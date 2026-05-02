// ============================================================
// Reconnect re-converge coverage for StartViewerSessionUseCase:
// when the signaling client fires `onReconnect`, the use case must
// re-register presence, re-subscribe to the cameras, re-query the
// presence snapshot, drop stale peers and connect to fresh ones.
// ============================================================

import { StartViewerSessionUseCase } from '@/domain/use-cases/start-viewer-session.use-case';
import type {
  CameraConnection,
  ConnectToCameraUseCase,
} from '@/domain/use-cases/connect-to-camera.use-case';
import type { ISignalingRepository } from '@/domain/repositories/i-signaling.repository';
import { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';
import type { PresenceChangeDto } from '@sentinel-monitor/shared-types';

interface FakeSignaling {
  connected: boolean;
  registerCalls: string[];
  subscribeCalls: Array<readonly string[]>;
  queryCalls: Array<readonly string[]>;
  presenceHandlers: Array<(c: PresenceChangeDto) => void>;
  reconnectHandlers: Array<() => void>;
  queryQueue: Array<{ online: readonly string[] }>;
  repo: ISignalingRepository;
}

function createFakeSignaling(initialQuery: { online: readonly string[] }): FakeSignaling {
  const f: FakeSignaling = {
    connected: true,
    registerCalls: [],
    subscribeCalls: [],
    queryCalls: [],
    presenceHandlers: [],
    reconnectHandlers: [],
    queryQueue: [initialQuery],
    repo: {} as ISignalingRepository,
  };
  f.repo = {
    connect: async () => {
      f.connected = true;
    },
    disconnect: () => {
      f.connected = false;
    },
    isConnected: () => f.connected,
    registerPresence: (id) => f.registerCalls.push(id),
    redeemPairingCode: async () => ({
      success: true,
      data: { cameraId: 'c', dashboardId: 'd' },
    }),
    queryPresence: async (ids) => {
      f.queryCalls.push(ids);
      return f.queryQueue.shift() ?? { online: [] };
    },
    subscribePresence: (ids) => f.subscribeCalls.push(ids),
    sendSignal: () => undefined,
    onSignal: () => undefined,
    offSignal: () => undefined,
    onPresenceChange: (h) => f.presenceHandlers.push(h),
    offPresenceChange: (h) => {
      f.presenceHandlers = f.presenceHandlers.filter((x) => x !== h);
    },
    onReconnect: (h) => f.reconnectHandlers.push(h),
    offReconnect: (h) => {
      f.reconnectHandlers = f.reconnectHandlers.filter((x) => x !== h);
    },
  };
  return f;
}

interface RecordedConnect {
  cameraId: string;
  closed: boolean;
  conn: CameraConnection;
}

function createConnectStub(failFor: Set<string> = new Set()): {
  uc: ConnectToCameraUseCase;
  records: RecordedConnect[];
} {
  const records: RecordedConnect[] = [];
  const uc = {
    async execute(cameraId: string): Promise<CameraConnection> {
      if (failFor.has(cameraId)) throw new Error(`boom-${cameraId}`);
      const rec: RecordedConnect = {
        cameraId,
        closed: false,
        conn: {} as CameraConnection,
      };
      rec.conn = {
        cameraId,
        subscriber: {} as never,
        close: () => {
          rec.closed = true;
        },
      };
      records.push(rec);
      return rec.conn;
    },
  } as unknown as ConnectToCameraUseCase;
  return { uc, records };
}

function makeBinding(cameraId: string, idx: number): CameraBindingEntity {
  return CameraBindingEntity.create({
    id: `binding-${idx}`,
    cameraId,
    label: `Camera ${idx}`,
    addedAt: idx,
  });
}

async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe('StartViewerSessionUseCase — reconnect re-converge', () => {
  it('on reconnect: re-registers presence, re-subscribes, re-queries presence and reconnects fresh online cameras', async () => {
    const signaling = createFakeSignaling({ online: ['cam-A'] });
    // Second response (post-reconnect): cam-A drops, cam-B comes online.
    signaling.queryQueue.push({ online: ['cam-B'] });
    const { uc: connectUC, records } = createConnectStub();
    const snapshots: string[][] = [];
    const changes: Array<[string, boolean]> = [];

    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: (online) => snapshots.push([...online]),
      onPresenceChange: (id, online) => changes.push([id, online]),
    });

    const session = await useCase.execute({
      bindings: [makeBinding('cam-A', 1), makeBinding('cam-B', 2)],
    });

    expect(signaling.registerCalls).toEqual(['dash-1']);
    expect(signaling.subscribeCalls).toEqual([['cam-A', 'cam-B']]);
    expect(signaling.queryCalls).toEqual([['cam-A', 'cam-B']]);
    expect(records.map((r) => r.cameraId)).toEqual(['cam-A']);
    expect(session.connections.has('cam-A')).toBe(true);

    // Simulate socket drop + reconnect.
    expect(signaling.reconnectHandlers).toHaveLength(1);
    signaling.reconnectHandlers[0]!();
    await flush();

    // Re-registered + re-subscribed + re-queried.
    expect(signaling.registerCalls).toEqual(['dash-1', 'dash-1']);
    expect(signaling.subscribeCalls).toEqual([
      ['cam-A', 'cam-B'],
      ['cam-A', 'cam-B'],
    ]);
    expect(signaling.queryCalls).toHaveLength(2);

    // Snapshot updated.
    expect(snapshots).toEqual([['cam-A'], ['cam-B']]);

    // Stale peer cam-A was closed; cam-B was opened.
    const camA = records.find((r) => r.cameraId === 'cam-A')!;
    expect(camA.closed).toBe(true);
    expect(records.map((r) => r.cameraId)).toEqual(['cam-A', 'cam-B']);
    expect(session.connections.has('cam-A')).toBe(false);
    expect(session.connections.has('cam-B')).toBe(true);

    // Presence change callbacks fired for the deltas.
    expect(changes).toEqual(
      expect.arrayContaining([
        ['cam-A', false],
        ['cam-B', true],
      ]),
    );
  });

  it('reconnect handler keeps existing peers when they remain online', async () => {
    const signaling = createFakeSignaling({ online: ['cam-A'] });
    signaling.queryQueue.push({ online: ['cam-A'] });
    const { uc: connectUC, records } = createConnectStub();

    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    const session = await useCase.execute({
      bindings: [makeBinding('cam-A', 1)],
    });

    signaling.reconnectHandlers[0]!();
    await flush();

    // cam-A should NOT have been re-opened nor closed.
    expect(records.filter((r) => r.cameraId === 'cam-A')).toHaveLength(1);
    expect(records[0]!.closed).toBe(false);
    expect(session.connections.has('cam-A')).toBe(true);
  });

  it('logs and continues when the re-query fails', async () => {
    const signaling = createFakeSignaling({ online: [] });
    // Make the next queryPresence reject.
    const original = signaling.repo.queryPresence;
    let calls = 0;
    signaling.repo = {
      ...signaling.repo,
      queryPresence: async (ids) => {
        calls += 1;
        if (calls === 2) throw new Error('network');
        return original(ids);
      },
    };
    const { uc: connectUC } = createConnectStub();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    await useCase.execute({ bindings: [makeBinding('cam-A', 1)] });

    signaling.reconnectHandlers[0]!();
    await flush();

    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('logs and continues when reconnect-driven connect fails for one camera', async () => {
    const signaling = createFakeSignaling({ online: [] });
    signaling.queryQueue.push({ online: ['cam-A', 'cam-B'] });
    const failFor = new Set<string>(['cam-A']);
    const { uc: connectUC, records } = createConnectStub(failFor);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    const session = await useCase.execute({
      bindings: [makeBinding('cam-A', 1), makeBinding('cam-B', 2)],
    });

    signaling.reconnectHandlers[0]!();
    await flush();

    expect(records.map((r) => r.cameraId)).toEqual(['cam-B']);
    expect(session.connections.has('cam-B')).toBe(true);
    expect(session.connections.has('cam-A')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('with no bindings, reconnect handler still re-registers presence', async () => {
    const signaling = createFakeSignaling({ online: [] });
    const { uc: connectUC } = createConnectStub();

    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    const session = await useCase.execute({ bindings: [] });

    expect(signaling.reconnectHandlers).toHaveLength(1);
    signaling.reconnectHandlers[0]!();
    expect(signaling.registerCalls).toEqual(['dash-1', 'dash-1']);

    await session.stop();
    expect(signaling.reconnectHandlers).toHaveLength(0);
  });

  it('stop() unsubscribes the reconnect handler', async () => {
    const signaling = createFakeSignaling({ online: [] });
    const { uc: connectUC } = createConnectStub();
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    const session = await useCase.execute({
      bindings: [makeBinding('cam-A', 1)],
    });
    expect(signaling.reconnectHandlers).toHaveLength(1);
    await session.stop();
    expect(signaling.reconnectHandlers).toHaveLength(0);
  });
});
