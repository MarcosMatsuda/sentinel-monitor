import type { CameraConfig } from '../entities/camera-config.entity';
import type { ISignalingClient } from '../repositories/i-signaling.repository';
import type { ILogger } from '../../infrastructure/logging/logger';

export interface RequestPairingDeps {
  readonly signaling: ISignalingClient;
  readonly logger: ILogger;
  readonly maxRetries?: number;
}

export interface PairingPrompt {
  readonly cameraId: string;
  readonly label: string;
  readonly code: string;
  readonly expiresAt: number;
}

const DEFAULT_MAX_RETRIES = 3;

/**
 * Asks the signaling server for a fresh pairing code for one camera and
 * returns it for display (logs + HTTP /pairing inspector). Retries up
 * to `maxRetries` on transient failures, then surfaces the error so the
 * caller can decide whether to give up.
 */
export class RequestPairingUseCase {
  constructor(private readonly deps: RequestPairingDeps) {}

  async execute(camera: CameraConfig): Promise<PairingPrompt> {
    const max = this.deps.maxRetries ?? DEFAULT_MAX_RETRIES;
    let lastErr: unknown;

    for (let attempt = 1; attempt <= max; attempt++) {
      try {
        const issued = await this.deps.signaling.requestPairingCode(camera.id);
        this.deps.logger.info(
          {
            event: 'pairing.code_issued',
            cameraId: camera.id,
            cameraLabel: camera.label,
            code: issued.code,
            expiresAt: issued.expiresAt,
          },
          `Pairing code for "${camera.label}": ${issued.code}`,
        );
        return {
          cameraId: camera.id,
          label: camera.label,
          code: issued.code,
          expiresAt: issued.expiresAt,
        };
      } catch (err) {
        lastErr = err;
        this.deps.logger.warn(
          {
            event: 'pairing.request_failed',
            cameraId: camera.id,
            attempt,
            maxRetries: max,
            error: err instanceof Error ? err.message : String(err),
          },
          'Pairing-code request failed; will retry',
        );
      }
    }

    this.deps.logger.error(
      { event: 'pairing.request_exhausted', cameraId: camera.id, maxRetries: max },
      `Pairing-code request gave up after ${max} attempts`,
    );
    throw lastErr instanceof Error
      ? lastErr
      : new Error(`Pairing-code request gave up after ${max} attempts`);
  }
}
