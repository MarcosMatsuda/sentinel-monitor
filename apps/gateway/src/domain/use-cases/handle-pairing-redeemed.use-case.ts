import type { GatewayConfig } from '../entities/gateway-config.entity';
import type { CameraConfig } from '../entities/camera-config.entity';
import type { IConfigStorageRepository } from '../repositories/i-config-storage.repository';
import type { ILogger } from '../../infrastructure/logging/logger';
import type { PairingRedeemedDto } from '@sentinel-monitor/shared-types';

export interface HandlePairingRedeemedDeps {
  readonly configStorage: IConfigStorageRepository;
  readonly logger: ILogger;
}

export type HandlePairingRedeemedResult =
  | { readonly handled: true; readonly cameraId: string; readonly dashboardId: string; readonly alreadyPaired: boolean }
  | { readonly handled: false; readonly reason: 'unknown-camera' };

/**
 * When the signaling server pushes pairing-redeemed{cameraId, dashboardId}:
 * appends the dashboardId to that camera's pairedDashboards list and
 * persists the config back to disk so the binding survives restarts.
 *
 * Idempotent: redeeming the same pair twice is a no-op (alreadyPaired:true).
 */
export class HandlePairingRedeemedUseCase {
  constructor(private readonly deps: HandlePairingRedeemedDeps) {}

  async execute(event: PairingRedeemedDto): Promise<HandlePairingRedeemedResult> {
    const config = await this.deps.configStorage.load();
    const camera = config.cameras.find((c) => c.id === event.cameraId);

    if (!camera) {
      this.deps.logger.warn(
        { event: 'pairing.redeemed_unknown_camera', cameraId: event.cameraId },
        'pairing-redeemed referenced an unknown camera id',
      );
      return { handled: false, reason: 'unknown-camera' };
    }

    if (camera.pairedDashboards.includes(event.dashboardId)) {
      this.deps.logger.debug(
        {
          event: 'pairing.redeemed_already_paired',
          cameraId: event.cameraId,
          dashboardId: event.dashboardId,
        },
        'pairing-redeemed for an already-paired dashboard; ignoring',
      );
      return {
        handled: true,
        cameraId: event.cameraId,
        dashboardId: event.dashboardId,
        alreadyPaired: true,
      };
    }

    const next: GatewayConfig = {
      ...config,
      cameras: config.cameras.map((c): CameraConfig =>
        c.id === event.cameraId
          ? {
              ...c,
              pairedDashboards: [...c.pairedDashboards, event.dashboardId],
            }
          : c,
      ),
    };

    await this.deps.configStorage.save(next);

    this.deps.logger.info(
      {
        event: 'pairing.redeemed',
        cameraId: event.cameraId,
        cameraLabel: camera.label,
        dashboardId: event.dashboardId,
        pairedCount: next.cameras.find((c) => c.id === event.cameraId)?.pairedDashboards.length,
      },
      `Camera "${camera.label}" paired with a new dashboard`,
    );

    return {
      handled: true,
      cameraId: event.cameraId,
      dashboardId: event.dashboardId,
      alreadyPaired: false,
    };
  }
}
