import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { Server, type Socket as ServerSocket } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
  PairingCodeIssuedDto,
  PairingErrorDto,
  PairingRedeemedDto,
  PresenceChangeDto,
  PresenceSnapshotDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';

import { InMemoryPairingCodeRepository } from '../../src/data/repositories/in-memory-pairing-code.repository';
import { InMemoryPeerPresenceRepository } from '../../src/data/repositories/in-memory-peer-presence.repository';
import { GeneratePairingCodeUseCase } from '../../src/domain/use-cases/generate-pairing-code.use-case';
import { HandleDisconnectUseCase } from '../../src/domain/use-cases/handle-disconnect.use-case';
import { RedeemPairingCodeUseCase } from '../../src/domain/use-cases/redeem-pairing-code.use-case';
import { RegisterPresenceUseCase } from '../../src/domain/use-cases/register-presence.use-case';
import { RouteSignalUseCase } from '../../src/domain/use-cases/route-signal.use-case';
import { SocketHandler } from '../../src/presentation/handlers/socket.handler';

type TypedClient = ClientSocket<IServerToClientEvents, IClientToServerEvents>;

interface ITestRig {
  httpServer: HttpServer;
  io: Server<IClientToServerEvents, IServerToClientEvents>;
  port: number;
  presence: InMemoryPeerPresenceRepository;
  pairing: InMemoryPairingCodeRepository;
}

async function setupRig(): Promise<ITestRig> {
  const presence = new InMemoryPeerPresenceRepository();
  const pairing = new InMemoryPairingCodeRepository();
  const handler = new SocketHandler({
    registerPresence: new RegisterPresenceUseCase(presence),
    generatePairingCode: new GeneratePairingCodeUseCase(pairing),
    redeemPairingCode: new RedeemPairingCodeUseCase(pairing),
    routeSignal: new RouteSignalUseCase(presence),
    handleDisconnect: new HandleDisconnectUseCase(presence),
    presence,
  });

  const httpServer = createServer();
  const io = new Server<IClientToServerEvents, IServerToClientEvents>(httpServer);
  handler.register(io);

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const port = (httpServer.address() as AddressInfo).port;
  return { httpServer, io, port, presence, pairing };
}

async function tearDown(rig: ITestRig, clients: TypedClient[]): Promise<void> {
  for (const c of clients) c.disconnect();
  await new Promise<void>((resolve) => rig.io.close(() => resolve()));
  await new Promise<void>((resolve) => rig.httpServer.close(() => resolve()));
}

