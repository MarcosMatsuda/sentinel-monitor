// ============================================================
// RemoveCamera — pure list operation. Persistence is the
// responsibility of the caller (the bindings store).
// ============================================================

import type {
  CameraBindingEntity,
  CameraBindingId,
} from '../entities/camera-binding.entity';

export class RemoveCameraUseCase {
  execute(
    bindings: readonly CameraBindingEntity[],
    id: CameraBindingId,
  ): readonly CameraBindingEntity[] {
    if (!bindings.some((b) => b.id === id)) {
      throw new Error(`binding "${id}" not found`);
    }
    return bindings.filter((b) => b.id !== id);
  }
}
