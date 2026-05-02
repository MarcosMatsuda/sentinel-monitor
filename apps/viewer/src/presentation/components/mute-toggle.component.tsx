// ============================================================
// MuteToggle — icon-based, tappable button that flips the audio
// mute flag for a single camera tile. Pure presentational; the
// caller owns the state and the actual toggle effect (use case).
// ============================================================

import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { radii, semantic, typography } from '../theme';

export interface MuteToggleProps {
  readonly muted: boolean;
  readonly onToggle: () => void;
  readonly cameraId: string;
}

export function MuteToggle({
  muted,
  onToggle,
  cameraId,
}: MuteToggleProps): JSX.Element {
  return (
    <TouchableOpacity
      onPress={(e) => {
        // Stop bubbling so the parent tile press (fullscreen route)
        // does not also fire when the user only meant to mute.
        e.stopPropagation?.();
        onToggle();
      }}
      hitSlop={8}
      style={styles.button}
      accessibilityRole="button"
      accessibilityState={{ checked: muted }}
      accessibilityLabel={`mute-toggle-${cameraId}`}
    >
      <Text style={styles.icon} accessibilityElementsHidden>
        {muted ? 'M' : 'A'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: semantic.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: semantic.border.subtle,
  },
  icon: {
    color: semantic.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.bold,
  },
});
