import { io, type Socket } from 'socket.io-client';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
  PairingCodeIssuedDto,
  PairingRedeemedDto,
  PresenceChangeDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';
import type { ISignalingClient } from '../../domain/repositories/i-signaling.repository';
import type { ILogger } from '../logging/logger';

type TypedSocket = Socket<IServerToClientEvents, IClientToServerEvents>;

export interface SocketIoSignalingClientOptions {
  readonly logger: ILogger;
  readonly socketFactory?: (url: string) => TypedSocket;
}

export class SocketIoSignalingClient implements ISignalingClient {
  private socket: TypedSocket | null = null;
  private readonly logger: ILogger;
  private readonly socketFactory: (url: string) => TypedSocket;
  private signalHandler: ((p: SignalDto) => void) | null = null;
  private presenceHandler: ((e: PresenceChangeDto) => void) | null = null;
  private pairingRedeemedHandler: ((e: PairingRedeemedDto) => void) | null = null;

  constructor(opts: SocketIoSignalingClientOptions) {
    this.logger = opts.logger;
    this.socketFactory =
      opts.socketFactory ??
      ((url) =>
        io(url, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 1_000,
          reconnectionDelayMax: 10_000,
          randomizationFactor: 0.5,
        }) as TypedSocket);
  }

  async connect(signalingUrl: string): Promise<void> {
    if (this.socket && this.socket.connected) return;

    this.socket = this.socketFactory(signalingUrl);

    this.socket.on('connect', () => {
      this.logger.info(
        { event: 'signaling.connected', socketId: this.socket?.id },
        'Signaling socket connected',
      );
    });

    this.socket.on('disconnect', (reason) => {
      this.logger.warn(
        { event: 'signaling.disconnected', reason },
        'Signaling socket disconnected',
      );
    });

    this.socket.on('signal', (payload: SignalDto) => {
      this.signalHandler?.(payload);
    });

    this.socket.on('presence-change', (event: PresenceChangeDto) => {
      this.presenceHandler?.(event);
    });

    this.socket.on('pairing-redeemed', (event: PairingRedeemedDto) => {
      this.pairingRedeemedHandler?.(event);
    });

    return new Promise<void>((resolve, reject) => {
      const sock = this.socket!;
      const onConnect = (): void => {
        sock.off('connect_error', onError);
        resolve();
      };
      const onError = (err: Error): void => {
        sock.off('connect', onConnect);
        reject(err);
      };
      sock.once('connect', onConnect);
      sock.once('connect_error', onError);
    });
  }

  async disconnect(): Promise<void> {
    if (!this.socket) return;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
  }

  registerPresence(peerId: string): void {
    if (!this.socket) {
      throw new Error('registerPresence: signaling not connected');
    }
    this.socket.emit('register-presence', { peerId, role: 'camera' });
    this.logger.info(
      { event: 'signaling.presence_registered', peerId },
      'Camera presence registered',
    );
  }

  sendSignal(payload: SignalDto): void {
    if (!this.socket) {
      this.logger.debug(
        { event: 'signaling.send_dropped_no_socket' },
        'sendSignal called before connect — dropping',
      );
      return;
    }
    this.socket.emit('signal', payload);
  }

  onSignal(handler: (payload: SignalDto) => void): void {
    this.signalHandler = handler;
  }

  onPresenceChange(handler: (event: PresenceChangeDto) => void): void {
    this.presenceHandler = handler;
  }

  requestPairingCode(cameraId: string): Promise<PairingCodeIssuedDto> {
    if (!this.socket) {
      return Promise.reject(new Error('requestPairingCode: signaling not connected'));
    }
    return new Promise((resolve) => {
      this.socket!.emit('request-pairing-code', { cameraId }, (response) => {
        resolve(response);
      });
    });
  }

  onPairingRedeemed(handler: (event: PairingRedeemedDto) => void): void {
    this.pairingRedeemedHandler = handler;
  }
}
