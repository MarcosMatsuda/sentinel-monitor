// Domain port for persistent identity & paired-dashboard storage.
// Implementations live in `infrastructure/identity`.
export interface IIdentityStorageRepository {
  getCameraId(): string | null;
  setCameraId(id: string): void;
  getPairedDashboards(): readonly string[];
  setPairedDashboards(ids: readonly string[]): void;
}
