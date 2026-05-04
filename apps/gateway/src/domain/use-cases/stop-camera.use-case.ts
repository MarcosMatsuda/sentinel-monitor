import type { ICameraPublisher } from '../repositories/i-camera-publisher.repository';
import type { ISignalingClient } from '../repositories/i-signaling.repository';
import type { IGo2RtcClient } from '../repositories/i-go2rtc-client.repository';

export interface StopCameraDeps {
  readonly signaling: ISignalingClient;
  readonly publisher: ICameraPublisher;
  readonly go2rtc: IGo2RtcClient;
}

export interface StopCameraInput {
  readonly cameraId: string;
}

/**
 * Tears down everything for a single camera. Idempotent.
 */
export class StopCameraUseCase {
  constructor(private readonly deps: StopCameraDeps) {}

  async execute(input: StopCameraInput): Promise<void> {
    await this.deps.publisher.closeAllSessions();
    await this.deps.signaling.disconnect();
    try {
      await this.deps.go2rtc.removeStream(input.cameraId);
    } catch {
      // Best-effort: if go2rtc went away, we still consider the camera stopped.
    }
  }
}
