import type { IIdentityStorageRepository } from '../repositories/i-identity-storage.repository';

// Persistent identity for this camera install. The same UUID is reused
// across reloads. The browser's `crypto.randomUUID()` provides the seed.
export class CameraIdentityEntity {
  private constructor(public readonly id: string) {}

  static createOrLoad(
    storage: IIdentityStorageRepository,
    generate: () => string = () => crypto.randomUUID(),
  ): CameraIdentityEntity {
    const existing = storage.getCameraId();
    if (existing && existing.length > 0) {
      return new CameraIdentityEntity(existing);
    }
    const fresh = generate();
    storage.setCameraId(fresh);
    return new CameraIdentityEntity(fresh);
  }
}
