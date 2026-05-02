import { createServer, type Server as HttpServer } from 'http';
import type { AddressInfo } from 'net';
import { Server } from 'socket.io';
import { io as createClient, type Socket as ClientSocket } from 'socket.io-client';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
  PairingCodeIssuedDto,
} from '@sentinel-monitor/shared-types';

import { InMemoryPairingCodeRepository } from '../../src/data/repositories/in-memory-pairing-code.repository';
import { InMemoryPeerPresenceRepository } from '../../src/data/repositories/in-memory-peer-presence.repository';
import { GeneratePairingCodeUseCase } from '../../src/domain/use-cases/generate-pairing-code.use-case';
import { HandleDisconnectUseCase } from '../../src/domain/use-cases/handle-disconnect.use-case';
import { RedeemPairingCodeUseCase } from '../../src/domain/use-cases/redeem-pairing-code.use-case';
import { RegisterPresenceUseCase } from '../../src/domain/use-cases/register-presence.use-case';
import { RouteSignalUseCase } from '../../src/domain/use-cases/route-signal.use-case';
import type { ILogger } from '../../src/infrastructure/logging/logger';
import { SocketHandler } from '../../src/presentation/handlers/socket.handler';

type TypedClient = ClientSocket<IServerToClientEvents, IClientToServerEvents>;

interface ILoggedRecord {
  level: 'info' | 'warn' | 'error' | 'debug';
  payload: Record<string, unknown> | string;
  message?: string;
  bindings: Record<string, unknown>;
}

class RecordingLogger implements ILogger {
  constructor(
    public readonly records: ILoggedRecord[] = [],
    private readonly bindings: Record<string, unknown> = {},
  ) {}

  info(payload: Record<string, unknown> | string, message?: string): void {
    this.records.push({ level: 'info', payload, message, bindings: this.bindings });
  }
  warn(payload: Record<string, unknown> | string, message?: string): void {
    this.records.push({ level: 'warn', payload, message, bindings: this.bindings });
  }
  error(payload: Record<string, unknown> | string, message?: string): void {
    this.records.push({ level: 'error', payload, message, bindings: this.bindings });
  }
  debug(payload: Record<string, unknown> | string, message?: string): void {
    this.records.push({ level: 'debug', payload, message, bindings: this.bindings });
  }
  child(bindings: Record<string, unknown>): ILogger {
    return new RecordingLogger(this.records, { ...this.bindings, ...bindings });
  }
}

interface ITestRig {
  httpServer: HttpServer;
  io: Server<IClientToServerEvents, IServerToClientEvents>;
  port: number;
  logger: RecordingLogger;
}

async function setupRig(correlationId = 'corr-fixed'): Promise<ITestRig> {
  const presence = new InMemoryPeerPresenceRepository();
  const pairing = new InMemoryPairingCodeRepository();
  const logger = new RecordingLogger();
  const handler = new SocketHandler({
    registerPresence: new RegisterPresenceUseCase(presence),
    generatePairingCode: new GeneratePairingCodeUseCase(pairing),
    redeemPairingCode: new RedeemPairingCodeUseCase(pairing),
    routeSignal: new RouteSignalUseCase(presence),
    handleDisconnect: new HandleDisconnectUseCase(presence),
    presence,
    logger,
    correlationIdFactory: () => correlationId,
  });

  const httpServer = createServer();
  const io = new Server<IClientToServerEvents, IServerToClientEvents>(httpServer);
  handler.register(io);

  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const port = (httpServer.address() as AddressInfo).port;
  return { httpServer, io, port, logger };
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

describe('SocketHandler logging', () => {
  let rig: ITestRig;
  let clients: TypedClient[];

  beforeEach(async () => {
    rig = await setupRig();
    clients = [];
  });

  afterEach(async () => {
    await tearDown(rig, clients);
  });

  it('binds correlationId + socketId to all per-connection logs', async () => {
    const cam = await connectClient(rig.port);
    clients.push(cam);
    cam.emit('register-presence', { peerId: 'cam-1', role: 'camera' });
    await new Promise((r) => setTimeout(r, 30));

    const connectRecord = rig.logger.records.find(
      (r) => typeof r.payload === 'object' && r.payload.event === 'socket.connected',
    );
    expect(connectRecord).toBeDefined();
    expect(connectRecord!.bindings.correlationId).toBe('corr-fixed');
    expect(typeof connectRecord!.bindings.socketId).toBe('string');

    const presenceRecord = rig.logger.records.find(
      (r) => typeof r.payload === 'object' && r.payload.event === 'presence.registered',
    );
    expect(presenceRecord).toBeDefined();
    expect((presenceRecord!.payload as Record<string, unknown>).peerId).toBe('cam-1');
    expect((presenceRecord!.payload as Record<string, unknown>).role).toBe('camera');
    expect(presenceRecord!.bindings.correlationId).toBe('corr-fixed');
  });

  it('logs pairing.code_issued at info level with cameraId', async () => {
    const cam = await connectClient(rig.port);
    clients.push(cam);
    await new Promise<PairingCodeIssuedDto>((resolve) => {
      cam.emit('request-pairing-code', { cameraId: 'cam-9' }, resolve);
    });
    const issued = rig.logger.records.find(
      (r) => typeof r.payload === 'object' && r.payload.event === 'pairing.code_issued',
    );
    expect(issued).toBeDefined();
    expect(issued!.level).toBe('info');
    expect((issued!.payload as Record<string, unknown>).cameraId).toBe('cam-9');
  });

  it('logs pairing.redeem_failed at warn level when code is unknown', async () => {
    const dashboard = await connectClient(rig.port);
    clients.push(dashboard);
    await new Promise((resolve) => {
      dashboard.emit(
        'redeem-pairing-code',
        { code: 'UNKNOWN', dashboardId: 'dash-1' },
        resolve,
      );
    });
    const failed = rig.logger.records.find(
      (r) => typeof r.payload === 'object' && r.payload.event === 'pairing.redeem_failed',
    );
    expect(failed).toBeDefined();
    expect(failed!.level).toBe('warn');
    expect((failed!.payload as Record<string, unknown>).reason).toBe('NOT_FOUND');
  });

  it('logs socket.disconnected on disconnect', async () => {
    const cam = await connectClient(rig.port);
    cam.disconnect();
    await new Promise((r) => setTimeout(r, 60));
    const disc = rig.logger.records.find(
      (r) => typeof r.payload === 'object' && r.payload.event === 'socket.disconnected',
    );
    expect(disc).toBeDefined();
    expect(disc!.bindings.correlationId).toBe('corr-fixed');
  });
});
