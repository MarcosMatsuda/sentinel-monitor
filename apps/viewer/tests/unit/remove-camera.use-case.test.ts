import { RemoveCameraUseCase } from '@/domain/use-cases/remove-camera.use-case';
import { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';

function make(id: string): CameraBindingEntity {
  return CameraBindingEntity.create({
    id,
    cameraId: `cam-${id}`,
    label: id,
    addedAt: 0,
  });
}

describe('RemoveCameraUseCase', () => {
  it('removes the binding by id', () => {
    const uc = new RemoveCameraUseCase();
    const result = uc.execute([make('a'), make('b')], 'a');
    expect(result.map((b) => b.id)).toEqual(['b']);
  });

  it('throws if id not found', () => {
    const uc = new RemoveCameraUseCase();
    expect(() => uc.execute([make('a')], 'zzz')).toThrow();
  });
});
