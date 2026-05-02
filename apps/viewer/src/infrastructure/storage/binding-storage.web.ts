// ============================================================
// Web binding storage — localStorage. Picked by Metro/Webpack
// for the web bundle via the .web.ts extension. Never imports
// AsyncStorage so the web bundle stays free of native deps.
// ============================================================

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

export class WebBindingStorageRepository implements IBindingStorageRepository {
  async load(): Promise<PersistedState> {
    if (typeof localStorage === 'undefined') return EMPTY;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isPersistedState(parsed) ? parsed : EMPTY;
    } catch {
      return EMPTY;
    }
  }

  async save(state: PersistedState): Promise<void> {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function createBindingStorage(): IBindingStorageRepository {
  return new WebBindingStorageRepository();
}
