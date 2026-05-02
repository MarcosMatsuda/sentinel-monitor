import { RedeemPairingCodeUseCase } from '../../src/domain/use-cases/redeem-pairing-code.use-case';
import type { IPairingCodeRepository } from '@sentinel-monitor/shared-types';

const mockCodes: jest.Mocked<IPairingCodeRepository> = {
  create: jest.fn(),
  redeem: jest.fn(),
  purgeExpired: jest.fn(),
  count: jest.fn(),
};

describe('RedeemPairingCodeUseCase', () => {
  let useCase: RedeemPairingCodeUseCase;

  beforeEach(() => {
    useCase = new RedeemPairingCodeUseCase(mockCodes, () => 1700000000000);
  });

  it('returns success with the binding pair on valid redemption', () => {
    mockCodes.redeem.mockReturnValue({ cameraId: 'cam-1' });

    const result = useCase.execute({ code: 'ABC123', dashboardId: 'dash-1' });

    expect(mockCodes.redeem).toHaveBeenCalledWith('ABC123', 1700000000000);
    expect(result).toEqual({
      success: true,
      data: { cameraId: 'cam-1', dashboardId: 'dash-1' },
    });
  });

  it('returns NOT_FOUND error when code is unknown', () => {
    mockCodes.redeem.mockReturnValue({ error: 'NOT_FOUND' });

    const result = useCase.execute({ code: 'NOPE99', dashboardId: 'dash-1' });

    expect(result).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Pairing code not found.' },
    });
  });

  it('returns EXPIRED error when code has expired', () => {
    mockCodes.redeem.mockReturnValue({ error: 'EXPIRED' });

    const result = useCase.execute({ code: 'OLD123', dashboardId: 'dash-1' });

    expect(result).toEqual({
      success: false,
      error: { code: 'EXPIRED', message: 'Pairing code expired.' },
    });
  });

  it('returns CONSUMED error when code was already redeemed', () => {
    mockCodes.redeem.mockReturnValue({ error: 'CONSUMED' });

    const result = useCase.execute({ code: 'USED12', dashboardId: 'dash-1' });

    expect(result).toEqual({
      success: false,
      error: { code: 'CONSUMED', message: 'Pairing code already used.' },
    });
  });
});
