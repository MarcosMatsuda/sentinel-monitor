// ============================================================
// Native binding storage — AsyncStorage. Picked by Metro for
// iOS/Android via the .native.ts extension. Never imports
// localStorage so the native bundle stays focused.
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  STORAGE_KEY,
  type IBindingStorageRepository,
  type PersistedState,
} from '@/domain/repositories/i-binding-storage.repository';

const EMPTY: PersistedState = { identity: null, bindings: [] };

function isPersistedState(value: unknown): value is PersistedState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return 'identity' in obj && 'bindings' in obj && Array.isArray(obj.bindings);
}

export class NativeBindingStorageRepository implements IBindingStorageRepository {
  async load(): Promise<PersistedState> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isPersistedState(parsed) ? parsed : EMPTY;
    } catch {
      return EMPTY;
    }
  }

  async save(state: PersistedState): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function createBindingStorage(): IBindingStorageRepository {
  return new NativeBindingStorageRepository();
}
