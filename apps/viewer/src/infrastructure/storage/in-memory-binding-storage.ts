// ============================================================
// In-memory binding storage — for tests only. Not imported by
// any platform bundle.
// ============================================================

import type {
  IBindingStorageRepository,
  PersistedState,
} from '@/domain/repositories/i-binding-storage.repository';

export class InMemoryBindingStorageRepository
  implements IBindingStorageRepository
{
  private state: PersistedState = { identity: null, bindings: [] };

  async load(): Promise<PersistedState> {
    return this.state;
  }

  async save(state: PersistedState): Promise<void> {
    this.state = state;
  }

  snapshot(): PersistedState {
    return this.state;
  }
}
