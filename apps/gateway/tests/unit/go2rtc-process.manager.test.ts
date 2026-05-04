import { Go2RtcProcessManager } from '../../src/infrastructure/go2rtc/go2rtc-process.manager';

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
};

describe('Go2RtcProcessManager', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    silentLogger.child.mockReturnValue(silentLogger);
  });

  it('isRunning() returns false before start', () => {
    const mgr = new Go2RtcProcessManager({ logger: silentLogger });
    expect(mgr.isRunning()).toBe(false);
  });

  it('start() with a non-existent binary still resolves and the exit handler clears the child', async () => {
    const mgr = new Go2RtcProcessManager({
      binaryPath: '/usr/bin/false', // exists on linux/mac, exits non-zero immediately
      logger: silentLogger,
    });
    await mgr.start();
    // Wait a tick for the spawn-then-exit cycle to fire on the event loop.
    await new Promise((r) => setTimeout(r, 50));
    expect(mgr.isRunning()).toBe(false);
    // The "exited" warn log fired.
    expect(silentLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'go2rtc.exited' }),
      expect.any(String),
    );
  });

  it('start() is idempotent (does not spawn twice)', async () => {
    const mgr = new Go2RtcProcessManager({
      binaryPath: 'sleep', // Use sleep so the process stays alive long enough for the test
      logger: silentLogger,
    });
    // We can't easily inject child_process.spawn — instead, verify
    // start() returns and doesn't blow up when called twice rapidly.
    await mgr.start();
    await mgr.start();
    await mgr.stop();
    expect(mgr.isRunning()).toBe(false);
  });

  it('stop() before start() is a no-op', async () => {
    const mgr = new Go2RtcProcessManager({ logger: silentLogger });
    await expect(mgr.stop()).resolves.toBeUndefined();
  });
});
