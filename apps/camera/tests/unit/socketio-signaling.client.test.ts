import { describe, expect, test, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { SocketIoSignalingClient } from '../../src/infrastructure/signaling/socketio-signaling.client';
import { FakeSocket } from '../helpers/fake-socket';

const buildClient = (): { client: SocketIoSignalingClient; socket: FakeSocket } => {
  const socket = new FakeSocket();
  const client = new SocketIoSignalingClient({
    url: 'http://test',
    socketFactory: () => socket as unknown as Socket,
  });
  return { client, socket };
};

describe('SocketIoSignalingClient', () => {
  test('connect resolves when the underlying socket fires `connect`', async () => {
    const { client, socket } = buildClient();
    const promise = client.connect();
    expect(socket.connectCalls).toBe(1);
    socket.fire('connect');
    await expect(promise).resolves.toBeUndefined();
  });

  test('connect rejects when the underlying socket fires `connect_error`', async () => {
    const { client, socket } = buildClient();
    const promise = client.connect();
    socket.fire('connect_error', new Error('boom'));
    await expect(promise).rejects.toThrow('boom');
  });

  test('connect short-circuits when already connected', async () => {
    const { client, socket } = buildClient();
    socket.connected = true;
    await expect(client.connect()).resolves.toBeUndefined();
    expect(socket.connectCalls).toBe(0);
  });

  test('disconnect proxies to the underlying socket', () => {
    const { client, socket } = buildClient();
    client.disconnect();
    expect(socket.disconnectCalls).toBe(1);
  });

  test('isConnected reflects the socket state', () => {
    const { client, socket } = buildClient();
    expect(client.isConnected()).toBe(false);
    socket.connected = true;
    expect(client.isConnected()).toBe(true);
  });

  test('registerPresence emits with role camera', () => {
    const { client, socket } = buildClient();
    client.registerPresence('cam-1');
    expect(socket.emitted[0]).toEqual({
      event: 'register-presence',
      args: [{ peerId: 'cam-1', role: 'camera' }],
    });
  });

  test('requestPairingCode emits the request and resolves with the ack payload', async () => {
    const { client, socket } = buildClient();
    socket.ackResponses['request-pairing-code'] = { code: 'AB12CD', expiresAt: 999 };
    const result = await client.requestPairingCode('cam-1');
    expect(result).toEqual({ code: 'AB12CD', expiresAt: 999 });
    expect(socket.emitted[0]?.event).toBe('request-pairing-code');
    const args = socket.emitted[0]?.args;
    expect(args?.[0]).toEqual({ cameraId: 'cam-1' });
  });

  test('sendSignal emits a signal event with the payload', () => {
    const { client, socket } = buildClient();
    client.sendSignal({
      fromPeerId: 'cam',
      toPeerId: 'dash',
      payload: { type: 'answer', sdp: 'v=0' },
    });
    expect(socket.emitted[0]?.event).toBe('signal');
  });

  test('onSignal subscribes to incoming signal events', () => {
    const { client, socket } = buildClient();
    const handler = vi.fn();
    client.onSignal(handler);
    socket.fire('signal', {
      fromPeerId: 'dash',
      toPeerId: 'cam',
      payload: { type: 'offer', sdp: 'v=0' },
    });
    expect(handler).toHaveBeenCalledOnce();
  });

  test('onPairingRedeemed subscribes to pairing-redeemed events', () => {
    const { client, socket } = buildClient();
    const handler = vi.fn();
    client.onPairingRedeemed(handler);
    socket.fire('pairing-redeemed', { cameraId: 'cam', dashboardId: 'dash' });
    expect(handler).toHaveBeenCalledWith({ cameraId: 'cam', dashboardId: 'dash' });
  });
});
