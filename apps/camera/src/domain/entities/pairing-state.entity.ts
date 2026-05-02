import type { PairingCodeIssuedDto } from '@sentinel-monitor/shared-types';

// Snapshot of the current pairing code (if any) plus its expiry.
// Pure value type with helper methods — no side effects.
export class PairingStateEntity {
  constructor(
    public readonly code: string,
    public readonly expiresAt: number,
  ) {}

  static fromDto(dto: PairingCodeIssuedDto): PairingStateEntity {
    return new PairingStateEntity(dto.code, dto.expiresAt);
  }

  isExpired(now: number = Date.now()): boolean {
    return now >= this.expiresAt;
  }

  remainingMs(now: number = Date.now()): number {
    return Math.max(0, this.expiresAt - now);
  }

  remainingSeconds(now: number = Date.now()): number {
    return Math.ceil(this.remainingMs(now) / 1000);
  }
}
