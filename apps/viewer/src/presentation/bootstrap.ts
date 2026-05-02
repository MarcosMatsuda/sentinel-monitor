// ============================================================
// App-level bootstrap — wires the platform-specific storage
// into the bindings store singleton. Imported once from the
// root layout.
// ============================================================

import { createBindingStorage } from '@/infrastructure/storage/binding-storage';
import {
  createBindingsStore,
  setBindingsStoreSingleton,
  type BindingsStore,
} from './stores/bindings.store';

let initialized: BindingsStore | null = null;

function generateId(): string {
  // crypto.randomUUID is available on modern web + RN 0.74+.
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function initBindingsStore(): BindingsStore {
  if (initialized) return initialized;
  const storage = createBindingStorage();
  const store = createBindingsStore({
    storage,
    generateId,
    now: () => Date.now(),
  });
  setBindingsStoreSingleton(store);
  initialized = store;
  return store;
}
