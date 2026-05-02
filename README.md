# Sentinel Monitor

Multi-camera B2B dashboard for security operations. Open a web URL on a camera device to publish a stream; pair it with a dashboard via a 6-character code; the binding is permanent. Dashboard supports up to 9 cameras in a 1×1 / 2×2 / 3×3 grid, runs on iOS, Android and the web from a single Expo Universal codebase.

> Status: scaffolding (pre-MVP). Plan and architecture are documented at `architecture.html`. Roadmap at `roadmap.html`.

## How it works

```
  Camera device (browser)              Server (signaling + presence)        Viewer (Expo Universal)
  ┌────────────────────┐               ┌────────────────────────┐           ┌─────────────────────┐
  │ getUserMedia       │               │ presence map           │           │ AsyncStorage:       │
  │ UUID stable        │◄─── WebRTC P2P (after handshake) ─────►│           │   bindings[]       │
  │ pairing code       │               │ pairing codes (TTL 5m) │           │   dashboardId      │
  │ persists pairings  │   signaling   │ signal routing by UUID │ signaling │ Grid 1x1/2x2/3x3   │
  └─────────┬──────────┘──────────────►│                        │◄──────────┤ Tap → fullscreen   │
            │                          └────────────────────────┘           │ Rename / Remove    │
            └────── direct video + audio ─────────────────────────────────►│
```

**Pairing (one-time)**:
1. Camera device opens the camera URL → generates persistent UUID → shows 6-char code
2. Operator at HQ enters the code in the dashboard → server resolves to camera UUID → both sides save the binding
3. From now on, dashboard reconnects to the camera automatically on every restart

## Stack

| Layer | Technology |
|---|---|
| Server | Node.js, Express, Socket.IO |
| Camera publisher | Vite, vanilla TypeScript, native browser WebRTC |
| Viewer | Expo (iOS / Android / Web via react-native-web), Expo Router, Zustand, react-native-webrtc on native, native browser WebRTC on web |
| Shared | TypeScript strict, Turborepo, pnpm workspaces, design tokens |

## Project layout

```
sentinel-monitor/
├── apps/
│   ├── server/        # Signaling + presence
│   ├── camera/        # Browser camera publisher (Vite + vanilla TS)
│   └── viewer/        # Expo Universal dashboard (iOS / Android / Web)
├── packages/
│   ├── shared-types/  # Domain types, Socket.IO contract, DataChannel messages
│   ├── webrtc-config/ # ICE servers, media constraints, bitrate presets
│   └── design-tokens/ # Colors, spacing, typography
├── architecture.html  # Full SDD-style technical document
├── roadmap.html       # Phased delivery plan (MVP → Phase 2 AI → Phase 3 scale)
├── start              # iTerm2 tabs for server + camera + viewer
└── turbo.json
```

Each app follows Clean Architecture: `domain → data/infrastructure → presentation`. The `domain` layer has zero framework dependencies.

## Quick start

> **Status**: scaffolding only. The commands below will become functional as PRs land. Track progress in the GitHub project board.

```bash
git clone <repo-url>
cd sentinel-monitor
pnpm install
./start              # opens iTerm2 tabs for all 3 services (once implemented)
```

## Branching policy

- `main` — locked. Receives only the v1.0.0 release merge.
- `develop` — default integration branch. All feature PRs target develop.
- `feat/issue-NN-*`, `fix/issue-NN-*`, `chore/issue-NN-*`, `test/issue-NN-*` — short-lived, one per GitHub issue.

## License

MIT
