import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import type { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';
import type { ConnectionState } from '@sentinel-monitor/shared-types';
import { radii, semantic, spacing, typography } from '../theme';
import { MuteToggle } from './mute-toggle.component';
import { PresenceDot } from './presence-dot.component';
import { VideoSurface } from './video-surface';

export interface CameraTileProps {
  readonly binding: CameraBindingEntity;
  readonly stream?: MediaStream | null;
  readonly state?: ConnectionState;
  readonly online?: boolean;
  readonly muted?: boolean;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
  readonly onToggleMute?: () => void;
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
  muted = false,
  onPress,
  onLongPress,
  onToggleMute,
}: CameraTileProps): JSX.Element {
  const status = resolveStatus(online, state);
  const showVideo = status === 'connected' && stream !== null;

  return (
    <Animated.View
      style={styles.tileWrapper}
      layout={LinearTransition.duration(250)}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      <TouchableOpacity
        style={styles.tile}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={`camera-tile-${binding.id}`}
        activeOpacity={0.85}
      >
        <View style={styles.placeholder}>
          {showVideo ? (
            <View style={StyleSheet.absoluteFill}>
              <VideoSurface stream={stream} muted={muted} />
            </View>
          ) : (
            <Text style={styles.placeholderText}>{statusLabel(status)}</Text>
          )}
          {onToggleMute ? (
            <View style={styles.muteSlot}>
              <MuteToggle
                muted={muted}
                onToggle={onToggleMute}
                cameraId={binding.id}
              />
            </View>
          ) : null}
        </View>
        <View style={styles.footer}>
          <PresenceDot state={status} />
          <Text style={styles.label} numberOfLines={1}>
            {binding.label}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tileWrapper: {
    flex: 1,
    margin: spacing[1],
  },
  tile: {
    flex: 1,
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
  muteSlot: {
    position: 'absolute',
    top: spacing[2],
    right: spacing[2],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing[2],
    gap: spacing[2],
  },
  label: {
    color: semantic.text.primary,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    flex: 1,
  },
});
