import { PairingCode } from '../../src/domain/entities/pairing-code.entity';
import { PAIRING_CODE_CHARS, PAIRING_CODE_LENGTH } from '@sentinel-monitor/shared-types';

describe('PairingCode', () => {
  describe('isExpired', () => {
    it('returns false strictly before expiresAt', () => {
      const code = new PairingCode('ABC123', 'cam-1', 1000, 2000);
      expect(code.isExpired(1999)).toBe(false);
    });

    it('returns true at exact expiresAt timestamp', () => {
      const code = new PairingCode('ABC123', 'cam-1', 1000, 2000);
      expect(code.isExpired(2000)).toBe(true);
    });

    it('returns true after expiresAt', () => {
      const code = new PairingCode('ABC123', 'cam-1', 1000, 2000);
      expect(code.isExpired(5000)).toBe(true);
    });
  });

  describe('generateCode', () => {
    it('generates codes of the configured length', () => {
      const code = PairingCode.generateCode();
      expect(code).toHaveLength(PAIRING_CODE_LENGTH);
    });

    it('only uses characters from the alphabet', () => {
      for (let i = 0; i < 50; i++) {
        const code = PairingCode.generateCode();
        for (const ch of code) {
          expect(PAIRING_CODE_CHARS).toContain(ch);
        }
      }
    });

    it('uses the injected RNG so tests can control output', () => {
      // Always pick char index 0 (first char of alphabet = 'A').
      const code = PairingCode.generateCode(() => 0);
      expect(code).toBe('A'.repeat(PAIRING_CODE_LENGTH));
    });
  });
});
