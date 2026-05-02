// Composition root for the Sentinel Monitor camera publisher.
/// <reference types="vite/client" />

import './presentation/styles/main.css';

import { SIGNALING_URL } from '@sentinel-monitor/webrtc-config';

import { BootstrapCameraUseCase } from './domain/use-cases/bootstrap-camera.use-case';
import { RequestPairingCodeUseCase } from './domain/use-cases/request-pairing-code.use-case';
import { LocalStorageIdentityRepository } from './infrastructure/identity/local-storage-identity.repository';
import { BrowserMediaCaptureRepository } from './infrastructure/media/browser-media-capture.repository';
import { SocketIoSignalingClient } from './infrastructure/signaling/socketio-signaling.client';
import { BrowserWebRtcPublisher } from './infrastructure/webrtc/browser-webrtc-publisher';
import { PairingScreen } from './presentation/screens/pairing.screen';
import { StreamingScreen } from './presentation/screens/streaming.screen';

async function main(): Promise<void> {
  const appEl = document.getElementById('app');
  if (!appEl) throw new Error('main: #app root not found');

  const storage = new LocalStorageIdentityRepository();
  const mediaCapture = new BrowserMediaCaptureRepository();
  const signaling = new SocketIoSignalingClient({ url: SIGNALING_URL });

  // Identity must be available before constructing the publisher because
  // the publisher echoes the camera id back into outgoing signals.
  const provisionalIdentity =
    storage.getCameraId() ??
    (() => {
      const id = crypto.randomUUID();
      storage.setCameraId(id);
      return id;
    })();
  const publisher = new BrowserWebRtcPublisher(provisionalIdentity);

  const bootstrap = new BootstrapCameraUseCase({
    storage,
    mediaCapture,
    signaling,
    publisher,
  });

  let pairingScreen: PairingScreen | null = null;
  let streamingScreen: StreamingScreen | null = null;
  let activeStream: MediaStream | null = null;

  signaling.onPairingRedeemed((event) => {
    const current = storage.getPairedDashboards();
    if (current.includes(event.dashboardId)) return;
    const next = [...current, event.dashboardId];
    storage.setPairedDashboards(next);

    pairingScreen?.unmount();
    pairingScreen = null;

    if (!streamingScreen) {
      streamingScreen = new StreamingScreen({
        stream: activeStream ?? new MediaStream(),
        pairedDashboards: next,
        statuses: publisher.getStatuses(),
      });
      streamingScreen.mount(appEl);
    } else {
      streamingScreen.setPairedDashboards(next);
    }
  });

  publisher.onStatusChange(() => {
    streamingScreen?.setStatuses(publisher.getStatuses());
  });

  const result = await bootstrap.execute();
  activeStream = result.stream;

  if (result.screen === 'pairing' && result.pairingState) {
    pairingScreen = new PairingScreen({
      state: result.pairingState,
      cameraId: result.identity.id,
      pairingUrl: `${window.location.origin.replace(/\/camera$/, '')}/?code=${result.pairingState.code}`,
      onRegenerate: () => {
        const requester = new RequestPairingCodeUseCase(signaling);
        void requester.execute(result.identity.id).then((next) => {
          pairingScreen?.updateState(next);
        });
      },
    });
    pairingScreen.mount(appEl);
  } else {
    streamingScreen = new StreamingScreen({
      stream: result.stream,
      pairedDashboards: result.pairedDashboards,
      statuses: publisher.getStatuses(),
    });
    streamingScreen.mount(appEl);
  }
}

void main().catch((err: unknown) => {
  // Render a minimal fallback so the user sees something on hard failure.
  const appEl = document.getElementById('app');
  if (appEl) {
    const message =
      err instanceof Error ? err.message : 'Erro desconhecido ao iniciar a câmera.';
    appEl.innerHTML = `<section class="screen"><h1 class="screen__title">Falha ao iniciar a câmera</h1><p class="screen__subtitle">${message}</p></section>`;
  }
});
