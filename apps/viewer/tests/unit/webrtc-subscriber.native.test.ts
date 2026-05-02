// ============================================================
// Unit tests for the native subscriber. We mock react-native-webrtc
// so the file under test runs in jsdom without pulling any native
// modules. Lifecycle: createOffer -> emit signal, inbound answer ->
// setRemoteDescription, inbound ICE -> addIceCandidate, ontrack
// fires the registered handler, close() tears down + flips state.
// ============================================================

interface FakeIceCandidate {
  toJSON(): RTCIceCandidateInit;
}

interface FakePeer {
  connectionState: string;
  ontrack:
    | ((event: { streams: ReadonlyArray<unknown>; track: unknown }) => void)
    | null;
  onicecandidate:
    | ((event: { candidate: FakeIceCandidate | null }) => void)
    | null;
  onconnectionstatechange: (() => void) | null;
  transceivers: Array<{ kind: string; direction: string }>;
  localDescription: unknown;
  remoteDescription: unknown;
  iceCandidates: unknown[];
  closed: boolean;
  addTransceiver: jest.Mock;
  createOffer: jest.Mock;
  setLocalDescription: jest.Mock;
  setRemoteDescription: jest.Mock;
  addIceCandidate: jest.Mock;
  close: jest.Mock;
}

function createFakePeer(): FakePeer {
  const peer: FakePeer = {
    connectionState: 'new',
    ontrack: null,
    onicecandidate: null,
    onconnectionstatechange: null,
    transceivers: [],
    localDescription: null,
    remoteDescription: null,
    iceCandidates: [],
    closed: false,
    addTransceiver: jest.fn((kind: string, init: { direction: string }) => {
      peer.transceivers.push({ kind, direction: init.direction });
      return {};
    }),
    createOffer: jest.fn(async () => ({ type: 'offer', sdp: 'v=0\nfake-offer' })),
    setLocalDescription: jest.fn(async (desc: unknown) => {
      peer.localDescription = desc;
    }),
    setRemoteDescription: jest.fn(async (desc: unknown) => {
      peer.remoteDescription = desc;
    }),
    addIceCandidate: jest.fn(async (c: unknown) => {
      peer.iceCandidates.push(c);
    }),
    close: jest.fn(() => {
      peer.closed = true;
    }),
  };
  return peer;
}

jest.mock('react-native-webrtc', () => {
  return {
    RTCPeerConnection: jest.fn(),
    RTCSessionDescription: jest.fn().mockImplementation((init: unknown) => ({
      __sd: init,
    })),
    RTCIceCandidate: jest.fn().mockImplementation((init: unknown) => ({
      __ice: init,
    })),
  };
});

jest.mock('@sentinel-monitor/webrtc-config', () => ({
  WEBRTC_CONFIG: { iceServers: [] },
}));

import type { SignalPayload } from '@sentinel-monitor/shared-types';
import {
  NativeWebRtcSubscriber,
  type NativePeerFactory,
} from '@/infrastructure/webrtc/webrtc-subscriber.native';

