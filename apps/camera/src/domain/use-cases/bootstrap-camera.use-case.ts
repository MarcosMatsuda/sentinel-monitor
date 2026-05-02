import type { IIdentityStorageRepository } from '../repositories/i-identity-storage.repository';
import type { IMediaCaptureRepository } from '../repositories/i-media-capture.repository';
import type { ISignalingRepository } from '../repositories/i-signaling.repository';
import type { IWebRtcPublisherRepository } from '../repositories/i-webrtc-publisher.repository';
import { CameraIdentityEntity } from '../entities/camera-identity.entity';
import { PairingStateEntity } from '../entities/pairing-state.entity';
import { RequestPairingCodeUseCase } from './request-pairing-code.use-case';
import { HandleIncomingSubscriberUseCase } from './handle-incoming-subscriber.use-case';

export type BootstrapScreen = 'pairing' | 'streaming';

export interface BootstrapResult {
  readonly identity: CameraIdentityEntity;
  readonly pairedDashboards: readonly string[];
  readonly screen: BootstrapScreen;
  readonly pairingState: PairingStateEntity | null;
  readonly stream: MediaStream;
}

export interface BootstrapPorts {
  readonly storage: IIdentityStorageRepository;
  readonly mediaCapture: IMediaCaptureRepository;
  readonly signaling: ISignalingRepository;
  readonly publisher: IWebRtcPublisherRepository;
}

// Boots the camera publisher end-to-end:
//  1. Resolve / create the persistent identity.
//  2. Capture audio + video.
//  3. Connect signaling, register presence.
//  4. Wire incoming offers to the publisher.
//  5. If unpaired, request a fresh pairing code; else go straight to streaming.
export class BootstrapCameraUseCase {
  constructor(private readonly ports: BootstrapPorts) {}

  async execute(): Promise<BootstrapResult> {
    const identity = CameraIdentityEntity.createOrLoad(this.ports.storage);

    const stream = await this.ports.mediaCapture.requestAudioVideo();
    this.ports.publisher.setStream(stream);

    await this.ports.signaling.connect();
    this.ports.signaling.registerPresence(identity.id);

    const incomingHandler = new HandleIncomingSubscriberUseCase(this.ports.publisher);
    this.ports.signaling.onSignal((signal) => {
      void incomingHandler.execute(signal);
    });

    this.ports.publisher.onSignalToSend((signal) => {
      this.ports.signaling.sendSignal(signal);
    });

    const paired = this.ports.storage.getPairedDashboards();
    if (paired.length === 0) {
      const requester = new RequestPairingCodeUseCase(this.ports.signaling);
      const pairingState = await requester.execute(identity.id);
      return {
        identity,
        pairedDashboards: paired,
        screen: 'pairing',
        pairingState,
        stream,
      };
    }

    return {
      identity,
      pairedDashboards: paired,
      screen: 'streaming',
      pairingState: null,
      stream,
    };
  }
}
