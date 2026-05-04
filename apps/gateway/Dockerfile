# syntax=docker/dockerfile:1.7
# Multi-stage build for the Sentinel Monitor LAN gateway.
# Stage 1: install full workspace deps, compile TypeScript.
# Stage 2: prune to production deps only.
# Stage 3: minimal runtime image.

ARG NODE_VERSION=20.18.0
ARG PNPM_VERSION=9.12.0

# ---------- Stage 1: build ----------
FROM node:${NODE_VERSION}-alpine AS build
ARG PNPM_VERSION
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json .npmrc ./
COPY apps/gateway/package.json apps/gateway/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/webrtc-config/package.json packages/webrtc-config/

RUN pnpm install --frozen-lockfile --filter @sentinel-monitor/gateway...

COPY packages/shared-types packages/shared-types
COPY packages/webrtc-config packages/webrtc-config
COPY apps/gateway apps/gateway

RUN pnpm --filter @sentinel-monitor/gateway build

# ---------- Stage 2: prune ----------
FROM node:${NODE_VERSION}-alpine AS prune
ARG PNPM_VERSION
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json .npmrc ./
COPY apps/gateway/package.json apps/gateway/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/webrtc-config/package.json packages/webrtc-config/
COPY packages/shared-types packages/shared-types
COPY packages/webrtc-config packages/webrtc-config

RUN pnpm install --frozen-lockfile --prod --filter @sentinel-monitor/gateway...

# ---------- Stage 3: runtime ----------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    LOG_LEVEL=info \
    GATEWAY_CONFIG_PATH=/app/config/gateway.yaml \
    GATEWAY_HTTP_PORT=9090

COPY --from=prune /repo/node_modules /app/node_modules
COPY --from=prune /repo/apps/gateway/node_modules /app/node_modules
COPY --from=prune /repo/packages /app/packages
COPY --from=build /repo/apps/gateway/dist /app/dist
COPY --from=build /repo/apps/gateway/package.json /app/package.json

USER node

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:${GATEWAY_HTTP_PORT}/health || exit 1

CMD ["node", "dist/main.js"]
