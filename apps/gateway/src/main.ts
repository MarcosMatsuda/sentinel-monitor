// Composition root for the Sentinel Monitor LAN gateway.
// Wires config → go2rtc → signaling → publishers → pairing → HTTP inspector.

import { resolve } from 'node:path';
import { YamlConfigStorageRepository } from './infrastructure/config/yaml-config-storage.repository';
import { createLogger, type ILogger } from './infrastructure/logging/logger';
import { Go2RtcClient } from './infrastructure/go2rtc/go2rtc.client';
import { SocketIoSignalingClient } from './infrastructure/signaling/socketio-signaling.client';
import { GatewayCameraPublisher } from './infrastructure/webrtc/gateway-camera-publisher';
import { StartCameraUseCase } from './domain/use-cases/start-camera.use-case';
import { StopCameraUseCase } from './domain/use-cases/stop-camera.use-case';
import { RequestPairingUseCase } from './domain/use-cases/request-pairing.use-case';
import { HandlePairingRedeemedUseCase } from './domain/use-cases/handle-pairing-redeemed.use-case';
import { PairingStatusHandler } from './presentation/http/pairing-status.handler';
import type { CameraConfig } from './domain/entities/camera-config.entity';
import type { GatewayConfig } from './domain/entities/gateway-config.entity';

const CONFIG_PATH = process.env.GATEWAY_CONFIG_PATH ?? resolve(process.cwd(), 'gateway.yaml');
const PAIRING_HTTP_PORT = Number(process.env.GATEWAY_HTTP_PORT ?? 9090);
const GO2RTC_HEALTH_RETRIES = 10;
const GO2RTC_HEALTH_DELAY_MS = 2_000;

interface CameraRuntime {
  readonly stop: () => Promise<void>;
}

async function main(): Promise<void> {
  const logger = createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    pretty: process.env.NODE_ENV !== 'production',
  });

  logger.info({ event: 'boot.starting', configPath: CONFIG_PATH }, 'Gateway starting');

  const configRepo = new YamlConfigStorageRepository(CONFIG_PATH);
  const config = await loadConfigOrExit(configRepo, logger);

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

  const go2rtc = new Go2RtcClient({ baseUrl: config.go2rtcUrl });
  await waitForGo2Rtc(go2rtc, logger);

  const httpInspector = new PairingStatusHandler({ logger, port: PAIRING_HTTP_PORT });
  httpInspector.setConfig(config);
  await httpInspector.start();

  const runtimes = new Map<string, CameraRuntime>();

  for (const camera of config.cameras) {
    try {
      const runtime = await startCamera({
        camera,
        config,
        configRepo,
        go2rtc,
        httpInspector,
        logger,
      });
      runtimes.set(camera.id, runtime);
    } catch (err) {
      logger.error(
        {
          event: 'boot.camera_failed',
          cameraId: camera.id,
          cameraLabel: camera.label,
          error: err instanceof Error ? err.message : String(err),
        },
        `Failed to start camera "${camera.label}"`,
      );
    }
  }

  logger.info(
    { event: 'boot.ready', online: runtimes.size, total: config.cameras.length },
    `Gateway ready (${runtimes.size}/${config.cameras.length} cameras online)`,
  );

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ event: 'boot.shutdown', signal }, `Shutting down (${signal})`);
    await Promise.all(
      Array.from(runtimes.values()).map((r) => r.stop().catch(() => undefined)),
    );
    await httpInspector.stop();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

async function loadConfigOrExit(
  configRepo: YamlConfigStorageRepository,
  logger: ILogger,
): Promise<GatewayConfig> {
  try {
    return await configRepo.load();
  } catch (err) {
    logger.error(
      { event: 'boot.config_failed', error: err instanceof Error ? err.message : String(err) },
      'Failed to load gateway configuration',
    );
    process.exit(1);
  }
}

async function waitForGo2Rtc(go2rtc: Go2RtcClient, logger: ILogger): Promise<void> {
  for (let attempt = 1; attempt <= GO2RTC_HEALTH_RETRIES; attempt++) {
    try {
      const result = await go2rtc.health();
      logger.info(
        { event: 'go2rtc.health_ok', attempt, version: result.version },
        'go2rtc reachable',
      );
      return;
    } catch (err) {
      logger.warn(
        {
          event: 'go2rtc.health_retry',
          attempt,
          maxAttempts: GO2RTC_HEALTH_RETRIES,
          error: err instanceof Error ? err.message : String(err),
        },
        'Waiting for go2rtc',
      );
      await new Promise((r) => setTimeout(r, GO2RTC_HEALTH_DELAY_MS));
    }
  }
  logger.error({ event: 'go2rtc.unreachable' }, 'go2rtc never came online; exiting');
  process.exit(1);
}

interface StartCameraArgs {
  readonly camera: CameraConfig;
  readonly config: GatewayConfig;
  readonly configRepo: YamlConfigStorageRepository;
  readonly go2rtc: Go2RtcClient;
  readonly httpInspector: PairingStatusHandler;
  readonly logger: ILogger;
}

async function startCamera(args: StartCameraArgs): Promise<CameraRuntime> {
  const { camera, config, configRepo, go2rtc, httpInspector, logger } = args;
  const childLogger = logger.child({ cameraId: camera.id, cameraLabel: camera.label });

  const signaling = new SocketIoSignalingClient({ logger: childLogger });
  const publisher = new GatewayCameraPublisher({
    cameraId: camera.id,
    streamId: camera.id,
    whepBaseUrl: go2rtc.getWhepUrl(camera.id),
    logger: childLogger,
  });

  const startUseCase = new StartCameraUseCase({ signaling, publisher, go2rtc });
  const stopUseCase = new StopCameraUseCase({ signaling, publisher, go2rtc });
  const requestPairing = new RequestPairingUseCase({ signaling, logger: childLogger });
  const handleRedeemed = new HandlePairingRedeemedUseCase({
    configStorage: configRepo,
    logger: childLogger,
  });

  const result = await startUseCase.execute({
    camera,
    signalingUrl: config.signalingUrl,
  });
  if (!result.started) {
    throw new Error(result.reason);
  }

  signaling.onPairingRedeemed((event) => {
    void handleRedeemed.execute(event).then(async (handled) => {
      if (handled.handled) {
        const refreshed = await configRepo.load();
        httpInspector.setConfig(refreshed);
        httpInspector.clearPrompt(camera.id);
      }
    });
  });

  if (camera.pairedDashboards.length === 0) {
    try {
      const prompt = await requestPairing.execute(camera);
      httpInspector.setPrompt(prompt);
    } catch {
      // RequestPairingUseCase already logged the exhaustion. Keep the camera
      // running; operator can restart later or pair via the inspector retry.
    }
  }

  return {
    stop: () => stopUseCase.execute({ cameraId: camera.id }),
  };
}

void main().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Fatal:', err);
  process.exit(1);
});
