import { RenameCameraUseCase } from '@/domain/use-cases/rename-camera.use-case';
import { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';

function make(id: string, label: string): CameraBindingEntity {
  return CameraBindingEntity.create({
    id,
    cameraId: `cam-${id}`,
    label,
    addedAt: 0,
  });
}

describe('RenameCameraUseCase', () => {
  it('renames the binding by id', () => {
    const uc = new RenameCameraUseCase();
    const result = uc.execute([make('a', 'Old'), make('b', 'X')], 'a', 'New');
    expect(result[0]!.label).toBe('New');
    expect(result[1]!.label).toBe('X');
  });

  it('throws if id not found', () => {
    const uc = new RenameCameraUseCase();
    expect(() => uc.execute([make('a', 'Old')], 'missing', 'X')).toThrow();
  });
});
