// ============================================================
// Viewer theme — re-exports design tokens with viewer-specific
// helpers. Components import from here, never directly from the
// design-tokens package, to keep the swap-point local.
// ============================================================

export {
  colors,
  semantic,
  spacing,
  typography,
  radii,
  shadows,
  animation,
  getStatusColor,
} from '@sentinel-monitor/design-tokens';
