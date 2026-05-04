import type {
  ICameraPublisher,
} from '../../domain/repositories/i-camera-publisher.repository';
import type { SignalPayload } from '@sentinel-monitor/shared-types';
import type { ILogger } from '../logging/logger';

interface WhepSession {
  /** Resource URL returned in WHEP Location header — used for trickle/teardown. */
  resourceUrl: string;
}

export interface GatewayCameraPublisherOptions {
  readonly cameraId: string;
  readonly streamId: string; // go2rtc stream id (often === cameraId)
  readonly whepBaseUrl: string; // e.g. http://127.0.0.1:1984/api/webrtc?src=streamId
  readonly fetchImpl?: typeof fetch;
  readonly logger: ILogger;
}

/**
 * Bridges WebRTC signaling between a viewer and the local go2rtc instance
 * via WHEP (WebRTC-HTTP Egress Protocol). The gateway never instantiates
 * an RTCPeerConnection — go2rtc holds the actual peer.
 *
 * Flow per dashboard:
 *   viewer offer →  POST whepUrl  →  go2rtc returns 201 + answer SDP + Location
 *   viewer ICE candidate (trickle) → PATCH resourceUrl + sdpFrag (best effort)
 *   teardown → DELETE resourceUrl
 *
 * Limitations:
 *   - Trickle ICE from gateway → viewer is not modeled; go2rtc returns
 *     non-trickle SDP (all candidates inline) which works for most networks.
 *   - We swallow viewer ICE PATCH failures so the session still works
 *     when go2rtc doesn't support trickle on its WHEP impl.
 */
export class GatewayCameraPublisher implements ICameraPublisher {
  private readonly sessions = new Map<string, WhepSession>();
  private readonly fetchImpl: typeof fetch;
  private readonly logger: ILogger;

  constructor(private readonly opts: GatewayCameraPublisherOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.logger = opts.logger.child({ cameraId: opts.cameraId });
  }

  async handleViewerSignal(
    fromDashboardId: string,
    payload: SignalPayload,
  ): Promise<SignalPayload | null> {
    if (payload.type === 'offer') {
      return this.handleOffer(fromDashboardId, payload.sdp);
    }
    if (payload.type === 'ice-candidate') {
      await this.handleIceCandidate(fromDashboardId, payload.candidate);
      return null;
    }
    // Answers don't apply: gateway is the answerer side.
    this.logger.debug(
      { event: 'publisher.unexpected_answer', from: fromDashboardId },
      'Received an answer from viewer; gateway only handles offers/candidates',
    );
    return null;
  }

  private async handleOffer(
    fromDashboardId: string,
    offerSdp: string,
  ): Promise<SignalPayload> {
    // Tear down a stale session before opening a new one (renegotiation).
    if (this.sessions.has(fromDashboardId)) {
      await this.closeSession(fromDashboardId);
    }

    const res = await this.fetchImpl(this.opts.whepBaseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: offerSdp,
    });

    if (!res.ok) {
      this.logger.error(
        { event: 'publisher.whep_offer_failed', from: fromDashboardId, status: res.status },
        'go2rtc WHEP rejected the offer',
      );
      throw new Error(`WHEP offer failed: HTTP ${res.status}`);
    }

    const answerSdp = await res.text();
    const resourceUrl = res.headers.get('location') ?? '';
    this.sessions.set(fromDashboardId, { resourceUrl });

    this.logger.info(
      { event: 'publisher.session_opened', from: fromDashboardId, hasResource: !!resourceUrl },
      'WHEP session opened for dashboard',
    );

    return { type: 'answer', sdp: answerSdp };
  }

  private async handleIceCandidate(
    fromDashboardId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const session = this.sessions.get(fromDashboardId);
    if (!session || !session.resourceUrl) {
      // Either the session was never opened (out-of-order) or go2rtc
      // didn't give us a resource URL (no trickle support). Swallow.
      this.logger.debug(
        { event: 'publisher.ice_skipped', from: fromDashboardId },
        'No WHEP resource — ignoring trickle candidate',
      );
      return;
    }

    try {
      const res = await this.fetchImpl(session.resourceUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/trickle-ice-sdpfrag' },
        body: this.candidateToSdpFrag(candidate),
      });
      if (!res.ok && res.status !== 405) {
        this.logger.warn(
          { event: 'publisher.ice_patch_failed', from: fromDashboardId, status: res.status },
          'WHEP PATCH for ICE candidate failed',
        );
      }
    } catch (err) {
      // Network error — swallow; the connection may still establish via
      // the candidates already inline in the original SDP exchange.
      this.logger.debug(
        { event: 'publisher.ice_patch_error', from: fromDashboardId, error: String(err) },
        'WHEP ICE PATCH errored',
      );
    }
  }

  async closeSession(fromDashboardId: string): Promise<void> {
    const session = this.sessions.get(fromDashboardId);
    if (!session) return;
    this.sessions.delete(fromDashboardId);

    if (!session.resourceUrl) return;
    try {
      await this.fetchImpl(session.resourceUrl, { method: 'DELETE' });
    } catch {
      // ignore — best-effort teardown
    }
    this.logger.info(
      { event: 'publisher.session_closed', from: fromDashboardId },
      'WHEP session closed',
    );
  }

  async closeAllSessions(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map((id) => this.closeSession(id)));
  }

  sessionCount(): number {
    return this.sessions.size;
  }

  private candidateToSdpFrag(candidate: RTCIceCandidateInit): string {
    // Minimal SDP fragment for WHEP trickle. Real impls are more
    // elaborate, but go2rtc accepts the bare candidate line.
    const cand = candidate.candidate ?? '';
    const mid = candidate.sdpMid ?? '0';
    return `a=mid:${mid}\r\na=${cand}\r\n`;
  }
}
