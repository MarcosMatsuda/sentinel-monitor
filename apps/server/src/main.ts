// Composition root for the Sentinel Monitor signaling server.
// Wires repositories -> use cases -> presentation handlers (Socket.IO + Express).

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
} from '@sentinel-monitor/shared-types';

import { InMemoryPairingCodeRepository } from './data/repositories/in-memory-pairing-code.repository';
import { InMemoryPeerPresenceRepository } from './data/repositories/in-memory-peer-presence.repository';
import { GeneratePairingCodeUseCase } from './domain/use-cases/generate-pairing-code.use-case';
import { HandleDisconnectUseCase } from './domain/use-cases/handle-disconnect.use-case';
import { RedeemPairingCodeUseCase } from './domain/use-cases/redeem-pairing-code.use-case';
import { RegisterPresenceUseCase } from './domain/use-cases/register-presence.use-case';
import { RouteSignalUseCase } from './domain/use-cases/route-signal.use-case';
import {
  describeEnv,
  EnvValidationError,
  loadEnv,
  type IServerEnv,
} from './infrastructure/config/env';
import { createLogger } from './infrastructure/logging/logger';
import { HealthHandler } from './presentation/handlers/health.handler';
import { SocketHandler } from './presentation/handlers/socket.handler';

let env: IServerEnv;
try {
  env = loadEnv();
} catch (err) {
  // Logger not yet built; emit a single bootstrap error and exit.
  // eslint-disable-next-line no-console
  console.error(
    err instanceof EnvValidationError ? err.message : 'Failed to load environment',
  );
  process.exit(1);
}

const logger = createLogger({
  level: env.LOG_LEVEL,
  pretty: env.NODE_ENV !== 'production',
});

logger.info({ event: 'boot.env', config: describeEnv(env) }, 'environment loaded');

// ---- Repositories (data layer) ----
const presenceRepo = new InMemoryPeerPresenceRepository();
const pairingRepo = new InMemoryPairingCodeRepository();

// ---- Use cases (domain layer) ----
const registerPresence = new RegisterPresenceUseCase(presenceRepo);
const generatePairingCode = new GeneratePairingCodeUseCase(pairingRepo);
const redeemPairingCode = new RedeemPairingCodeUseCase(pairingRepo);
const routeSignal = new RouteSignalUseCase(presenceRepo);
const handleDisconnect = new HandleDisconnectUseCase(presenceRepo);

// ---- Express + Socket.IO bootstrap ----
const app = express();
const httpServer = createServer(app);
const io = new Server<IClientToServerEvents, IServerToClientEvents>(httpServer, {
  cors: { origin: env.CORS_ORIGIN },
});

// ---- Presentation handlers ----
new HealthHandler(presenceRepo).register(app);
new SocketHandler({
  registerPresence,
  generatePairingCode,
  redeemPairingCode,
  routeSignal,
  handleDisconnect,
  presence: presenceRepo,
  logger,
}).register(io);

httpServer.listen(env.PORT, () => {
  logger.info(
    { event: 'boot.listening', port: env.PORT },
    `Sentinel signaling server listening on :${env.PORT}`,
  );
});

const shutdown = (signal: string): void => {
  logger.info({ event: 'boot.shutdown', signal }, 'shutting down');
  httpServer.close(() => process.exit(0));
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
