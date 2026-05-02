import { InMemoryPeerPresenceRepository } from '../../src/data/repositories/in-memory-peer-presence.repository';

describe('InMemoryPeerPresenceRepository', () => {
  let repo: InMemoryPeerPresenceRepository;

  beforeEach(() => {
    repo = new InMemoryPeerPresenceRepository();
  });

  describe('set + lookup', () => {
    it('stores a peer and finds it both ways', () => {
      repo.set('peer-1', 'sock-1', 'camera');
      expect(repo.getSocketId('peer-1')).toBe('sock-1');
      expect(repo.getPeerId('sock-1')).toBe('peer-1');
      expect(repo.isOnline('peer-1')).toBe(true);
      expect(repo.count()).toBe(1);
    });

    it('returns null when looking up unknown ids', () => {
      expect(repo.getSocketId('missing')).toBeNull();
      expect(repo.getPeerId('missing-sock')).toBeNull();
      expect(repo.isOnline('missing')).toBe(false);
    });

    it('replaces stale socket on reconnect of same peerId', () => {
      repo.set('peer-1', 'sock-1', 'camera');
      repo.set('peer-1', 'sock-2', 'camera');

      expect(repo.getSocketId('peer-1')).toBe('sock-2');
      expect(repo.getPeerId('sock-1')).toBeNull();
      expect(repo.getPeerId('sock-2')).toBe('peer-1');
      expect(repo.count()).toBe(1);
    });
  });

  describe('removeBySocket', () => {
    it('removes a tracked peer and returns its info', () => {
      repo.set('peer-1', 'sock-1', 'dashboard');
      const removed = repo.removeBySocket('sock-1');

      expect(removed).toEqual({ peerId: 'peer-1', role: 'dashboard' });
      expect(repo.isOnline('peer-1')).toBe(false);
      expect(repo.getPeerId('sock-1')).toBeNull();
      expect(repo.count()).toBe(0);
    });

    it('returns null when the socket is unknown', () => {
      expect(repo.removeBySocket('ghost')).toBeNull();
    });

    it('is safe to call twice for the same socket', () => {
      repo.set('peer-1', 'sock-1', 'camera');
      repo.removeBySocket('sock-1');
      expect(repo.removeBySocket('sock-1')).toBeNull();
    });
  });

  describe('count', () => {
    it('reflects the live peer set', () => {
      expect(repo.count()).toBe(0);
      repo.set('p-1', 's-1', 'camera');
      repo.set('p-2', 's-2', 'dashboard');
      expect(repo.count()).toBe(2);
      repo.removeBySocket('s-1');
      expect(repo.count()).toBe(1);
    });
  });
});
