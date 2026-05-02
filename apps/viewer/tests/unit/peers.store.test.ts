import {
  createPeersStore,
  setPeersStoreSingleton,
  getPeersStoreSingleton,
} from '@/presentation/stores/peers.store';

const fakeStream = (): MediaStream =>
  ({ id: 'stream' } as unknown as MediaStream);

describe('peers.store', () => {
  it('starts empty', () => {
    const store = createPeersStore();
    expect(store.getState().peers).toEqual({});
    expect(store.getState().get('camera-1')).toBeUndefined();
  });

  it('setStream creates an entry with default state "connected"', () => {
    const store = createPeersStore();
    const s = fakeStream();
    store.getState().setStream('camera-1', s);
    const entry = store.getState().get('camera-1');
    expect(entry).toEqual({
      cameraId: 'camera-1',
      stream: s,
      state: 'connected',
    });
  });

  it('setStream preserves existing state if already set', () => {
    const store = createPeersStore();
    store.getState().setState('camera-1', 'connecting');
    const s = fakeStream();
    store.getState().setStream('camera-1', s);
    expect(store.getState().get('camera-1')!.state).toBe('connecting');
    expect(store.getState().get('camera-1')!.stream).toBe(s);
  });

  it('setState creates an entry with null stream when none exists', () => {
    const store = createPeersStore();
    store.getState().setState('camera-2', 'idle');
    expect(store.getState().get('camera-2')).toEqual({
      cameraId: 'camera-2',
      stream: null,
      state: 'idle',
    });
  });

  it('setState preserves the existing stream', () => {
    const store = createPeersStore();
    const s = fakeStream();
    store.getState().setStream('camera-1', s);
    store.getState().setState('camera-1', 'reconnecting');
    expect(store.getState().get('camera-1')!.stream).toBe(s);
    expect(store.getState().get('camera-1')!.state).toBe('reconnecting');
  });

  it('remove deletes an entry', () => {
    const store = createPeersStore();
    store.getState().setState('camera-1', 'connected');
    store.getState().remove('camera-1');
    expect(store.getState().get('camera-1')).toBeUndefined();
  });

  it('remove is a noop for unknown ids', () => {
    const store = createPeersStore();
    const before = store.getState().peers;
    store.getState().remove('nope');
    expect(store.getState().peers).toBe(before);
  });

  it('clear empties everything', () => {
    const store = createPeersStore();
    store.getState().setState('a', 'connected');
    store.getState().setState('b', 'connected');
    store.getState().clear();
    expect(store.getState().peers).toEqual({});
  });
});

describe('peers.store singleton helpers', () => {
  it('getPeersStoreSingleton throws when not initialized', () => {
    jest.isolateModules(() => {
      const mod = require('@/presentation/stores/peers.store');
      expect(() => mod.getPeersStoreSingleton()).toThrow(/not initialized/);
    });
  });

  it('set + get returns the same store', () => {
    const store = createPeersStore();
    setPeersStoreSingleton(store);
    expect(getPeersStoreSingleton()).toBe(store);
  });
});
