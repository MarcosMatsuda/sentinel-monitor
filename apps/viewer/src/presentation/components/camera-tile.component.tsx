import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';
import { getStatusColor, radii, semantic, spacing, typography } from '../theme';

export interface CameraTileProps {
  readonly binding: CameraBindingEntity;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
}

export function CameraTile({
  binding,
  onPress,
  onLongPress,
}: CameraTileProps): JSX.Element {
  // PR6 will replace 'idle' with the live ConnectionState.
  const statusColor = getStatusColor('idle');

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`camera-tile-${binding.id}`}
    >
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Aguardando vídeo…</Text>
      </View>
      <View style={styles.footer}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={styles.label} numberOfLines={1}>
          {binding.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    margin: spacing[1],
    backgroundColor: semantic.bg.surface,
    borderRadius: radii.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: semantic.border.subtle,
  },
  placeholder: {
    flex: 1,
    backgroundColor: semantic.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: semantic.text.muted,
    fontSize: typography.size.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[2],
    gap: spacing[2],
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  label: {
    color: semantic.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
});
