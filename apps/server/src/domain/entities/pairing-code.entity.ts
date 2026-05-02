import {
  PAIRING_CODE_CHARS,
  PAIRING_CODE_LENGTH,
  type PairingCodeEntity as PairingCodeEntityDto,
} from '@sentinel-monitor/shared-types';

// Server-side pairing code entity. The shared-types interface defines
// the wire shape; this class adds behavior (expiry check + generation).
export class PairingCode implements PairingCodeEntityDto {
  constructor(
    public readonly code: string,
    public readonly cameraId: string,
    public readonly issuedAt: number,
    public readonly expiresAt: number,
  ) {}

  isExpired(now: number): boolean {
    return now >= this.expiresAt;
  }

  static generateCode(rng: () => number = Math.random): string {
    let result = '';
    for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
      result += PAIRING_CODE_CHARS[Math.floor(rng() * PAIRING_CODE_CHARS.length)];
    }
    return result;
  }
}
