import type { ISignalingRepository } from '../repositories/i-signaling.repository';
import { PairingStateEntity } from '../entities/pairing-state.entity';

export class RequestPairingCodeUseCase {
  constructor(private readonly signaling: ISignalingRepository) {}

  async execute(cameraId: string): Promise<PairingStateEntity> {
    const dto = await this.signaling.requestPairingCode(cameraId);
    return PairingStateEntity.fromDto(dto);
  }
}
