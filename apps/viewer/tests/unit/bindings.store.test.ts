import {
  createBindingsStore,
  type BindingsStore,
} from '@/presentation/stores/bindings.store';
import { InMemoryBindingStorageRepository } from '@/infrastructure/storage/in-memory-binding-storage';

function buildStore(): {
  store: BindingsStore;
  storage: InMemoryBindingStorageRepository;
} {
  const storage = new InMemoryBindingStorageRepository();
  let counter = 0;
  const store = createBindingsStore({
    storage,
    generateId: () => `id-${++counter}`,
    now: () => 1000 + counter,
  });
  return { store, storage };
}

describe('bindings.store', () => {
  it('hydrates with a fresh identity and empty bindings', async () => {
    const { store } = buildStore();
    await store.getState().hydrate();
    const state = store.getState();
    expect(state.hydrated).toBe(true);
    expect(state.identity?.dashboardId).toBe('id-1');
    expect(state.bindings).toHaveLength(0);
  });

  it('adds a camera and persists it', async () => {
    const { store, storage } = buildStore();
    await store.getState().hydrate();
    await store.getState().addCamera({ pairingCode: 'abc', label: 'Sala' });
    const state = store.getState();
    expect(state.bindings).toHaveLength(1);
    expect(state.bindings[0]!.label).toBe('Sala');
    const snap = storage.snapshot();
    expect(snap.bindings).toHaveLength(1);
    expect(snap.bindings[0]!.cameraId).toBe('camera-ABC');
  });

  it('removes a camera and persists', async () => {
    const { store, storage } = buildStore();
    await store.getState().hydrate();
    const b = await store.getState().addCamera({ pairingCode: 'A' });
    await store.getState().removeCamera(b.id);
    expect(store.getState().bindings).toHaveLength(0);
    expect(storage.snapshot().bindings).toHaveLength(0);
  });

  it('renames a camera and persists', async () => {
    const { store, storage } = buildStore();
    await store.getState().hydrate();
    const b = await store.getState().addCamera({ pairingCode: 'A' });
    await store.getState().renameCamera(b.id, 'Quintal');
    expect(store.getState().bindings[0]!.label).toBe('Quintal');
    expect(storage.snapshot().bindings[0]!.label).toBe('Quintal');
  });

  it('rejects adding the same camera twice', async () => {
    const { store } = buildStore();
    await store.getState().hydrate();
    await store.getState().addCamera({ pairingCode: 'A' });
    await expect(
      store.getState().addCamera({ pairingCode: 'a' }),
    ).rejects.toThrow();
  });
});
