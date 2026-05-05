# Sentinel Monitor

**Self-hosted multi-camera surveillance dashboard. WebRTC peer-to-peer, vendor-agnostic, runs on a Raspberry Pi.**

Pair any RTSP camera (Tapo, Reolink, Hikvision) via a small Node.js gateway and watch from anywhere on iOS, Android, or the web. One Expo Universal codebase. Your video never touches a vendor's cloud.

> Status: MVP working end-to-end with a real Tapo C200 over LAN. Full delivery plan in [`roadmap.html`](roadmap.html), architecture deep dive in [`architecture.html`](architecture.html).

---

## Why this exists

Every consumer IP-camera vendor sells you hardware once and then funnels you into their cloud forever. Your video, your motion alerts, your license plates — all sitting on someone else's servers. Tapo cloud, Reolink cloud, Wyze cloud. Different brand, same lock-in.

Sentinel flips that:

- **Your video never leaves your infrastructure.** WebRTC negotiates a peer-to-peer link straight from the camera's local network to your viewer. The signaling server only routes handshake metadata, never frames.
- **Mix any cameras you already own.** A Tapo in the kitchen, a Reolink in the garage, a Hikvision out front — all show up in the same 1×1 / 2×2 / 3×3 grid.
- **One codebase, every screen.** Expo Universal renders the same dashboard on iOS, Android, and the web. Pair a camera once on your laptop and it's there on your phone.
- **Built to be self-hosted.** A Raspberry Pi 4 in the living room is enough for 4–6 cameras. The signaling server fits comfortably on Render's free tier.

---

## Architecture

```
[Tapo / Reolink / any RTSP cam]   <-- LAN only, never the internet
              |
              | RTSP
              v
     [go2rtc on Raspberry Pi]   bridges RTSP -> WebRTC
              |
              | WHEP
              v
     [sentinel-gateway]   per-camera identity, pairing, signaling client
              |
              | Socket.IO
              v
     [signaling server]   stateless, in-memory presence map (Render)
              ^
              | Socket.IO
              |
     [viewer]   pair once, reconnect forever (Expo Universal)
              ^
              |
              +--- WebRTC P2P direct ---> go2rtc / camera
```

The signaling server is **stateless** and only routes signaling envelopes by peer UUID. It never sees video. The gateway is an ARM-friendly Node service that proxies WHEP offers into the local go2rtc instance, keeping the heavy work on the Pi.

### Pairing flow (one time per camera)

1. Gateway boots, connects to the signaling server, registers each camera with a stable UUID
2. Operator opens the viewer, taps **Add camera**, enters a 6-character pairing code shown in the gateway logs
3. Server matches the code to the camera UUID, both sides persist the binding
4. Every subsequent reconnect skips pairing — bindings are durable on both ends

### Why peer-to-peer matters

A 1080p H264 stream at 15fps is roughly 1 GB per camera per day. With four cameras and three viewers, a relay-based architecture would shovel ~12 GB/day through the cloud. WebRTC P2P keeps that traffic on the LAN and only "borrows" a TURN relay (~$5/month) for the cases where direct ICE fails (CGNAT, restrictive firewalls, mobile carriers).

---

## Stack

