import type { PeerRole } from '@sentinel-monitor/shared-types';

// Snapshot of a connected peer (camera or dashboard) held in memory by
// the server. Pure data — repositories own the actual presence map.
export class Peer {
  constructor(
    public readonly id: string,
    public readonly role: PeerRole,
    public readonly socketId: string,
    public readonly connectedAt: number,
    public readonly label?: string,
  ) {}
}
