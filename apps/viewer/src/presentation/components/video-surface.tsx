// ============================================================
// Stub fallback used only by Jest (which does not honor Metro's
// .web/.native extension resolution by default). Production web
// builds resolve video-surface.web.tsx; native builds resolve
// video-surface.native.tsx.
// ============================================================

import type { ReactElement } from 'react';

export interface VideoSurfaceProps {
  readonly stream: MediaStream | null;
  readonly muted?: boolean;
}

export function VideoSurface(_props: VideoSurfaceProps): ReactElement | null {
  return null;
}
