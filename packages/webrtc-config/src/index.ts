// ============================================================
// @sentinel-monitor/webrtc-config
// ICE servers, media constraints, bitrate presets
// ============================================================

export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const turnUrl = process.env.TURN_URL;
const turnUser = process.env.TURN_USER;
const turnPass = process.env.TURN_PASS;
if (turnUrl && turnUser && turnPass) {
  ICE_SERVERS.push({
    urls: turnUrl,
    username: turnUser,
    credential: turnPass,
  });
}

export const WEBRTC_CONFIG: RTCConfiguration = {
  iceServers: ICE_SERVERS,
};

// Default media constraints — phone cam quality, restrained for mesh load.
// Auto-downgrades when grid count >= 5 (handled by viewer at runtime).
export const VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 320 },
  height: { ideal: 240 },
  frameRate: { ideal: 15, max: 20 },
  facingMode: 'environment',
};

export const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 16000,
};

export const MEDIA_CONSTRAINTS: MediaStreamConstraints = {
  audio: AUDIO_CONSTRAINTS,
  video: VIDEO_CONSTRAINTS,
};

// Bitrate caps. Viewer auto-applies "low" when grid count >= 5.
export type BitratePreset = 'low' | 'normal' | 'high';

export const VIDEO_BITRATE_PRESETS: Record<BitratePreset, number> = {
  low: 100_000,
  normal: 250_000,
  high: 500_000,
};

export const SIGNALING_URL =
  process.env.SIGNALING_URL ?? 'http://localhost:3010';
