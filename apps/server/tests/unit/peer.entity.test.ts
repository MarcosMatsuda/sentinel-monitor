import { Peer } from '../../src/domain/entities/peer.entity';

describe('Peer', () => {
  it('exposes constructor fields as readonly properties', () => {
    const p = new Peer('uuid-1', 'camera', 'sock-1', 1700000000000, 'Sala');
    expect(p.id).toBe('uuid-1');
    expect(p.role).toBe('camera');
    expect(p.socketId).toBe('sock-1');
    expect(p.connectedAt).toBe(1700000000000);
    expect(p.label).toBe('Sala');
  });

  it('allows label to be omitted', () => {
    const p = new Peer('uuid-2', 'dashboard', 'sock-2', 0);
    expect(p.label).toBeUndefined();
  });
});
