// ============================================================
// IBindingStorageRepository — abstraction over platform-specific
// storage. Web implementation uses localStorage; native uses
// AsyncStorage. Selected at build time via .web.ts / .native.ts
// file extensions, never via runtime Platform.OS.
// ============================================================

import type { CameraBindingProps } from '../entities/camera-binding.entity';
import type { ViewerIdentityProps } from '../entities/viewer-identity.entity';

export interface PersistedState {
  readonly identity: ViewerIdentityProps | null;
  readonly bindings: readonly CameraBindingProps[];
}

export interface IBindingStorageRepository {
  load(): Promise<PersistedState>;
  save(state: PersistedState): Promise<void>;
}

export const STORAGE_KEY = 'sm.bindings';
