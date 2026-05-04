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
  muted = true,
}: VideoSurfaceProps): JSX.Element {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.srcObject !== stream) {
      // Force muted before play() — Chrome blocks autoplay on streams with audio.
      el.muted = true;
      el.srcObject = stream;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          // Autoplay may still be blocked on some browsers; the user can
          // interact with the tile to start playback manually.
        });
      }
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
        objectFit: 'contain',
        backgroundColor: '#000',
      }}
    />
  );
}