function connectClient(port: number): Promise<TypedClient> {
  const client = createClient(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    forceNew: true,
  }) as TypedClient;
  return new Promise((resolve, reject) => {
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}

describe('SocketHandler (integration)', () => {
  let rig: ITestRig;
  let clients: TypedClient[];

  beforeEach(async () => {
    rig = await setupRig();
    clients = [];
  });

  afterEach(async () => {
    await tearDown(rig, clients);
  });

  it('register-presence stores the peer in the repository', async () => {
    const cam = await connectClient(rig.port);
    clients.push(cam);
    cam.emit('register-presence', { peerId: 'cam-1', role: 'camera' });
    await new Promise((r) => setTimeout(r, 30));
    expect(rig.presence.isOnline('cam-1')).toBe(true);
  });

  it('subscribe-presence then register-presence pushes presence-change to subscriber', async () => {
    const dashboard = await connectClient(rig.port);
    const cam = await connectClient(rig.port);
    clients.push(dashboard, cam);

    const change = new Promise<PresenceChangeDto>((resolve) => {
      dashboard.once('presence-change', (data) => resolve(data));
    });

    dashboard.emit('subscribe-presence', { peerIds: ['cam-1'] });
    await new Promise((r) => setTimeout(r, 30));
    cam.emit('register-presence', { peerId: 'cam-1', role: 'camera' });

    const data = await change;
    expect(data).toEqual({ peerId: 'cam-1', online: true });
  });

  it('disconnect of a registered camera emits presence-change online:false to subscribers', async () => {
    const dashboard = await connectClient(rig.port);
    const cam = await connectClient(rig.port);
    clients.push(dashboard);

    dashboard.emit('subscribe-presence', { peerIds: ['cam-7'] });
    await new Promise((r) => setTimeout(r, 30));
    cam.emit('register-presence', { peerId: 'cam-7', role: 'camera' });
    await new Promise((r) => setTimeout(r, 30));

    const offline = new Promise<PresenceChangeDto>((resolve) => {
      dashboard.on('presence-change', (data) => {
        if (!data.online) resolve(data);
      });
    });

    cam.disconnect();
    const data = await offline;
    expect(data).toEqual({ peerId: 'cam-7', online: false });
  });

  it('request-pairing-code acks with code and expiry', async () => {
    const cam = await connectClient(rig.port);
    clients.push(cam);
    const issued = await new Promise<PairingCodeIssuedDto>((resolve) => {
      cam.emit('request-pairing-code', { cameraId: 'cam-1' }, (response) => resolve(response));
    });
    expect(issued.code).toMatch(/^[A-Z0-9]{6}$/);
    expect(issued.expiresAt).toBeGreaterThan(Date.now());
  });

  it('redeem-pairing-code acks success and pushes pairing-redeemed to camera', async () => {
    const cam = await connectClient(rig.port);
    const dashboard = await connectClient(rig.port);
    clients.push(cam, dashboard);

    cam.emit('register-presence', { peerId: 'cam-1', role: 'camera' });
    await new Promise((r) => setTimeout(r, 30));

    const issued = await new Promise<PairingCodeIssuedDto>((resolve) => {
      cam.emit('request-pairing-code', { cameraId: 'cam-1' }, resolve);
    });

    const redeemedToCam = new Promise<PairingRedeemedDto>((resolve) => {
      cam.once('pairing-redeemed', resolve);
    });

    const ack = await new Promise<PairingRedeemedDto | PairingErrorDto>((resolve) => {
      dashboard.emit(
        'redeem-pairing-code',
        { code: issued.code, dashboardId: 'dash-1' },
        resolve,
      );
    });

    expect(ack).toEqual({ cameraId: 'cam-1', dashboardId: 'dash-1' });
    const pushed = await redeemedToCam;
    expect(pushed).toEqual({ cameraId: 'cam-1', dashboardId: 'dash-1' });
  });

  it('redeem-pairing-code with unknown code acks error', async () => {
    const dashboard = await connectClient(rig.port);
    clients.push(dashboard);
    const ack = await new Promise<PairingRedeemedDto | PairingErrorDto>((resolve) => {
      dashboard.emit(
        'redeem-pairing-code',
        { code: 'UNKNOWN', dashboardId: 'dash-1' },
        resolve,
      );
    });
    expect(ack).toEqual({ code: 'NOT_FOUND', message: expect.any(String) });
  });

  it('query-presence returns only online peers from the requested set', async () => {
    const cam = await connectClient(rig.port);
    const dashboard = await connectClient(rig.port);
    clients.push(cam, dashboard);

    cam.emit('register-presence', { peerId: 'cam-1', role: 'camera' });
    await new Promise((r) => setTimeout(r, 30));

    const snapshot = await new Promise<PresenceSnapshotDto>((resolve) => {
      dashboard.emit('query-presence', { peerIds: ['cam-1', 'cam-2'] }, resolve);
    });
    expect(snapshot.online).toEqual(['cam-1']);
  });

  it('signal forwards payload from one peer to another and is silent when offline', async () => {
    const a = await connectClient(rig.port);
    const b = await connectClient(rig.port);
    clients.push(a, b);

    a.emit('register-presence', { peerId: 'peer-a', role: 'camera' });
    b.emit('register-presence', { peerId: 'peer-b', role: 'dashboard' });
    await new Promise((r) => setTimeout(r, 30));

    const received = new Promise<SignalDto>((resolve) => {
      b.once('signal', resolve);
    });

    const dto: SignalDto = {
      fromPeerId: 'peer-a',
      toPeerId: 'peer-b',
      payload: { type: 'offer', sdp: 'v=0' },
    };
    a.emit('signal', dto);
    const got = await received;
    expect(got).toEqual(dto);

    // Silently drops to offline recipient — assert no error surfaces.
    const offlineDto: SignalDto = {
      fromPeerId: 'peer-a',
      toPeerId: 'ghost',
      payload: { type: 'answer', sdp: 'v=0' },
    };
    a.emit('signal', offlineDto);
    await new Promise((r) => setTimeout(r, 30));
    expect(rig.presence.isOnline('ghost')).toBe(false);
  });

  it('subscribe-presence is additive across multiple calls', async () => {
    const dashboard = await connectClient(rig.port);
    const cam1 = await connectClient(rig.port);
    const cam2 = await connectClient(rig.port);
    clients.push(dashboard, cam1, cam2);

    dashboard.emit('subscribe-presence', { peerIds: ['cam-A'] });
    dashboard.emit('subscribe-presence', { peerIds: ['cam-B'] });
    await new Promise((r) => setTimeout(r, 30));

    const seen: PresenceChangeDto[] = [];
    dashboard.on('presence-change', (d) => {
      if (d.online) seen.push(d);
    });

    cam1.emit('register-presence', { peerId: 'cam-A', role: 'camera' });
    cam2.emit('register-presence', { peerId: 'cam-B', role: 'camera' });
    await new Promise((r) => setTimeout(r, 60));

    expect(seen.map((s) => s.peerId).sort()).toEqual(['cam-A', 'cam-B']);
  });

  it('disconnect of an unregistered socket emits no presence-change', async () => {
    const dashboard = await connectClient(rig.port);
    const stranger = await connectClient(rig.port);
    clients.push(dashboard);

    dashboard.emit('subscribe-presence', { peerIds: ['anyone'] });
    await new Promise((r) => setTimeout(r, 30));

    let received = false;
    dashboard.on('presence-change', () => {
      received = true;
    });
    stranger.disconnect();
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toBe(false);
  });
});
