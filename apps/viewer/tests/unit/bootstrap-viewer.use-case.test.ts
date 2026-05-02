import { BootstrapViewerUseCase } from '@/domain/use-cases/bootstrap-viewer.use-case';
import { InMemoryBindingStorageRepository } from '@/infrastructure/storage/in-memory-binding-storage';

describe('BootstrapViewerUseCase', () => {
  it('mints a fresh identity on cold start and persists it', async () => {
    const storage = new InMemoryBindingStorageRepository();
    const uc = new BootstrapViewerUseCase({
      storage,
      generateId: () => 'fresh-id',
      now: () => 42,
    });
    const result = await uc.execute();
    expect(result.identity.dashboardId).toBe('fresh-id');
    expect(result.bindings).toEqual([]);
    expect(storage.snapshot().identity?.dashboardId).toBe('fresh-id');
  });

  it('hydrates from existing persisted state without re-minting', async () => {
    const storage = new InMemoryBindingStorageRepository();
    await storage.save({
      identity: { dashboardId: 'existing', createdAt: 1 },
      bindings: [
        { id: 'b1', cameraId: 'cam-1', label: 'L', addedAt: 1 },
      ],
    });
    const uc = new BootstrapViewerUseCase({
      storage,
      generateId: () => 'should-not-be-used',
      now: () => 99,
    });
    const result = await uc.execute();
    expect(result.identity.dashboardId).toBe('existing');
    expect(result.bindings).toHaveLength(1);
    expect(result.bindings[0]!.label).toBe('L');
  });
});
