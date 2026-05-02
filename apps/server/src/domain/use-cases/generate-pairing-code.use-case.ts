import {
  PAIRING_CODE_TTL_MS,
  type IPairingCodeRepository,
  type PairingCodeIssuedDto,
} from '@sentinel-monitor/shared-types';

export interface IGeneratePairingCodeInput {
  readonly cameraId: string;
}

export class GeneratePairingCodeUseCase {
  constructor(private readonly codes: IPairingCodeRepository) {}

  execute(input: IGeneratePairingCodeInput): PairingCodeIssuedDto {
    const entity = this.codes.create(input.cameraId, PAIRING_CODE_TTL_MS);
    return { code: entity.code, expiresAt: entity.expiresAt };
  }
}
