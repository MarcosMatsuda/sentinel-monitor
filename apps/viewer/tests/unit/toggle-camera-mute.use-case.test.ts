import {
  ToggleCameraMuteUseCase,
  type MuteAdvisorySender,
  type MuteStore,
} from '@/domain/use-cases/toggle-camera-mute.use-case';

function makeStore(): MuteStore & { mutes: Record<string, boolean> } {
  const mutes: Record<string, boolean> = {};
  return {
    mutes,
    toggleMuted(cameraId: string): boolean {
      const next = !(mutes[cameraId] ?? false);
      mutes[cameraId] = next;
      return next;
    },
    setMuted(cameraId: string, muted: boolean): void {
      mutes[cameraId] = muted;
    },
    isMuted(cameraId: string): boolean {
      return mutes[cameraId] ?? false;
    },
  };
}

describe('ToggleCameraMuteUseCase', () => {
  it('execute toggles the store and returns the new value', () => {
    const store = makeStore();
    const uc = new ToggleCameraMuteUseCase({ store });
    const result = uc.execute('camera-1');
    expect(result).toEqual({
      cameraId: 'camera-1',
      muted: true,
      advisoryDelivered: false,
    });
    expect(store.isMuted('camera-1')).toBe(true);
  });

  it('execute toggles back on second call', () => {
    const store = makeStore();
    const uc = new ToggleCameraMuteUseCase({ store });
    uc.execute('camera-1');
    const result = uc.execute('camera-1');
    expect(result.muted).toBe(false);
    expect(store.isMuted('camera-1')).toBe(false);
  });

  it('set writes the explicit value', () => {
    const store = makeStore();
    const uc = new ToggleCameraMuteUseCase({ store });
    const result = uc.set('camera-2', true);
    expect(result).toEqual({
      cameraId: 'camera-2',
      muted: true,
      advisoryDelivered: false,
    });
    expect(store.isMuted('camera-2')).toBe(true);
  });

  it('execute fires the advisory sender with the new mute value', () => {
    const store = makeStore();
    const send = jest.fn().mockReturnValue(true);
    const sender: MuteAdvisorySender = { send };
    const uc = new ToggleCameraMuteUseCase({
      store,
      sender,
      now: () => 12345,
    });
    const result = uc.execute('camera-1');
    expect(send).toHaveBeenCalledWith('camera-1', {
      type: 'audio-mute-request',
      muted: true,
      ts: 12345,
    });
    expect(result.advisoryDelivered).toBe(true);
  });

  it('reports advisoryDelivered=false when sender returns false', () => {
    const store = makeStore();
    const sender: MuteAdvisorySender = { send: jest.fn().mockReturnValue(false) };
    const uc = new ToggleCameraMuteUseCase({ store, sender });
    expect(uc.execute('camera-1').advisoryDelivered).toBe(false);
  });

  it('swallows sender exceptions and still toggles the store', () => {
    const store = makeStore();
    const sender: MuteAdvisorySender = {
      send: jest.fn().mockImplementation(() => {
        throw new Error('peer not connected');
      }),
    };
    const uc = new ToggleCameraMuteUseCase({ store, sender });
    const result = uc.execute('camera-1');
    expect(result.advisoryDelivered).toBe(false);
    expect(result.muted).toBe(true);
    expect(store.isMuted('camera-1')).toBe(true);
  });

  it('set forwards the explicit muted flag to the sender', () => {
    const store = makeStore();
    const send = jest.fn().mockReturnValue(true);
    const uc = new ToggleCameraMuteUseCase({
      store,
      sender: { send },
      now: () => 999,
    });
    uc.set('camera-9', false);
    expect(send).toHaveBeenCalledWith('camera-9', {
      type: 'audio-mute-request',
      muted: false,
      ts: 999,
    });
  });
});
