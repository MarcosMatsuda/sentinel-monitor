import { io, type Socket } from 'socket.io-client';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
  PairingCodeIssuedDto,
  PairingRedeemedDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';
import type { ISignalingRepository } from '../../domain/repositories/i-signaling.repository';

export type TypedSocket = Socket<IServerToClientEvents, IClientToServerEvents>;

export interface SocketIoSignalingClientOptions {
  readonly url: string;
  readonly socketFactory?: (url: string) => TypedSocket;
}

const defaultFactory = (url: string): TypedSocket =>
  io(url, {
    autoConnect: false,
    transports: ['websocket'],
  }) as TypedSocket;

export class SocketIoSignalingClient implements ISignalingRepository {
  private readonly socket: TypedSocket;

  constructor(options: SocketIoSignalingClientOptions) {
    const factory = options.socketFactory ?? defaultFactory;
    this.socket = factory(options.url);
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
    this.socket.emit('register-presence', { peerId, role: 'camera' });
  }

  requestPairingCode(cameraId: string): Promise<PairingCodeIssuedDto> {
    return new Promise<PairingCodeIssuedDto>((resolve) => {
      this.socket.emit(
        'request-pairing-code',
        { cameraId },
        (response: PairingCodeIssuedDto) => {
          resolve(response);
        },
      );
    });
  }

  sendSignal(signal: SignalDto): void {
    this.socket.emit('signal', signal);
  }

  onSignal(handler: (signal: SignalDto) => void): void {
    this.socket.on('signal', handler);
  }

  onPairingRedeemed(handler: (data: PairingRedeemedDto) => void): void {
    this.socket.on('pairing-redeemed', handler);
  }
}
