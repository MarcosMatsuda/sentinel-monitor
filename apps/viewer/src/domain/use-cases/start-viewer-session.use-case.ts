// ============================================================
// StartViewerSession — once the viewer has hydrated its identity
// and bindings, this orchestrates the realtime side:
//   1. Connect to the signaling socket
//   2. Register presence as a 'dashboard'
//   3. Query + subscribe presence for every bound cameraId
//   4. Trigger ConnectToCamera for every camera that is online
//   5. React to presence-change events (online → connect, offline → close)
//
// Returns a disposer that closes all open peer connections and
// unsubscribes presence handlers.
// ============================================================

import type { PresenceChangeDto } from '@sentinel-monitor/shared-types';
import type { CameraBindingEntity } from '../entities/camera-binding.entity';
import type { ISignalingRepository } from '../repositories/i-signaling.repository';
import type {
  CameraConnection,
  ConnectToCameraUseCase,
} from './connect-to-camera.use-case';

export interface StartViewerSessionDeps {
  readonly signaling: ISignalingRepository;
  readonly connectToCamera: ConnectToCameraUseCase;
  readonly dashboardId: string;
  readonly onPresenceSnapshot: (online: readonly string[]) => void;
  readonly onPresenceChange: (cameraId: string, online: boolean) => void;
}

export interface StartViewerSessionInput {
  readonly bindings: readonly CameraBindingEntity[];
}

export interface ViewerSession {
  readonly stop: () => Promise<void>;
  readonly connections: ReadonlyMap<string, CameraConnection>;
}

export class StartViewerSessionUseCase {
  constructor(private readonly deps: StartViewerSessionDeps) {}

  async execute(input: StartViewerSessionInput): Promise<ViewerSession> {
    const { signaling, connectToCamera, dashboardId, onPresenceSnapshot, onPresenceChange } =
      this.deps;

    if (!signaling.isConnected()) {
      await signaling.connect();
    }
    signaling.registerPresence(dashboardId);

    const cameraIds = input.bindings.map((b) => b.cameraId);
    const connections = new Map<string, CameraConnection>();

    if (cameraIds.length === 0) {
      const noopHandler = (_change: PresenceChangeDto): void => undefined;
      signaling.onPresenceChange(noopHandler);
      return {
        connections,
        stop: async () => {
          signaling.offPresenceChange(noopHandler);
        },
      };
    }

    signaling.subscribePresence(cameraIds);
    const snapshot = await signaling.queryPresence(cameraIds);
    onPresenceSnapshot(snapshot.online);

    for (const cameraId of snapshot.online) {
      try {
        const conn = await connectToCamera.execute(cameraId);
        connections.set(cameraId, conn);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[viewer] failed to connect to ${cameraId}`, err);
      }
    }

    const presenceHandler = (change: PresenceChangeDto): void => {
      // The server only fans-out to subscribers, but accept and filter
      // defensively so the use case stays robust.
      if (!cameraIds.includes(change.peerId)) return;
      onPresenceChange(change.peerId, change.online);

      if (change.online) {
        if (connections.has(change.peerId)) return;
        void connectToCamera
          .execute(change.peerId)
          .then((conn) => connections.set(change.peerId, conn))
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.warn(`[viewer] reconnect failed for ${change.peerId}`, err);
          });
        return;
      }

      const existing = connections.get(change.peerId);
      if (existing) {
        existing.close();
        connections.delete(change.peerId);
      }
    };

    signaling.onPresenceChange(presenceHandler);

    return {
      connections,
      stop: async () => {
        signaling.offPresenceChange(presenceHandler);
        for (const conn of connections.values()) conn.close();
        connections.clear();
      },
    };
  }
}
