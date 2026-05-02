import { describeEnv, EnvValidationError, loadEnv } from '../../src/infrastructure/config/env';

describe('loadEnv', () => {
  it('applies defaults when no env vars are provided', () => {
    const env = loadEnv({});
    expect(env.PORT).toBe(3010);
    expect(env.CORS_ORIGIN).toBe('*');
    expect(env.NODE_ENV).toBe('development');
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.TURN_URL).toBeUndefined();
  });

  it('parses PORT as a number', () => {
    const env = loadEnv({ PORT: '4242' });
    expect(env.PORT).toBe(4242);
  });

  it('throws EnvValidationError when PORT is not a valid integer', () => {
    expect(() => loadEnv({ PORT: 'not-a-port' })).toThrow(EnvValidationError);
  });

  it('throws EnvValidationError when PORT is out of range', () => {
    expect(() => loadEnv({ PORT: '70000' })).toThrow(EnvValidationError);
  });

  it('throws EnvValidationError when NODE_ENV is unknown', () => {
    expect(() => loadEnv({ NODE_ENV: 'staging' })).toThrow(EnvValidationError);
  });

  it('accepts a valid TURN trio', () => {
    const env = loadEnv({
      TURN_URL: 'turns:turn.example.com:5349',
      TURN_USER: 'alice',
      TURN_PASS: 'secret',
    });
    expect(env.TURN_URL).toBe('turns:turn.example.com:5349');
    expect(env.TURN_USER).toBe('alice');
    expect(env.TURN_PASS).toBe('secret');
  });

  it('throws when TURN credentials are partially provided', () => {
    expect(() =>
      loadEnv({
        TURN_URL: 'turns:turn.example.com:5349',
        TURN_USER: 'alice',
      }),
    ).toThrow(/TURN_URL, TURN_USER, and TURN_PASS/);
  });

  it('rejects non-URL TURN_URL values', () => {
    expect(() =>
      loadEnv({
        TURN_URL: 'not a url',
        TURN_USER: 'alice',
        TURN_PASS: 'secret',
      }),
    ).toThrow(EnvValidationError);
  });

  it('produces a human-readable error message', () => {
    try {
      loadEnv({ PORT: 'abc' });
      fail('expected loadEnv to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError);
      expect((err as EnvValidationError).message).toMatch(/PORT/);
    }
  });
});

describe('describeEnv', () => {
  it('exposes safe fields and signals TURN as configured', () => {
    const env = loadEnv({
      PORT: '3010',
      TURN_URL: 'turns:turn.example.com:5349',
      TURN_USER: 'alice',
      TURN_PASS: 'secret',
    });
    const description = describeEnv(env);
    expect(description).toEqual({
      nodeEnv: 'development',
      port: 3010,
      corsOrigin: '*',
      logLevel: 'info',
      turnConfigured: true,
    });
    // It must not leak credentials.
    const serialized = JSON.stringify(description);
    expect(serialized).not.toContain('secret');
    expect(serialized).not.toContain('alice');
  });

  it('reports turnConfigured as false when TURN is unset', () => {
    const env = loadEnv({});
    expect(describeEnv(env).turnConfigured).toBe(false);
  });
});
