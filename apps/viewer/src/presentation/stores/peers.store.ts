// ============================================================
// peers.store — Map<cameraId, PeerEntry> with the live MediaStream
// and connection state. Built around an internal Map for fast lookup;
// the .entries view is rebuilt on each change so React selectors can
// shallow-compare.
// ============================================================

import { createStore, useStore } from 'zustand';
import type { ConnectionState } from '@sentinel-monitor/shared-types';

export interface PeerEntry {
  readonly cameraId: string;
  readonly stream: MediaStream | null;
  readonly state: ConnectionState;
}

export interface PeersState {
  readonly peers: Readonly<Record<string, PeerEntry>>;
  readonly setStream: (cameraId: string, stream: MediaStream) => void;
  readonly setState: (cameraId: string, state: ConnectionState) => void;
  readonly remove: (cameraId: string) => void;
  readonly get: (cameraId: string) => PeerEntry | undefined;
  readonly clear: () => void;
}

export function createPeersStore() {
  return createStore<PeersState>((set, get) => ({
    peers: {},

    setStream: (cameraId, stream) => {
      const current = get().peers;
      const existing = current[cameraId];
      const next: PeerEntry = {
        cameraId,
        stream,
        state: existing?.state ?? 'connected',
      };
      set({ peers: { ...current, [cameraId]: next } });
    },

    setState: (cameraId, state) => {
      const current = get().peers;
      const existing = current[cameraId];
      const next: PeerEntry = {
        cameraId,
        stream: existing?.stream ?? null,
        state,
      };
      set({ peers: { ...current, [cameraId]: next } });
    },

    remove: (cameraId) => {
      const current = get().peers;
      if (!(cameraId in current)) return;
      const next = { ...current };
      delete next[cameraId];
      set({ peers: next });
    },

    get: (cameraId) => get().peers[cameraId],

    clear: () => set({ peers: {} }),
  }));
}

export type PeersStore = ReturnType<typeof createPeersStore>;

let singleton: PeersStore | null = null;

export function setPeersStoreSingleton(store: PeersStore): void {
  singleton = store;
}

export function getPeersStoreSingleton(): PeersStore {
  if (!singleton) {
    throw new Error(
      'peers store not initialized — call setPeersStoreSingleton() in app bootstrap',
    );
  }
  return singleton;
}

export function usePeersStore<T>(selector: (state: PeersState) => T): T {
  return useStore(getPeersStoreSingleton(), selector);
}
