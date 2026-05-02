import { describe, expect, test, vi } from 'vitest';
import type {
  PairingCodeIssuedDto,
  PairingRedeemedDto,
  SignalDto,
  SignalPayload,
} from '@sentinel-monitor/shared-types';
import { BootstrapCameraUseCase } from '../../src/domain/use-cases/bootstrap-camera.use-case';
import type { IIdentityStorageRepository } from '../../src/domain/repositories/i-identity-storage.repository';
import type { IMediaCaptureRepository } from '../../src/domain/repositories/i-media-capture.repository';
import type { ISignalingRepository } from '../../src/domain/repositories/i-signaling.repository';
import type {
  DashboardPeerStatus,
  IWebRtcPublisherRepository,
} from '../../src/domain/repositories/i-webrtc-publisher.repository';

const buildHarness = (overrides: { paired?: string[]; cameraId?: string | null } = {}) => {
  const stored: { id: string | null; dashboards: string[] } = {
    id: overrides.cameraId ?? null,
    dashboards: overrides.paired ?? [],
  };

  const storage: IIdentityStorageRepository = {
    getCameraId: () => stored.id,
    setCameraId: (id) => {
      stored.id = id;
    },
    getPairedDashboards: () => stored.dashboards,
    setPairedDashboards: (ids) => {
      stored.dashboards = [...ids];
    },
  };

  const fakeStream = { id: 'stream' } as unknown as MediaStream;
  const mediaCapture: IMediaCaptureRepository = {
    requestAudioVideo: vi.fn().mockResolvedValue(fakeStream),
  };

  let signalHandler: ((signal: SignalDto) => void) | null = null;
  let pairingHandler: ((data: PairingRedeemedDto) => void) | null = null;
  const signalingMock = {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    registerPresence: vi.fn(),
    requestPairingCode: vi
      .fn<(cameraId: string) => Promise<PairingCodeIssuedDto>>()
      .mockResolvedValue({ code: 'ABCDEF', expiresAt: Date.now() + 60_000 }),
    sendSignal: vi.fn(),
    onSignal: vi.fn((h: (signal: SignalDto) => void) => {
      signalHandler = h;
    }),
    onPairingRedeemed: vi.fn((h: (data: PairingRedeemedDto) => void) => {
      pairingHandler = h;
    }),
  };
  const signaling: ISignalingRepository = signalingMock;

  let publisherSignalHandler: ((signal: SignalDto) => void) | null = null;
  let publisherStatusHandler: ((status: DashboardPeerStatus) => void) | null = null;
  const publisherMock = {
    setStream: vi.fn(),
    handleIncomingSignal: vi
      .fn<(from: string, payload: SignalPayload) => Promise<void>>()
      .mockResolvedValue(undefined),
    removeDashboard: vi.fn(),
    getStatuses: vi.fn().mockReturnValue([] as DashboardPeerStatus[]),
    onSignalToSend: vi.fn((h: (signal: SignalDto) => void) => {
      publisherSignalHandler = h;
    }),
    onStatusChange: vi.fn((h: (status: DashboardPeerStatus) => void) => {
      publisherStatusHandler = h;
    }),
    closeAll: vi.fn(),
  };
  const publisher: IWebRtcPublisherRepository = publisherMock;

  return {
    storage,
    stored,
    mediaCapture,
    signaling,
    signalingMock,
    publisher,
    publisherMock,
    fakeStream,
    fireSignal: (s: SignalDto) => signalHandler?.(s),
    firePairingRedeemed: (data: PairingRedeemedDto) => pairingHandler?.(data),
    firePublisherSignal: (s: SignalDto) => publisherSignalHandler?.(s),
    firePublisherStatus: (s: DashboardPeerStatus) => publisherStatusHandler?.(s),
  };
};

