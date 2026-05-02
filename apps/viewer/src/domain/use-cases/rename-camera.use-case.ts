// ============================================================
// RenameCamera — returns a new bindings array with the renamed
// entity replaced. Pure; persistence handled by the store.
// ============================================================

import type {
  CameraBindingEntity,
  CameraBindingId,
} from '../entities/camera-binding.entity';

export class RenameCameraUseCase {
  execute(
    bindings: readonly CameraBindingEntity[],
    id: CameraBindingId,
    label: string,
  ): readonly CameraBindingEntity[] {
    const index = bindings.findIndex((b) => b.id === id);
    if (index < 0) throw new Error(`binding "${id}" not found`);
    const current = bindings[index]!;
    const updated = current.rename(label);
    const next = bindings.slice();
    next[index] = updated;
    return next;
  }
}
