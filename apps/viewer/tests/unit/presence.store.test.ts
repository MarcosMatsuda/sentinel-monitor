import {
  createPresenceStore,
  setPresenceStoreSingleton,
  getPresenceStoreSingleton,
} from '@/presentation/stores/presence.store';

describe('presence.store', () => {
  it('starts with no online peers', () => {
    const store = createPresenceStore();
    expect(store.getState().online).toEqual({});
    expect(store.getState().isOnline('camera-1')).toBe(false);
  });

  it('setMany marks every id as online and replaces previous state', () => {
    const store = createPresenceStore();
    store.getState().setOne('old', true);
    store.getState().setMany(['a', 'b', 'c']);
    expect(store.getState().online).toEqual({ a: true, b: true, c: true });
    expect(store.getState().isOnline('old')).toBe(false);
  });

  it('setMany with empty array clears online', () => {
    const store = createPresenceStore();
    store.getState().setOne('x', true);
    store.getState().setMany([]);
    expect(store.getState().online).toEqual({});
  });

  it('setOne flips a peer online and offline', () => {
    const store = createPresenceStore();
    store.getState().setOne('camera-1', true);
    expect(store.getState().isOnline('camera-1')).toBe(true);
    store.getState().setOne('camera-1', false);
    expect(store.getState().isOnline('camera-1')).toBe(false);
  });

  it('setOne is a noop when value does not change (same reference)', () => {
    const store = createPresenceStore();
    store.getState().setOne('camera-1', true);
    const ref = store.getState().online;
    store.getState().setOne('camera-1', true);
    expect(store.getState().online).toBe(ref);
  });

  it('reset clears online', () => {
    const store = createPresenceStore();
    store.getState().setMany(['a', 'b']);
    store.getState().reset();
    expect(store.getState().online).toEqual({});
  });
});

describe('presence.store singleton helpers', () => {
  it('getPresenceStoreSingleton throws when not initialized', () => {
    jest.isolateModules(() => {
      const mod = require('@/presentation/stores/presence.store');
      expect(() => mod.getPresenceStoreSingleton()).toThrow(/not initialized/);
    });
  });

  it('set + get returns the same store', () => {
    const store = createPresenceStore();
    setPresenceStoreSingleton(store);
    expect(getPresenceStoreSingleton()).toBe(store);
  });
});
