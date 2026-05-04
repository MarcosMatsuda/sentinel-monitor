# `@sentinel-monitor/gateway`

LAN-side bridge that publishes home IP cameras (Tapo C200, Reolink, anything
that speaks RTSP/ONVIF) to the Sentinel Monitor signaling server so a viewer
anywhere on the internet can subscribe via WebRTC.

```
[IP cam]──RTSP──►[go2rtc]──WHEP──►[gateway]──signaling──►[server]──WebRTC──►[viewer]
                                                          (Render)            (anywhere)
```

The gateway never instantiates an `RTCPeerConnection` itself — it proxies
WHEP offers from viewers into the local go2rtc bridge. That keeps it
portable to ARM (Raspberry Pi) without native compilation.

## Quickstart

### 1. Confirm the camera works standalone

Before touching gateway code, verify go2rtc + your Tapo speak to each other:

```bash
docker run --rm --network host \
  -e GO2RTC_CONFIG='streams:
    sala: rtsp://USER:PASS@TAPO_IP:554/stream1' \
  alexxit/go2rtc
```

Open `http://localhost:1984`, click `sala`, see live video. If this fails,
the issue is the Tapo (Camera Account not configured in the Tapo app, wrong
RTSP path — try `/stream2`, wrong creds). Fix this before anything else.

### 2. Configure the gateway

Copy the example config and edit it:

```bash
mkdir -p gateway
cp apps/gateway/gateway.yaml.example gateway/gateway.yaml
$EDITOR gateway/gateway.yaml
```

Minimal config:

```yaml
gateway:
  signalingUrl: "https://sentinel-server.onrender.com"
  go2rtcUrl: "http://127.0.0.1:1984"
  cameras:
    - label: "Sala"
      rtspUrl: "rtsp://USER:PASS@192.168.0.42:554/stream2"
```

UUIDs are filled in on first boot and written back to the file — identity
stays stable across restarts.

Create a matching go2rtc config (the gateway will register streams via
go2rtc's REST API but go2rtc still needs its own bind config):

```yaml
# gateway/go2rtc.yaml
api:
  listen: ":1984"
webrtc:
  listen: ":8555"
```

### 3. Run with Docker Compose

```bash
docker compose --profile gateway up
```

This starts both `go2rtc` and `gateway`. Watch the logs for the pairing code:

```
INFO  pairing.code_issued  cameraLabel=Sala  code=ABC123
```

Open the viewer (web or native), tap **Add camera**, enter the code. Once
paired, the binding is persisted to `gateway.yaml` — restarts reconnect
automatically without prompting again.

### 4. Inspect status

A tiny HTTP server runs on `127.0.0.1:9090`:

```bash
curl -s http://127.0.0.1:9090/pairing | jq
curl -s http://127.0.0.1:9090/health
```

`/pairing` shows each camera, who it's paired with, and any active code.

## Run locally without Docker

```bash
pnpm install
pnpm --filter @sentinel-monitor/gateway dev
```

Set `GATEWAY_CONFIG_PATH` to point at your YAML if it's not in CWD:

```bash
GATEWAY_CONFIG_PATH=./gateway/gateway.yaml \
  pnpm --filter @sentinel-monitor/gateway dev
```

You still need go2rtc running somewhere reachable (its URL goes in
`gateway.go2rtcUrl`).

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `GATEWAY_CONFIG_PATH` | `./gateway.yaml` | Absolute or relative path to the YAML config. |
| `GATEWAY_HTTP_PORT` | `9090` | Port for the local pairing inspector (binds to 127.0.0.1 only). |
| `LOG_LEVEL` | `info` | One of `fatal`, `error`, `warn`, `info`, `debug`, `trace`. |
| `NODE_ENV` | `development` | `production` disables pretty logs. |

## Architecture (Clean Architecture)

```
src/
├── domain/
│   ├── entities/                 # CameraConfig, GatewayConfig
│   ├── repositories/             # IConfigStorage, IGo2RtcClient, ISignaling, ICameraPublisher
│   └── use-cases/                # StartCamera, StopCamera, RequestPairing, HandlePairingRedeemed
├── infrastructure/
│   ├── config/                   # YAML+Zod storage with UUID backfill
│   ├── go2rtc/                   # REST adapter for go2rtc
│   ├── logging/                  # ILogger + Pino adapter
│   ├── signaling/                # Socket.IO client implementing ISignalingClient
│   └── webrtc/                   # GatewayCameraPublisher (WHEP proxy)
├── presentation/
│   └── http/                     # Pairing-status HTTP inspector
└── main.ts                       # Composition root
```

Dependencies always point inward: domain has zero framework imports.

## Troubleshooting

**`go2rtc.unreachable` — gateway exits at startup**
The gateway retries 10× over 20 s waiting for go2rtc. If go2rtc never
responds at the URL in `gateway.go2rtcUrl`, the process exits. With
`network_mode: host` (compose default), the URL should be
`http://127.0.0.1:1984`.

**Pairing code never appears in logs**
The signaling server may be unreachable. Check `signaling.connected` events
in the logs. If you see `connect_error`, validate `signalingUrl` and that
the server is running.

**Viewer pairs but sees no video**
1. Confirm the camera publishes in go2rtc UI (`http://127.0.0.1:1984`).
2. Check viewer devtools for ICE failures — restrictive NATs need TURN.
3. Confirm `pairedDashboards` in `gateway.yaml` was written back.

**`registerStream failed: HTTP 400`**
go2rtc rejected the RTSP URL. Test it with VLC first
(`File → Open Network → rtsp://...`).
