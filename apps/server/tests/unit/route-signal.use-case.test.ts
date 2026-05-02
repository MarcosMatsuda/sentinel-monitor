import { RouteSignalUseCase } from '../../src/domain/use-cases/route-signal.use-case';
import type {
  IPeerPresenceRepository,
  SignalDto,
} from '@sentinel-monitor/shared-types';

const mockPresence: jest.Mocked<IPeerPresenceRepository> = {
  set: jest.fn(),
  getSocketId: jest.fn(),
  getPeerId: jest.fn(),
  removeBySocket: jest.fn(),
  isOnline: jest.fn(),
  count: jest.fn(),
};

const offer: SignalDto = {
  fromPeerId: 'dash-1',
  toPeerId: 'cam-1',
  payload: { type: 'offer', sdp: 'v=0\r\n' },
};

describe('RouteSignalUseCase', () => {
  let useCase: RouteSignalUseCase;

  beforeEach(() => {
    useCase = new RouteSignalUseCase(mockPresence);
  });

  it('returns the recipient socket id when peer is online', () => {
    mockPresence.getSocketId.mockReturnValue('sock-cam-1');

    const result = useCase.execute(offer);

    expect(mockPresence.getSocketId).toHaveBeenCalledWith('cam-1');
    expect(result).toEqual({ routed: true, toSocketId: 'sock-cam-1', payload: offer });
  });

  it('returns recipient-offline when peer is not registered', () => {
    mockPresence.getSocketId.mockReturnValue(null);

    const result = useCase.execute(offer);

    expect(result).toEqual({ routed: false, reason: 'recipient-offline' });
  });
});
