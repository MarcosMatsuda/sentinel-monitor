// Minimal WebRTC fakes for unit testing the camera publisher.
// Adapted from baby-monitor with multi-peer support: each
// `installFakeRtc()` keeps a list of every constructed PC so tests can
// assert on per-dashboard behaviour.

import { vi } from 'vitest';

export class FakeMediaStreamTrack {
  enabled = true;
  constructor(public kind: 'audio' | 'video') {}
}

export const createFakeStream = (
  audio?: FakeMediaStreamTrack,
  video?: FakeMediaStreamTrack,
): MediaStream => {
  const audioTracks = audio ? [audio] : [];
  const videoTracks = video ? [video] : [];
  return {
    getAudioTracks: () => audioTracks,
    getVideoTracks: () => videoTracks,
    getTracks: () => [...audioTracks, ...videoTracks],
  } as unknown as MediaStream;
};

export class FakePeerConnection {
  public connectionState: RTCPeerConnectionState = 'new';
  public closed = false;
  public addedTracks: Array<{ track: FakeMediaStreamTrack; stream: MediaStream }> = [];
  public localDescription: RTCSessionDescriptionInit | null = null;
  public remoteDescriptions: RTCSessionDescriptionInit[] = [];
  public addedCandidates: RTCIceCandidateInit[] = [];
  public lastConfig: RTCConfiguration | undefined;

  public onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null = null;
  public onconnectionstatechange: (() => void) | null = null;

  // Test seam — controls what createAnswer returns.
  public nextAnswer: RTCSessionDescriptionInit = { type: 'answer', sdp: 'v=0\r\n' };
  // Force addIceCandidate to throw (simulates late candidate).
  public addIceCandidateError: unknown = null;

  constructor(config?: RTCConfiguration) {
    this.lastConfig = config;
  }

  addTrack(track: FakeMediaStreamTrack, stream: MediaStream): unknown {
    this.addedTracks.push({ track, stream });
    return {};
  }

  createAnswer(): Promise<RTCSessionDescriptionInit> {
    return Promise.resolve(this.nextAnswer);
  }

  setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
    return Promise.resolve();
  }

  setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.remoteDescriptions.push(desc);
    return Promise.resolve();
  }

  addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (this.addIceCandidateError) {
      const err = this.addIceCandidateError;
      this.addIceCandidateError = null;
      return Promise.reject(err);
    }
    this.addedCandidates.push(candidate);
    return Promise.resolve();
  }

  close(): void {
    this.closed = true;
  }

  // ---- Lifecycle helpers driven by tests ----

  fireIceCandidate(candidate: RTCIceCandidate | null): void {
    this.onicecandidate?.({ candidate } as RTCPeerConnectionIceEvent);
  }

  setStateAndFire(state: RTCPeerConnectionState): void {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}

export interface InstalledRtc {
  peers: FakePeerConnection[];
  lastConfig(): RTCConfiguration | undefined;
}

export const installFakeRtc = (): InstalledRtc => {
  const installed: InstalledRtc = {
    peers: [],
    lastConfig() {
      return this.peers[this.peers.length - 1]?.lastConfig;
    },
  };

  class StubPeer {
    constructor(config?: RTCConfiguration) {
      const peer = new FakePeerConnection(config);
      installed.peers.push(peer);
      return peer as unknown as StubPeer;
    }
  }

  class StubSessionDesc {
    type: string;
    sdp: string;
    constructor(init: RTCSessionDescriptionInit) {
      this.type = init.type;
      this.sdp = init.sdp ?? '';
    }
  }

  class StubIceCandidate {
    constructor(public init: RTCIceCandidateInit) {}
    toJSON(): RTCIceCandidateInit {
      return this.init;
    }
  }

  vi.stubGlobal('RTCPeerConnection', StubPeer);
  vi.stubGlobal('RTCSessionDescription', StubSessionDesc);
  vi.stubGlobal('RTCIceCandidate', StubIceCandidate);

  return installed;
};
