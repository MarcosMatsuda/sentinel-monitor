// ============================================================
// Stub fallback used only by Jest (which does not honor Metro's
// .web/.native extension resolution by default). Production web
// builds resolve binding-storage.web.ts; native builds resolve
// binding-storage.native.ts.
// ============================================================

import type { IBindingStorageRepository } from '@/domain/repositories/i-binding-storage.repository';
import { InMemoryBindingStorageRepository } from './in-memory-binding-storage';

export function createBindingStorage(): IBindingStorageRepository {
  return new InMemoryBindingStorageRepository();
}
