import { AddCameraUseCase } from '@/domain/use-cases/add-camera.use-case';
import { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';
import { MAX_CAMERAS_PER_DASHBOARD } from '@sentinel-monitor/shared-types';

const deps = {
  generateId: () => 'fixed-id',
  now: () => 1,
  resolveCameraId: (code: string) => `camera-${code}`,
};

describe('AddCameraUseCase', () => {
  it('creates a binding from a pairing code', () => {
    const uc = new AddCameraUseCase(deps);
    const b = uc.execute({ pairingCode: 'abc123' }, []);
    expect(b.cameraId).toBe('camera-ABC123');
    expect(b.label).toBe('Camera 1');
  });

  it('uses the provided label', () => {
    const uc = new AddCameraUseCase(deps);
    const b = uc.execute({ pairingCode: 'XYZ', label: 'Garagem' }, []);
    expect(b.label).toBe('Garagem');
  });

  it('rejects empty pairing code', () => {
    const uc = new AddCameraUseCase(deps);
    expect(() => uc.execute({ pairingCode: '   ' }, [])).toThrow();
  });

  it('rejects duplicate cameraId', () => {
    const uc = new AddCameraUseCase(deps);
    const existing = [
      CameraBindingEntity.create({
        id: 'b1',
        cameraId: 'camera-ABC',
        label: 'X',
        addedAt: 0,
      }),
    ];
    expect(() => uc.execute({ pairingCode: 'abc' }, existing)).toThrow(
      /already added/,
    );
  });

  it('rejects when at max capacity', () => {
    const uc = new AddCameraUseCase(deps);
    const existing = Array.from(
      { length: MAX_CAMERAS_PER_DASHBOARD },
      (_, i) =>
        CameraBindingEntity.create({
          id: `b${i}`,
          cameraId: `camera-${i}`,
          label: `L${i}`,
          addedAt: 0,
        }),
    );
    expect(() => uc.execute({ pairingCode: 'NEW' }, existing)).toThrow(
      /maximum/,
    );
  });
});
