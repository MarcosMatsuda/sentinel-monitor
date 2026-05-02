// ============================================================
// Bootstrap viewer — load persisted state, generating a fresh
// ViewerIdentity if none exists. Returns the hydrated state.
// ============================================================

import {
  ViewerIdentityEntity,
  type ViewerIdentityProps,
} from '../entities/viewer-identity.entity';
import { CameraBindingEntity } from '../entities/camera-binding.entity';
import type {
  IBindingStorageRepository,
  PersistedState,
} from '../repositories/i-binding-storage.repository';

export interface BootstrapResult {
  readonly identity: ViewerIdentityEntity;
  readonly bindings: readonly CameraBindingEntity[];
}

export interface BootstrapDeps {
  readonly storage: IBindingStorageRepository;
  readonly generateId: () => string;
  readonly now: () => number;
}

export class BootstrapViewerUseCase {
  constructor(private readonly deps: BootstrapDeps) {}

  async execute(): Promise<BootstrapResult> {
    const persisted = await this.deps.storage.load();
    const identity = this.resolveIdentity(persisted);
    const bindings = persisted.bindings.map((b) => CameraBindingEntity.create(b));

    // Persist if we just minted a new identity.
    if (!persisted.identity) {
      const next: PersistedState = {
        identity: identity.toJSON(),
        bindings: bindings.map((b) => b.toJSON()),
      };
      await this.deps.storage.save(next);
    }

    return { identity, bindings };
  }

  private resolveIdentity(persisted: PersistedState): ViewerIdentityEntity {
    if (persisted.identity) {
      return ViewerIdentityEntity.create(persisted.identity);
    }
    const fresh: ViewerIdentityProps = {
      dashboardId: this.deps.generateId(),
      createdAt: this.deps.now(),
    };
    return ViewerIdentityEntity.create(fresh);
  }
}
