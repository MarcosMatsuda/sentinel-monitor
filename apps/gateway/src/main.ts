// Composition root for the Sentinel Monitor LAN gateway.
// PR-G1: scaffold only — loads YAML config and prints the parsed
// gateway + cameras. Subsequent PRs add go2rtc + signaling + WebRTC.

import { resolve } from 'node:path';
import { YamlConfigStorageRepository } from './infrastructure/config/yaml-config-storage.repository';
import { createLogger } from './infrastructure/logging/logger';

const CONFIG_PATH = process.env.GATEWAY_CONFIG_PATH ?? resolve(process.cwd(), 'gateway.yaml');

async function main(): Promise<void> {
  const logger = createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    pretty: process.env.NODE_ENV !== 'production',
  });

  logger.info({ event: 'boot.starting', configPath: CONFIG_PATH });

  const configRepo = new YamlConfigStorageRepository(CONFIG_PATH);
  let config;
  try {
    config = await configRepo.load();
  } catch (err) {
    logger.error(
      { event: 'boot.config_failed', error: err instanceof Error ? err.message : String(err) },
      'Failed to load gateway configuration',
    );
    process.exit(1);
  }

  logger.info(
    {
      event: 'boot.loaded',
      gatewayId: config.id,
      signalingUrl: config.signalingUrl,
      go2rtcUrl: config.go2rtcUrl,
      cameraCount: config.cameras.length,
    },
    'Gateway configuration loaded',
  );

  for (const cam of config.cameras) {
    logger.info(
      { event: 'boot.camera', id: cam.id, label: cam.label, paired: cam.pairedDashboards.length },
      `Camera registered: ${cam.label}`,
    );
  }

  logger.warn(
    { event: 'boot.scaffold_only' },
    'PR-G1 scaffold: no go2rtc, no signaling, no WebRTC yet. Subsequent PRs will wire these.',
  );
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal:', err);
  process.exit(1);
});
