// Composition root for the Sentinel Monitor signaling server.
// Wires repositories, use cases, and the socket handler together.
//
// PR3 fills this in. For now, just a health check on PORT.

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
} from '@sentinel-monitor/shared-types';

const PORT = Number(process.env.PORT ?? 3010);
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';

const app = express();
const httpServer = createServer(app);

const io = new Server<IClientToServerEvents, IServerToClientEvents>(httpServer, {
  cors: { origin: CORS_ORIGIN },
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

io.on('connection', (socket) => {
  // Wired in PR3 by SocketHandler
  // eslint-disable-next-line no-console
  console.log(`[scaffold] socket connected: ${socket.id}`);
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Sentinel signaling server listening on :${PORT}`);
});
