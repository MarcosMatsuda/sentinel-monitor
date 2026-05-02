import type { SignalDto } from '@sentinel-monitor/shared-types';
import type { IWebRtcPublisherRepository } from '../repositories/i-webrtc-publisher.repository';

// Routes an incoming `signal` (offer/answer/ice) from the signaling
// channel into the publisher, which manages per-dashboard PCs.
export class HandleIncomingSubscriberUseCase {
  constructor(private readonly publisher: IWebRtcPublisherRepository) {}

  async execute(signal: SignalDto): Promise<void> {
    await this.publisher.handleIncomingSignal(signal.fromPeerId, signal.payload);
  }
}
