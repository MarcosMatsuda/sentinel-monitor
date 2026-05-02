// ============================================================
// presence.store — tracks which cameraIds are currently online
// from the dashboard's perspective.
//
// Pattern mirrors bindings.store (createStore + singleton + hook).
// ============================================================

import { createStore, useStore } from 'zustand';

export interface PresenceState {
  readonly online: Readonly<Record<string, boolean>>;
  readonly setMany: (cameraIds: readonly string[]) => void;
  readonly setOne: (cameraId: string, online: boolean) => void;
  readonly isOnline: (cameraId: string) => boolean;
  readonly reset: () => void;
}

export function createPresenceStore() {
  return createStore<PresenceState>((set, get) => ({
    online: {},

    setMany: (cameraIds) => {
      const next: Record<string, boolean> = {};
      for (const id of cameraIds) next[id] = true;
      set({ online: next });
    },

    setOne: (cameraId, online) => {
      const current = get().online;
      if (Boolean(current[cameraId]) === online) return;
      set({ online: { ...current, [cameraId]: online } });
    },

    isOnline: (cameraId) => Boolean(get().online[cameraId]),

    reset: () => set({ online: {} }),
  }));
}

export type PresenceStore = ReturnType<typeof createPresenceStore>;

let singleton: PresenceStore | null = null;

export function setPresenceStoreSingleton(store: PresenceStore): void {
  singleton = store;
}

export function getPresenceStoreSingleton(): PresenceStore {
  if (!singleton) {
    throw new Error(
      'presence store not initialized — call setPresenceStoreSingleton() in app bootstrap',
    );
  }
  return singleton;
}

export function usePresenceStore<T>(selector: (state: PresenceState) => T): T {
  return useStore(getPresenceStoreSingleton(), selector);
}
