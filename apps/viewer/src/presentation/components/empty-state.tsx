import { StyleSheet, Text, View } from 'react-native';
import { semantic, spacing, typography } from '../theme';

export interface EmptyStateProps {
  readonly onAddPress: () => void;
}

export function EmptyState({ onAddPress }: EmptyStateProps): JSX.Element {
  return (
    <View style={styles.container} accessibilityRole="summary">
      <Text style={styles.title}>Nenhuma câmera. Adicione uma.</Text>
      <Text
        style={styles.cta}
        accessibilityRole="button"
        onPress={onAddPress}
      >
        + Adicionar câmera
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
    backgroundColor: semantic.bg.primary,
  },
  title: {
    color: semantic.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.medium,
    marginBottom: spacing[4],
    textAlign: 'center',
  },
  cta: {
    color: semantic.accent.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
  },
});
