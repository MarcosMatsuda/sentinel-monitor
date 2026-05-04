import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { ILogger } from '../../infrastructure/logging/logger';
import type { PairingPrompt } from '../../domain/use-cases/request-pairing.use-case';
import type { GatewayConfig } from '../../domain/entities/gateway-config.entity';

export interface PairingStatusHandlerOptions {
  readonly logger: ILogger;
  readonly port?: number;
}

interface PairingSnapshot {
  readonly id: string;
  readonly label: string;
  readonly pairedDashboards: readonly string[];
  readonly currentCode?: { code: string; expiresAt: number };
}

const DEFAULT_PORT = 9090;

/**
 * Tiny HTTP server (no Express) on localhost:9090 that exposes the
 * gateway's pairing status as JSON. Operator can `curl localhost:9090/pairing`
 * to see active pairing codes, dashboards already bound, etc.
 *
 * Designed for LAN diagnostics only — binds to 127.0.0.1, not 0.0.0.0.
 */
export class PairingStatusHandler {
  private server: Server | null = null;
  private readonly logger: ILogger;
  private readonly port: number;
  private snapshot: { config: GatewayConfig | null; prompts: Map<string, PairingPrompt> } = {
    config: null,
    prompts: new Map(),
  };

  constructor(opts: PairingStatusHandlerOptions) {
    this.logger = opts.logger;
    this.port = opts.port ?? DEFAULT_PORT;
  }

  setConfig(config: GatewayConfig): void {
    this.snapshot.config = config;
  }

  setPrompt(prompt: PairingPrompt): void {
    this.snapshot.prompts.set(prompt.cameraId, prompt);
  }

  clearPrompt(cameraId: string): void {
    this.snapshot.prompts.delete(cameraId);
  }

  async start(): Promise<void> {
    if (this.server) return;

    this.server = createServer((req, res) => this.handleRequest(req, res));

    return new Promise<void>((resolve, reject) => {
      const server = this.server!;
      server.once('error', reject);
      server.listen(this.port, '127.0.0.1', () => {
        server.off('error', reject);
        this.logger.info(
          { event: 'pairing.http_started', port: this.port },
          `Pairing inspector at http://127.0.0.1:${this.port}/pairing`,
        );
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise<void>((resolve) => {
      this.server!.close(() => {
        this.server = null;
        resolve();
      });
    });
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    if (!req.url || !req.method) {
      res.writeHead(400);
      res.end();
      return;
    }

    if (req.method !== 'GET') {
      res.writeHead(405, { Allow: 'GET' });
      res.end();
      return;
    }

    if (req.url === '/pairing') {
      this.respondWithSnapshot(res);
      return;
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(404);
    res.end();
  }

  private respondWithSnapshot(res: ServerResponse): void {
    const config = this.snapshot.config;
    if (!config) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'gateway not yet ready' }));
      return;
    }

    const cameras: PairingSnapshot[] = config.cameras.map((cam) => {
      const prompt = this.snapshot.prompts.get(cam.id);
      return {
        id: cam.id,
        label: cam.label,
        pairedDashboards: cam.pairedDashboards,
        ...(prompt
          ? { currentCode: { code: prompt.code, expiresAt: prompt.expiresAt } }
          : {}),
      };
    });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ gatewayId: config.id, cameras }, null, 2));
  }
}
