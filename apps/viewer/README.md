# Viewer (Expo Universal)

Placeholder until PR5 lands the Expo scaffold via `npx create-expo-app` (or `eas init`).

When PR5 lands, this folder will contain:
- `app.config.ts` — Expo config (bundle id, plugins, permissions)
- `app/` — Expo Router routes (`_layout.tsx`, `index.tsx` = grid, `camera/[id].tsx` = fullscreen)
- `src/domain/`, `src/infrastructure/`, `src/presentation/` — Clean Architecture layers
- `metro.config.js`, `babel.config.js` — bundler config
- `tsconfig.json`, `jest.config.js`

Native target uses `react-native-webrtc` (custom dev client required, not Expo Go). Web target uses native browser WebRTC via `react-native-web` + `.web.tsx` file resolution.
