import { describe, expect, test } from 'vitest';
import { PairingStateEntity } from '../../src/domain/entities/pairing-state.entity';

describe('PairingStateEntity', () => {
  test('isExpired flips at the expiry boundary', () => {
    const state = new PairingStateEntity('ABC123', 1_000);
    expect(state.isExpired(999)).toBe(false);
    expect(state.isExpired(1_000)).toBe(true);
    expect(state.isExpired(1_500)).toBe(true);
  });

  test('remainingMs clamps to zero past expiry', () => {
    const state = new PairingStateEntity('ABC123', 1_000);
    expect(state.remainingMs(500)).toBe(500);
    expect(state.remainingMs(2_000)).toBe(0);
  });

  test('remainingSeconds rounds up so the user never sees 0 prematurely', () => {
    const state = new PairingStateEntity('ABC123', 1_500);
    expect(state.remainingSeconds(0)).toBe(2);
    expect(state.remainingSeconds(1_000)).toBe(1);
    expect(state.remainingSeconds(1_500)).toBe(0);
  });

  test('fromDto copies code and expiry', () => {
    const state = PairingStateEntity.fromDto({ code: 'XYZ987', expiresAt: 42 });
    expect(state.code).toBe('XYZ987');
    expect(state.expiresAt).toBe(42);
  });
});
