// ============================================================
// Domain port for the dashboard's signaling channel.
// Surface: presence registration / queries / subscription, pairing
// code redemption, and the bidirectional signal pipe.
// ============================================================

import type {
  PairingErrorDto,
  PairingRedeemedDto,
  PresenceChangeDto,
  PresenceSnapshotDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';

export type RedeemPairingResult =
  | { readonly success: true; readonly data: PairingRedeemedDto }
  | { readonly success: false; readonly error: PairingErrorDto };

export interface ISignalingRepository {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  registerPresence(peerId: string): void;
  redeemPairingCode(code: string, dashboardId: string): Promise<RedeemPairingResult>;
  queryPresence(peerIds: readonly string[]): Promise<PresenceSnapshotDto>;
  subscribePresence(peerIds: readonly string[]): void;

  sendSignal(signal: SignalDto): void;
  onSignal(handler: (signal: SignalDto) => void): void;
  offSignal(handler: (signal: SignalDto) => void): void;
  onPresenceChange(handler: (change: PresenceChangeDto) => void): void;
  offPresenceChange(handler: (change: PresenceChangeDto) => void): void;
}
