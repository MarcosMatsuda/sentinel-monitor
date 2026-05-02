import { HandleDisconnectUseCase } from '../../src/domain/use-cases/handle-disconnect.use-case';
import type { IPeerPresenceRepository } from '@sentinel-monitor/shared-types';

const mockPresence: jest.Mocked<IPeerPresenceRepository> = {
  set: jest.fn(),
  getSocketId: jest.fn(),
  getPeerId: jest.fn(),
  removeBySocket: jest.fn(),
  isOnline: jest.fn(),
  count: jest.fn(),
};

describe('HandleDisconnectUseCase', () => {
  let useCase: HandleDisconnectUseCase;

  beforeEach(() => {
    useCase = new HandleDisconnectUseCase(mockPresence);
  });

  it('returns peer info when the socket was registered', () => {
    mockPresence.removeBySocket.mockReturnValue({ peerId: 'cam-1', role: 'camera' });

    const result = useCase.execute({ socketId: 'sock-1' });

    expect(mockPresence.removeBySocket).toHaveBeenCalledWith('sock-1');
    expect(result).toEqual({ removed: true, peerId: 'cam-1', role: 'camera' });
  });

  it('returns removed:false when the socket was unknown', () => {
    mockPresence.removeBySocket.mockReturnValue(null);

    const result = useCase.execute({ socketId: 'ghost-sock' });

    expect(result).toEqual({ removed: false });
  });
});
