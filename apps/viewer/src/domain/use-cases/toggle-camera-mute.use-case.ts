// ============================================================
// ToggleCameraMute — flips the per-camera mute flag in the peers
// store and best-effort sends an advisory `audio-mute-request`
// DataChannel message so the camera can stop encoding audio.
//
// The DataChannel send is advisory: if the peer is not connected
// or the channel is not open, the failure is swallowed silently.
// The store mutation is the source of truth for the UI.
// ============================================================

import type { DataChannelMessage } from '@sentinel-monitor/shared-types';

export interface MuteAdvisorySender {
  /**
   * Best-effort send of an advisory DataChannel message to the camera.
   * Implementations MUST NOT throw — return false when the channel
   * is unavailable so callers can log/no-op without try/catch.
   */
  send(cameraId: string, message: DataChannelMessage): boolean;
}

export interface MuteStore {
  toggleMuted(cameraId: string): boolean;
  setMuted(cameraId: string, muted: boolean): void;
  isMuted(cameraId: string): boolean;
}

export interface ToggleCameraMuteDeps {
  readonly store: MuteStore;
  readonly sender?: MuteAdvisorySender;
  readonly now?: () => number;
}

export interface ToggleCameraMuteResult {
  readonly cameraId: string;
  readonly muted: boolean;
  readonly advisoryDelivered: boolean;
}

export class ToggleCameraMuteUseCase {
  constructor(private readonly deps: ToggleCameraMuteDeps) {}

  execute(cameraId: string): ToggleCameraMuteResult {
    const { store, sender, now = Date.now } = this.deps;
    const muted = store.toggleMuted(cameraId);
    const advisoryDelivered = this.trySend(sender, cameraId, muted, now());
    return { cameraId, muted, advisoryDelivered };
  }

  set(cameraId: string, muted: boolean): ToggleCameraMuteResult {
    const { store, sender, now = Date.now } = this.deps;
    store.setMuted(cameraId, muted);
    const advisoryDelivered = this.trySend(sender, cameraId, muted, now());
    return { cameraId, muted, advisoryDelivered };
  }

  private trySend(
    sender: MuteAdvisorySender | undefined,
    cameraId: string,
    muted: boolean,
    ts: number,
  ): boolean {
    if (!sender) return false;
    try {
      return sender.send(cameraId, {
        type: 'audio-mute-request',
        muted,
        ts,
      });
    } catch {
      // Advisory send is best-effort. Swallow silently to honor the
      // contract: the UI mute toggle must never fail because of a
      // missing or broken DataChannel.
      return false;
    }
  }
}
