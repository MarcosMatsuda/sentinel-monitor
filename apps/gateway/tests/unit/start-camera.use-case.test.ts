import { StartCameraUseCase } from '../../src/domain/use-cases/start-camera.use-case';
import type { CameraConfig } from '../../src/domain/entities/camera-config.entity';
import type { ICameraPublisher } from '../../src/domain/repositories/i-camera-publisher.repository';
import type { ISignalingClient } from '../../src/domain/repositories/i-signaling.repository';
import type { IGo2RtcClient } from '../../src/domain/repositories/i-go2rtc-client.repository';
import type { PresenceChangeDto, SignalDto } from '@sentinel-monitor/shared-types';

const camera: CameraConfig = {
  id: 'cam-1',
  label: 'Sala',
  rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1',
  addedAt: 1000,
  pairedDashboards: ['dash-1'],
};

describe('StartCameraUseCase', () => {
  let go2rtc: jest.Mocked<IGo2RtcClient>;
  let signaling: jest.Mocked<ISignalingClient>;
  let publisher: jest.Mocked<ICameraPublisher>;
  let signalHandler: ((s: SignalDto) => void) | null;
  let presenceHandler: ((e: PresenceChangeDto) => void) | null;

  beforeEach(() => {
    signalHandler = null;
    presenceHandler = null;

    go2rtc = {
      health: jest.fn(),
      registerStream: jest.fn().mockResolvedValue(undefined),
      removeStream: jest.fn(),
      getStreamHealth: jest.fn(),
      getWhepUrl: jest.fn(),
    };

    signaling = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      registerPresence: jest.fn(),
      sendSignal: jest.fn(),
      onSignal: jest.fn((handler) => {
        signalHandler = handler;
      }),
      onPresenceChange: jest.fn((handler) => {
        presenceHandler = handler;
      }),
      requestPairingCode: jest.fn(),
      onPairingRedeemed: jest.fn(),
    };

    publisher = {
      handleViewerSignal: jest.fn(),
      closeSession: jest.fn().mockResolvedValue(undefined),
      closeAllSessions: jest.fn(),
      sessionCount: jest.fn(),
    };
  });

  it('registers the RTSP source, connects signaling, and announces presence', async () => {
    const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });
    const result = await useCase.execute({
      camera,
      signalingUrl: 'http://localhost:3010',
    });

    expect(result).toEqual({ started: true });
    expect(go2rtc.registerStream).toHaveBeenCalledWith(camera.id, camera.rtspUrl);
    expect(signaling.connect).toHaveBeenCalledWith('http://localhost:3010');
    expect(signaling.registerPresence).toHaveBeenCalledWith(camera.id);
  });

  it('returns started:false when go2rtc registration fails', async () => {
    go2rtc.registerStream.mockRejectedValue(new Error('connection refused'));
    const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });

    const result = await useCase.execute({ camera, signalingUrl: 'http://x' });
    expect(result).toEqual({
      started: false,
      reason: 'go2rtc.registerStream failed: connection refused',
    });
    expect(signaling.connect).not.toHaveBeenCalled();
  });

  it('returns started:false when signaling connect fails', async () => {
    signaling.connect.mockRejectedValue(new Error('timeout'));
    const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });

    const result = await useCase.execute({ camera, signalingUrl: 'http://x' });
    expect(result.started).toBe(false);
    if (!result.started) expect(result.reason).toMatch(/signaling.connect/);
  });

  describe('signal forwarding', () => {
    it('forwards offers addressed to this camera to the publisher and replies via signaling', async () => {
      publisher.handleViewerSignal.mockResolvedValue({ type: 'answer', sdp: 'v=0\r\nans' });
      const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });
      await useCase.execute({ camera, signalingUrl: 'http://x' });

      const offer: SignalDto = {
        fromPeerId: 'dash-1',
        toPeerId: 'cam-1',
        payload: { type: 'offer', sdp: 'v=0\r\noff' },
      };
      await signalHandler!(offer);

      expect(publisher.handleViewerSignal).toHaveBeenCalledWith('dash-1', offer.payload);
      expect(signaling.sendSignal).toHaveBeenCalledWith({
        fromPeerId: 'cam-1',
        toPeerId: 'dash-1',
        payload: { type: 'answer', sdp: 'v=0\r\nans' },
      });
    });

    it('does not reply when publisher returns null (e.g., trickle ICE)', async () => {
      publisher.handleViewerSignal.mockResolvedValue(null);
      const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });
      await useCase.execute({ camera, signalingUrl: 'http://x' });

      await signalHandler!({
        fromPeerId: 'dash-1',
        toPeerId: 'cam-1',
        payload: { type: 'ice-candidate', candidate: { candidate: 'x', sdpMid: '0' } },
      });

      expect(publisher.handleViewerSignal).toHaveBeenCalled();
      expect(signaling.sendSignal).not.toHaveBeenCalled();
    });

    it('ignores signals addressed to other peers', async () => {
      const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });
      await useCase.execute({ camera, signalingUrl: 'http://x' });

      await signalHandler!({
        fromPeerId: 'dash-1',
        toPeerId: 'other-camera',
        payload: { type: 'offer', sdp: 'v=0' },
      });

      expect(publisher.handleViewerSignal).not.toHaveBeenCalled();
    });
  });

  describe('presence handling', () => {
    it('closes a dashboard session when its presence drops', async () => {
      const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });
      await useCase.execute({ camera, signalingUrl: 'http://x' });

      presenceHandler!({ peerId: 'dash-1', online: false });
      // Allow microtasks to resolve.
      await new Promise((r) => setImmediate(r));

      expect(publisher.closeSession).toHaveBeenCalledWith('dash-1');
    });

    it('does nothing when a dashboard comes online (peer initiates the offer)', async () => {
      const useCase = new StartCameraUseCase({ signaling, publisher, go2rtc });
      await useCase.execute({ camera, signalingUrl: 'http://x' });

      presenceHandler!({ peerId: 'dash-1', online: true });
      await new Promise((r) => setImmediate(r));

      expect(publisher.closeSession).not.toHaveBeenCalled();
    });
  });
});
