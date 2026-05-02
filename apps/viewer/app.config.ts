import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Sentinel Monitor',
  slug: 'sentinel-monitor-viewer',
  version: '0.0.1',
  orientation: 'portrait',
  scheme: 'sentinelmonitor',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: 'com.marcos.matsuda.sentinelmonitor',
    supportsTablet: true,
  },
  android: {
    package: 'com.marcos.matsuda.sentinelmonitor',
  },
  web: {
    bundler: 'metro',
    output: 'single',
  },
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
