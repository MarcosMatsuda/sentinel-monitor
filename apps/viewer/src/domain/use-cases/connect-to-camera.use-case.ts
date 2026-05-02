// ============================================================
// ConnectToCamera — orchestrates a single subscriber-driven
// WebRTC handshake against one remote camera through the
// shared signaling channel.
//
// Lifecycle:
//   1. Build a fresh subscriber via the injected factory
//   2. Wire signal in/out (offer + ICE) through the signaling repo
//   3. On inbound MediaStream → publish to peers store
//   4. On state change → publish to peers store
//   5. Return a disposer that closes the peer connection
// ============================================================

import type {
  SignalDto,
  SignalPayload,
} from '@sentinel-monitor/shared-types';
import type { ISignalingRepository } from '../repositories/i-signaling.repository';
import type {
  IWebRtcSubscriberRepository,
  SubscriberState,
} from '../repositories/i-webrtc-subscriber.repository';

export type SubscriberFactory = (
  cameraId: string,
  emitSignal: (payload: SignalPayload) => void,
) => IWebRtcSubscriberRepository;

export interface ConnectToCameraDeps {
  readonly signaling: ISignalingRepository;
  readonly subscriberFactory: SubscriberFactory;
  readonly dashboardId: string;
  readonly onStream: (cameraId: string, stream: MediaStream) => void;
  readonly onState: (cameraId: string, state: SubscriberState) => void;
}

export interface CameraConnection {
  readonly cameraId: string;
  readonly subscriber: IWebRtcSubscriberRepository;
  close(): void;
}

export class ConnectToCameraUseCase {
  constructor(private readonly deps: ConnectToCameraDeps) {}

  async execute(cameraId: string): Promise<CameraConnection> {
    const { signaling, subscriberFactory, dashboardId, onStream, onState } =
      this.deps;

    const emitSignal = (payload: SignalPayload): void => {
      signaling.sendSignal({
        fromPeerId: dashboardId,
        toPeerId: cameraId,
        payload,
      });
    };

    const subscriber = subscriberFactory(cameraId, emitSignal);

    subscriber.onTrack((stream) => onStream(cameraId, stream));
    subscriber.onStateChange((state) => onState(cameraId, state));

    const signalHandler = (signal: SignalDto): void => {
      if (signal.fromPeerId !== cameraId) return;
      void subscriber.handleIncomingSignal(signal.payload);
    };
    signaling.onSignal(signalHandler);

    onState(cameraId, 'connecting');
    await subscriber.connect(cameraId);

    return {
      cameraId,
      subscriber,
      close: (): void => {
        signaling.offSignal(signalHandler);
        subscriber.close();
        onState(cameraId, 'closed');
      },
    };
  }
}
