import { RequestPairingUseCase } from '../../src/domain/use-cases/request-pairing.use-case';
import type { ISignalingClient } from '../../src/domain/repositories/i-signaling.repository';
import type { CameraConfig } from '../../src/domain/entities/camera-config.entity';

const camera: CameraConfig = {
  id: 'cam-1',
  label: 'Sala',
  rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1',
  addedAt: 1000,
  pairedDashboards: [],
};

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

describe('RequestPairingUseCase', () => {
  let signaling: jest.Mocked<ISignalingClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    silentLogger.child.mockReturnValue(silentLogger);
    signaling = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      registerPresence: jest.fn(),
      sendSignal: jest.fn(),
      onSignal: jest.fn(),
      onPresenceChange: jest.fn(),
      requestPairingCode: jest.fn(),
      onPairingRedeemed: jest.fn(),
    };
  });

  it('returns the issued code on first attempt success', async () => {
    signaling.requestPairingCode.mockResolvedValue({ code: 'ABC123', expiresAt: 1700000060000 });

    const useCase = new RequestPairingUseCase({ signaling, logger: silentLogger });
    const prompt = await useCase.execute(camera);

    expect(prompt).toEqual({
      cameraId: 'cam-1',
      label: 'Sala',
      code: 'ABC123',
      expiresAt: 1700000060000,
    });
    expect(signaling.requestPairingCode).toHaveBeenCalledTimes(1);
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'pairing.code_issued', code: 'ABC123' }),
      expect.any(String),
    );
  });

  it('retries up to maxRetries before giving up', async () => {
    signaling.requestPairingCode
      .mockRejectedValueOnce(new Error('transient 1'))
      .mockRejectedValueOnce(new Error('transient 2'))
      .mockResolvedValueOnce({ code: 'XYZ789', expiresAt: 1700000060000 });

    const useCase = new RequestPairingUseCase({
      signaling,
      logger: silentLogger,
      maxRetries: 3,
    });
    const prompt = await useCase.execute(camera);

    expect(prompt.code).toBe('XYZ789');
    expect(signaling.requestPairingCode).toHaveBeenCalledTimes(3);
    expect(silentLogger.warn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    signaling.requestPairingCode.mockRejectedValue(new Error('always fails'));

    const useCase = new RequestPairingUseCase({
      signaling,
      logger: silentLogger,
      maxRetries: 2,
    });
    await expect(useCase.execute(camera)).rejects.toThrow('always fails');
    expect(signaling.requestPairingCode).toHaveBeenCalledTimes(2);
    expect(silentLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'pairing.request_exhausted' }),
      expect.any(String),
    );
  });

  it('uses default 3 retries when not specified', async () => {
    signaling.requestPairingCode.mockRejectedValue(new Error('boom'));

    const useCase = new RequestPairingUseCase({ signaling, logger: silentLogger });
    await expect(useCase.execute(camera)).rejects.toThrow('boom');
    expect(signaling.requestPairingCode).toHaveBeenCalledTimes(3);
  });

  it('wraps non-Error rejections in Error', async () => {
    signaling.requestPairingCode.mockRejectedValue('string error');

    const useCase = new RequestPairingUseCase({
      signaling,
      logger: silentLogger,
      maxRetries: 1,
    });
    await expect(useCase.execute(camera)).rejects.toBeInstanceOf(Error);
  });
});
