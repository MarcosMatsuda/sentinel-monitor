import type {
  PairingCodeIssuedDto,
  PairingRedeemedDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';

// Domain port for the signaling channel (Socket.IO under the hood).
// Camera-only surface — pairing code request, presence registration, signal pipe.
export interface ISignalingRepository {
  connect(): Promise<void>;
  disconnect(): void;
  registerPresence(peerId: string): void;
  requestPairingCode(cameraId: string): Promise<PairingCodeIssuedDto>;
  sendSignal(signal: SignalDto): void;
  onSignal(handler: (signal: SignalDto) => void): void;
  onPairingRedeemed(handler: (data: PairingRedeemedDto) => void): void;
  isConnected(): boolean;
}
