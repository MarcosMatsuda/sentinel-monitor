# syntax=docker/dockerfile:1.7
# Multi-stage build for the Sentinel Monitor signaling server.
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

# Copy workspace manifests first for better layer caching.
COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared-types/package.json packages/shared-types/

RUN pnpm install --frozen-lockfile --filter @sentinel-monitor/server...

# Copy sources for the server and the workspace package it depends on.
COPY packages/shared-types packages/shared-types
COPY apps/server apps/server

RUN pnpm --filter @sentinel-monitor/shared-types build
RUN pnpm --filter @sentinel-monitor/server build

# ---------- Stage 2: prune ----------
FROM node:${NODE_VERSION}-alpine AS prune
ARG PNPM_VERSION
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

COPY .npmrc pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/shared-types packages/shared-types

RUN pnpm install --frozen-lockfile --prod --filter @sentinel-monitor/server...

# ---------- Stage 3: runtime ----------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3010 \
    LOG_LEVEL=info

# node-linker=hoisted → all deps land in the workspace root node_modules (flat, no symlinks).
# shared-types is compiled to dist/ so Node.js can require it at runtime.
COPY --from=prune /repo/node_modules /app/node_modules
COPY --from=build /repo/packages/shared-types/dist /app/node_modules/@sentinel-monitor/shared-types/dist
COPY --from=build /repo/packages/shared-types/package.json /app/node_modules/@sentinel-monitor/shared-types/package.json
COPY --from=build /repo/apps/server/dist /app/dist
COPY --from=build /repo/apps/server/package.json /app/package.json

# Run as the non-root user shipped in the node:alpine images.
USER node

EXPOSE 3010

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:${PORT}/health || exit 1

CMD ["node", "dist/main.js"]