describe('NativeWebRtcSubscriber', () => {
  let peer: FakePeer;
  let factory: NativePeerFactory;
  let emitted: SignalPayload[];

  beforeEach(() => {
    peer = createFakePeer();
    factory = ((): unknown => peer) as unknown as NativePeerFactory;
    emitted = [];
  });

  function build(): NativeWebRtcSubscriber {
    return new NativeWebRtcSubscriber({
      emitSignal: (p) => emitted.push(p),
      peerFactory: factory,
    });
  }

  it('starts in idle state', () => {
    const sub = build();
    expect(sub.getState()).toBe('idle');
  });

  it('connect() adds recvonly transceivers and emits the offer', async () => {
    const sub = build();
    await sub.connect('cam-1');

    expect(peer.transceivers).toEqual([
      { kind: 'video', direction: 'recvonly' },
      { kind: 'audio', direction: 'recvonly' },
    ]);
    expect(peer.createOffer).toHaveBeenCalledTimes(1);
    expect(peer.setLocalDescription).toHaveBeenCalledWith({
      type: 'offer',
      sdp: 'v=0\nfake-offer',
    });
    expect(emitted).toEqual([{ type: 'offer', sdp: 'v=0\nfake-offer' }]);
    expect(sub.getState()).toBe('connecting');
  });

  it('connect() emits an empty sdp when the engine omits it', async () => {
    peer.createOffer = jest.fn(async () => ({ type: 'offer' }));
    const sub = build();
    await sub.connect('cam-1');
    expect(emitted).toEqual([{ type: 'offer', sdp: '' }]);
  });

  it('handleIncomingSignal applies an inbound answer', async () => {
    const sub = build();
    await sub.handleIncomingSignal({ type: 'answer', sdp: 'v=0\nremote' });
    expect(peer.setRemoteDescription).toHaveBeenCalledTimes(1);
    expect(peer.remoteDescription).toEqual({
      __sd: { type: 'answer', sdp: 'v=0\nremote' },
    });
  });

  it('handleIncomingSignal forwards inbound ICE candidates', async () => {
    const sub = build();
    const candidate: RTCIceCandidateInit = {
      candidate: 'candidate:1 ...',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };
    await sub.handleIncomingSignal({ type: 'ice-candidate', candidate });
    expect(peer.addIceCandidate).toHaveBeenCalledTimes(1);
    expect(peer.iceCandidates[0]).toEqual({ __ice: candidate });
  });

  it('handleIncomingSignal swallows ICE errors (late/duplicate candidates)', async () => {
    peer.addIceCandidate = jest.fn(async () => {
      throw new Error('late candidate');
    });
    const sub = build();
    await expect(
      sub.handleIncomingSignal({
        type: 'ice-candidate',
        candidate: { candidate: 'c', sdpMid: '0', sdpMLineIndex: 0 },
      }),
    ).resolves.toBeUndefined();
  });

  it('handleIncomingSignal ignores stray offers', async () => {
    const sub = build();
    await sub.handleIncomingSignal({ type: 'offer', sdp: 'x' });
    expect(peer.setRemoteDescription).not.toHaveBeenCalled();
  });

  it('emits ICE candidates produced by the peer', () => {
    build();
    const candidate: RTCIceCandidateInit = {
      candidate: 'host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    };
    peer.onicecandidate?.({
      candidate: { toJSON: () => candidate },
    });
    expect(emitted).toEqual([{ type: 'ice-candidate', candidate }]);
  });

  it('skips emit when the peer reports a null candidate (gathering done)', () => {
    build();
    peer.onicecandidate?.({ candidate: null });
    expect(emitted).toEqual([]);
  });

  it('forwards the inbound stream via onTrack', () => {
    const sub = build();
    const received: unknown[] = [];
    sub.onTrack((s) => received.push(s));

    const fakeStream = { id: 'remote-stream' };
    peer.ontrack?.({ streams: [fakeStream], track: {} });
    expect(received).toEqual([fakeStream]);
  });

  it('replays the cached stream when onTrack is registered late', () => {
    const sub = build();
    const fakeStream = { id: 'remote-stream' };
    peer.ontrack?.({ streams: [fakeStream], track: {} });

    const received: unknown[] = [];
    sub.onTrack((s) => received.push(s));
    expect(received).toEqual([fakeStream]);
  });

  it('ignores ontrack events with no streams', () => {
    const sub = build();
    const received: unknown[] = [];
    sub.onTrack((s) => received.push(s));
    peer.ontrack?.({ streams: [], track: {} });
    expect(received).toEqual([]);
  });

  it('maps connectionState transitions to SubscriberState', () => {
    const sub = build();
    const states: string[] = [];
    sub.onStateChange((s) => states.push(s));

    peer.connectionState = 'connecting';
    peer.onconnectionstatechange?.();
    peer.connectionState = 'connected';
    peer.onconnectionstatechange?.();
    peer.connectionState = 'disconnected';
    peer.onconnectionstatechange?.();
    peer.connectionState = 'failed';
    peer.onconnectionstatechange?.();

    expect(states).toEqual(['connecting', 'connected', 'disconnected', 'failed']);
    expect(sub.getState()).toBe('failed');
  });

  it('maps unknown / new connectionState back to idle', () => {
    const sub = build();
    peer.connectionState = 'new';
    peer.onconnectionstatechange?.();
    expect(sub.getState()).toBe('idle');

    peer.connectionState = 'something-weird';
    peer.onconnectionstatechange?.();
    expect(sub.getState()).toBe('idle');
  });

  it('does not re-fire the state handler for repeat states', () => {
    const sub = build();
    const handler = jest.fn();
    sub.onStateChange(handler);

    peer.connectionState = 'connected';
    peer.onconnectionstatechange?.();
    peer.onconnectionstatechange?.();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('close() tears down the peer and flips state to closed', () => {
    const sub = build();
    const states: string[] = [];
    sub.onStateChange((s) => states.push(s));
    sub.close();
    expect(peer.close).toHaveBeenCalledTimes(1);
    expect(sub.getState()).toBe('closed');
    expect(states).toEqual(['closed']);
  });

  it('falls back to the default peer factory when none is provided', () => {
    // Verifies the default branch wires through the mocked
    // RTCPeerConnection constructor without throwing.
    const rnWebrtc = jest.requireMock('react-native-webrtc') as {
      RTCPeerConnection: jest.Mock;
    };
    rnWebrtc.RTCPeerConnection.mockImplementation(() => peer);
    const sub = new NativeWebRtcSubscriber({ emitSignal: () => {} });
    expect(sub.getState()).toBe('idle');
    expect(rnWebrtc.RTCPeerConnection).toHaveBeenCalledTimes(1);
  });
});
