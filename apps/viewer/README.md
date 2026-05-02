# Viewer (Expo Universal)

The Sentinel Monitor viewer — iOS, Android, and Web from one Expo SDK 52
codebase via `react-native-web`. Bootstrapped in PR5; WebRTC arrives in PR6.

## Layout

```
apps/viewer
├── app/                  Expo Router routes
│   ├── _layout.tsx       Root stack + store hydration
│   ├── index.tsx         Grid screen (empty state -> tiles)
│   └── camera/[id].tsx   Fullscreen placeholder
├── src/
│   ├── domain/           Entities, repositories, use cases (pure TS)
│   ├── infrastructure/   Storage adapters (.web.ts / .native.ts)
│   └── presentation/     Zustand store, components, theme
└── tests/unit/           Jest + ts-jest, ≥80% on domain & stores
```

Dependencies always point inward toward `domain/`. Platform-specific code
lives behind interfaces and is wired in via `presentation/bootstrap.ts`.

## Scripts

```sh
pnpm --filter @sentinel-monitor/viewer dev:web   # expo start --web
pnpm --filter @sentinel-monitor/viewer dev:ios   # expo run:ios
pnpm --filter @sentinel-monitor/viewer test
pnpm --filter @sentinel-monitor/viewer typecheck
```

## EAS dev client (iOS / Android)

`react-native-webrtc` ships native modules — Expo Go is **not** supported.
You must build a custom dev client once per platform, then run Metro
against it.

```sh
# 1. Install deps from the repo root
pnpm install

# 2. Generate native projects (writes ios/ + android/)
pnpm --filter @sentinel-monitor/viewer exec expo prebuild --clean

# 3. (One-time) authenticate with EAS
eas login

# 4. Build a dev client
#    iOS simulator (fastest local loop):
eas build --profile development --platform ios
#    Android emulator / device:
eas build --profile development --platform android

# 5. Install the resulting build on the simulator/device, then start Metro
pnpm --filter @sentinel-monitor/viewer dev
```

The `development` profile in `eas.json` enables `developmentClient: true`
and targets the iOS simulator + an Android APK so you can sideload
locally without a Play Store account.

The Expo plugin `@config-plugins/react-native-webrtc` (wired in
`app.config.ts`) handles the iOS Info.plist usage strings and the
Android `CAMERA` / `RECORD_AUDIO` permissions during prebuild.

### Smoke test (manual)

Native WebRTC cannot be exercised from CI — verify on real runtimes:

1. Start the signaling server (`apps/server`).
2. Pair a camera (`apps/camera`) and copy the pairing code.
3. Launch the viewer dev client; redeem the code.
4. Confirm the remote video renders inside the camera tile and that
   `connectionState` reaches `connected`.

## Storage

`binding-storage.web.ts` uses `localStorage` (key `sm.bindings`).
`binding-storage.native.ts` uses `@react-native-async-storage/async-storage`.
Metro picks the right one via file extension — never via `Platform.OS`.

For tests, `in-memory-binding-storage.ts` provides a deterministic adapter.

## What lives where

| Concern              | File                                                   |
| -------------------- | ------------------------------------------------------ |
| Grid math            | `src/domain/entities/grid-layout.entity.ts`            |
| Persisted binding    | `src/domain/entities/camera-binding.entity.ts`         |
| Stable dashboardId   | `src/domain/entities/viewer-identity.entity.ts`        |
| Cold-start hydration | `src/domain/use-cases/bootstrap-viewer.use-case.ts`    |
| Add/remove/rename    | `src/domain/use-cases/{add,remove,rename}-camera.*`    |
| State + persistence  | `src/presentation/stores/bindings.store.ts`            |

