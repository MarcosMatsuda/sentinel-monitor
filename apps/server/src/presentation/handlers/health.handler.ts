import type { IRouter, Request, Response } from 'express';
import type { IPeerPresenceRepository } from '@sentinel-monitor/shared-types';

export interface IHealthSnapshot {
  readonly status: 'ok';
  readonly presenceCount: number;
  readonly uptime: number;
}

/**
 * Exposes a synchronous GET /health endpoint that surfaces server liveness,
 * the current peer-presence count, and process uptime in seconds.
 */
export class HealthHandler {
  constructor(
    private readonly presence: IPeerPresenceRepository,
    private readonly uptime: () => number = () => Math.floor(process.uptime()),
  ) {}

  register(router: IRouter): void {
    router.get('/health', (_req: Request, res: Response) => {
      const snapshot: IHealthSnapshot = {
        status: 'ok',
        presenceCount: this.presence.count(),
        uptime: this.uptime(),
      };
      res.json(snapshot);
    });
  }
}
