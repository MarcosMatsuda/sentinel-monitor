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
  readonly mutes: Readonly<Record<string, boolean>>;
  readonly setStream: (cameraId: string, stream: MediaStream) => void;
  readonly setState: (cameraId: string, state: ConnectionState) => void;
  readonly setMuted: (cameraId: string, muted: boolean) => void;
  readonly toggleMuted: (cameraId: string) => boolean;
  readonly isMuted: (cameraId: string) => boolean;
  readonly remove: (cameraId: string) => void;
  readonly get: (cameraId: string) => PeerEntry | undefined;
  readonly clear: () => void;
}

export function createPeersStore() {
  return createStore<PeersState>((set, get) => ({
    peers: {},
    mutes: {},

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

    setMuted: (cameraId, muted) => {
      const current = get().mutes;
      if (current[cameraId] === muted) return;
      set({ mutes: { ...current, [cameraId]: muted } });
    },

    toggleMuted: (cameraId) => {
      const current = get().mutes;
      const next = !(current[cameraId] ?? false);
      set({ mutes: { ...current, [cameraId]: next } });
      return next;
    },

    isMuted: (cameraId) => get().mutes[cameraId] ?? false,

    remove: (cameraId) => {
      const current = get().peers;
      const currentMutes = get().mutes;
      const hadPeer = cameraId in current;
      const hadMute = cameraId in currentMutes;
      if (!hadPeer && !hadMute) return;
      const nextPeers = hadPeer ? { ...current } : current;
      const nextMutes = hadMute ? { ...currentMutes } : currentMutes;
      if (hadPeer) delete (nextPeers as Record<string, PeerEntry>)[cameraId];
      if (hadMute) delete (nextMutes as Record<string, boolean>)[cameraId];
      set({ peers: nextPeers, mutes: nextMutes });
    },

    get: (cameraId) => get().peers[cameraId],

    clear: () => set({ peers: {}, mutes: {} }),
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
