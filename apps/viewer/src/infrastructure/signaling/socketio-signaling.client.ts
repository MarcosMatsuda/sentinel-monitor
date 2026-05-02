// ============================================================
// Socket.IO signaling client for the dashboard/viewer.
// Implements the ISignalingRepository surface using the typed
// event maps from @sentinel-monitor/shared-types.
// ============================================================

import { io, type Socket } from 'socket.io-client';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
  PairingErrorDto,
  PairingRedeemedDto,
  PresenceChangeDto,
  PresenceSnapshotDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';
import type {
  ISignalingRepository,
  RedeemPairingResult,
} from '../../domain/repositories/i-signaling.repository';

export type TypedSocket = Socket<IServerToClientEvents, IClientToServerEvents>;

export interface SocketIoSignalingClientOptions {
  readonly url: string;
  readonly socketFactory?: (url: string) => TypedSocket;
}

const defaultFactory = (url: string): TypedSocket =>
  io(url, {
    autoConnect: false,
    transports: ['websocket'],
    // Socket.IO already implements exponential backoff with jitter — we
    // make the configuration explicit so reconnection behavior is
    // documented and predictable across environments.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    randomizationFactor: 0.5,
  }) as TypedSocket;

function isPairingError(
  response: PairingRedeemedDto | PairingErrorDto,
): response is PairingErrorDto {
  return (
    typeof (response as PairingErrorDto).code === 'string' &&
    typeof (response as PairingErrorDto).message === 'string' &&
    (response as PairingRedeemedDto).cameraId === undefined
  );
}

export class SocketIoSignalingClient implements ISignalingRepository {
  private readonly socket: TypedSocket;
  private readonly reconnectHandlers = new Set<() => void>();
  private hasConnectedOnce = false;

  constructor(options: SocketIoSignalingClientOptions) {
    const factory = options.socketFactory ?? defaultFactory;
    this.socket = factory(options.url);

    // Socket.IO emits `connect` on both the initial connect and every
    // subsequent automatic reconnect. We treat any post-initial
    // `connect` as a reconnect signal so callers can re-emit
    // presence/subscriptions and reconverge their state.
    this.socket.on('connect', () => {
      if (!this.hasConnectedOnce) {
        this.hasConnectedOnce = true;
        return;
      }
      for (const handler of this.reconnectHandlers) handler();
    });
  }

  connect(): Promise<void> {
    if (this.socket.connected) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const onConnect = (): void => {
        this.socket.off('connect_error', onError);
        resolve();
      };
      const onError = (err: Error): void => {
        this.socket.off('connect', onConnect);
        reject(err);
      };
      this.socket.once('connect', onConnect);
      this.socket.once('connect_error', onError);
      this.socket.connect();
    });
  }

  disconnect(): void {
    this.socket.disconnect();
  }

  isConnected(): boolean {
    return this.socket.connected;
  }

  registerPresence(peerId: string): void {
    this.socket.emit('register-presence', { peerId, role: 'dashboard' });
  }

  redeemPairingCode(
    code: string,
    dashboardId: string,
  ): Promise<RedeemPairingResult> {
    return new Promise<RedeemPairingResult>((resolve) => {
      this.socket.emit(
        'redeem-pairing-code',
        { code, dashboardId },
        (response: PairingRedeemedDto | PairingErrorDto) => {
          if (isPairingError(response)) {
            resolve({ success: false, error: response });
            return;
          }
          resolve({ success: true, data: response });
        },
      );
    });
  }

  queryPresence(peerIds: readonly string[]): Promise<PresenceSnapshotDto> {
    return new Promise<PresenceSnapshotDto>((resolve) => {
      this.socket.emit(
        'query-presence',
        { peerIds },
        (response: PresenceSnapshotDto) => resolve(response),
      );
    });
  }

  subscribePresence(peerIds: readonly string[]): void {
    this.socket.emit('subscribe-presence', { peerIds });
  }

  sendSignal(signal: SignalDto): void {
    this.socket.emit('signal', signal);
  }

  onSignal(handler: (signal: SignalDto) => void): void {
    this.socket.on('signal', handler);
  }

  offSignal(handler: (signal: SignalDto) => void): void {
    this.socket.off('signal', handler);
  }

  onPresenceChange(handler: (change: PresenceChangeDto) => void): void {
    this.socket.on('presence-change', handler);
  }

  offPresenceChange(handler: (change: PresenceChangeDto) => void): void {
    this.socket.off('presence-change', handler);
  }

  onReconnect(handler: () => void): void {
    this.reconnectHandlers.add(handler);
  }

  offReconnect(handler: () => void): void {
    this.reconnectHandlers.delete(handler);
  }
}
