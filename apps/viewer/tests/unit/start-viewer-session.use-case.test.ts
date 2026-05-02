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
  connectCalls: number;
  registerCalls: string[];
  subscribeCalls: Array<readonly string[]>;
  queryCalls: Array<readonly string[]>;
  presenceHandlers: Array<(c: PresenceChangeDto) => void>;
  queryResult: { online: readonly string[] };
  repo: ISignalingRepository;
}

function createFakeSignaling(initiallyConnected = false): FakeSignaling {
  const f: FakeSignaling = {
    connected: initiallyConnected,
    connectCalls: 0,
    registerCalls: [],
    subscribeCalls: [],
    queryCalls: [],
    presenceHandlers: [],
    queryResult: { online: [] },
    repo: {} as ISignalingRepository,
  };
  f.repo = {
    connect: async () => {
      f.connectCalls += 1;
      f.connected = true;
    },
    disconnect: () => {
      f.connected = false;
    },
    isConnected: () => f.connected,
    registerPresence: (id) => {
      f.registerCalls.push(id);
    },
    redeemPairingCode: async () => ({
      success: true,
      data: { cameraId: 'c', dashboardId: 'd' },
    }),
    queryPresence: async (ids) => {
      f.queryCalls.push(ids);
      return f.queryResult;
    },
    subscribePresence: (ids) => {
      f.subscribeCalls.push(ids);
    },
    sendSignal: () => undefined,
    onSignal: () => undefined,
    offSignal: () => undefined,
    onPresenceChange: (h) => {
      f.presenceHandlers.push(h);
    },
    offPresenceChange: (h) => {
      f.presenceHandlers = f.presenceHandlers.filter((x) => x !== h);
    },
  };
  return f;
}

interface RecordedConnect {
  cameraId: string;
  conn: CameraConnection;
  closed: boolean;
}

