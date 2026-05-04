// Per-camera configuration loaded from gateway.yaml. Pure data; the
// gateway uses these to spawn one go2rtc stream + one WebRTC peer
// per camera, addressing the signaling server with the camera's
// stable UUID.
export interface CameraConfig {
  readonly id: string; // UUID v4 — stable identity across restarts
  readonly label: string; // human-readable, e.g. "Sala", "Quarto"
  readonly rtspUrl: string; // rtsp://user:pass@ip:port/stream1
  readonly addedAt: number; // epoch ms when first added to config
  readonly pairedDashboards: readonly string[]; // dashboard UUIDs already paired
}
