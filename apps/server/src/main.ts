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
import { HealthHandler } from './presentation/handlers/health.handler';
import { SocketHandler } from './presentation/handlers/socket.handler';

const PORT = Number(process.env.PORT ?? 3010);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

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
  cors: { origin: CORS_ORIGIN },
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
}).register(io);

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Sentinel signaling server listening on :${PORT}`);
});