function createConnectToCameraStub(): {
  uc: ConnectToCameraUseCase;
  records: RecordedConnect[];
  failFor: Set<string>;
} {
  const records: RecordedConnect[] = [];
  const failFor = new Set<string>();
  const uc = {
    async execute(cameraId: string): Promise<CameraConnection> {
      if (failFor.has(cameraId)) {
        throw new Error(`boom-${cameraId}`);
      }
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
  return { uc, records, failFor };
}

function makeBinding(cameraId: string, idx: number): CameraBindingEntity {
  return CameraBindingEntity.create({
    id: `binding-${idx}`,
    cameraId,
    label: `Camera ${idx}`,
    addedAt: idx,
  });
}

describe('StartViewerSessionUseCase', () => {
  it('connects signaling when not yet connected and registers presence', async () => {
    const signaling = createFakeSignaling(false);
    const { uc: connectUC } = createConnectToCameraStub();
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    await useCase.execute({ bindings: [] });
    expect(signaling.connectCalls).toBe(1);
    expect(signaling.registerCalls).toEqual(['dash-1']);
  });

  it('skips connect when signaling is already connected', async () => {
    const signaling = createFakeSignaling(true);
    const { uc: connectUC } = createConnectToCameraStub();
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    await useCase.execute({ bindings: [] });
    expect(signaling.connectCalls).toBe(0);
  });

  it('with no bindings, registers a noop presence handler that gets removed on stop', async () => {
    const signaling = createFakeSignaling(true);
    const { uc: connectUC } = createConnectToCameraStub();
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    const session = await useCase.execute({ bindings: [] });
    expect(signaling.subscribeCalls).toHaveLength(0);
    expect(signaling.queryCalls).toHaveLength(0);
    expect(signaling.presenceHandlers).toHaveLength(1);
    await session.stop();
    expect(signaling.presenceHandlers).toHaveLength(0);
  });

  it('subscribes + queries presence and connects to every online camera', async () => {
    const signaling = createFakeSignaling(true);
    signaling.queryResult = { online: ['cam-A', 'cam-C'] };
    const { uc: connectUC, records } = createConnectToCameraStub();
    const snapshots: ReadonlyArray<readonly string[]> = [];
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: (online) => {
        (snapshots as string[][]).push([...online]);
      },
      onPresenceChange: () => undefined,
    });
    const bindings = [
      makeBinding('cam-A', 1),
      makeBinding('cam-B', 2),
      makeBinding('cam-C', 3),
    ];
    const session = await useCase.execute({ bindings });
    expect(signaling.subscribeCalls).toEqual([['cam-A', 'cam-B', 'cam-C']]);
    expect(signaling.queryCalls).toEqual([['cam-A', 'cam-B', 'cam-C']]);
    expect(snapshots).toEqual([['cam-A', 'cam-C']]);
    expect(records.map((r) => r.cameraId)).toEqual(['cam-A', 'cam-C']);
    expect(session.connections.size).toBe(2);
    expect(session.connections.has('cam-A')).toBe(true);
    expect(session.connections.has('cam-C')).toBe(true);
  });

  it('survives a connect failure and continues with the remaining cameras', async () => {
    const signaling = createFakeSignaling(true);
    signaling.queryResult = { online: ['cam-A', 'cam-B'] };
    const { uc: connectUC, records, failFor } = createConnectToCameraStub();
    failFor.add('cam-A');
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
    expect(records.map((r) => r.cameraId)).toEqual(['cam-B']);
    expect(session.connections.has('cam-B')).toBe(true);
    expect(session.connections.has('cam-A')).toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('reacts to presence-change online by connecting and storing the connection', async () => {
    const signaling = createFakeSignaling(true);
    signaling.queryResult = { online: [] };
    const { uc: connectUC, records } = createConnectToCameraStub();
    const changes: Array<[string, boolean]> = [];
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: (id, online) => changes.push([id, online]),
    });
    const session = await useCase.execute({
      bindings: [makeBinding('cam-A', 1)],
    });
    const handler = signaling.presenceHandlers[0]!;
    handler({ peerId: 'cam-A', online: true });
    // wait for the dispatched .then() to resolve
    await new Promise((r) => setTimeout(r, 0));
    expect(changes).toEqual([['cam-A', true]]);
    expect(records.map((r) => r.cameraId)).toEqual(['cam-A']);
    expect(session.connections.has('cam-A')).toBe(true);
  });

  it('ignores presence changes for unknown peers', async () => {
    const signaling = createFakeSignaling(true);
    const { uc: connectUC, records } = createConnectToCameraStub();
    const changes: Array<[string, boolean]> = [];
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: (id, online) => changes.push([id, online]),
    });
    await useCase.execute({ bindings: [makeBinding('cam-A', 1)] });
    signaling.presenceHandlers[0]!({ peerId: 'cam-OTHER', online: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(changes).toEqual([]);
    expect(records).toHaveLength(0);
  });

  it('does not double-connect when an online change arrives for an already-connected peer', async () => {
    const signaling = createFakeSignaling(true);
    signaling.queryResult = { online: ['cam-A'] };
    const { uc: connectUC, records } = createConnectToCameraStub();
    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    await useCase.execute({ bindings: [makeBinding('cam-A', 1)] });
    expect(records).toHaveLength(1);
    signaling.presenceHandlers[0]!({ peerId: 'cam-A', online: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(records).toHaveLength(1);
  });

  it('closes and removes the connection when a peer goes offline', async () => {
    const signaling = createFakeSignaling(true);
    signaling.queryResult = { online: ['cam-A'] };
    const { uc: connectUC, records } = createConnectToCameraStub();
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
    signaling.presenceHandlers[0]!({ peerId: 'cam-A', online: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(records[0]!.closed).toBe(true);
    expect(session.connections.has('cam-A')).toBe(false);
  });

  it('logs a warning if reconnect fails', async () => {
    const signaling = createFakeSignaling(true);
    signaling.queryResult = { online: [] };
    const { uc: connectUC, failFor } = createConnectToCameraStub();
    failFor.add('cam-A');
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    const useCase = new StartViewerSessionUseCase({
      signaling: signaling.repo,
      connectToCamera: connectUC,
      dashboardId: 'dash-1',
      onPresenceSnapshot: () => undefined,
      onPresenceChange: () => undefined,
    });
    await useCase.execute({ bindings: [makeBinding('cam-A', 1)] });
    signaling.presenceHandlers[0]!({ peerId: 'cam-A', online: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stop() unsubscribes presence handler and closes every active connection', async () => {
    const signaling = createFakeSignaling(true);
    signaling.queryResult = { online: ['cam-A', 'cam-B'] };
    const { uc: connectUC, records } = createConnectToCameraStub();
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
    await session.stop();
    expect(signaling.presenceHandlers).toHaveLength(0);
    expect(records.every((r) => r.closed)).toBe(true);
    expect(session.connections.size).toBe(0);
  });
});
