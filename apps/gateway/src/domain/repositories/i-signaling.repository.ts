import type { SignalDto } from '@sentinel-monitor/shared-types';

// Gateway-side signaling client. Each camera owns one connection (one
// `peerId = cameraId`) and listens for inbound signals + presence
// changes from the dashboards that paired with it.

export interface ISignalingClient {
  /** Establishes the Socket.IO connection. Idempotent. */
  connect(signalingUrl: string): Promise<void>;

  /** Closes the connection cleanly. */
  disconnect(): Promise<void>;

  /** Announces this peer is online. Must be called after connect(). */
  registerPresence(peerId: string): void;

  /** Outbound signal (camera → dashboard). */
  sendSignal(payload: SignalDto): void;

  /** Subscribe to signals where toPeerId === our peer id. */
  onSignal(handler: (payload: SignalDto) => void): void;

  /** Subscribe to presence changes for the dashboards paired with our camera. */
  onPresenceChange(
    handler: (event: { peerId: string; online: boolean }) => void,
  ): void;
}
