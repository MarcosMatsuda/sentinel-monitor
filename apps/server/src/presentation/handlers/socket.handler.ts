import type { Server, Socket } from 'socket.io';
import type {
  IClientToServerEvents,
  IServerToClientEvents,
  IPeerPresenceRepository,
  PairingCodeIssuedDto,
  PairingErrorDto,
  PairingRedeemedDto,
  PresenceChangeDto,
  PresenceQueryDto,
  PresenceSnapshotDto,
  RedeemPairingCodeDto,
  RegisterPresenceDto,
  RequestPairingCodeDto,
  SignalDto,
} from '@sentinel-monitor/shared-types';
import type { GeneratePairingCodeUseCase } from '../../domain/use-cases/generate-pairing-code.use-case';
import type { HandleDisconnectUseCase } from '../../domain/use-cases/handle-disconnect.use-case';
import type { RedeemPairingCodeUseCase } from '../../domain/use-cases/redeem-pairing-code.use-case';
import type { RegisterPresenceUseCase } from '../../domain/use-cases/register-presence.use-case';
import type { RouteSignalUseCase } from '../../domain/use-cases/route-signal.use-case';

export type TypedServer = Server<IClientToServerEvents, IServerToClientEvents>;
export type TypedSocket = Socket<IClientToServerEvents, IServerToClientEvents>;

export interface ISocketHandlerDeps {
  readonly registerPresence: RegisterPresenceUseCase;
  readonly generatePairingCode: GeneratePairingCodeUseCase;
  readonly redeemPairingCode: RedeemPairingCodeUseCase;
  readonly routeSignal: RouteSignalUseCase;
  readonly handleDisconnect: HandleDisconnectUseCase;
  readonly presence: IPeerPresenceRepository;
}

/**
 * Bridges the Socket.IO transport with the domain use cases. Holds in-memory
 * subscription sets per socket so dashboards can be notified when the cameras
 * they care about change presence.
 */
export class SocketHandler {
  // socketId -> set of peerIds the socket is subscribed to
  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(private readonly deps: ISocketHandlerDeps) {}

  register(io: TypedServer): void {
    io.on('connection', (socket) => this.onConnection(io, socket));
  }

  private onConnection(io: TypedServer, socket: TypedSocket): void {
    socket.on('register-presence', (data: RegisterPresenceDto) => {
      this.deps.registerPresence.execute({
        peerId: data.peerId,
        role: data.role,
        socketId: socket.id,
      });
      this.broadcastPresence(io, { peerId: data.peerId, online: true });
    });

    socket.on(
      'request-pairing-code',
      (data: RequestPairingCodeDto, ack: (response: PairingCodeIssuedDto) => void) => {
        const issued = this.deps.generatePairingCode.execute({ cameraId: data.cameraId });
        ack(issued);
      },
    );

    socket.on(
      'redeem-pairing-code',
      (
        data: RedeemPairingCodeDto,
        ack: (response: PairingRedeemedDto | PairingErrorDto) => void,
      ) => {
        const result = this.deps.redeemPairingCode.execute({
          code: data.code,
          dashboardId: data.dashboardId,
        });
        if (!result.success) {
          ack(result.error);
          return;
        }
        ack(result.data);
        const cameraSocketId = this.deps.presence.getSocketId(result.data.cameraId);
        if (cameraSocketId) {
          io.to(cameraSocketId).emit('pairing-redeemed', result.data);
        }
      },
    );

    socket.on(
      'query-presence',
      (data: PresenceQueryDto, ack: (response: PresenceSnapshotDto) => void) => {
        const online = data.peerIds.filter((id) => this.deps.presence.isOnline(id));
        ack({ online });
      },
    );

    socket.on('subscribe-presence', (data: PresenceQueryDto) => {
      const set = this.subscriptions.get(socket.id) ?? new Set<string>();
      for (const id of data.peerIds) set.add(id);
      this.subscriptions.set(socket.id, set);
    });

    socket.on('signal', (data: SignalDto) => {
      const result = this.deps.routeSignal.execute(data);
      if (!result.routed) return;
      io.to(result.toSocketId).emit('signal', result.payload);
    });

    socket.on('disconnect', () => {
      this.subscriptions.delete(socket.id);
      const result = this.deps.handleDisconnect.execute({ socketId: socket.id });
      if (result.removed) {
        this.broadcastPresence(io, { peerId: result.peerId, online: false });
      }
    });
  }

  private broadcastPresence(io: TypedServer, change: PresenceChangeDto): void {
    for (const [socketId, peers] of this.subscriptions) {
      if (peers.has(change.peerId)) {
        io.to(socketId).emit('presence-change', change);
      }
    }
  }
}
