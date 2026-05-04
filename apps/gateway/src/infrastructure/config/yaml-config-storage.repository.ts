import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parse, stringify } from 'yaml';
import { z } from 'zod';
import type { IConfigStorageRepository } from '../../domain/repositories/i-config-storage.repository';
import type { GatewayConfig } from '../../domain/entities/gateway-config.entity';

const cameraSchema = z.object({
  id: z.string().uuid().optional(),
  label: z.string().min(1).max(64),
  rtspUrl: z.string().url().regex(/^rtsp:\/\//, 'must start with rtsp://'),
  addedAt: z.number().int().nonnegative().optional(),
  pairedDashboards: z.array(z.string().uuid()).optional(),
});

const gatewaySchema = z.object({
  gateway: z.object({
    id: z.string().uuid().optional(),
    signalingUrl: z.string().url(),
    go2rtcUrl: z.string().url().default('http://127.0.0.1:1984'),
    cameras: z.array(cameraSchema).default([]),
  }),
});

export class YamlConfigStorageRepository implements IConfigStorageRepository {
  constructor(
    private readonly filePath: string,
    private readonly now: () => number = () => Date.now(),
    private readonly idGenerator: () => string = () => randomUUID(),
  ) {}

  async load(): Promise<GatewayConfig> {
    const raw = await fs.readFile(this.filePath, 'utf8');
    const parsed = gatewaySchema.parse(parse(raw));
    const filledIn = this.fillMissingIds(parsed.gateway);
    if (this.needsRewrite(parsed.gateway, filledIn)) {
      await this.save(filledIn);
    }
    return filledIn;
  }

  async save(config: GatewayConfig): Promise<void> {
    const yaml = stringify({ gateway: config });
    await fs.writeFile(this.filePath, yaml, 'utf8');
  }

  private fillMissingIds(input: z.infer<typeof gatewaySchema>['gateway']): GatewayConfig {
    return {
      id: input.id ?? this.idGenerator(),
      signalingUrl: input.signalingUrl,
      go2rtcUrl: input.go2rtcUrl,
      cameras: input.cameras.map((cam) => ({
        id: cam.id ?? this.idGenerator(),
        label: cam.label,
        rtspUrl: cam.rtspUrl,
        addedAt: cam.addedAt ?? this.now(),
        pairedDashboards: cam.pairedDashboards ?? [],
      })),
    };
  }

  private needsRewrite(
    raw: z.infer<typeof gatewaySchema>['gateway'],
    filled: GatewayConfig,
  ): boolean {
    if (!raw.id) return true;
    return raw.cameras.some((cam, i) => {
      const next = filled.cameras[i];
      if (!next) return false;
      return !cam.id || cam.addedAt === undefined || !cam.pairedDashboards;
    });
  }
}
