import { InMemoryPairingCodeRepository } from '../../src/data/repositories/in-memory-pairing-code.repository';
import { PAIRING_CODE_LENGTH } from '@sentinel-monitor/shared-types';

describe('InMemoryPairingCodeRepository', () => {
  describe('create', () => {
    it('produces a code of the configured length', () => {
      const repo = new InMemoryPairingCodeRepository();
      const entity = repo.create('cam-1', 60_000);
      expect(entity.code).toHaveLength(PAIRING_CODE_LENGTH);
      expect(entity.cameraId).toBe('cam-1');
      expect(entity.expiresAt - entity.issuedAt).toBe(60_000);
    });

    it('uses the injected clock so expiry is deterministic', () => {
      const repo = new InMemoryPairingCodeRepository(() => 1700000000000);
      const entity = repo.create('cam-1', 60_000);
      expect(entity.issuedAt).toBe(1700000000000);
      expect(entity.expiresAt).toBe(1700000060000);
    });

    it('retries on collision and eventually finds a unique code', () => {
      // RNG returns the same value the first 6 codes (collision) then varies.
      let calls = 0;
      const rng = () => {
        calls++;
        // First PAIRING_CODE_LENGTH * 2 calls: same low value -> "AAAAAA"
        // After: walk the alphabet to break collision.
        if (calls <= PAIRING_CODE_LENGTH * 2) return 0;
        return 0.5;
      };
      const repo = new InMemoryPairingCodeRepository(() => 0, rng);

      const first = repo.create('cam-1', 60_000);
      const second = repo.create('cam-2', 60_000);
      expect(first.code).not.toBe(second.code);
      expect(repo.count()).toBe(2);
    });
  });

  describe('redeem', () => {
    it('returns the camera id and removes the code on success', () => {
      const repo = new InMemoryPairingCodeRepository(() => 1000);
      const { code } = repo.create('cam-1', 60_000);

      const result = repo.redeem(code, 1500);
      expect(result).toEqual({ cameraId: 'cam-1' });
      expect(repo.count()).toBe(0);
    });

    it('returns NOT_FOUND for unknown codes', () => {
      const repo = new InMemoryPairingCodeRepository();
      expect(repo.redeem('NOPE99', Date.now())).toEqual({ error: 'NOT_FOUND' });
    });

    it('returns CONSUMED on second redeem of the same code', () => {
      const repo = new InMemoryPairingCodeRepository(() => 1000);
      const { code } = repo.create('cam-1', 60_000);

      repo.redeem(code, 1500);
      expect(repo.redeem(code, 1600)).toEqual({ error: 'NOT_FOUND' });
    });

    it('returns EXPIRED and removes when redeemed past expiresAt', () => {
      const repo = new InMemoryPairingCodeRepository(() => 1000);
      const { code, expiresAt } = repo.create('cam-1', 60_000);

      const result = repo.redeem(code, expiresAt + 1);
      expect(result).toEqual({ error: 'EXPIRED' });
      expect(repo.count()).toBe(0);
    });
  });

  describe('purgeExpired', () => {
    it('removes only entries past expiresAt and returns the count', () => {
      const repo = new InMemoryPairingCodeRepository(() => 1000);
      repo.create('cam-1', 5_000); // expires at 6000
      repo.create('cam-2', 60_000); // expires at 61000

      const removed = repo.purgeExpired(10_000);
      expect(removed).toBe(1);
      expect(repo.count()).toBe(1);
    });

    it('is a no-op when nothing is expired', () => {
      const repo = new InMemoryPairingCodeRepository(() => 1000);
      repo.create('cam-1', 60_000);
      expect(repo.purgeExpired(2000)).toBe(0);
      expect(repo.count()).toBe(1);
    });
  });
});