describe('BootstrapCameraUseCase', () => {
  test('unpaired flow: requests pairing code and returns pairing screen', async () => {
    const h = buildHarness({ cameraId: 'cam-1' });
    const useCase = new BootstrapCameraUseCase({
      storage: h.storage,
      mediaCapture: h.mediaCapture,
      signaling: h.signaling,
      publisher: h.publisher,
    });

    const result = await useCase.execute();

    expect(result.identity.id).toBe('cam-1');
    expect(result.screen).toBe('pairing');
    expect(result.pairingState?.code).toBe('ABCDEF');
    expect(result.stream).toBe(h.fakeStream);
    expect(h.signalingMock.registerPresence).toHaveBeenCalledWith('cam-1');
    expect(h.publisherMock.setStream).toHaveBeenCalledWith(h.fakeStream);
    expect(h.signalingMock.requestPairingCode).toHaveBeenCalledWith('cam-1');
  });

  test('paired flow: skips code request and returns streaming screen', async () => {
    const h = buildHarness({ cameraId: 'cam-2', paired: ['dash-a'] });
    const useCase = new BootstrapCameraUseCase({
      storage: h.storage,
      mediaCapture: h.mediaCapture,
      signaling: h.signaling,
      publisher: h.publisher,
    });

    const result = await useCase.execute();

    expect(result.screen).toBe('streaming');
    expect(result.pairingState).toBeNull();
    expect(result.pairedDashboards).toEqual(['dash-a']);
    expect(h.signalingMock.requestPairingCode).not.toHaveBeenCalled();
  });

  test('routes incoming signal events through the publisher', async () => {
    const h = buildHarness({ cameraId: 'cam-3', paired: ['dash-x'] });
    const useCase = new BootstrapCameraUseCase({
      storage: h.storage,
      mediaCapture: h.mediaCapture,
      signaling: h.signaling,
      publisher: h.publisher,
    });
    await useCase.execute();

    h.fireSignal({
      fromPeerId: 'dash-x',
      toPeerId: 'cam-3',
      payload: { type: 'offer', sdp: 'sdp' },
    });

    // microtask flush
    await Promise.resolve();
    expect(h.publisherMock.handleIncomingSignal).toHaveBeenCalledWith('dash-x', {
      type: 'offer',
      sdp: 'sdp',
    });
  });

  test('publisher signals are forwarded to signaling.sendSignal', async () => {
    const h = buildHarness({ cameraId: 'cam-4', paired: ['dash-y'] });
    const useCase = new BootstrapCameraUseCase({
      storage: h.storage,
      mediaCapture: h.mediaCapture,
      signaling: h.signaling,
      publisher: h.publisher,
    });
    await useCase.execute();

    const signal: SignalDto = {
      fromPeerId: 'cam-4',
      toPeerId: 'dash-y',
      payload: { type: 'answer', sdp: 'sdp' },
    };
    h.firePublisherSignal(signal);
    expect(h.signalingMock.sendSignal).toHaveBeenCalledWith(signal);
  });
});

describe('RequestPairingCodeUseCase (covered transitively)', () => {
  test('wraps the signaling DTO into a PairingStateEntity', async () => {
    const { RequestPairingCodeUseCase } = await import(
      '../../src/domain/use-cases/request-pairing-code.use-case'
    );
    const signaling = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(),
      registerPresence: vi.fn(),
      requestPairingCode: vi.fn().mockResolvedValue({ code: 'AAA111', expiresAt: 5_000 }),
      sendSignal: vi.fn(),
      onSignal: vi.fn(),
      onPairingRedeemed: vi.fn(),
    } satisfies ISignalingRepository;

    const useCase = new RequestPairingCodeUseCase(signaling);
    const state = await useCase.execute('cam-9');
    expect(state.code).toBe('AAA111');
    expect(state.expiresAt).toBe(5_000);
  });
});

describe('HandleIncomingSubscriberUseCase', () => {
  test('delegates to publisher.handleIncomingSignal with peer id and payload', async () => {
    const { HandleIncomingSubscriberUseCase } = await import(
      '../../src/domain/use-cases/handle-incoming-subscriber.use-case'
    );
    const publisher: IWebRtcPublisherRepository = {
      setStream: vi.fn(),
      handleIncomingSignal: vi.fn().mockResolvedValue(undefined),
      removeDashboard: vi.fn(),
      getStatuses: vi.fn().mockReturnValue([]),
      onSignalToSend: vi.fn(),
      onStatusChange: vi.fn(),
      closeAll: vi.fn(),
    };
    const useCase = new HandleIncomingSubscriberUseCase(publisher);
    await useCase.execute({
      fromPeerId: 'dash-1',
      toPeerId: 'cam',
      payload: { type: 'offer', sdp: 'sdp' },
    });
    expect(publisher.handleIncomingSignal).toHaveBeenCalledWith('dash-1', {
      type: 'offer',
      sdp: 'sdp',
    });
  });
});
