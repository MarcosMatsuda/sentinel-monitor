import type {
  IPairingCodeRepository,
  PairingErrorDto,
  PairingErrorCode,
  PairingRedeemedDto,
} from '@sentinel-monitor/shared-types';

export interface IRedeemPairingCodeInput {
  readonly code: string;
  readonly dashboardId: string;
}

export type RedeemPairingCodeResult =
  | { readonly success: true; readonly data: PairingRedeemedDto }
  | { readonly success: false; readonly error: PairingErrorDto };

const ERROR_MESSAGES: Record<PairingErrorCode, string> = {
  NOT_FOUND: 'Pairing code not found.',
  EXPIRED: 'Pairing code expired.',
  CONSUMED: 'Pairing code already used.',
};

export class RedeemPairingCodeUseCase {
  constructor(
    private readonly codes: IPairingCodeRepository,
    private readonly now: () => number = () => Date.now(),
  ) {}

  execute(input: IRedeemPairingCodeInput): RedeemPairingCodeResult {
    const result = this.codes.redeem(input.code, this.now());
    if ('error' in result) {
      return {
        success: false,
        error: { code: result.error, message: ERROR_MESSAGES[result.error] },
      };
    }
    return {
      success: true,
      data: { cameraId: result.cameraId, dashboardId: input.dashboardId },
    };
  }
}
