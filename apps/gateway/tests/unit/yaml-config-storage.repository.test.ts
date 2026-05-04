import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { YamlConfigStorageRepository } from '../../src/infrastructure/config/yaml-config-storage.repository';

const FIXED_NOW = 1_700_000_000_000;
let counter = 0;
const fixedIdGen = () => `00000000-0000-0000-0000-${String(++counter).padStart(12, '0')}`;

const writeYaml = async (filePath: string, obj: unknown): Promise<void> => {
  await fs.writeFile(filePath, stringify(obj), 'utf8');
};

const readYaml = async (filePath: string): Promise<string> => fs.readFile(filePath, 'utf8');

describe('YamlConfigStorageRepository', () => {
  let path: string;

  beforeEach(async () => {
    counter = 0;
    path = join(tmpdir(), `gateway-test-${process.pid}-${Date.now()}-${Math.random()}.yaml`);
  });

  afterEach(async () => {
    await fs.rm(path, { force: true });
  });

  describe('load + UUID backfill', () => {
    it('keeps existing IDs when present', async () => {
      const fixedGwId = '11111111-1111-1111-1111-111111111111';
      const fixedCamId = '22222222-2222-2222-2222-222222222222';
      await writeYaml(path, {
        gateway: {
          id: fixedGwId,
          signalingUrl: 'http://localhost:3010',
          go2rtcUrl: 'http://127.0.0.1:1984',
          cameras: [
            {
              id: fixedCamId,
              label: 'Sala',
              rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1',
              addedAt: 1000,
              pairedDashboards: ['33333333-3333-3333-3333-333333333333'],
            },
          ],
        },
      });

      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      const config = await repo.load();

      expect(config.id).toBe(fixedGwId);
      expect(config.cameras[0]).toBeDefined();
      expect(config.cameras[0]!.id).toBe(fixedCamId);
      expect(config.cameras[0]!.addedAt).toBe(1000);
      expect(config.cameras[0]!.pairedDashboards).toEqual([
        '33333333-3333-3333-3333-333333333333',
      ]);
    });

    it('generates and writes back IDs when gateway.id is missing', async () => {
      await writeYaml(path, {
        gateway: {
          signalingUrl: 'http://localhost:3010',
          cameras: [],
        },
      });

      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      const config = await repo.load();

      expect(config.id).toMatch(/^00000000/);
      const reloaded = await repo.load();
      expect(reloaded.id).toBe(config.id);
    });

    it('generates UUIDs and addedAt for cameras missing them', async () => {
      await writeYaml(path, {
        gateway: {
          id: '11111111-1111-1111-1111-111111111111',
          signalingUrl: 'http://localhost:3010',
          cameras: [
            { label: 'Sala', rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1' },
            { label: 'Quarto', rtspUrl: 'rtsp://u:p@192.168.0.43:554/stream1' },
          ],
        },
      });

      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      const config = await repo.load();

      expect(config.cameras).toHaveLength(2);
      expect(config.cameras[0]!.id).toMatch(/^00000000/);
      expect(config.cameras[1]!.id).toMatch(/^00000000/);
      expect(config.cameras[0]!.id).not.toBe(config.cameras[1]!.id);
      expect(config.cameras[0]!.addedAt).toBe(FIXED_NOW);
      expect(config.cameras[0]!.pairedDashboards).toEqual([]);
    });

    it('persists generated IDs back to file (subsequent reads return same IDs)', async () => {
      await writeYaml(path, {
        gateway: {
          signalingUrl: 'http://localhost:3010',
          cameras: [{ label: 'Sala', rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1' }],
        },
      });

      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      const first = await repo.load();
      const second = await repo.load();

      expect(second.id).toBe(first.id);
      expect(second.cameras[0]!.id).toBe(first.cameras[0]!.id);
    });

    it('does not rewrite the file when no IDs are missing', async () => {
      const fullConfig = {
        gateway: {
          id: '11111111-1111-1111-1111-111111111111',
          signalingUrl: 'http://localhost:3010',
          go2rtcUrl: 'http://127.0.0.1:1984',
          cameras: [
            {
              id: '22222222-2222-2222-2222-222222222222',
              label: 'Sala',
              rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1',
              addedAt: 1000,
              pairedDashboards: [],
            },
          ],
        },
      };
      await writeYaml(path, fullConfig);
      const before = await readYaml(path);

      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      await repo.load();

      const after = await readYaml(path);
      expect(after).toBe(before);
    });
  });

  describe('validation errors', () => {
    it('rejects missing signalingUrl', async () => {
      await writeYaml(path, { gateway: { cameras: [] } });
      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      await expect(repo.load()).rejects.toThrow();
    });

    it('rejects non-rtsp URLs', async () => {
      await writeYaml(path, {
        gateway: {
          signalingUrl: 'http://localhost:3010',
          cameras: [{ label: 'Sala', rtspUrl: 'http://192.168.0.42/stream' }],
        },
      });
      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      await expect(repo.load()).rejects.toThrow();
    });

    it('rejects empty label', async () => {
      await writeYaml(path, {
        gateway: {
          signalingUrl: 'http://localhost:3010',
          cameras: [{ label: '', rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1' }],
        },
      });
      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      await expect(repo.load()).rejects.toThrow();
    });

    it('throws ENOENT when file does not exist', async () => {
      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      await expect(repo.load()).rejects.toThrow();
    });
  });

  describe('save', () => {
    it('round-trips a complete config', async () => {
      const repo = new YamlConfigStorageRepository(path, () => FIXED_NOW, fixedIdGen);
      const original = {
        id: '11111111-1111-1111-1111-111111111111',
        signalingUrl: 'http://localhost:3010',
        go2rtcUrl: 'http://127.0.0.1:1984',
        cameras: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            label: 'Sala',
            rtspUrl: 'rtsp://u:p@192.168.0.42:554/stream1',
            addedAt: FIXED_NOW,
            pairedDashboards: ['33333333-3333-3333-3333-333333333333'],
          },
        ],
      };
      await repo.save(original);
      const loaded = await repo.load();

      expect(loaded.id).toBe(original.id);
      expect(loaded.cameras[0]!.id).toBe(original.cameras[0]!.id);
      expect(loaded.cameras[0]!.pairedDashboards).toEqual(original.cameras[0]!.pairedDashboards);
    });
  });
});
