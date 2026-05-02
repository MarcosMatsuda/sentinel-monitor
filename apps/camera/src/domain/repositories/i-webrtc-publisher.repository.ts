import type { SignalDto, SignalPayload } from '@sentinel-monitor/shared-types';

export interface DashboardPeerStatus {
  readonly dashboardId: string;
  readonly state: RTCPeerConnectionState;
}

export interface IWebRtcPublisherRepository {
  setStream(stream: MediaStream): void;
  handleIncomingSignal(fromDashboardId: string, payload: SignalPayload): Promise<void>;
  removeDashboard(dashboardId: string): void;
  getStatuses(): readonly DashboardPeerStatus[];
  onSignalToSend(handler: (signal: SignalDto) => void): void;
  onStatusChange(handler: (status: DashboardPeerStatus) => void): void;
  closeAll(): void;
}
