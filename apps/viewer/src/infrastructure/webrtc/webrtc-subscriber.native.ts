// ============================================================
// Native subscriber backed by react-native-webrtc. Mirrors the
// browser sibling: the dashboard is the offerer, recvonly
// transceivers for video + audio, ICE both ways via the injected
// signal sink. We narrow react-native-webrtc's loose event shapes
// to the same lifecycle the .web variant exposes.
// ============================================================

import {
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream as RNMediaStream,
} from 'react-native-webrtc';
import { WEBRTC_CONFIG } from '@sentinel-monitor/webrtc-config';
import type { SignalPayload } from '@sentinel-monitor/shared-types';
import type {
  IWebRtcSubscriberRepository,
  SubscriberState,
} from '../../domain/repositories/i-webrtc-subscriber.repository';

// react-native-webrtc's RTCPeerConnection event types are looser than
// the DOM's. Define just the bits we touch so the rest of the code stays
// strict and `any`-free.
interface RNRtcTrackEvent {
  readonly streams: ReadonlyArray<RNMediaStream>;
  readonly track: unknown;
}

interface RNRtcIceCandidateEvent {
  readonly candidate: { toJSON(): RTCIceCandidateInit } | null;
}

interface RNPeerConnectionLike {
  connectionState: string;
  ontrack: ((event: RNRtcTrackEvent) => void) | null;
  onicecandidate: ((event: RNRtcIceCandidateEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;
  addTransceiver(
    kind: 'video' | 'audio',
    init: { direction: 'recvonly' | 'sendrecv' | 'sendonly' | 'inactive' },
  ): unknown;
  createOffer(): Promise<{ sdp?: string; type: string }>;
  setLocalDescription(desc: unknown): Promise<void>;
  setRemoteDescription(desc: unknown): Promise<void>;
  addIceCandidate(candidate: unknown): Promise<void>;
  close(): void;
}

// Public type used by the consumer (presentation layer) — same shape as DOM.
export type SubscriberMediaStream = RNMediaStream;

export type NativePeerFactory = (
  config: typeof WEBRTC_CONFIG,
) => RNPeerConnectionLike;

export interface NativeWebRtcSubscriberOptions {
  readonly emitSignal: (payload: SignalPayload) => void;
  readonly rtcConfig?: typeof WEBRTC_CONFIG;
  readonly peerFactory?: NativePeerFactory;
}

export class NativeWebRtcSubscriber implements IWebRtcSubscriberRepository {
  private readonly pc: RNPeerConnectionLike;
  private state: SubscriberState = 'idle';
  private remoteStream: RNMediaStream | null = null;
  private trackHandler: ((stream: MediaStream) => void) | null = null;
  private stateHandler: ((state: SubscriberState) => void) | null = null;

  constructor(private readonly options: NativeWebRtcSubscriberOptions) {
    const factory: NativePeerFactory =
      options.peerFactory ??
      ((c): RNPeerConnectionLike =>
        new RTCPeerConnection(c) as unknown as RNPeerConnectionLike);
    this.pc = factory(options.rtcConfig ?? WEBRTC_CONFIG);

    this.pc.ontrack = (event): void => {
      const stream = event.streams[0];
      if (!stream) return;
      this.remoteStream = stream;
      // Domain port is typed against the DOM MediaStream — react-native-webrtc's
      // class is structurally compatible at the surface we expose (toURL,
      // getTracks). The domain consumer never touches DOM-only APIs.
      this.trackHandler?.(stream as unknown as MediaStream);
    };

    this.pc.onicecandidate = (event): void => {
      if (event.candidate) {
        this.options.emitSignal({
          type: 'ice-candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.pc.onconnectionstatechange = (): void => {
      this.setState(mapPeerState(this.pc.connectionState));
    };
  }

  async connect(_cameraId: string): Promise<void> {
    this.setState('connecting');
    this.pc.addTransceiver('video', { direction: 'recvonly' });
    this.pc.addTransceiver('audio', { direction: 'recvonly' });

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.options.emitSignal({ type: 'offer', sdp: offer.sdp ?? '' });
  }

  async handleIncomingSignal(payload: SignalPayload): Promise<void> {
    if (payload.type === 'answer') {
      await this.pc.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }),
      );
      return;
    }
    if (payload.type === 'ice-candidate') {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // Late or duplicate candidate — safe to ignore.
      }
      return;
    }
    // 'offer' arriving at the dashboard would be a protocol bug; ignore.
  }

  close(): void {
    this.pc.close();
    this.setState('closed');
  }

  onTrack(handler: (stream: MediaStream) => void): void {
    this.trackHandler = handler;
    if (this.remoteStream) handler(this.remoteStream as unknown as MediaStream);
  }

  onStateChange(handler: (state: SubscriberState) => void): void {
    this.stateHandler = handler;
  }

  getState(): SubscriberState {
    return this.state;
  }

  private setState(next: SubscriberState): void {
    if (this.state === next) return;
    this.state = next;
    this.stateHandler?.(next);
  }
}

function mapPeerState(s: string): SubscriberState {
  switch (s) {
    case 'new':
      return 'idle';
    case 'connecting':
      return 'connecting';
    case 'connected':
      return 'connected';
    case 'disconnected':
      return 'disconnected';
    case 'failed':
      return 'failed';
    case 'closed':
      return 'closed';
    default:
      return 'idle';
  }
}
