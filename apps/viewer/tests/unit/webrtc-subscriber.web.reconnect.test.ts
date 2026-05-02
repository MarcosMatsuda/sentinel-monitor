// ============================================================
// Reconnect-path coverage for the browser WebRTC subscriber:
// ICE restart on `iceconnectionstate === 'disconnected'`,
// debounced so a flapping connection does not trigger a loop.
// ============================================================

import {
  BrowserWebRtcSubscriber,
  type PeerFactory,
} from '@/infrastructure/webrtc/webrtc-subscriber.web';
import type { SignalPayload } from '@sentinel-monitor/shared-types';

interface FakePeerConnection {
  iceConnectionState: RTCIceConnectionState;
  connectionState: RTCPeerConnectionState;
  oniceconnectionstatechange: (() => void) | null;
  onconnectionstatechange: (() => void) | null;
  ontrack: ((e: RTCTrackEvent) => void) | null;
  onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null;
  restartIce: jest.Mock;
  createOffer: jest.Mock;
  setLocalDescription: jest.Mock;
  setRemoteDescription: jest.Mock;
  addIceCandidate: jest.Mock;
  addTransceiver: jest.Mock;
  close: jest.Mock;
  // Test helper: trip the ICE state.
  __tripIce(state: RTCIceConnectionState): void;
}

function createFakePeer(): FakePeerConnection {
  const fake: FakePeerConnection = {
    iceConnectionState: 'new',
    connectionState: 'new',
    oniceconnectionstatechange: null,
    onconnectionstatechange: null,
    ontrack: null,
    onicecandidate: null,
    restartIce: jest.fn(),
    createOffer: jest.fn(async (opts?: RTCOfferOptions) => ({
      type: 'offer' as RTCSdpType,
      sdp: opts?.iceRestart ? 'v=0-restart' : 'v=0',
    })),
    setLocalDescription: jest.fn(async () => undefined),
    setRemoteDescription: jest.fn(async () => undefined),
    addIceCandidate: jest.fn(async () => undefined),
    addTransceiver: jest.fn(),
    close: jest.fn(),
    __tripIce(state) {
      fake.iceConnectionState = state;
      fake.oniceconnectionstatechange?.();
    },
  };
  return fake;
}

function buildSubscriber(opts: {
  emitted: SignalPayload[];
  fake: FakePeerConnection;
  now?: () => number;
  intervalMs?: number;
}): BrowserWebRtcSubscriber {
  const factory: PeerFactory = () => opts.fake as unknown as RTCPeerConnection;
  return new BrowserWebRtcSubscriber({
    emitSignal: (p) => opts.emitted.push(p),
    peerFactory: factory,
    iceRestartMinIntervalMs: opts.intervalMs,
    now: opts.now,
  });
}

describe('BrowserWebRtcSubscriber — ICE reconnect path', () => {
  it('calls restartIce + emits a fresh iceRestart offer when ICE goes disconnected', async () => {
    const fake = createFakePeer();
    const emitted: SignalPayload[] = [];
    let t = 0;
    buildSubscriber({ emitted, fake, now: () => t, intervalMs: 5_000 });

    fake.__tripIce('disconnected');
    // Drain microtasks so the async restart finishes.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(fake.restartIce).toHaveBeenCalledTimes(1);
    expect(fake.createOffer).toHaveBeenCalledWith({ iceRestart: true });
    expect(fake.setLocalDescription).toHaveBeenCalledTimes(1);
    expect(emitted).toEqual([{ type: 'offer', sdp: 'v=0-restart' }]);
  });

  it('debounces consecutive ICE disconnects within the min interval', async () => {
    const fake = createFakePeer();
    const emitted: SignalPayload[] = [];
    let t = 1_000;
    buildSubscriber({ emitted, fake, now: () => t, intervalMs: 5_000 });

    fake.__tripIce('disconnected');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.restartIce).toHaveBeenCalledTimes(1);

    // Bounce again only 1s later — must be debounced.
    t = 2_000;
    fake.__tripIce('disconnected');
    await Promise.resolve();
    expect(fake.restartIce).toHaveBeenCalledTimes(1);
    expect(emitted).toHaveLength(1);
  });

  it('allows a second restart once the min interval has elapsed', async () => {
    const fake = createFakePeer();
    const emitted: SignalPayload[] = [];
    let t = 0;
    buildSubscriber({ emitted, fake, now: () => t, intervalMs: 5_000 });

    fake.__tripIce('disconnected');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.restartIce).toHaveBeenCalledTimes(1);

    t = 10_000;
    fake.__tripIce('disconnected');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(fake.restartIce).toHaveBeenCalledTimes(2);
    expect(emitted).toHaveLength(2);
  });

  it('ignores ICE state changes other than "disconnected"', async () => {
    const fake = createFakePeer();
    const emitted: SignalPayload[] = [];
    buildSubscriber({ emitted, fake });
    fake.__tripIce('connected');
    fake.__tripIce('checking');
    fake.__tripIce('completed');
    await Promise.resolve();
    expect(fake.restartIce).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(0);
  });

  it('does not restart when the subscriber has been closed', async () => {
    const fake = createFakePeer();
    const emitted: SignalPayload[] = [];
    const sub = buildSubscriber({ emitted, fake });
    sub.close();
    fake.__tripIce('disconnected');
    await Promise.resolve();
    expect(fake.restartIce).not.toHaveBeenCalled();
  });

  it('swallows restart errors via the warn channel and does not throw', async () => {
    const fake = createFakePeer();
    fake.createOffer = jest.fn(async () => {
      throw new Error('boom');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const emitted: SignalPayload[] = [];
    buildSubscriber({ emitted, fake });

    fake.__tripIce('disconnected');
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(warn).toHaveBeenCalled();
    expect(emitted).toHaveLength(0);
    warn.mockRestore();
  });

  it('does not run a second restart while one is already in-flight', async () => {
    const fake = createFakePeer();
    const releaseRef: { fn: (() => void) | null } = { fn: null };
    fake.createOffer = jest.fn(
      () =>
        new Promise<RTCSessionDescriptionInit>((resolve) => {
          releaseRef.fn = (): void =>
            resolve({ type: 'offer' as RTCSdpType, sdp: 'v=0-restart' });
        }),
    );
    const emitted: SignalPayload[] = [];
    let t = 0;
    buildSubscriber({ emitted, fake, now: () => t, intervalMs: 1 });

    fake.__tripIce('disconnected');
    await Promise.resolve();
    expect(fake.restartIce).toHaveBeenCalledTimes(1);

    // Even though enough time has elapsed, a second trip should be ignored
    // until the in-flight restart resolves.
    t = 500;
    fake.__tripIce('disconnected');
    await Promise.resolve();
    expect(fake.restartIce).toHaveBeenCalledTimes(1);

    // Resolve the pending restart.
    releaseRef.fn?.();
    await Promise.resolve();
    await Promise.resolve();
    expect(emitted).toHaveLength(1);
  });
});
