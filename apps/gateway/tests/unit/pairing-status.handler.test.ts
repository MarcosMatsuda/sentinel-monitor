import { PairingStatusHandler } from '../../src/presentation/http/pairing-status.handler';
import type { GatewayConfig } from '../../src/domain/entities/gateway-config.entity';

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn().mockReturnThis(),
};

const baseConfig = (): GatewayConfig => ({
  id: '11111111-1111-1111-1111-111111111111',
  signalingUrl: 'http://localhost:3010',
  go2rtcUrl: 'http://127.0.0.1:1984',
  cameras: [
    {
      id: 'cam-1',
      label: 'Sala',
      rtspUrl: 'rtsp://u:p@host:554/s1',
      addedAt: 1000,
      pairedDashboards: ['dash-old'],
    },
  ],
});

let port: number;

const fetchPath = async (path: string): Promise<{ status: number; body: string }> => {
  const res = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: res.status, body: await res.text() };
};

describe('PairingStatusHandler', () => {
  let handler: PairingStatusHandler;

  beforeEach(async () => {
    jest.clearAllMocks();
    silentLogger.child.mockReturnValue(silentLogger);
    port = 9000 + Math.floor(Math.random() * 800);
    handler = new PairingStatusHandler({ logger: silentLogger, port });
    await handler.start();
  });

  afterEach(async () => {
    await handler.stop();
  });

  describe('GET /pairing', () => {
    it('returns 503 before config is set', async () => {
      const res = await fetchPath('/pairing');
      expect(res.status).toBe(503);
    });

    it('returns gateway + cameras + paired dashboards once config is set', async () => {
      handler.setConfig(baseConfig());
      const res = await fetchPath('/pairing');

      expect(res.status).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.gatewayId).toBe('11111111-1111-1111-1111-111111111111');
      expect(body.cameras).toHaveLength(1);
      expect(body.cameras[0].id).toBe('cam-1');
      expect(body.cameras[0].pairedDashboards).toEqual(['dash-old']);
      expect(body.cameras[0].currentCode).toBeUndefined();
    });

    it('includes currentCode for cameras with active prompts', async () => {
      handler.setConfig(baseConfig());
      handler.setPrompt({
        cameraId: 'cam-1',
        label: 'Sala',
        code: 'ABC123',
        expiresAt: 1700000060000,
      });

      const res = await fetchPath('/pairing');
      const body = JSON.parse(res.body);
      expect(body.cameras[0].currentCode).toEqual({
        code: 'ABC123',
        expiresAt: 1700000060000,
      });
    });

    it('clears prompt when clearPrompt is called', async () => {
      handler.setConfig(baseConfig());
      handler.setPrompt({
        cameraId: 'cam-1',
        label: 'Sala',
        code: 'ABC123',
        expiresAt: 1700000060000,
      });
      handler.clearPrompt('cam-1');

      const res = await fetchPath('/pairing');
      const body = JSON.parse(res.body);
      expect(body.cameras[0].currentCode).toBeUndefined();
    });
  });

  describe('GET /health', () => {
    it('returns 200 ok', async () => {
      const res = await fetchPath('/health');
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ status: 'ok' });
    });
  });

  describe('other methods + paths', () => {
    it('rejects POST with 405', async () => {
      const res = await fetch(`http://127.0.0.1:${port}/pairing`, { method: 'POST' });
      expect(res.status).toBe(405);
    });

    it('returns 404 for unknown paths', async () => {
      const res = await fetchPath('/whatever');
      expect(res.status).toBe(404);
    });
  });

  describe('lifecycle', () => {
    it('start() is idempotent', async () => {
      await expect(handler.start()).resolves.toBeUndefined();
    });

    it('stop() is idempotent', async () => {
      await handler.stop();
      await expect(handler.stop()).resolves.toBeUndefined();
    });
  });
});
