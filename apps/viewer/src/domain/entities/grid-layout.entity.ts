// ============================================================
// GridLayout — pure function deciding how many rows/columns
// to render for N cameras. Capped at MAX_CAMERAS_PER_DASHBOARD.
//   0       -> 0x0 (empty state handled by UI)
//   1       -> 1x1
//   2..4    -> 2x2
//   5..9    -> 3x3
// ============================================================

import { MAX_CAMERAS_PER_DASHBOARD } from '@sentinel-monitor/shared-types';

export interface GridLayout {
  readonly rows: number;
  readonly cols: number;
}

export class GridLayoutEntity {
  static compute(cameraCount: number): GridLayout {
    if (!Number.isFinite(cameraCount) || cameraCount < 0) {
      throw new Error('cameraCount must be a non-negative finite number');
    }
    const n = Math.min(Math.floor(cameraCount), MAX_CAMERAS_PER_DASHBOARD);
    if (n === 0) return { rows: 0, cols: 0 };
    if (n === 1) return { rows: 1, cols: 1 };
    if (n <= 4) return { rows: 2, cols: 2 };
    return { rows: 3, cols: 3 };
  }
}
