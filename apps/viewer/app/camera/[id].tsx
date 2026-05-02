import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useBindingsStore } from '@/presentation/stores/bindings.store';
import { semantic, spacing, typography } from '@/presentation/theme';

export default function CameraFullscreen(): JSX.Element {
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const binding = useBindingsStore((s) => s.bindings.find((b) => b.id === id));

  return (
    <View style={styles.root}>
      <Text style={styles.label}>{binding?.label ?? 'Câmera'}</Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>
          Vídeo em tempo real chegará no PR6.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: semantic.bg.primary, padding: spacing[4] },
  label: {
    color: semantic.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[3],
  },
  placeholder: {
    flex: 1,
    backgroundColor: semantic.bg.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: { color: semantic.text.muted, fontSize: typography.size.sm },
});
