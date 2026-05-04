import { createLogger } from '../../src/infrastructure/logging/logger';

describe('createLogger', () => {
  it('returns a logger that exposes the four standard levels + child', () => {
    const logger = createLogger({ level: 'silent' });
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.child).toBe('function');
  });

  it('child() returns a logger with the same shape', () => {
    const logger = createLogger({ level: 'silent' });
    const child = logger.child({ correlationId: 'abc' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.child).toBe('function');
  });

  it('does not throw when called with object + msg or string only', () => {
    const logger = createLogger({ level: 'silent' });
    expect(() => logger.info('plain')).not.toThrow();
    expect(() => logger.info({ foo: 1 }, 'with msg')).not.toThrow();
    expect(() => logger.warn({ event: 'x' })).not.toThrow();
    expect(() => logger.error('err')).not.toThrow();
    expect(() => logger.debug({ event: 'd' })).not.toThrow();
  });
});
