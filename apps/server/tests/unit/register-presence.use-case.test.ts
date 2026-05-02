import { RegisterPresenceUseCase } from '../../src/domain/use-cases/register-presence.use-case';
import type { IPeerPresenceRepository } from '@sentinel-monitor/shared-types';

const mockPresence: jest.Mocked<IPeerPresenceRepository> = {
  set: jest.fn(),
  getSocketId: jest.fn(),
  getPeerId: jest.fn(),
  removeBySocket: jest.fn(),
  isOnline: jest.fn(),
  count: jest.fn(),
};

describe('RegisterPresenceUseCase', () => {
  let useCase: RegisterPresenceUseCase;

  beforeEach(() => {
    useCase = new RegisterPresenceUseCase(mockPresence);
  });

  it('forwards the registration to the presence repo', () => {
    useCase.execute({ peerId: 'cam-1', role: 'camera', socketId: 'sock-1' });
    expect(mockPresence.set).toHaveBeenCalledWith('cam-1', 'sock-1', 'camera');
  });

  it('is idempotent: calling twice with same input is safe', () => {
    useCase.execute({ peerId: 'cam-1', role: 'camera', socketId: 'sock-1' });
    useCase.execute({ peerId: 'cam-1', role: 'camera', socketId: 'sock-1' });
    expect(mockPresence.set).toHaveBeenCalledTimes(2);
  });
});
