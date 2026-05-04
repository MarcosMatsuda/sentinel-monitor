import type { GatewayConfig } from '../entities/gateway-config.entity';

// Loads + persists gateway config (YAML on disk in production, memory
// in tests). Writeback is required because we generate UUIDs on first
// boot and must persist them so identity is stable across restarts.
export interface IConfigStorageRepository {
  load(): Promise<GatewayConfig>;
  save(config: GatewayConfig): Promise<void>;
}
