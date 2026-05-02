// ============================================================
// Browser RTCPeerConnection-based subscriber. The dashboard is
// the offerer in our protocol; the camera answers. We add a
// recvonly transceiver pair (video + audio) so the SDP advertises
// what we want, then send the offer through the injected signal sink.
// ============================================================

import { WEBRTC_CONFIG } from '@sentinel-monitor/webrtc-config';
import type { SignalPayload } from '@sentinel-monitor/shared-types';
import type {
  IWebRtcSubscriberRepository,
  SubscriberState,
} from '../../domain/repositories/i-webrtc-subscriber.repository';

export type PeerFactory = (config: RTCConfiguration) => RTCPeerConnection;

export interface BrowserWebRtcSubscriberOptions {
  readonly emitSignal: (payload: SignalPayload) => void;
  readonly rtcConfig?: RTCConfiguration;
  readonly peerFactory?: PeerFactory;
}

export class BrowserWebRtcSubscriber implements IWebRtcSubscriberRepository {
  private readonly pc: RTCPeerConnection;
  private state: SubscriberState = 'idle';
  private remoteStream: MediaStream | null = null;
  private trackHandler: ((stream: MediaStream) => void) | null = null;
  private stateHandler: ((state: SubscriberState) => void) | null = null;

  constructor(private readonly options: BrowserWebRtcSubscriberOptions) {
    const factory = options.peerFactory ?? ((c) => new RTCPeerConnection(c));
    this.pc = factory(options.rtcConfig ?? WEBRTC_CONFIG);

    this.pc.ontrack = (event): void => {
      // Prefer the stream the remote attached the track to. Fallback
      // to a synthesized one for engines that omit event.streams.
      const stream = event.streams[0] ?? new MediaStream([event.track]);
      this.remoteStream = stream;
      this.trackHandler?.(stream);
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
    // recvonly transceivers — we don't send media, we only receive.
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
    if (this.remoteStream) handler(this.remoteStream);
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

function mapPeerState(s: RTCPeerConnectionState): SubscriberState {
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