| Layer | Technology |
|---|---|
| Signaling server | Node.js · Express · Socket.IO · Pino · Zod |
| RTSP -> WebRTC bridge | [go2rtc](https://github.com/AlexxIT/go2rtc) (binary on the Pi) |
| LAN gateway | Node.js · Socket.IO client · WHEP proxy |
| Viewer | Expo SDK 52 · Expo Router · Zustand · `react-native-webrtc` (native) / browser WebRTC (web) |
| Shared | TypeScript strict · Turborepo · pnpm workspaces · Clean Architecture per app |

Every app follows Clean Architecture (`domain -> data / infrastructure -> presentation`). The domain layer has zero framework imports — pure types and use-cases that survive any framework rewrite.

---

## Quick start

Three paths depending on what you have on hand.

### 1. Browser-only smoke test (just a laptop)

```bash
git clone <repo-url>
cd sentinel-monitor
pnpm install
./start
```

Open the Camera URL in one tab (uses your webcam), the Viewer URL in another, type the 6-character code. Done. No physical camera, no Raspberry Pi, no go2rtc — this proves the WebRTC core in under a minute.

### 2. Real cameras via go2rtc + gateway (Mac / Linux dev box)

You'll need:

- [go2rtc](https://github.com/AlexxIT/go2rtc/releases/latest) on your PATH (`/usr/local/bin/go2rtc` is fine)
- A `gateway/gateway.yaml` describing your cameras
- An RTSP-capable camera with credentials configured (Tapo: enable "Camera Account" in the app)

```bash
mkdir -p gateway
cp apps/gateway/gateway.yaml.example gateway/gateway.yaml
$EDITOR gateway/gateway.yaml          # add your RTSP URL(s)

./start
```

`./start` opens four iTerm2 tabs (Server, go2rtc, Gateway, Viewer), kills any stale processes on the relevant ports, and pre-flights `go2rtc` + the YAML config. Watch the gateway logs for `pairing.code_issued`, paste the 6-char code into the viewer at `http://localhost:8081`, and you've got live video.

> **Heads up for Chrome users on macOS/Linux**: Chrome hides local IPs behind mDNS by default, and go2rtc can't resolve `.local` hostnames. Either disable the flag at `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` for local dev, or deploy a TURN server so ICE can complete via relay.

### 3. Production: Pi gateway + Render + Vercel + TURN

For "see my cameras from anywhere":

- Flash a Raspberry Pi 4 with the gateway Docker image (multi-arch build, ARM-native)
- Deploy the signaling server to Render with the included Blueprint (`render.yaml`) — one click after connecting the repo
- `pnpm --filter @sentinel-monitor/viewer exec expo export --platform web` and upload the bundle to Vercel
- Spin up a coturn instance on a $5/month Hetzner VPS (or use Twilio Network Traversal) and set `TURN_URL` / `TURN_USER` / `TURN_PASS` on the server

The full production checklist lives in [`roadmap.html`](roadmap.html) under **Phase 1.5 — Personal production**.

---

## Project layout

```
sentinel-monitor/
├── apps/
│   ├── server/        # Signaling + presence (Express + Socket.IO)
│   ├── camera/        # Browser camera publisher (Vite + vanilla TS)
│   ├── gateway/       # LAN bridge for IP cams (Node, runs on Pi)
│   └── viewer/        # Expo Universal dashboard (iOS / Android / Web)
├── packages/
│   ├── shared-types/  # Domain types, Socket.IO contract, message DTOs
│   ├── webrtc-config/ # ICE servers, media constraints, bitrate presets
│   └── design-tokens/ # Colors, spacing, typography
├── architecture.html  # SDD-style technical document
├── roadmap.html       # Phased delivery plan with cards by category
├── render.yaml        # Render Blueprint for one-click signaling deploy
├── docker-compose.yml # Local server + optional gateway profile
├── start              # iTerm2 multiplexer for the 4 dev services
└── turbo.json
```

---

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

A copy-ready `.env.example` lives at the repo root.

---

## Deploy

The viewer and camera apps are static bundles (Expo Web export and Vite build) and can be uploaded to any static host (Vercel, Netlify, Cloudflare Pages). The signaling server is a long-running Node process — the walkthrough below uses Render's free tier.

### Render free tier (signaling server)

The repo ships a [`render.yaml`](render.yaml) Blueprint at the root. Render auto-detects it and provisions the service with the right Dockerfile, health check, and non-secret env vars in one click.

**One-shot import**:

1. Make sure `main` exists with the latest release commit (the Blueprint pins `branch: main` and `autoDeploy: false`).
2. In Render: **New +** -> **Blueprint** -> connect this repo.
3. Render reads `render.yaml`, shows the service plan, click **Apply**.
4. After provisioning, open the service -> **Environment** and fill in the `sync: false` secrets if you need TURN: `TURN_URL`, `TURN_USER`, `TURN_PASS`. Update `CORS_ORIGIN` if your viewer URL differs from the placeholder in `render.yaml`.
5. Trigger the first deploy manually (auto-deploy is off in the MVP).
6. Confirm: `curl https://<service>.onrender.com/health` -> `{"status":"ok",...}`. Render's **Logs** tab streams the Pino JSON.
7. Paste the public URL into the viewer and camera builds as `EXPO_PUBLIC_SIGNALING_URL` / `VITE_SIGNALING_URL`.

> **Free tier caveat**: services sleep after 15 min of inactivity. The first request after sleep takes 30–60 s to boot. Acceptable for MVP demos; for real production move to a paid plan or a host without idle suspension (Fly.io, Railway).

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
# upload apps/viewer/dist (or the directory configured in app.json)
```

---

## Monitoring

The server emits structured JSON logs to stdout via [Pino](https://getpino.io/). Each line carries:

- `time` — ISO timestamp
- `level` — Pino numeric level (`30` info, `40` warn, `50` error)
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
| `/health` -> non-200 | Liveness check failed. Render will restart automatically. |

On Render: the **Logs** tab streams stdout in real time. Use the **Search** box with the JSON `event` value (e.g. `pairing.redeem_failed`) to filter.

---

## Troubleshooting

**Server fails to boot with `Invalid server environment: ...`**
The Zod env validator caught a misconfiguration. The error names the offending variable. Fix it in your platform's env config and redeploy. Validation runs before the listener binds, so the process exits with code `1`.

**Tile shows `Aguardando vídeo…` but Chrome devtools say the connection is `connected`**
Chrome hides local IPs behind mDNS by default, and go2rtc cannot resolve `.local` hostnames in its ICE agent. Either disable the flag at `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` and relaunch Chrome, or deploy a TURN server so ICE candidate pairs can succeed via relay. Adding `webrtc.candidates: [127.0.0.1:8555, <LAN-IP>:8555]` to your `gateway/go2rtc.yaml` also helps when running viewer + go2rtc on the same machine.

**Video element receives the stream but stays black**
Chrome's autoplay policy blocks `play()` on streams that contain audio unless the element is muted **in JavaScript** before `srcObject` is set. The viewer does this in `video-surface.web.tsx` — if you fork it, keep that ordering or add a "click to start" overlay.

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

# Generate a fresh pairing code (clears persisted dashboard binding)
$EDITOR gateway/gateway.yaml      # set pairedDashboards: [] for the camera
# then restart the gateway
```

---

## Roadmap (the short version)

| Phase | Theme | Status |
|---|---|---|
| 1 | MVP core (signaling, gateway, viewer, browser publisher) | Done |
| 1.5 | Personal production (TURN, Vercel, EAS, RPi gateway, observability) | In progress |
| 1.6 | Multi-tenant pilot (auth, central DB, isolation, self-service onboarding) | Planned |
| 2 | Cross-camera AI tracking (YOLO edge + Gemini Vision cloud, watchlists, LPR) | Planned |
| 3 | Recording, scale, SaaS (continuous + triggered recording, timeline UI, billing, motion zones, SFU) | Planned |

Full breakdown with cards filterable by category (Core / AI / UX / Infra / Recording) is in [`roadmap.html`](roadmap.html).

---

## Branching policy

- `main` — locked. Receives only the v1.0.0 release merge.
- `develop` — default integration branch. All feature PRs target develop.
- `feat/*`, `fix/*`, `chore/*`, `test/*` — short-lived, one per task.

---

## License

MIT — see [`LICENSE`](LICENSE).
