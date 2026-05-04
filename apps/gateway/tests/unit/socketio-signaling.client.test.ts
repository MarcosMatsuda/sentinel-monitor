import { SocketIoSignalingClient } from '../../src/infrastructure/signaling/socketio-signaling.client';

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

class FakeSocket {
  public id = 'sock-fake';
  public connected = false;
  public emitted: Array<{ event: string; payload: unknown }> = [];
  public removedAll = false;
  public disconnected = false;
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  private onceListeners = new Map<string, Array<(...args: unknown[]) => void>>();

  emit(event: string, payload: unknown): void {
    this.emitted.push({ event, payload });
  }
  on(event: string, cb: (...args: unknown[]) => void): void {
    const list = this.listeners.get(event) ?? [];
    list.push(cb);
    this.listeners.set(event, list);
  }
  once(event: string, cb: (...args: unknown[]) => void): void {
    const list = this.onceListeners.get(event) ?? [];
    list.push(cb);
    this.onceListeners.set(event, list);
  }
  off(event: string, cb: (...args: unknown[]) => void): void {
    const list = this.listeners.get(event) ?? [];
    const idx = list.indexOf(cb);
    if (idx >= 0) list.splice(idx, 1);
    const onceList = this.onceListeners.get(event) ?? [];
    const onceIdx = onceList.indexOf(cb);
    if (onceIdx >= 0) onceList.splice(onceIdx, 1);
  }
  removeAllListeners(): void {
    this.removedAll = true;
    this.listeners.clear();
    this.onceListeners.clear();
  }
  disconnect(): void {
    this.disconnected = true;
    this.connected = false;
  }
  fire(event: string, ...args: unknown[]): void {
    for (const cb of this.listeners.get(event) ?? []) cb(...args);
    for (const cb of this.onceListeners.get(event) ?? []) cb(...args);
    this.onceListeners.set(event, []);
  }
}

describe('SocketIoSignalingClient', () => {
  let fakeSocket: FakeSocket;
  let client: SocketIoSignalingClient;

  beforeEach(() => {
    fakeSocket = new FakeSocket();
    silentLogger.child.mockReturnValue(silentLogger);
    client = new SocketIoSignalingClient({
      logger: silentLogger,
      socketFactory: () => fakeSocket as unknown as Parameters<typeof Object>[0] as never,
    });
  });

  describe('connect', () => {
    it('resolves when socket emits connect', async () => {
      const promise = client.connect('http://localhost:3010');
      fakeSocket.fire('connect');
      await expect(promise).resolves.toBeUndefined();
    });

    it('rejects when socket emits connect_error', async () => {
      const promise = client.connect('http://localhost:3010');
      fakeSocket.fire('connect_error', new Error('refused'));
      await expect(promise).rejects.toThrow('refused');
    });
  });

  describe('registerPresence', () => {
    it('emits register-presence with role:camera', async () => {
      const p = client.connect('http://x');
      fakeSocket.fire('connect');
      await p;

      client.registerPresence('cam-1');
      expect(fakeSocket.emitted).toContainEqual({
        event: 'register-presence',
        payload: { peerId: 'cam-1', role: 'camera' },
      });
    });

    it('throws when called before connect', () => {
      expect(() => client.registerPresence('cam-1')).toThrow(/not connected/);
    });
  });

  describe('sendSignal', () => {
    it('emits signal event with the payload', async () => {
      const p = client.connect('http://x');
      fakeSocket.fire('connect');
      await p;

      const dto = {
        fromPeerId: 'cam-1',
        toPeerId: 'dash-1',
        payload: { type: 'answer' as const, sdp: 'v=0' },
      };
      client.sendSignal(dto);
      expect(fakeSocket.emitted).toContainEqual({ event: 'signal', payload: dto });
    });

    it('drops the signal silently when not connected (logged at debug)', () => {
      client.sendSignal({
        fromPeerId: 'cam-1',
        toPeerId: 'dash-1',
        payload: { type: 'answer', sdp: 'v=0' },
      });
      expect(silentLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'signaling.send_dropped_no_socket' }),
        expect.any(String),
      );
    });
  });

  describe('listeners', () => {
    it('forwards signal events to onSignal handler', async () => {
      const handler = jest.fn();
      client.onSignal(handler);
      const p = client.connect('http://x');
      fakeSocket.fire('connect');
      await p;

      const dto = {
        fromPeerId: 'dash-1',
        toPeerId: 'cam-1',
        payload: { type: 'offer' as const, sdp: 'v=0' },
      };
      fakeSocket.fire('signal', dto);
      expect(handler).toHaveBeenCalledWith(dto);
    });

    it('forwards presence-change events to onPresenceChange handler', async () => {
      const handler = jest.fn();
      client.onPresenceChange(handler);
      const p = client.connect('http://x');
      fakeSocket.fire('connect');
      await p;

      fakeSocket.fire('presence-change', { peerId: 'dash-1', online: false });
      expect(handler).toHaveBeenCalledWith({ peerId: 'dash-1', online: false });
    });
  });

  describe('disconnect', () => {
    it('removes listeners and disconnects the socket', async () => {
      const p = client.connect('http://x');
      fakeSocket.fire('connect');
      await p;
      await client.disconnect();
      expect(fakeSocket.removedAll).toBe(true);
      expect(fakeSocket.disconnected).toBe(true);
    });

    it('is a no-op when not connected', async () => {
      await expect(client.disconnect()).resolves.toBeUndefined();
    });
  });
});
