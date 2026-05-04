import type { CameraConfig } from './camera-config.entity';

// Top-level gateway state, loaded from gateway.yaml at boot. The
// signalingUrl is where the gateway connects (Render-hosted server
// in production, localhost during dev).
export interface GatewayConfig {
  readonly id: string; // UUID v4 — gateway identity
  readonly signalingUrl: string;
  readonly go2rtcUrl: string; // e.g. http://127.0.0.1:1984
  readonly cameras: readonly CameraConfig[];
}
