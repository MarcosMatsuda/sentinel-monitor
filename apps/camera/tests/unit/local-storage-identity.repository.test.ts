import { describe, expect, test } from 'vitest';
import { LocalStorageIdentityRepository } from '../../src/infrastructure/identity/local-storage-identity.repository';
import { InMemoryStorage } from '../helpers/in-memory-storage';

describe('LocalStorageIdentityRepository', () => {
  test('round-trips paired dashboards as JSON', () => {
    const repo = new LocalStorageIdentityRepository(new InMemoryStorage());
    expect(repo.getPairedDashboards()).toEqual([]);
    repo.setPairedDashboards(['a', 'b']);
    expect(repo.getPairedDashboards()).toEqual(['a', 'b']);
  });

  test('returns empty array on malformed JSON', () => {
    const inner = new InMemoryStorage();
    inner.setItem('sm.pairedDashboards', 'not-json');
    const repo = new LocalStorageIdentityRepository(inner);
    expect(repo.getPairedDashboards()).toEqual([]);
  });

  test('returns empty array when stored value is not an array', () => {
    const inner = new InMemoryStorage();
    inner.setItem('sm.pairedDashboards', '{"oops":true}');
    const repo = new LocalStorageIdentityRepository(inner);
    expect(repo.getPairedDashboards()).toEqual([]);
  });

  test('drops non-string entries defensively', () => {
    const inner = new InMemoryStorage();
    inner.setItem('sm.pairedDashboards', '["ok",42,null,"good"]');
    const repo = new LocalStorageIdentityRepository(inner);
    expect(repo.getPairedDashboards()).toEqual(['ok', 'good']);
  });
});
