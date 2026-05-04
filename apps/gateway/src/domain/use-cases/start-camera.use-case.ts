import type { CameraConfig } from '../entities/camera-config.entity';
import type { ICameraPublisher } from '../repositories/i-camera-publisher.repository';
import type { ISignalingClient } from '../repositories/i-signaling.repository';
import type { IGo2RtcClient } from '../repositories/i-go2rtc-client.repository';

export interface StartCameraDeps {
  readonly signaling: ISignalingClient;
  readonly publisher: ICameraPublisher;
  readonly go2rtc: IGo2RtcClient;
}

export interface StartCameraInput {
  readonly camera: CameraConfig;
  readonly signalingUrl: string;
}

export type StartCameraResult =
  | { readonly started: true }
  | { readonly started: false; readonly reason: string };

/**
 * Brings one camera online end-to-end:
 *   1. Register the RTSP source with the local go2rtc bridge.
 *   2. Connect to the signaling server with the camera's stable UUID.
 *   3. Wire incoming viewer signals to the publisher.
 *   4. Wire publisher answers/candidates back to viewers.
 *   5. On viewer disconnect, tear down its WHEP session.
 */
export class StartCameraUseCase {
  constructor(private readonly deps: StartCameraDeps) {}

  async execute(input: StartCameraInput): Promise<StartCameraResult> {
    try {
      await this.deps.go2rtc.registerStream(input.camera.id, input.camera.rtspUrl);
    } catch (err) {
      return {
        started: false,
        reason: `go2rtc.registerStream failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    try {
      await this.deps.signaling.connect(input.signalingUrl);
    } catch (err) {
      return {
        started: false,
        reason: `signaling.connect failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    this.deps.signaling.registerPresence(input.camera.id);

    this.deps.signaling.onSignal(async (signal) => {
      // Only handle signals addressed to this camera.
      if (signal.toPeerId !== input.camera.id) return;

      const reply = await this.deps.publisher.handleViewerSignal(
        signal.fromPeerId,
        signal.payload,
      );

      if (reply) {
        this.deps.signaling.sendSignal({
          fromPeerId: input.camera.id,
          toPeerId: signal.fromPeerId,
          payload: reply,
        });
      }
    });

    this.deps.signaling.onPresenceChange((event) => {
      if (!event.online) {
        // Dashboard disconnected — close its session if any.
        void this.deps.publisher.closeSession(event.peerId);
      }
    });

    return { started: true };
  }
}
