// ============================================================
// Native video surface — STUB. The real implementation arrives
// in PR7 alongside react-native-webrtc's RTCView.
// ============================================================

import type { ReactElement } from 'react';

export interface VideoSurfaceProps {
  readonly stream: MediaStream | null;
  readonly muted?: boolean;
}

export function VideoSurface(_props: VideoSurfaceProps): ReactElement | null {
  // eslint-disable-next-line no-console
  console.warn(
    'VideoSurface (native): not implemented — see PR7 (react-native-webrtc / RTCView)',
  );
  return null;
}
