import { CameraBindingEntity } from '@/domain/entities/camera-binding.entity';

const baseProps = {
  id: 'b1',
  cameraId: 'cam-1',
  label: 'Sala',
  addedAt: 1700000000000,
};

describe('CameraBindingEntity', () => {
  it('creates a binding with valid props', () => {
    const b = CameraBindingEntity.create(baseProps);
    expect(b.label).toBe('Sala');
    expect(b.toJSON()).toEqual(baseProps);
  });

  it('throws when id is empty', () => {
    expect(() => CameraBindingEntity.create({ ...baseProps, id: '' })).toThrow();
  });

  it('throws when cameraId is empty', () => {
    expect(() =>
      CameraBindingEntity.create({ ...baseProps, cameraId: '' }),
    ).toThrow();
  });

  it('throws when label is blank', () => {
    expect(() =>
      CameraBindingEntity.create({ ...baseProps, label: '   ' }),
    ).toThrow();
  });

  it('rename returns a new entity with trimmed label', () => {
    const b = CameraBindingEntity.create(baseProps).rename('  Quintal  ');
    expect(b.label).toBe('Quintal');
    expect(b.id).toBe(baseProps.id);
  });

  it('rename throws on empty label', () => {
    const b = CameraBindingEntity.create(baseProps);
    expect(() => b.rename('   ')).toThrow();
  });
});
