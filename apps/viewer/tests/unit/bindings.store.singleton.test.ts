import {
  createBindingsStore,
  getBindingsStoreSingleton,
  setBindingsStoreSingleton,
} from '@/presentation/stores/bindings.store';
import { InMemoryBindingStorageRepository } from '@/infrastructure/storage/in-memory-binding-storage';

describe('bindings.store singleton helpers', () => {
  it('getBindingsStoreSingleton throws when not initialized', () => {
    // Force-reset by setting to a known store first, then test the throw path
    // by clearing via re-import is not possible; instead verify error message
    // when not yet set in a freshly required module via jest.isolateModules.
    jest.isolateModules(() => {
      const mod = require('@/presentation/stores/bindings.store');
      expect(() => mod.getBindingsStoreSingleton()).toThrow(/not initialized/);
    });
  });

  it('set + get returns the same store', () => {
    const store = createBindingsStore({
      storage: new InMemoryBindingStorageRepository(),
      generateId: () => 'x',
      now: () => 0,
    });
    setBindingsStoreSingleton(store);
    expect(getBindingsStoreSingleton()).toBe(store);
  });
});
