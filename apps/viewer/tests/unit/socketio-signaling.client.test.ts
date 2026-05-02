import {
  SocketIoSignalingClient,
  type TypedSocket,
} from '@/infrastructure/signaling/socketio-signaling.client';
import type {
  PairingErrorDto,
  PairingRedeemedDto,
  PresenceChangeDto,
  PresenceSnapshotDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';

interface FakeSocket {
  connected: boolean;
  emitted: Array<{ event: string; args: unknown[] }>;
  listeners: Record<string, Array<(...a: unknown[]) => void>>;
  onceListeners: Record<string, Array<(...a: unknown[]) => void>>;
  socket: TypedSocket;
}

function createFakeSocket(): FakeSocket {
  const f: FakeSocket = {
    connected: false,
    emitted: [],
    listeners: {},
    onceListeners: {},
    socket: {} as TypedSocket,
  };

  const dispatch = (event: string, ...args: unknown[]): void => {
    (f.listeners[event] ?? []).forEach((fn) => fn(...args));
    const once = f.onceListeners[event] ?? [];
    f.onceListeners[event] = [];
    once.forEach((fn) => fn(...args));
  };

  f.socket = {
    get connected() {
      return f.connected;
    },
    connect: () => {
      // emulate async connect
      setTimeout(() => {
        f.connected = true;
        dispatch('connect');
      }, 0);
    },
    disconnect: () => {
      f.connected = false;
    },
    emit: (event: string, ...args: unknown[]) => {
      f.emitted.push({ event, args });
    },
    on: (event: string, handler: (...a: unknown[]) => void) => {
      (f.listeners[event] ??= []).push(handler);
    },
    off: (event: string, handler?: (...a: unknown[]) => void) => {
      if (!handler) {
        f.listeners[event] = [];
        return;
      }
      f.listeners[event] = (f.listeners[event] ?? []).filter(
        (h) => h !== handler,
      );
    },
    once: (event: string, handler: (...a: unknown[]) => void) => {
      (f.onceListeners[event] ??= []).push(handler);
    },
    // Test helper
    __dispatch: dispatch,
    __failConnect: (err: Error) => {
      setTimeout(() => dispatch('connect_error', err), 0);
    },
  } as unknown as TypedSocket;
  return f;
}

function buildClient(fake: FakeSocket): SocketIoSignalingClient {
  return new SocketIoSignalingClient({
    url: 'http://localhost:0',
    socketFactory: () => fake.socket,
  });
}

describe('SocketIoSignalingClient', () => {
  it('uses the provided socketFactory with the configured URL', () => {
    const fake = createFakeSocket();
    let received = '';
    const client = new SocketIoSignalingClient({
      url: 'http://server:1234',
      socketFactory: (url) => {
        received = url;
        return fake.socket;
      },
    });
    expect(client).toBeDefined();
    expect(received).toBe('http://server:1234');
  });

  it('connect() resolves when the socket emits "connect"', async () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    await client.connect();
    expect(fake.connected).toBe(true);
    expect(client.isConnected()).toBe(true);
  });

  it('connect() resolves immediately when already connected', async () => {
    const fake = createFakeSocket();
    fake.connected = true;
    const client = buildClient(fake);
    await client.connect(); // should not hang
  });

  it('connect() rejects when the socket emits "connect_error"', async () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    const err = new Error('fail');
    setTimeout(
      () =>
        (
          fake.socket as unknown as { __dispatch: (e: string, p: Error) => void }
        ).__dispatch('connect_error', err),
      0,
    );
    await expect(client.connect()).rejects.toBe(err);
  });

  it('disconnect() forwards to the underlying socket', () => {
    const fake = createFakeSocket();
    fake.connected = true;
    const client = buildClient(fake);
    client.disconnect();
    expect(fake.connected).toBe(false);
  });

  it('registerPresence emits with role "dashboard"', () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    client.registerPresence('dash-1');
    expect(fake.emitted).toEqual([
      { event: 'register-presence', args: [{ peerId: 'dash-1', role: 'dashboard' }] },
    ]);
  });

  it('redeemPairingCode emits the payload and resolves with success', async () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    const promise = client.redeemPairingCode('CODE', 'dash-1');
    expect(fake.emitted[0]!.event).toBe('redeem-pairing-code');
    expect(fake.emitted[0]!.args[0]).toEqual({ code: 'CODE', dashboardId: 'dash-1' });
    const ack = fake.emitted[0]!.args[1] as (
      r: PairingRedeemedDto | PairingErrorDto,
    ) => void;
    ack({ cameraId: 'cam-1', dashboardId: 'dash-1' });
    const result = await promise;
    expect(result).toEqual({
      success: true,
      data: { cameraId: 'cam-1', dashboardId: 'dash-1' },
    });
  });

  it('redeemPairingCode resolves with error on PairingErrorDto', async () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    const promise = client.redeemPairingCode('CODE', 'dash-1');
    const ack = fake.emitted[0]!.args[1] as (
      r: PairingRedeemedDto | PairingErrorDto,
    ) => void;
    ack({ code: 'NOT_FOUND', message: 'no match' });
    const result = await promise;
    expect(result).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'no match' },
    });
  });

  it('queryPresence emits and resolves with the snapshot', async () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    const p = client.queryPresence(['a', 'b']);
    expect(fake.emitted[0]!.event).toBe('query-presence');
    expect(fake.emitted[0]!.args[0]).toEqual({ peerIds: ['a', 'b'] });
    const ack = fake.emitted[0]!.args[1] as (r: PresenceSnapshotDto) => void;
    ack({ online: ['a'] });
    await expect(p).resolves.toEqual({ online: ['a'] });
  });

  it('subscribePresence emits with peerIds payload', () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    client.subscribePresence(['a', 'b']);
    expect(fake.emitted).toEqual([
      { event: 'subscribe-presence', args: [{ peerIds: ['a', 'b'] }] },
    ]);
  });

  it('sendSignal emits the SignalDto verbatim', () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    const signal: SignalDto = {
      fromPeerId: 'a',
      toPeerId: 'b',
      payload: { type: 'offer', sdp: 'v=0' },
    };
    client.sendSignal(signal);
    expect(fake.emitted).toEqual([{ event: 'signal', args: [signal] }]);
  });

  it('onSignal/offSignal subscribe and unsubscribe to "signal"', () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    const received: SignalDto[] = [];
    const handler = (s: SignalDto): void => {
      received.push(s);
    };
    client.onSignal(handler);
    expect(fake.listeners.signal).toHaveLength(1);

    const dispatch = (
      fake.socket as unknown as { __dispatch: (e: string, p: SignalDto) => void }
    ).__dispatch;
    const dto: SignalDto = {
      fromPeerId: 'a',
      toPeerId: 'b',
      payload: { type: 'answer', sdp: 'x' },
    };
    dispatch('signal', dto);
    expect(received).toEqual([dto]);

    client.offSignal(handler);
    expect(fake.listeners.signal).toHaveLength(0);
  });

  it('onPresenceChange/offPresenceChange subscribe and unsubscribe', () => {
    const fake = createFakeSocket();
    const client = buildClient(fake);
    const got: PresenceChangeDto[] = [];
    const handler = (c: PresenceChangeDto): void => {
      got.push(c);
    };
    client.onPresenceChange(handler);
    expect(fake.listeners['presence-change']).toHaveLength(1);

    const dispatch = (
      fake.socket as unknown as {
        __dispatch: (e: string, p: PresenceChangeDto) => void;
      }
    ).__dispatch;
    dispatch('presence-change', { peerId: 'cam', online: true });
    expect(got).toEqual([{ peerId: 'cam', online: true }]);

    client.offPresenceChange(handler);
    expect(fake.listeners['presence-change']).toHaveLength(0);
  });
});
