import { describe, expect, test } from 'vitest';
import { CameraIdentityEntity } from '../../src/domain/entities/camera-identity.entity';
import { LocalStorageIdentityRepository } from '../../src/infrastructure/identity/local-storage-identity.repository';
import { InMemoryStorage } from '../helpers/in-memory-storage';

describe('CameraIdentityEntity.createOrLoad', () => {
  test('generates a fresh id and persists it when storage is empty', () => {
    const storage = new LocalStorageIdentityRepository(new InMemoryStorage());
    let calls = 0;
    const id = CameraIdentityEntity.createOrLoad(storage, () => {
      calls += 1;
      return 'fresh-uuid';
    }).id;

    expect(id).toBe('fresh-uuid');
    expect(calls).toBe(1);
    expect(storage.getCameraId()).toBe('fresh-uuid');
  });

  test('returns the same id across reloads', () => {
    const inner = new InMemoryStorage();
    const storage = new LocalStorageIdentityRepository(inner);

    const first = CameraIdentityEntity.createOrLoad(storage, () => 'one');
    // Simulate a reload: brand new entity instance, same storage.
    const second = CameraIdentityEntity.createOrLoad(storage, () => 'two');

    expect(first.id).toBe('one');
    expect(second.id).toBe('one');
  });

  test('treats empty stored id as missing and regenerates', () => {
    const inner = new InMemoryStorage();
    inner.setItem('sm.cameraId', '');
    const storage = new LocalStorageIdentityRepository(inner);

    const entity = CameraIdentityEntity.createOrLoad(storage, () => 'fresh');
    expect(entity.id).toBe('fresh');
  });
});
