import type {
  IPeerPresenceRepository,
  SignalDto,
} from '@sentinel-monitor/shared-types';

export type RouteSignalResult =
  | { readonly routed: true; readonly toSocketId: string; readonly payload: SignalDto }
  | { readonly routed: false; readonly reason: 'recipient-offline' };

export class RouteSignalUseCase {
  constructor(private readonly presence: IPeerPresenceRepository) {}

  execute(payload: SignalDto): RouteSignalResult {
    const toSocketId = this.presence.getSocketId(payload.toPeerId);
    if (!toSocketId) {
      return { routed: false, reason: 'recipient-offline' };
    }
    return { routed: true, toSocketId, payload };
  }
}
