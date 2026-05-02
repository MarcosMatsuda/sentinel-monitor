import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';
import type { ConnectionState } from '@sentinel-monitor/shared-types';
import { getStatusColor, radii, semantic, spacing, typography } from '../theme';
import { VideoSurface } from './video-surface';

export interface CameraTileProps {
  readonly binding: CameraBindingEntity;
  readonly stream?: MediaStream | null;
  readonly state?: ConnectionState;
  readonly online?: boolean;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
}

function resolveStatus(
  online: boolean | undefined,
  state: ConnectionState | undefined,
): ConnectionState {
  if (online === false) return 'offline';
  return state ?? 'idle';
}

function statusLabel(status: ConnectionState): string {
  switch (status) {
    case 'connected':
      return 'Ao vivo';
    case 'connecting':
      return 'Conectando…';
    case 'reconnecting':
      return 'Reconectando…';
    case 'offline':
      return 'Offline';
    case 'disconnected':
      return 'Desconectado';
    case 'idle':
    default:
      return 'Aguardando vídeo…';
  }
}

export function CameraTile({
  binding,
  stream = null,
  state,
  online,
  onPress,
  onLongPress,
}: CameraTileProps): JSX.Element {
  const status = resolveStatus(online, state);
  const statusColor = getStatusColor(status);
  const showVideo = status === 'connected' && stream !== null;

  return (
    <TouchableOpacity
      style={styles.tile}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityLabel={`camera-tile-${binding.id}`}
    >
      <View style={styles.placeholder}>
        {showVideo ? (
          <View style={StyleSheet.absoluteFill}>
            <VideoSurface stream={stream} muted={false} />
          </View>
        ) : (
          <Text style={styles.placeholderText}>{statusLabel(status)}</Text>
        )}
      </View>
      <View style={styles.footer}>
        <View
          style={[styles.statusDot, { backgroundColor: statusColor }]}
          accessibilityLabel={`presence-dot-${status}`}
        />
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
