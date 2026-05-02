// ============================================================
// @sentinel-monitor/design-tokens
// "Command Center + Bento Grid" direction (placeholder until
// PR0 design lock-in formalizes the choice via ui-ux-pro-max).
// ============================================================

export const colors = {
  gray: {
    950: '#0a0d12',
    900: '#0f141b',
    800: '#141a23',
    700: '#1e2733',
    600: '#2a3645',
    500: '#475569',
    400: '#94a3b8',
    300: '#cbd5e1',
    200: '#e2e8f0',
    100: '#f1f5f9',
    50: '#f8fafc',
  },
  teal: {
    900: '#134e4a',
    700: '#0f766e',
    500: '#14b8a6',
    400: '#2dd4bf',
    300: '#5eead4',
  },
  amber: {
    700: '#b45309',
    500: '#f59e0b',
    400: '#fbbf24',
  },
  red: {
    700: '#b91c1c',
    500: '#ef4444',
    400: '#f87171',
  },
  green: {
    600: '#16a34a',
    500: '#22c55e',
    400: '#4ade80',
  },
} as const;

export const semantic = {
  bg: {
    primary: colors.gray[950],
    secondary: colors.gray[900],
    surface: colors.gray[800],
    elevated: colors.gray[700],
  },
  text: {
    primary: colors.gray[50],
    secondary: colors.gray[300],
    muted: colors.gray[400],
    inverse: colors.gray[950],
  },
  status: {
    online: colors.green[500],
    connecting: colors.amber[400],
    offline: colors.red[400],
    alert: colors.red[500],
    idle: colors.gray[400],
  },
  accent: {
    primary: colors.teal[500],
    primaryDim: colors.teal[700],
  },
  border: {
    subtle: 'rgba(255,255,255,0.08)',
    default: 'rgba(255,255,255,0.12)',
    strong: 'rgba(255,255,255,0.20)',
  },
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
} as const;

export const typography = {
  family: {
    sans: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    mono: 'JetBrains Mono, monospace',
  },
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 17,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    display: 64,
  },
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.1,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const radii = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.4)',
  md: '0 4px 8px rgba(0,0,0,0.5)',
  lg: '0 8px 24px rgba(0,0,0,0.6)',
  glow: `0 0 0 1px ${semantic.accent.primary}`,
} as const;

export const animation = {
  durationFast: 150,
  durationBase: 250,
  durationSlow: 400,
  easingStandard: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easingDecelerate: 'cubic-bezier(0, 0, 0.2, 1)',
  easingAccelerate: 'cubic-bezier(0.4, 0, 1, 1)',
} as const;

// Helper: map a peer's connection state to a status color.
import type { ConnectionState } from '@sentinel-monitor/shared-types';

export function getStatusColor(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return semantic.status.online;
    case 'connecting':
    case 'reconnecting':
      return semantic.status.connecting;
    case 'offline':
    case 'disconnected':
      return semantic.status.offline;
    case 'idle':
    default:
      return semantic.status.idle;
  }
}
