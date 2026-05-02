// ============================================================
// @sentinel-monitor/shared-types
// Domain layer — pure types, zero dependencies
// These types define the contract between server, camera, viewer.
// ============================================================

// ---- Roles & Entities ----

export type PeerRole = 'camera' | 'dashboard';

export interface PeerEntity {
  readonly id: string;
  readonly role: PeerRole;
  readonly label?: string;
  readonly connectedAt: number;
}

export interface PairingCodeEntity {
  readonly code: string;
  readonly cameraId: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
}

// ---- Wire DTOs ----

export interface RegisterPresenceDto {
  readonly peerId: string;
  readonly role: PeerRole;
}

export interface RequestPairingCodeDto {
  readonly cameraId: string;
}

export interface PairingCodeIssuedDto {
  readonly code: string;
  readonly expiresAt: number;
}

export interface RedeemPairingCodeDto {
  readonly code: string;
  readonly dashboardId: string;
}

export interface PairingRedeemedDto {
  readonly cameraId: string;
  readonly dashboardId: string;
}

export type PairingErrorCode = 'NOT_FOUND' | 'EXPIRED' | 'CONSUMED';

export interface PairingErrorDto {
  readonly code: PairingErrorCode;
  readonly message: string;
}

export type SignalPayload =
  | { readonly type: 'offer'; readonly sdp: string }
  | { readonly type: 'answer'; readonly sdp: string }
  | { readonly type: 'ice-candidate'; readonly candidate: RTCIceCandidateInit };

export interface SignalDto {
  readonly fromPeerId: string;
  readonly toPeerId: string;
  readonly payload: SignalPayload;
}

export interface PresenceQueryDto {
  readonly peerIds: readonly string[];
}

export interface PresenceSnapshotDto {
  readonly online: readonly string[];
}

export interface PresenceChangeDto {
  readonly peerId: string;
  readonly online: boolean;
}

// ---- DataChannel messages (per peer connection, label = SIGNAL_DATA_CHANNEL_LABEL) ----

export type DataChannelMessage =
  | { readonly type: 'video-meta'; readonly width: number; readonly height: number; readonly ts: number }
  | { readonly type: 'audio-mute-request'; readonly muted: boolean; readonly ts: number }
  | { readonly type: 'ping'; readonly ts: number }
  | { readonly type: 'pong'; readonly ts: number }
  // ---- Phase 2 forward-compat (cross-camera AI tracking) ----
  | { readonly type: 'detection-event'; readonly entityType: 'person' | 'vehicle'; readonly bbox: BoundingBox; readonly ts: number };

export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

// ---- Phase 2 placeholders (no use case yet, but contract is locked in) ----

export interface WatchlistEntry {
  readonly id: string;
  readonly label: string;
  readonly addedAt: number;
}

export interface CrossCameraAlert {
  readonly watchlistId: string;
  readonly cameraId: string;
  readonly bbox: BoundingBox;
  readonly confidence: number;
  readonly ts: number;
}

// ---- Connection state (used by viewer per camera) ----

export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'offline';

// ---- Socket.IO event maps ----

export interface IClientToServerEvents {
  'register-presence': (data: RegisterPresenceDto) => void;
  'request-pairing-code': (
    data: RequestPairingCodeDto,
    ack: (response: PairingCodeIssuedDto) => void,
  ) => void;
  'redeem-pairing-code': (
    data: RedeemPairingCodeDto,
    ack: (response: PairingRedeemedDto | PairingErrorDto) => void,
  ) => void;
  'query-presence': (
    data: PresenceQueryDto,
    ack: (response: PresenceSnapshotDto) => void,
  ) => void;
  'subscribe-presence': (data: PresenceQueryDto) => void;
  'signal': (data: SignalDto) => void;
}

export interface IServerToClientEvents {
  'pairing-redeemed': (data: PairingRedeemedDto) => void;
  'presence-change': (data: PresenceChangeDto) => void;
  'signal': (data: SignalDto) => void;
}

// ---- Repository interfaces (Dependency Inversion) ----

export interface IPeerPresenceRepository {
  set(peerId: string, socketId: string, role: PeerRole): void;
  getSocketId(peerId: string): string | null;
  getPeerId(socketId: string): string | null;
  removeBySocket(socketId: string): { peerId: string; role: PeerRole } | null;
  isOnline(peerId: string): boolean;
  count(): number;
}

export interface IPairingCodeRepository {
  create(cameraId: string, ttlMs: number): PairingCodeEntity;
  redeem(code: string, now: number): { cameraId: string } | { error: PairingErrorCode };
  purgeExpired(now: number): number;
  count(): number;
}

// ---- Constants ----

export const PAIRING_CODE_LENGTH = 6;
export const PAIRING_CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_TTL_MS = 5 * 60_000;
export const MAX_CAMERAS_PER_DASHBOARD = 9;
export const PRESENCE_HEARTBEAT_MS = 30_000;
export const SIGNAL_DATA_CHANNEL_LABEL = 'control';
export const RECONNECT_TIMEOUT_MS = 60_000;
