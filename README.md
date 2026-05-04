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

## Server runtime configuration

The signaling server validates its environment at boot via a Zod schema. Missing or invalid values fail fast with a single human-readable error.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NODE_ENV` | no | `development` | One of `development`, `test`, `production`. Toggles JSON vs pretty logs. |
| `PORT` | no | `3010` | Integer 1–65535. |
| `CORS_ORIGIN` | no | `*` | Origin allowed by Socket.IO. Set to your viewer/camera URLs in production. |
| `LOG_LEVEL` | no | `info` | One of `fatal`, `error`, `warn`, `info`, `debug`, `trace`, `silent`. |
| `TURN_URL` | optional | — | Required only when using a TURN relay. Must be set together with `TURN_USER` and `TURN_PASS`. |
| `TURN_USER` | optional | — | TURN username. |
| `TURN_PASS` | optional | — | TURN credential. |

A copy-ready `.env.example` lives next to the server (`apps/server/.env.example` — add one if you customize defaults).

## Deploy

The viewer and camera apps are static bundles (Expo Web export and Vite build) and can be uploaded to any static host (Vercel, Netlify, Cloudflare Pages). The signaling server is a long-running Node process — the walkthrough below uses Render's free tier.

### Render free tier (signaling server)

1. Push the `develop` branch to GitHub if you haven't yet.
2. In Render, **New +** → **Web Service** → connect the GitHub repo.
3. Configure:
   - **Runtime**: Docker
   - **Dockerfile path**: `apps/server/Dockerfile`
   - **Docker build context**: repository root (`.`)
   - **Branch**: `main` (only release tags should land here)
   - **Auto-deploy**: off for the MVP — deploy manually after a `develop → main` merge.
4. Add the environment variables from the table above. At minimum set `CORS_ORIGIN` to your viewer's deployed origin.
5. **Health check path**: `/health`.
6. Create the service. First build pulls workspace deps, compiles TypeScript, and prunes to production-only deps.
7. Note the public URL Render assigns (e.g. `https://sentinel-server.onrender.com`); paste it into the viewer and camera builds as `VITE_SIGNALING_URL` / `EXPO_PUBLIC_SIGNALING_URL`.

### Local Docker

```bash
docker compose up --build
# server now reachable at http://localhost:3010/health
```

### Static apps (camera + viewer)

```bash
# Camera (Vite)
pnpm --filter @sentinel-monitor/camera build
# upload apps/camera/dist to your static host

# Viewer (Expo web export)
pnpm --filter @sentinel-monitor/viewer exec expo export --platform web
# upload apps/viewer/dist (or the directory configured in app.json) to your static host
```

## Monitoring

The server emits structured JSON logs to stdout via [pino](https://getpino.io/). Each log line carries:

- `time` — ISO timestamp
- `level` — pino numeric level (`30` info, `40` warn, `50` error)
- `service` — always `sentinel-server`
- `event` — domain-event tag (e.g. `socket.connected`, `pairing.code_issued`, `pairing.redeem_failed`, `presence.registered`, `presence.removed`, `signal.dropped`, `boot.listening`, `boot.shutdown`)
- `correlationId` + `socketId` — bound to a child logger per Socket.IO connection so you can trace a single client end-to-end

What to watch in production:

| Signal | What it tells you |
|---|---|
| Spike in `pairing.redeem_failed` (`reason: "NOT_FOUND"`) | Camera and dashboard clocks drifted, or operators are typing wrong codes. |
| `signal.dropped` events | A peer is going offline mid-handshake. Confirm presence churn. |
| `presence.registered` count vs `presence.removed` count | Should balance over time. A growing gap means orphan presence — investigate. |
| `boot.shutdown` outside a planned deploy | Process was killed (OOM, host restart). Check the platform's process logs. |
| `/health` → non-200 | Liveness check failed. Render will restart automatically. |

On Render: **Logs** tab streams stdout in real time. Use the **Search** box with the JSON `event` value (e.g. `pairing.redeem_failed`) to filter.

## Troubleshooting

**Server fails to boot with `Invalid server environment: ...`**
The Zod env validator caught a misconfiguration. The error names the offending variable. Fix it in your platform's env config and redeploy. Validation runs before the listener binds, so the process exits with code `1`.

**Camera shows "connected" but dashboard never receives video**
Check three places, in order:
1. Server logs around the connection time — search by `correlationId` to follow both peers.
2. Browser devtools on both peers — look for ICE failures. If the operator is on a restrictive network, you need TURN. Set `TURN_URL`, `TURN_USER`, `TURN_PASS` and redeploy.
3. `CORS_ORIGIN` matches the actual viewer/camera origins. A wildcard (`*`) works but is not recommended in production.

**`pairing.redeem_failed` with `NOT_FOUND`**
Pairing codes expire after 5 minutes. Generate a fresh code from the camera and retry. If it still fails, check that the dashboard hits the same server URL the camera registered against.

**High latency / dropped signals**
Render's free tier sleeps idle services. The first request after sleep takes 30–60s. For real production use, upgrade to a paid plan or move to a host without idle suspension (Fly.io, Railway).

**Logs are unreadable JSON in development**
Ensure `NODE_ENV` is unset or `development` — the server only enables `pino-pretty` outside production. In Docker the default is `production`; override with `-e NODE_ENV=development` when poking around locally.

**Useful commands**

```bash
# Tail logs from a running container
docker compose logs -f server

# One-off health probe
curl -s http://localhost:3010/health | jq

# Rebuild the image after server source changes
docker compose build server && docker compose up -d server

# Inspect parsed env on boot — the first JSON line includes the safe view
docker compose logs server | head -n 5
```

## Run a real home setup with Tapo cams

For the production data flow (IP cams in your LAN, viewer accessible from
anywhere on the internet), use `apps/gateway` instead of the browser-based
`apps/camera`.

```
[Tapo C200]──RTSP──►[go2rtc]──►[gateway]──signaling──►[server]──►[viewer anywhere]
        (LAN — Mac/Pi running docker compose)             (Render)    (Vercel)
```

1. Confirm your Tapo speaks RTSP standalone — see
   [`apps/gateway/README.md`](apps/gateway/README.md) "Quickstart" step 1.
2. `cp apps/gateway/gateway.yaml.example gateway/gateway.yaml` and add
   each camera's RTSP URL.
3. `docker compose --profile gateway up` — boots both `go2rtc` and the
   gateway service.
4. Watch logs for a 6-character pairing code per camera, enter it in the
   viewer (web or native) once. The binding persists.
5. `curl http://127.0.0.1:9090/pairing` shows live pairing status.

Full docs (config, troubleshooting, architecture):
[`apps/gateway/README.md`](apps/gateway/README.md).

## Branching policy

- `main` — locked. Receives only the v1.0.0 release merge.
- `develop` — default integration branch. All feature PRs target develop.
- `feat/issue-NN-*`, `fix/issue-NN-*`, `chore/issue-NN-*`, `test/issue-NN-*` — short-lived, one per GitHub issue.

## License

MIT
