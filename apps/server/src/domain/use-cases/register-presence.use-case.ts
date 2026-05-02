import type {
  IPeerPresenceRepository,
  PeerRole,
} from '@sentinel-monitor/shared-types';

export interface IRegisterPresenceInput {
  readonly peerId: string;
  readonly role: PeerRole;
  readonly socketId: string;
}

export class RegisterPresenceUseCase {
  constructor(private readonly presence: IPeerPresenceRepository) {}

  execute(input: IRegisterPresenceInput): void {
    this.presence.set(input.peerId, input.socketId, input.role);
  }
}
