// ============================================================
// Native video surface — renders react-native-webrtc's <RTCView>
// bound to the inbound stream URL. Returns null when no stream is
// attached yet so the parent layout collapses gracefully.
// ============================================================

import type { ReactElement } from 'react';
import { StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';

export interface VideoSurfaceProps {
  readonly stream: MediaStream | null;
  readonly muted?: boolean;
}

interface RNStreamLike {
  toURL(): string;
}

export function VideoSurface({ stream }: VideoSurfaceProps): ReactElement {
  if (!stream) {
    return <View style={styles.surface} />;
  }

  // react-native-webrtc's MediaStream exposes toURL(); the DOM type alias
  // used by the domain port does not. Narrow at the boundary.
  const url = (stream as unknown as RNStreamLike).toURL();

  return (
    <RTCView streamURL={url} style={styles.surface} objectFit="cover" />
  );
}

const styles = StyleSheet.create({
  surface: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
  },
});
