import type {
  IPeerPresenceRepository,
  PeerRole,
} from '@sentinel-monitor/shared-types';

interface PresenceEntry {
  socketId: string;
  role: PeerRole;
}

export class InMemoryPeerPresenceRepository implements IPeerPresenceRepository {
  private byPeerId = new Map<string, PresenceEntry>();
  private bySocketId = new Map<string, string>();

  set(peerId: string, socketId: string, role: PeerRole): void {
    // If this peerId was already registered (e.g., reconnect from a new socket),
    // drop the stale socket-side mapping to avoid orphaned entries.
    const previous = this.byPeerId.get(peerId);
    if (previous && previous.socketId !== socketId) {
      this.bySocketId.delete(previous.socketId);
    }
    this.byPeerId.set(peerId, { socketId, role });
    this.bySocketId.set(socketId, peerId);
  }

  getSocketId(peerId: string): string | null {
    return this.byPeerId.get(peerId)?.socketId ?? null;
  }

  getPeerId(socketId: string): string | null {
    return this.bySocketId.get(socketId) ?? null;
  }

  removeBySocket(socketId: string): { peerId: string; role: PeerRole } | null {
    const peerId = this.bySocketId.get(socketId);
    if (!peerId) return null;
    const entry = this.byPeerId.get(peerId);
    this.bySocketId.delete(socketId);
    this.byPeerId.delete(peerId);
    return entry ? { peerId, role: entry.role } : null;
  }

  isOnline(peerId: string): boolean {
    return this.byPeerId.has(peerId);
  }

  count(): number {
    return this.byPeerId.size;
  }
}
