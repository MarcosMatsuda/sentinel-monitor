import { ComputeGridLayoutUseCase } from '@/domain/use-cases/compute-grid-layout.use-case';

describe('ComputeGridLayoutUseCase', () => {
  it('delegates to GridLayoutEntity.compute', () => {
    const uc = new ComputeGridLayoutUseCase();
    expect(uc.execute(0)).toEqual({ rows: 0, cols: 0 });
    expect(uc.execute(4)).toEqual({ rows: 2, cols: 2 });
    expect(uc.execute(9)).toEqual({ rows: 3, cols: 3 });
  });
});
