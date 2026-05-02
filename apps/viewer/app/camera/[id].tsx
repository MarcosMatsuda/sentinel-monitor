import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoSurface } from '@/presentation/components/video-surface';
import { useBindingsStore } from '@/presentation/stores/bindings.store';
import { usePeersStore } from '@/presentation/stores/peers.store';
import { radii, semantic, spacing, typography } from '@/presentation/theme';

export default function CameraFullscreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const binding = useBindingsStore((s) => s.bindings.find((b) => b.id === id));
  const peer = usePeersStore((s) => s.peers[id]);

  const stream = peer?.stream ?? null;
  const hasVideo = stream !== null;

  return (
    <View style={styles.root}>
      <View style={styles.surface}>
        {hasVideo ? (
          <View style={StyleSheet.absoluteFill}>
            {/* Fullscreen route: audio is unmuted by default. */}
            <VideoSurface stream={stream} muted={false} />
          </View>
        ) : (
          <Text style={styles.placeholderText}>
            Sem vídeo no momento. Verifique a conexão da câmera.
          </Text>
        )}
        <View style={styles.headerOverlay}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={12}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="back-to-grid"
          >
            <Text style={styles.backText}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.label} numberOfLines={1}>
            {binding?.label ?? 'Câmera'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  surface: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  placeholderText: {
    color: semantic.text.muted,
    fontSize: typography.size.sm,
    paddingHorizontal: spacing[4],
    textAlign: 'center',
  },
  headerOverlay: {
    position: 'absolute',
    top: spacing[4],
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radii.full,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    color: semantic.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
  },
  label: {
    color: semantic.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    flex: 1,
  },
});
