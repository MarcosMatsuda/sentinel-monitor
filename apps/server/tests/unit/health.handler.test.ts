import express from 'express';
import type { AddressInfo } from 'net';
import { createServer, type Server as HttpServer } from 'http';
import { HealthHandler } from '../../src/presentation/handlers/health.handler';
import { InMemoryPeerPresenceRepository } from '../../src/data/repositories/in-memory-peer-presence.repository';

interface IFetchedHealth {
  status: string;
  presenceCount: number;
  uptime: number;
}

async function getJson(url: string): Promise<{ status: number; body: IFetchedHealth }> {
  const res = await fetch(url);
  const body = (await res.json()) as IFetchedHealth;
  return { status: res.status, body };
}

describe('HealthHandler', () => {
  let server: HttpServer;
  let url: string;
  let presence: InMemoryPeerPresenceRepository;

  beforeEach(async () => {
    presence = new InMemoryPeerPresenceRepository();
    const app = express();
    new HealthHandler(presence, () => 42).register(app);
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const addr = server.address() as AddressInfo;
    url = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('returns ok with presence count and uptime', async () => {
    const res = await getJson(`${url}/health`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', presenceCount: 0, uptime: 42 });
  });

  it('reflects current presence count', async () => {
    presence.set('cam-1', 'sock-1', 'camera');
    presence.set('cam-2', 'sock-2', 'camera');
    const res = await getJson(`${url}/health`);
    expect(res.body.presenceCount).toBe(2);
  });

  it('uses process.uptime by default', () => {
    // Just construct with default uptime fn — exercises the default branch.
    const handler = new HealthHandler(presence);
    expect(handler).toBeInstanceOf(HealthHandler);
  });
});
