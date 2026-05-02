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

`react-native-webrtc` (PR6) requires a custom dev client — Expo Go is not
supported. After installing dependencies:

```sh
# 1. Login once
eas login

# 2. Configure builds
eas build:configure

# 3. Build a development client for the simulator/device
eas build --profile development --platform ios
eas build --profile development --platform android
```

Suggested `eas.json` (commit alongside the first EAS build, not part of PR5):

```json
{
  "cli": { "version": ">= 12.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": { "distribution": "internal" },
    "production": {}
  }
}
```

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

## TODO (PR6)

- `ConnectToCameraUseCase` — opens the WebRTC peer connection after a
  successful pairing, replacing the stub `resolveCameraId` in `add-camera`.
