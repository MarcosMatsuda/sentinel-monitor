// ============================================================
// PresenceDot — small circular indicator that pulses amber while
// the connection state is `reconnecting`. Animates only opacity
// and scale (compositor-friendly, no layout thrash).
// ============================================================

import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { ConnectionState } from '@sentinel-monitor/shared-types';
import { getStatusColor, radii, semantic } from '../theme';

const PULSE_DURATION_MS = 900;

export interface PresenceDotProps {
  readonly state: ConnectionState;
  readonly size?: number;
}

export function PresenceDot({
  state,
  size = 8,
}: PresenceDotProps): JSX.Element {
  const opacity = useSharedValue<number>(1);
  const scale = useSharedValue<number>(1);
  const isReconnecting = state === 'reconnecting';

  useEffect(() => {
    if (isReconnecting) {
      opacity.value = withRepeat(
        withTiming(0.35, {
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
      scale.value = withRepeat(
        withTiming(1.35, {
          duration: PULSE_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      );
    } else {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = withTiming(1, { duration: 150 });
      scale.value = withTiming(1, { duration: 150 });
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [isReconnecting, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const color = isReconnecting
    ? semantic.status.connecting
    : getStatusColor(state);

  return (
    <View
      accessibilityLabel={`presence-dot-${state}`}
      style={[styles.wrapper, { width: size, height: size }]}
    >
      <Animated.View
        style={[
          styles.dot,
          { backgroundColor: color, width: size, height: size },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    borderRadius: radii.full,
  },
});
