// ============================================================
// bindings.store — Zustand store mediating between use cases
// and presentation. Persists on every mutation.
//
// Pattern (mirrors baby-monitor-mvp):
//   - useBindingsStoreBase: raw create() instance for tests
//   - useBindingsStore: hook wrapper used by components
// ============================================================

import { createStore, useStore } from 'zustand';
import type { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';
import type { ViewerIdentityEntity } from '@/domain/entities/viewer-identity.entity';
import type {
  IBindingStorageRepository,
  PersistedState,
} from '@/domain/repositories/i-binding-storage.repository';
import { AddCameraUseCase } from '@/domain/use-cases/add-camera.use-case';
import { RemoveCameraUseCase } from '@/domain/use-cases/remove-camera.use-case';
import { RenameCameraUseCase } from '@/domain/use-cases/rename-camera.use-case';
import { BootstrapViewerUseCase } from '@/domain/use-cases/bootstrap-viewer.use-case';

export interface BindingsState {
  readonly identity: ViewerIdentityEntity | null;
  readonly bindings: readonly CameraBindingEntity[];
  readonly hydrated: boolean;
  readonly hydrate: () => Promise<void>;
  readonly addCamera: (input: {
    pairingCode: string;
    label?: string;
  }) => Promise<CameraBindingEntity>;
  readonly removeCamera: (id: string) => Promise<void>;
  readonly renameCamera: (id: string, label: string) => Promise<void>;
}

export interface BindingsStoreDeps {
  readonly storage: IBindingStorageRepository;
  readonly generateId: () => string;
  readonly now: () => number;
  readonly resolveCameraId?: (pairingCode: string) => string;
}

export function createBindingsStore(deps: BindingsStoreDeps) {
  const resolveCameraId =
    deps.resolveCameraId ?? ((code: string) => `camera-${code.toUpperCase()}`);

  const bootstrap = new BootstrapViewerUseCase({
    storage: deps.storage,
    generateId: deps.generateId,
    now: deps.now,
  });
  const addUC = new AddCameraUseCase({
    generateId: deps.generateId,
    now: deps.now,
    resolveCameraId,
  });
  const removeUC = new RemoveCameraUseCase();
  const renameUC = new RenameCameraUseCase();

  return createStore<BindingsState>((set, get) => {
    const persist = async (
      identity: ViewerIdentityEntity | null,
      bindings: readonly CameraBindingEntity[],
    ): Promise<void> => {
      const state: PersistedState = {
        identity: identity ? identity.toJSON() : null,
        bindings: bindings.map((b) => b.toJSON()),
      };
      await deps.storage.save(state);
    };

    return {
      identity: null,
      bindings: [],
      hydrated: false,

      hydrate: async () => {
        const result = await bootstrap.execute();
        set({
          identity: result.identity,
          bindings: result.bindings,
          hydrated: true,
        });
      },

      addCamera: async (input) => {
        const { bindings, identity } = get();
        const next = addUC.execute(input, bindings);
        const updated = [...bindings, next];
        set({ bindings: updated });
        await persist(identity, updated);
        return next;
      },

      removeCamera: async (id) => {
        const { bindings, identity } = get();
        const updated = removeUC.execute(bindings, id);
        set({ bindings: updated });
        await persist(identity, updated);
      },

      renameCamera: async (id, label) => {
        const { bindings, identity } = get();
        const updated = renameUC.execute(bindings, id, label);
        set({ bindings: updated });
        await persist(identity, updated);
      },
    };
  });
}

export type BindingsStore = ReturnType<typeof createBindingsStore>;

// Lazy-initialized singleton store for production. Tests should
// build their own via createBindingsStore() with InMemory storage.
let singleton: BindingsStore | null = null;

export function setBindingsStoreSingleton(store: BindingsStore): void {
  singleton = store;
}

export function getBindingsStoreSingleton(): BindingsStore {
  if (!singleton) {
    throw new Error(
      'bindings store not initialized — call setBindingsStoreSingleton() in app bootstrap',
    );
  }
  return singleton;
}

// Hook wrapper for components.
export function useBindingsStore<T>(selector: (state: BindingsState) => T): T {
  return useStore(getBindingsStoreSingleton(), selector);
}
