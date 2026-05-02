import { GeneratePairingCodeUseCase } from '../../src/domain/use-cases/generate-pairing-code.use-case';
import {
  PAIRING_CODE_TTL_MS,
  type IPairingCodeRepository,
  type PairingCodeEntity,
} from '@sentinel-monitor/shared-types';

const mockCodes: jest.Mocked<IPairingCodeRepository> = {
  create: jest.fn(),
  redeem: jest.fn(),
  purgeExpired: jest.fn(),
  count: jest.fn(),
};

describe('GeneratePairingCodeUseCase', () => {
  it('returns the issued code DTO with the correct TTL', () => {
    const entity: PairingCodeEntity = {
      code: 'ABC123',
      cameraId: 'cam-1',
      issuedAt: 1000,
      expiresAt: 1000 + PAIRING_CODE_TTL_MS,
    };
    mockCodes.create.mockReturnValue(entity);

    const useCase = new GeneratePairingCodeUseCase(mockCodes);
    const dto = useCase.execute({ cameraId: 'cam-1' });

    expect(mockCodes.create).toHaveBeenCalledWith('cam-1', PAIRING_CODE_TTL_MS);
    expect(dto).toEqual({ code: 'ABC123', expiresAt: entity.expiresAt });
  });
});
