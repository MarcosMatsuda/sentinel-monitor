import { HandlePairingRedeemedUseCase } from '../../src/domain/use-cases/handle-pairing-redeemed.use-case';
import type { IConfigStorageRepository } from '../../src/domain/repositories/i-config-storage.repository';
import type { GatewayConfig } from '../../src/domain/entities/gateway-config.entity';

const baseConfig = (cameras: GatewayConfig['cameras']): GatewayConfig => ({
  id: '11111111-1111-1111-1111-111111111111',
  signalingUrl: 'http://localhost:3010',
  go2rtcUrl: 'http://127.0.0.1:1984',
  cameras,
});

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

describe('HandlePairingRedeemedUseCase', () => {
  let storage: jest.Mocked<IConfigStorageRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    silentLogger.child.mockReturnValue(silentLogger);
    storage = {
      load: jest.fn(),
      save: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('appends a new dashboardId to the camera and persists', async () => {
    storage.load.mockResolvedValue(
      baseConfig([
        {
          id: 'cam-1',
          label: 'Sala',
          rtspUrl: 'rtsp://u:p@host:554/s1',
          addedAt: 1000,
          pairedDashboards: [],
        },
      ]),
    );

    const useCase = new HandlePairingRedeemedUseCase({
      configStorage: storage,
      logger: silentLogger,
    });
    const result = await useCase.execute({ cameraId: 'cam-1', dashboardId: 'dash-1' });

    expect(result).toEqual({
      handled: true,
      cameraId: 'cam-1',
      dashboardId: 'dash-1',
      alreadyPaired: false,
    });
    expect(storage.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cameras: expect.arrayContaining([
          expect.objectContaining({
            id: 'cam-1',
            pairedDashboards: ['dash-1'],
          }),
        ]),
      }),
    );
  });

  it('is idempotent for an already-paired dashboard (no save)', async () => {
    storage.load.mockResolvedValue(
      baseConfig([
        {
          id: 'cam-1',
          label: 'Sala',
          rtspUrl: 'rtsp://u:p@host:554/s1',
          addedAt: 1000,
          pairedDashboards: ['dash-1'],
        },
      ]),
    );

    const useCase = new HandlePairingRedeemedUseCase({
      configStorage: storage,
      logger: silentLogger,
    });
    const result = await useCase.execute({ cameraId: 'cam-1', dashboardId: 'dash-1' });

    expect(result).toEqual({
      handled: true,
      cameraId: 'cam-1',
      dashboardId: 'dash-1',
      alreadyPaired: true,
    });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('rejects unknown camera ids without saving', async () => {
    storage.load.mockResolvedValue(baseConfig([]));

    const useCase = new HandlePairingRedeemedUseCase({
      configStorage: storage,
      logger: silentLogger,
    });
    const result = await useCase.execute({ cameraId: 'ghost', dashboardId: 'dash-1' });

    expect(result).toEqual({ handled: false, reason: 'unknown-camera' });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it('preserves other cameras and previously-paired dashboards', async () => {
    storage.load.mockResolvedValue(
      baseConfig([
        {
          id: 'cam-1',
          label: 'Sala',
          rtspUrl: 'rtsp://u:p@host:554/s1',
          addedAt: 1000,
          pairedDashboards: ['dash-old'],
        },
        {
          id: 'cam-2',
          label: 'Quarto',
          rtspUrl: 'rtsp://u:p@host2:554/s1',
          addedAt: 1001,
          pairedDashboards: [],
        },
      ]),
    );

    const useCase = new HandlePairingRedeemedUseCase({
      configStorage: storage,
      logger: silentLogger,
    });
    await useCase.execute({ cameraId: 'cam-1', dashboardId: 'dash-new' });

    const saved = storage.save.mock.calls[0]![0];
    expect(saved.cameras).toHaveLength(2);
    const cam1 = saved.cameras.find((c) => c.id === 'cam-1')!;
    const cam2 = saved.cameras.find((c) => c.id === 'cam-2')!;
    expect(cam1.pairedDashboards).toEqual(['dash-old', 'dash-new']);
    expect(cam2.pairedDashboards).toEqual([]);
  });
});
