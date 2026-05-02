// ============================================================
// Reconnect-path coverage for the Socket.IO signaling client:
// the second `connect` event triggers registered reconnect handlers,
// and offReconnect properly removes them.
// ============================================================

import {
  SocketIoSignalingClient,
  type TypedSocket,
} from '@/infrastructure/signaling/socketio-signaling.client';

interface FakeSocket {
  connected: boolean;
  listeners: Record<string, Array<(...a: unknown[]) => void>>;
  socket: TypedSocket;
  dispatch: (event: string, ...args: unknown[]) => void;
}

function createFakeSocket(): FakeSocket {
  const f: FakeSocket = {
    connected: false,
    listeners: {},
    socket: {} as TypedSocket,
    dispatch: () => undefined,
  };
  f.dispatch = (event, ...args): void => {
    (f.listeners[event] ?? []).forEach((fn) => fn(...args));
  };
  f.socket = {
    get connected() {
      return f.connected;
    },
    connect: () => {
      f.connected = true;
      f.dispatch('connect');
    },
    disconnect: () => {
      f.connected = false;
      f.dispatch('disconnect');
    },
    emit: () => undefined,
    on: (event: string, handler: (...a: unknown[]) => void) => {
      (f.listeners[event] ??= []).push(handler);
    },
    off: (event: string, handler?: (...a: unknown[]) => void) => {
      if (!handler) {
        f.listeners[event] = [];
        return;
      }
      f.listeners[event] = (f.listeners[event] ?? []).filter((h) => h !== handler);
    },
    once: () => undefined,
  } as unknown as TypedSocket;
  return f;
}

describe('SocketIoSignalingClient — reconnect handlers', () => {
  it('registers a "connect" listener on the socket immediately', () => {
    const fake = createFakeSocket();
    new SocketIoSignalingClient({
      url: 'http://x',
      socketFactory: () => fake.socket,
    });
    expect(fake.listeners.connect).toHaveLength(1);
  });

  it('does not invoke reconnect handlers on the very first connect', () => {
    const fake = createFakeSocket();
    const client = new SocketIoSignalingClient({
      url: 'http://x',
      socketFactory: () => fake.socket,
    });
    const handler = jest.fn();
    client.onReconnect(handler);

    fake.dispatch('connect');
    expect(handler).not.toHaveBeenCalled();
  });

  it('invokes reconnect handlers on each subsequent connect (simulated drop + reconnect)', () => {
    const fake = createFakeSocket();
    const client = new SocketIoSignalingClient({
      url: 'http://x',
      socketFactory: () => fake.socket,
    });
    const handler = jest.fn();
    client.onReconnect(handler);

    // First connect = bootstrap.
    fake.dispatch('connect');
    // Drop and reconnect.
    fake.dispatch('disconnect');
    fake.dispatch('connect');
    expect(handler).toHaveBeenCalledTimes(1);

    // Another flap.
    fake.dispatch('disconnect');
    fake.dispatch('connect');
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('offReconnect removes the handler', () => {
    const fake = createFakeSocket();
    const client = new SocketIoSignalingClient({
      url: 'http://x',
      socketFactory: () => fake.socket,
    });
    const handler = jest.fn();
    client.onReconnect(handler);
    fake.dispatch('connect'); // bootstrap
    client.offReconnect(handler);
    fake.dispatch('connect'); // would-be reconnect
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple independent reconnect handlers', () => {
    const fake = createFakeSocket();
    const client = new SocketIoSignalingClient({
      url: 'http://x',
      socketFactory: () => fake.socket,
    });
    const a = jest.fn();
    const b = jest.fn();
    client.onReconnect(a);
    client.onReconnect(b);
    fake.dispatch('connect');
    fake.dispatch('connect');
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
