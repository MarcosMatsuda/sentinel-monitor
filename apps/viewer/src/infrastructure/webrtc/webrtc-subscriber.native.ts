// ============================================================
// Native subscriber stub. Real implementation lands in PR7
// (react-native-webrtc). Constructing this on a native runtime
// throws so misconfigured DI surfaces immediately.
// ============================================================

import type {
  IWebRtcSubscriberRepository,
  SubscriberState,
} from '../../domain/repositories/i-webrtc-subscriber.repository';

export class NativeWebRtcSubscriber implements IWebRtcSubscriberRepository {
  constructor() {
    throw new Error(
      'NativeWebRtcSubscriber not implemented yet — see PR7 (react-native-webrtc)',
    );
  }

  connect(_cameraId: string): Promise<void> {
    throw new Error('not implemented — see PR7');
  }

  handleIncomingSignal(): Promise<void> {
    throw new Error('not implemented — see PR7');
  }

  close(): void {
    throw new Error('not implemented — see PR7');
  }

  onTrack(_handler: (stream: MediaStream) => void): void {
    throw new Error('not implemented — see PR7');
  }

  onStateChange(_handler: (state: SubscriberState) => void): void {
    throw new Error('not implemented — see PR7');
  }

  getState(): SubscriberState {
    throw new Error('not implemented — see PR7');
  }
}
