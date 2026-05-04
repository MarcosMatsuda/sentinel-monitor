import pino, { type Logger as PinoLogger } from 'pino';

export interface ILogger {
  info(obj: object | string, msg?: string): void;
  warn(obj: object | string, msg?: string): void;
  error(obj: object | string, msg?: string): void;
  debug(obj: object | string, msg?: string): void;
  child(bindings: Record<string, unknown>): ILogger;
}

class PinoAdapter implements ILogger {
  constructor(private readonly inner: PinoLogger) {}

  info(obj: object | string, msg?: string): void {
    typeof obj === 'string' ? this.inner.info(obj) : this.inner.info(obj, msg);
  }

  warn(obj: object | string, msg?: string): void {
    typeof obj === 'string' ? this.inner.warn(obj) : this.inner.warn(obj, msg);
  }

  error(obj: object | string, msg?: string): void {
    typeof obj === 'string' ? this.inner.error(obj) : this.inner.error(obj, msg);
  }

  debug(obj: object | string, msg?: string): void {
    typeof obj === 'string' ? this.inner.debug(obj) : this.inner.debug(obj, msg);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new PinoAdapter(this.inner.child(bindings));
  }
}

export function createLogger(opts: { level?: string; pretty?: boolean } = {}): ILogger {
  const inner = pino({
    level: opts.level ?? 'info',
    base: { service: 'sentinel-gateway' },
    ...(opts.pretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss.l' },
          },
        }
      : {}),
  });
  return new PinoAdapter(inner);
}
