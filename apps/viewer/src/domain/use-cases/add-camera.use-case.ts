// ============================================================
// AddCamera — given a (presumably already-validated) pairing
// code, simulate the cameraId resolution (PR6 will replace the
// stub with real signaling) and persist a new binding.
// ============================================================

import {
  CameraBindingEntity,
  type CameraBindingProps,
} from '../entities/camera-binding.entity';
import { MAX_CAMERAS_PER_DASHBOARD } from '@sentinel-monitor/shared-types';

export interface AddCameraInput {
  readonly pairingCode: string;
  readonly label?: string;
}

export interface AddCameraDeps {
  readonly generateId: () => string;
  readonly now: () => number;
  readonly resolveCameraId: (pairingCode: string) => string;
}

export class AddCameraUseCase {
  constructor(private readonly deps: AddCameraDeps) {}

  execute(
    input: AddCameraInput,
    existing: readonly CameraBindingEntity[],
  ): CameraBindingEntity {
    const code = input.pairingCode.trim().toUpperCase();
    if (code.length === 0) {
      throw new Error('pairingCode is required');
    }
    if (existing.length >= MAX_CAMERAS_PER_DASHBOARD) {
      throw new Error(
        `dashboard already has the maximum ${MAX_CAMERAS_PER_DASHBOARD} cameras`,
      );
    }

    const cameraId = this.deps.resolveCameraId(code);
    if (existing.some((b) => b.cameraId === cameraId)) {
      throw new Error('camera already added to this dashboard');
    }

    const props: CameraBindingProps = {
      id: this.deps.generateId(),
      cameraId,
      label: (input.label ?? `Camera ${existing.length + 1}`).trim(),
      addedAt: this.deps.now(),
    };

    // The realtime side (subscribePresence + ConnectToCameraUseCase)
    // is wired by StartViewerSessionUseCase from the store layer once
    // the new binding is persisted.
    return CameraBindingEntity.create(props);
  }
}
