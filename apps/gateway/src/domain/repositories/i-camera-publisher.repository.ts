import type { SignalPayload } from '@sentinel-monitor/shared-types';

// Per-camera publisher. NOT a real RTCPeerConnection — proxies SDP
// offers/answers between viewer ↔ go2rtc WHEP. Keeps the gateway free
// of native WebRTC bindings (works on ARM/Pi without compilation).

export interface ICameraPublisher {
  /**
   * Process an inbound signal from a viewer (offer or ICE candidate).
   * Returns the outbound signal to send back, or null when nothing to
   * forward (e.g., trickle ICE candidates that don't need an answer).
   */
  handleViewerSignal(
    fromDashboardId: string,
    payload: SignalPayload,
  ): Promise<SignalPayload | null>;

  /** Tear down the WHEP session for a specific dashboard. */
  closeSession(fromDashboardId: string): Promise<void>;

  /** Tear down all sessions. Used on camera stop. */
  closeAllSessions(): Promise<void>;

  /** Number of active sessions (one per connected dashboard). */
  sessionCount(): number;
}
