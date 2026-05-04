import { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ComputeGridLayoutUseCase } from '@/domain/use-cases/compute-grid-layout.use-case';
import { ToggleCameraMuteUseCase } from '@/domain/use-cases/toggle-camera-mute.use-case';
import { AddCameraModal } from '@/presentation/components/add-camera-modal';
import { CameraTile } from '@/presentation/components/camera-tile.component';
import { EmptyState } from '@/presentation/components/empty-state';
import { useBindingsStore } from '@/presentation/stores/bindings.store';
import {
  getPeersStoreSingleton,
  usePeersStore,
} from '@/presentation/stores/peers.store';
import { usePresenceStore } from '@/presentation/stores/presence.store';
import { radii, semantic, spacing, typography } from '@/presentation/theme';

const layoutUC = new ComputeGridLayoutUseCase();

export default function GridScreen(): JSX.Element {
  const router = useRouter();
  const bindings = useBindingsStore((s) => s.bindings);
  const addCamera = useBindingsStore((s) => s.addCamera);
  const removeCamera = useBindingsStore((s) => s.removeCamera);
  const peers = usePeersStore((s) => s.peers);
  const mutes = usePeersStore((s) => s.mutes);
  const online = usePresenceStore((s) => s.online);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  const toggleMuteUC = useMemo(
    () =>
      new ToggleCameraMuteUseCase({
        store: getPeersStoreSingleton().getState(),
      }),
    [],
  );

  const layout = useMemo(() => layoutUC.execute(bindings.length), [bindings]);

  if (bindings.length === 0) {
    return (
      <View style={styles.root}>
        <EmptyState onAddPress={() => setModalOpen(true)} />
        <AddCameraModal
          visible={modalOpen}
          onClose={() => setModalOpen(false)}
          onSubmit={async (pairingCode, label) => {
            await addCamera({ pairingCode, label });
          }}
        />
      </View>
    );
  }

  const rows: typeof bindings[] = [];
  for (let r = 0; r < layout.rows; r += 1) {
    rows.push(bindings.slice(r * layout.cols, (r + 1) * layout.cols));
  }

  return (
    <View style={styles.root}>
      <View style={styles.grid}>
        {rows.map((row, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.row}>
            {row.map((b) => {
              const peer = peers[b.cameraId];
              const presenceKnown = b.cameraId in online;
              const isOnline = presenceKnown ? online[b.cameraId] : undefined;
              return (
                <CameraTile
                  key={b.id}
                  binding={b}
                  stream={peer?.stream ?? null}
                  state={peer?.state}
                  online={isOnline}
                  muted={mutes[b.id] ?? false}
                  onPress={() => router.push(`/camera/${b.id}`)}
                  onLongPress={() => {
                    void removeCamera(b.id);
                  }}
                  onToggleMute={() => {
                    toggleMuteUC.execute(b.id);
                  }}
                  onRemove={() => {
                    void removeCamera(b.id);
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
      <TouchableOpacity
        onPress={() => setModalOpen(true)}
        style={styles.fab}
        accessibilityLabel="add-camera-fab"
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
      <AddCameraModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (pairingCode, label) => {
          await addCamera({ pairingCode, label });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg.primary },
  grid: { flex: 1, padding: spacing[2] },
  row: { flex: 1, flexDirection: 'row' },
  fab: {
    position: 'absolute',
    bottom: spacing[6],
    right: spacing[6],
    width: 56,
    height: 56,
    borderRadius: radii.full,
    backgroundColor: semantic.accent.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    color: semantic.text.primary,
    fontSize: typography.size.xl,
    fontWeight: typography.weight.bold,
  },
});
