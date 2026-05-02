import {
  ConnectToCameraUseCase,
  type SubscriberFactory,
} from '@/domain/use-cases/connect-to-camera.use-case';
import type { ISignalingRepository } from '@/domain/repositories/i-signaling.repository';
import type {
  IWebRtcSubscriberRepository,
  SubscriberState,
} from '@/domain/repositories/i-webrtc-subscriber.repository';
import type {
  SignalDto,
  SignalPayload,
} from '@sentinel-monitor/shared-types';

interface FakeSubscriber extends IWebRtcSubscriberRepository {
  trackHandler: ((stream: MediaStream) => void) | null;
  stateHandler: ((state: SubscriberState) => void) | null;
  emitSignal: (payload: SignalPayload) => void;
  cameraIdAtConnect: string | null;
  closed: boolean;
  incoming: SignalPayload[];
  connectImpl: (() => Promise<void>) | null;
}

function createFakeSubscriber(emit: (p: SignalPayload) => void): FakeSubscriber {
  let state: SubscriberState = 'idle';
  const sub: FakeSubscriber = {
    trackHandler: null,
    stateHandler: null,
    emitSignal: emit,
    cameraIdAtConnect: null,
    closed: false,
    incoming: [],
    connectImpl: null,
    async connect(cameraId: string) {
      sub.cameraIdAtConnect = cameraId;
      if (sub.connectImpl) await sub.connectImpl();
    },
    async handleIncomingSignal(payload: SignalPayload) {
      sub.incoming.push(payload);
    },
    close() {
      sub.closed = true;
    },
    onTrack(handler) {
      sub.trackHandler = handler;
    },
    onStateChange(handler) {
      sub.stateHandler = handler;
    },
    getState() {
      return state;
    },
  };
  void state;
  return sub;
}

interface FakeSignaling {
  signalHandlers: Array<(s: SignalDto) => void>;
  presenceHandlers: Array<(c: { peerId: string; online: boolean }) => void>;
  sent: SignalDto[];
  repo: ISignalingRepository;
}

function createFakeSignaling(): FakeSignaling {
  const f: FakeSignaling = {
    signalHandlers: [],
    presenceHandlers: [],
    sent: [],
    repo: {} as ISignalingRepository,
  };
  f.repo = {
    connect: async () => undefined,
    disconnect: () => undefined,
    isConnected: () => true,
    registerPresence: () => undefined,
    redeemPairingCode: async () => ({
      success: true,
      data: { cameraId: 'c', dashboardId: 'd' },
    }),
    queryPresence: async () => ({ online: [] }),
    subscribePresence: () => undefined,
    sendSignal: (s) => f.sent.push(s),
    onSignal: (h) => {
      f.signalHandlers.push(h);
    },
    offSignal: (h) => {
      f.signalHandlers = f.signalHandlers.filter((x) => x !== h);
    },
    onPresenceChange: (h) => {
      f.presenceHandlers.push(h);
    },
    offPresenceChange: (h) => {
      f.presenceHandlers = f.presenceHandlers.filter((x) => x !== h);
    },
  };
  return f;
}

function buildUseCase(): {
  uc: ConnectToCameraUseCase;
  signaling: FakeSignaling;
  subscribers: FakeSubscriber[];
  streams: Array<{ cameraId: string; stream: MediaStream }>;
  states: Array<{ cameraId: string; state: SubscriberState }>;
  factory: SubscriberFactory;
} {
  const signaling = createFakeSignaling();
  const subscribers: FakeSubscriber[] = [];
  const streams: Array<{ cameraId: string; stream: MediaStream }> = [];
  const states: Array<{ cameraId: string; state: SubscriberState }> = [];
  const factory: SubscriberFactory = (cameraId, emitSignal) => {
    const s = createFakeSubscriber(emitSignal);
    subscribers.push(s);
    void cameraId;
    return s;
  };
  const uc = new ConnectToCameraUseCase({
    signaling: signaling.repo,
    subscriberFactory: factory,
    dashboardId: 'dash-1',
    onStream: (cameraId, stream) => streams.push({ cameraId, stream }),
    onState: (cameraId, state) => states.push({ cameraId, state }),
  });
  return { uc, signaling, subscribers, streams, states, factory };
}

describe('ConnectToCameraUseCase', () => {
  it('builds a subscriber, wires signal handler and triggers connect', async () => {
    const { uc, signaling, subscribers, states } = buildUseCase();
    const conn = await uc.execute('camera-1');
    expect(subscribers).toHaveLength(1);
    expect(subscribers[0]!.cameraIdAtConnect).toBe('camera-1');
    expect(signaling.signalHandlers).toHaveLength(1);
    expect(states[0]).toEqual({ cameraId: 'camera-1', state: 'connecting' });
    expect(conn.cameraId).toBe('camera-1');
    expect(conn.subscriber).toBe(subscribers[0]);
  });

  it('emitSignal wraps payload with from/to peer ids', async () => {
    const { uc, signaling, subscribers } = buildUseCase();
    await uc.execute('camera-1');
    subscribers[0]!.emitSignal({ type: 'offer', sdp: 'v=0' });
    expect(signaling.sent).toEqual([
      {
        fromPeerId: 'dash-1',
        toPeerId: 'camera-1',
        payload: { type: 'offer', sdp: 'v=0' },
      },
    ]);
  });

  it('forwards inbound signals from the matching peer to the subscriber', async () => {
    const { uc, signaling, subscribers } = buildUseCase();
    await uc.execute('camera-1');
    const handler = signaling.signalHandlers[0]!;
    handler({
      fromPeerId: 'camera-1',
      toPeerId: 'dash-1',
      payload: { type: 'answer', sdp: 'v=0' },
    });
    // Drain microtask
    await Promise.resolve();
    expect(subscribers[0]!.incoming).toEqual([{ type: 'answer', sdp: 'v=0' }]);
  });

  it('ignores inbound signals from other peers', async () => {
    const { uc, signaling, subscribers } = buildUseCase();
    await uc.execute('camera-1');
    signaling.signalHandlers[0]!({
      fromPeerId: 'camera-OTHER',
      toPeerId: 'dash-1',
      payload: { type: 'answer', sdp: '' },
    });
    await Promise.resolve();
    expect(subscribers[0]!.incoming).toHaveLength(0);
  });

  it('forwards onTrack into onStream callback', async () => {
    const { uc, subscribers, streams } = buildUseCase();
    await uc.execute('camera-1');
    const fakeStream = { id: 's' } as unknown as MediaStream;
    subscribers[0]!.trackHandler!(fakeStream);
    expect(streams).toEqual([{ cameraId: 'camera-1', stream: fakeStream }]);
  });

  it('forwards onStateChange into onState callback', async () => {
    const { uc, subscribers, states } = buildUseCase();
    await uc.execute('camera-1');
    subscribers[0]!.stateHandler!('connected');
    expect(states).toContainEqual({ cameraId: 'camera-1', state: 'connected' });
  });

  it('close() detaches signal handler, closes subscriber, emits closed state', async () => {
    const { uc, signaling, subscribers, states } = buildUseCase();
    const conn = await uc.execute('camera-1');
    conn.close();
    expect(signaling.signalHandlers).toHaveLength(0);
    expect(subscribers[0]!.closed).toBe(true);
    expect(states.at(-1)).toEqual({ cameraId: 'camera-1', state: 'closed' });
  });
});
