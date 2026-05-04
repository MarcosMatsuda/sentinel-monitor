import { StopCameraUseCase } from '../../src/domain/use-cases/stop-camera.use-case';
import type { ICameraPublisher } from '../../src/domain/repositories/i-camera-publisher.repository';
import type { ISignalingClient } from '../../src/domain/repositories/i-signaling.repository';
import type { IGo2RtcClient } from '../../src/domain/repositories/i-go2rtc-client.repository';

describe('StopCameraUseCase', () => {
  let go2rtc: jest.Mocked<IGo2RtcClient>;
  let signaling: jest.Mocked<ISignalingClient>;
  let publisher: jest.Mocked<ICameraPublisher>;

  beforeEach(() => {
    go2rtc = {
      health: jest.fn(),
      registerStream: jest.fn(),
      removeStream: jest.fn().mockResolvedValue(undefined),
      getStreamHealth: jest.fn(),
      getWhepUrl: jest.fn(),
    };
    signaling = {
      connect: jest.fn(),
      disconnect: jest.fn().mockResolvedValue(undefined),
      registerPresence: jest.fn(),
      sendSignal: jest.fn(),
      onSignal: jest.fn(),
      onPresenceChange: jest.fn(),
      requestPairingCode: jest.fn(),
      onPairingRedeemed: jest.fn(),
    };
    publisher = {
      handleViewerSignal: jest.fn(),
      closeSession: jest.fn(),
      closeAllSessions: jest.fn().mockResolvedValue(undefined),
      sessionCount: jest.fn(),
    };
  });

  it('closes all sessions, disconnects signaling, and removes the go2rtc stream', async () => {
    const useCase = new StopCameraUseCase({ signaling, publisher, go2rtc });
    await useCase.execute({ cameraId: 'cam-1' });

    expect(publisher.closeAllSessions).toHaveBeenCalled();
    expect(signaling.disconnect).toHaveBeenCalled();
    expect(go2rtc.removeStream).toHaveBeenCalledWith('cam-1');
  });

  it('still completes when go2rtc.removeStream throws (best-effort)', async () => {
    go2rtc.removeStream.mockRejectedValue(new Error('go2rtc gone'));
    const useCase = new StopCameraUseCase({ signaling, publisher, go2rtc });
    await expect(useCase.execute({ cameraId: 'cam-1' })).resolves.toBeUndefined();
    expect(publisher.closeAllSessions).toHaveBeenCalled();
    expect(signaling.disconnect).toHaveBeenCalled();
  });
});
