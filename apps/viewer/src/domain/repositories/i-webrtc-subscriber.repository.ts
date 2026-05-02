// ============================================================
// Domain port for the WebRTC subscriber. The subscriber initiates
// the offer to a remote camera, receives back an answer, and
// surfaces the inbound MediaStream once tracks arrive.
// ============================================================

import type { SignalPayload } from '@sentinel-monitor/shared-types';

export type SubscriberState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'closed';

export interface IWebRtcSubscriberRepository {
  /**
   * Kick off the subscriber-driven WebRTC handshake. Implementations
   * MUST call signalSink with the offer and any ICE candidates.
   */
  connect(cameraId: string): Promise<void>;
  /** Apply an inbound signal (answer / ICE) routed by the server. */
  handleIncomingSignal(payload: SignalPayload): Promise<void>;
  /** Tear down the underlying RTCPeerConnection. */
  close(): void;

  onTrack(handler: (stream: MediaStream) => void): void;
  onStateChange(handler: (state: SubscriberState) => void): void;

  getState(): SubscriberState;
}
