import { createPeersStore } from '@/presentation/stores/peers.store';

describe('peers.store — mute state', () => {
  it('isMuted defaults to false for unknown ids', () => {
    const store = createPeersStore();
    expect(store.getState().isMuted('camera-1')).toBe(false);
    expect(store.getState().mutes).toEqual({});
  });

  it('setMuted writes the value', () => {
    const store = createPeersStore();
    store.getState().setMuted('camera-1', true);
    expect(store.getState().isMuted('camera-1')).toBe(true);
    expect(store.getState().mutes).toEqual({ 'camera-1': true });
  });

  it('setMuted is a noop when value is unchanged', () => {
    const store = createPeersStore();
    store.getState().setMuted('camera-1', true);
    const before = store.getState().mutes;
    store.getState().setMuted('camera-1', true);
    expect(store.getState().mutes).toBe(before);
  });

  it('toggleMuted flips and returns the new value', () => {
    const store = createPeersStore();
    expect(store.getState().toggleMuted('camera-1')).toBe(true);
    expect(store.getState().isMuted('camera-1')).toBe(true);
    expect(store.getState().toggleMuted('camera-1')).toBe(false);
    expect(store.getState().isMuted('camera-1')).toBe(false);
  });

  it('mute state survives setStream / setState transitions', () => {
    const store = createPeersStore();
    store.getState().setMuted('camera-1', true);
    store.getState().setState('camera-1', 'connecting');
    store
      .getState()
      .setStream('camera-1', { id: 's' } as unknown as MediaStream);
    expect(store.getState().isMuted('camera-1')).toBe(true);
  });

  it('remove clears the per-camera mute flag', () => {
    const store = createPeersStore();
    store.getState().setState('camera-1', 'connected');
    store.getState().setMuted('camera-1', true);
    store.getState().remove('camera-1');
    expect(store.getState().mutes).toEqual({});
    expect(store.getState().isMuted('camera-1')).toBe(false);
  });

  it('remove with only a mute (no peer) still clears it', () => {
    const store = createPeersStore();
    store.getState().setMuted('camera-2', true);
    store.getState().remove('camera-2');
    expect(store.getState().mutes).toEqual({});
  });

  it('clear empties mutes alongside peers', () => {
    const store = createPeersStore();
    store.getState().setMuted('a', true);
    store.getState().setState('b', 'connected');
    store.getState().clear();
    expect(store.getState().mutes).toEqual({});
    expect(store.getState().peers).toEqual({});
  });
});
