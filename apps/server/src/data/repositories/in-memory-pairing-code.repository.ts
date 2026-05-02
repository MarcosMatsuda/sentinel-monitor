import type {
  IPairingCodeRepository,
  PairingCodeEntity,
  PairingErrorCode,
} from '@sentinel-monitor/shared-types';
import { PairingCode } from '../../domain/entities/pairing-code.entity';

const MAX_GENERATION_RETRIES = 50;

export class InMemoryPairingCodeRepository implements IPairingCodeRepository {
  private byCode = new Map<string, PairingCode>();

  constructor(
    private readonly now: () => number = () => Date.now(),
    private readonly rng: () => number = Math.random,
  ) {}

  create(cameraId: string, ttlMs: number): PairingCodeEntity {
    let code = '';
    for (let i = 0; i < MAX_GENERATION_RETRIES; i++) {
      const candidate = PairingCode.generateCode(this.rng);
      if (!this.byCode.has(candidate)) {
        code = candidate;
        break;
      }
    }
    if (!code) {
      throw new Error('Could not generate a unique pairing code');
    }
    const issuedAt = this.now();
    const entry = new PairingCode(code, cameraId, issuedAt, issuedAt + ttlMs);
    this.byCode.set(code, entry);
    return entry;
  }

  redeem(
    code: string,
    now: number,
  ): { cameraId: string } | { error: PairingErrorCode } {
    const entry = this.byCode.get(code);
    if (!entry) return { error: 'NOT_FOUND' };
    if (entry.isExpired(now)) {
      this.byCode.delete(code);
      return { error: 'EXPIRED' };
    }
    // Atomic single-use: delete-and-return.
    this.byCode.delete(code);
    return { cameraId: entry.cameraId };
  }

  purgeExpired(now: number): number {
    let removed = 0;
    for (const [code, entry] of this.byCode) {
      if (entry.isExpired(now)) {
        this.byCode.delete(code);
        removed++;
      }
    }
    return removed;
  }

  count(): number {
    return this.byCode.size;
  }
}
