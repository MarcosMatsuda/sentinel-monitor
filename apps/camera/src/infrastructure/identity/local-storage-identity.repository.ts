import type { IIdentityStorageRepository } from '../../domain/repositories/i-identity-storage.repository';

const CAMERA_ID_KEY = 'sm.cameraId';
const PAIRED_DASHBOARDS_KEY = 'sm.pairedDashboards';

// Storage abstraction matches the synchronous part of `Storage` so it
// also accepts in-memory fakes from unit tests.
export interface IKeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageIdentityRepository implements IIdentityStorageRepository {
  constructor(private readonly storage: IKeyValueStorage = window.localStorage) {}

  getCameraId(): string | null {
    return this.storage.getItem(CAMERA_ID_KEY);
  }

  setCameraId(id: string): void {
    this.storage.setItem(CAMERA_ID_KEY, id);
  }

  getPairedDashboards(): readonly string[] {
    const raw = this.storage.getItem(PAIRED_DASHBOARDS_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      return [];
    }
  }

  setPairedDashboards(ids: readonly string[]): void {
    this.storage.setItem(PAIRED_DASHBOARDS_KEY, JSON.stringify(ids));
  }
}
