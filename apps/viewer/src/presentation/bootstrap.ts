// ============================================================
// App-level bootstrap — wires the platform-specific storage
// into the bindings store singleton, builds the realtime stack
// (signaling, peers, presence) and starts the viewer session.
// Imported once from the root layout.
// ============================================================

import { SIGNALING_URL } from '@sentinel-monitor/webrtc-config';
import type { ConnectionState } from '@sentinel-monitor/shared-types';
import { ConnectToCameraUseCase } from '@/domain/use-cases/connect-to-camera.use-case';
import { StartViewerSessionUseCase } from '@/domain/use-cases/start-viewer-session.use-case';
import type { ISignalingRepository } from '@/domain/repositories/i-signaling.repository';
import type { SubscriberState } from '@/domain/repositories/i-webrtc-subscriber.repository';
import { createBindingStorage } from '@/infrastructure/storage/binding-storage';
import { SocketIoSignalingClient } from '@/infrastructure/signaling/socketio-signaling.client';
import { BrowserWebRtcSubscriber } from '@/infrastructure/webrtc/webrtc-subscriber.web';
import {
  createBindingsStore,
  setBindingsStoreSingleton,
  type BindingsStore,
} from './stores/bindings.store';
import {
  createPresenceStore,
  setPresenceStoreSingleton,
  type PresenceStore,
} from './stores/presence.store';
import {
  createPeersStore,
  setPeersStoreSingleton,
  type PeersStore,
} from './stores/peers.store';

export interface ViewerRuntime {
  readonly bindings: BindingsStore;
  readonly presence: PresenceStore;
  readonly peers: PeersStore;
  readonly signaling: ISignalingRepository;
  readonly start: () => Promise<void>;
  readonly stop: () => Promise<void>;
}

let runtime: ViewerRuntime | null = null;

function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function mapSubscriberState(state: SubscriberState): ConnectionState {
  switch (state) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'disconnected':
    case 'failed':
    case 'closed':
      return 'disconnected';
    case 'idle':
    default:
      return 'idle';
  }
}

export function initRuntime(): ViewerRuntime {
  if (runtime) return runtime;

  const storage = createBindingStorage();
  const presence = createPresenceStore();
  const peers = createPeersStore();
  const signaling: ISignalingRepository = new SocketIoSignalingClient({
    url: SIGNALING_URL,
  });

  setPresenceStoreSingleton(presence);
  setPeersStoreSingleton(peers);

  // Pairing-code → cameraId resolution cache. Populated by addCamera
  // once the server confirms redemption; consumed by the bindings
  // store's resolveCameraId hook (which must stay synchronous).
  const resolveCache = new Map<string, string>();

  const bindings = createBindingsStore({
    storage,
    generateId,
    now: () => Date.now(),
    resolveCameraId: (code) => {
      const cached = resolveCache.get(code.toUpperCase());
      if (cached) return cached;
      // Fallback for offline scenarios — keeps the store usable
      // without a live server.
      return `camera-${code.toUpperCase()}`;
    },
  });
  setBindingsStoreSingleton(bindings);

  let dashboardId = '';

  const connectToCamera = new ConnectToCameraUseCase({
    signaling,
    get dashboardId(): string {
      return dashboardId;
    },
    subscriberFactory: (_cameraId, emitSignal) =>
      new BrowserWebRtcSubscriber({ emitSignal }),
    onStream: (cameraId, stream) =>
      peers.getState().setStream(cameraId, stream),
    onState: (cameraId, state) =>
      peers.getState().setState(cameraId, mapSubscriberState(state)),
  });

  // Wrap addCamera so that pairing redemption + connect happen alongside
  // persistence. Falls back to the offline path when signaling is down.
  const baseAdd = bindings.getState().addCamera;
  bindings.setState({
    addCamera: async (input) => {
      const code = input.pairingCode.trim().toUpperCase();
      if (signaling.isConnected() && dashboardId) {
        const result = await signaling.redeemPairingCode(code, dashboardId);
        if (!result.success) {
          throw new Error(`pairing failed: ${result.error.message}`);
        }
        resolveCache.set(code, result.data.cameraId);
      }
      const next = await baseAdd(input);
      if (signaling.isConnected() && dashboardId) {
        signaling.subscribePresence([next.cameraId]);
        const snap = await signaling.queryPresence([next.cameraId]);
        if (snap.online.includes(next.cameraId)) {
          presence.getState().setOne(next.cameraId, true);
          await connectToCamera.execute(next.cameraId);
        }
      }
      return next;
    },
  });

  let session: { stop: () => Promise<void> } | null = null;

  const start = async (): Promise<void> => {
    await bindings.getState().hydrate();
    const identity = bindings.getState().identity;
    if (!identity) throw new Error('viewer identity not hydrated');
    dashboardId = identity.dashboardId;

    const sessionUC = new StartViewerSessionUseCase({
      signaling,
      connectToCamera,
      dashboardId,
      onPresenceSnapshot: (online) => presence.getState().setMany(online),
      onPresenceChange: (cameraId, online) => {
        presence.getState().setOne(cameraId, online);
        if (!online) peers.getState().remove(cameraId);
      },
    });
    session = await sessionUC.execute({
      bindings: bindings.getState().bindings,
    });
  };

  const stop = async (): Promise<void> => {
    await session?.stop();
    session = null;
    signaling.disconnect();
  };

  runtime = { bindings, presence, peers, signaling, start, stop };
  return runtime;
}

// Backwards-compatible export retained for existing callers.
export function initBindingsStore(): BindingsStore {
  return initRuntime().bindings;
}
