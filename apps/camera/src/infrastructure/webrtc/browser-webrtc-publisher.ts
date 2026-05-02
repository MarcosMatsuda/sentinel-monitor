import { WEBRTC_CONFIG } from '@sentinel-monitor/webrtc-config';
import type { SignalDto, SignalPayload } from '@sentinel-monitor/shared-types';
import type {
  DashboardPeerStatus,
  IWebRtcPublisherRepository,
} from '../../domain/repositories/i-webrtc-publisher.repository';

interface PeerEntry {
  readonly pc: RTCPeerConnection;
  state: RTCPeerConnectionState;
}

// Subscriber-driven publisher. Each connecting dashboard creates a fresh
// RTCPeerConnection seeded with the same MediaStream. The dashboard is
// the offerer; this side answers and emits ICE candidates back through
// the signaling channel.
export class BrowserWebRtcPublisher implements IWebRtcPublisherRepository {
  private stream: MediaStream | null = null;
  private readonly peers = new Map<string, PeerEntry>();
  private signalHandler: ((signal: SignalDto) => void) | null = null;
  private statusHandler: ((status: DashboardPeerStatus) => void) | null = null;

  constructor(
    private readonly cameraId: string,
    private readonly rtcConfig: RTCConfiguration = WEBRTC_CONFIG,
    private readonly peerFactory: (config: RTCConfiguration) => RTCPeerConnection = (c) =>
      new RTCPeerConnection(c),
  ) {}

  setStream(stream: MediaStream): void {
    this.stream = stream;
  }

  onSignalToSend(handler: (signal: SignalDto) => void): void {
    this.signalHandler = handler;
  }

  onStatusChange(handler: (status: DashboardPeerStatus) => void): void {
    this.statusHandler = handler;
  }

  getStatuses(): readonly DashboardPeerStatus[] {
    return Array.from(this.peers.entries()).map(([dashboardId, entry]) => ({
      dashboardId,
      state: entry.state,
    }));
  }

  removeDashboard(dashboardId: string): void {
    const entry = this.peers.get(dashboardId);
    if (!entry) return;
    entry.pc.close();
    this.peers.delete(dashboardId);
  }

  closeAll(): void {
    for (const entry of this.peers.values()) {
      entry.pc.close();
    }
    this.peers.clear();
  }

  async handleIncomingSignal(
    fromDashboardId: string,
    payload: SignalPayload,
  ): Promise<void> {
    if (payload.type === 'offer') {
      await this.handleOffer(fromDashboardId, payload.sdp);
      return;
    }
    if (payload.type === 'answer') {
      // Subscriber-driven: camera never sends offers, so an answer here
      // would be a protocol bug. Safely ignore.
      return;
    }
    if (payload.type === 'ice-candidate') {
      await this.handleRemoteIce(fromDashboardId, payload.candidate);
    }
  }

  private async handleOffer(dashboardId: string, sdp: string): Promise<void> {
    if (!this.stream) {
      throw new Error('BrowserWebRtcPublisher: stream not set');
    }
    // If we already have a peer for this dashboard (re-offer / reconnect),
    // tear down the old one first — keeps state simple and predictable.
    const existing = this.peers.get(dashboardId);
    if (existing) {
      existing.pc.close();
      this.peers.delete(dashboardId);
    }

    const pc = this.peerFactory(this.rtcConfig);
    const entry: PeerEntry = { pc, state: pc.connectionState };
    this.peers.set(dashboardId, entry);

    pc.onicecandidate = (event): void => {
      if (event.candidate && this.signalHandler) {
        this.signalHandler({
          fromPeerId: this.cameraId,
          toPeerId: dashboardId,
          payload: {
            type: 'ice-candidate',
            candidate: event.candidate.toJSON(),
          },
        });
      }
    };

    pc.onconnectionstatechange = (): void => {
      entry.state = pc.connectionState;
      this.statusHandler?.({ dashboardId, state: pc.connectionState });
    };

    for (const track of this.stream.getTracks()) {
      pc.addTrack(track, this.stream);
    }

    await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.signalHandler?.({
      fromPeerId: this.cameraId,
      toPeerId: dashboardId,
      payload: { type: 'answer', sdp: answer.sdp ?? '' },
    });
  }

  private async handleRemoteIce(
    dashboardId: string,
    candidate: RTCIceCandidateInit,
  ): Promise<void> {
    const entry = this.peers.get(dashboardId);
    if (!entry) return;
    try {
      await entry.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch {
      // Late or duplicate candidate — safe to ignore.
    }
  }
}
