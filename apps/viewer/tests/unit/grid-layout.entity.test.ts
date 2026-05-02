import { GridLayoutEntity } from '@/domain/entities/grid-layout.entity';

describe('GridLayoutEntity.compute', () => {
  it('returns 0x0 when there are no cameras', () => {
    expect(GridLayoutEntity.compute(0)).toEqual({ rows: 0, cols: 0 });
  });

  it('returns 1x1 for a single camera', () => {
    expect(GridLayoutEntity.compute(1)).toEqual({ rows: 1, cols: 1 });
  });

  it.each([2, 3, 4])('returns 2x2 for %d cameras', (n) => {
    expect(GridLayoutEntity.compute(n)).toEqual({ rows: 2, cols: 2 });
  });

  it.each([5, 6, 7, 8, 9])('returns 3x3 for %d cameras', (n) => {
    expect(GridLayoutEntity.compute(n)).toEqual({ rows: 3, cols: 3 });
  });

  it('caps at MAX_CAMERAS_PER_DASHBOARD (3x3)', () => {
    expect(GridLayoutEntity.compute(20)).toEqual({ rows: 3, cols: 3 });
  });

  it('floors fractional input', () => {
    expect(GridLayoutEntity.compute(2.9)).toEqual({ rows: 2, cols: 2 });
  });

  it('throws on negative input', () => {
    expect(() => GridLayoutEntity.compute(-1)).toThrow();
  });

  it('throws on NaN input', () => {
    expect(() => GridLayoutEntity.compute(Number.NaN)).toThrow();
  });
});
