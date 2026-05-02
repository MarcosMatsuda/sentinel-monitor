import type {
  IPeerPresenceRepository,
  PeerRole,
} from '@sentinel-monitor/shared-types';

export interface IHandleDisconnectInput {
  readonly socketId: string;
}

export type HandleDisconnectResult =
  | { readonly removed: true; readonly peerId: string; readonly role: PeerRole }
  | { readonly removed: false };

export class HandleDisconnectUseCase {
  constructor(private readonly presence: IPeerPresenceRepository) {}

  execute(input: IHandleDisconnectInput): HandleDisconnectResult {
    const removed = this.presence.removeBySocket(input.socketId);
    if (!removed) return { removed: false };
    return { removed: true, peerId: removed.peerId, role: removed.role };
  }
}
