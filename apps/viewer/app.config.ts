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
  plugins: [
    'expo-router',
    [
      '@config-plugins/react-native-webrtc',
      {
        cameraPermission:
          'Sentinel Monitor needs camera access for two-way video (future).',
        microphonePermission:
          'Sentinel Monitor needs microphone access to talk back to the camera.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
};

export default config;
