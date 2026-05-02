// ============================================================
// ComputeGridLayout — thin use case wrapping GridLayoutEntity
// so presentation depends on a use case, not directly on an
// entity static. Keeps dependency direction inward.
// ============================================================

import {
  GridLayoutEntity,
  type GridLayout,
} from '../entities/grid-layout.entity';

export class ComputeGridLayoutUseCase {
  execute(cameraCount: number): GridLayout {
    return GridLayoutEntity.compute(cameraCount);
  }
}
