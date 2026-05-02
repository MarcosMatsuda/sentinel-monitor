// ============================================================
// Web video surface — wraps a native <video> element and binds the
// inbound MediaStream to its srcObject. Falls back gracefully when
// stream is null.
// ============================================================

import { useEffect, useRef } from 'react';

export interface VideoSurfaceProps {
  readonly stream: MediaStream | null;
  readonly muted?: boolean;
}

export function VideoSurface({
  stream,
  muted = false,
}: VideoSurfaceProps): JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      el.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        backgroundColor: '#000',
      }}
    />
  );
}
