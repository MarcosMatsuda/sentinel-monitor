import { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { radii, semantic, spacing, typography } from '../theme';

export interface AddCameraModalProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (pairingCode: string, label: string) => Promise<void> | void;
}

export function AddCameraModal({
  visible,
  onClose,
  onSubmit,
}: AddCameraModalProps): JSX.Element {
  const [code, setCode] = useState<string>('');
  const [label, setLabel] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const reset = (): void => {
    setCode('');
    setLabel('');
    setError(null);
  };

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await onSubmit(code.trim().toUpperCase(), label.trim() || 'Câmera');
      reset();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Adicionar câmera</Text>
          <Text style={styles.label}>Código de pareamento</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="ABC123"
            placeholderTextColor={semantic.text.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.input}
            accessibilityLabel="pairing-code-input"
          />
          <Text style={styles.label}>Apelido (opcional)</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Sala, Quintal..."
            placeholderTextColor={semantic.text.muted}
            style={styles.input}
            accessibilityLabel="label-input"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={styles.row}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.button, styles.secondary]}
              disabled={busy}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              style={[styles.button, styles.primary]}
              disabled={busy || code.trim().length === 0}
            >
              <Text style={styles.buttonText}>
                {busy ? 'Adicionando…' : 'Adicionar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[4],
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: semantic.bg.surface,
    borderRadius: radii.lg,
    padding: spacing[6],
    borderWidth: 1,
    borderColor: semantic.border.default,
  },
  title: {
    color: semantic.text.primary,
    fontSize: typography.size.lg,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing[4],
  },
  label: {
    color: semantic.text.secondary,
    fontSize: typography.size.sm,
    marginBottom: spacing[1],
    marginTop: spacing[2],
  },
  input: {
    backgroundColor: semantic.bg.elevated,
    color: semantic.text.primary,
    borderRadius: radii.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    fontSize: typography.size.base,
    borderWidth: 1,
    borderColor: semantic.border.subtle,
  },
  error: {
    color: semantic.status.alert,
    fontSize: typography.size.sm,
    marginTop: spacing[3],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing[5],
    gap: spacing[2],
  },
  button: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: radii.md,
  },
  primary: { backgroundColor: semantic.accent.primary },
  secondary: { backgroundColor: semantic.bg.elevated },
  buttonText: {
    color: semantic.text.primary,
    fontSize: typography.size.base,
    fontWeight: typography.weight.semibold,
  },
});
