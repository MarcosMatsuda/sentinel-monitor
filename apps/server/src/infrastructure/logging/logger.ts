import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

/**
 * Application-facing logger contract. Use cases and handlers depend on this
 * interface (DIP) so the concrete pino implementation can be swapped or
 * stubbed in tests without ripple effects.
 */
export interface ILogger {
  info(payload: Record<string, unknown> | string, message?: string): void;
  warn(payload: Record<string, unknown> | string, message?: string): void;
  error(payload: Record<string, unknown> | string, message?: string): void;
  debug(payload: Record<string, unknown> | string, message?: string): void;
  child(bindings: Record<string, unknown>): ILogger;
}

export interface ILoggerOptions {
  readonly level?: string;
  readonly pretty?: boolean;
  readonly base?: Record<string, unknown>;
  readonly destination?: NodeJS.WritableStream;
}

class PinoAdapter implements ILogger {
  constructor(private readonly inner: PinoLogger) {}

  info(payload: Record<string, unknown> | string, message?: string): void {
    this.write('info', payload, message);
  }

  warn(payload: Record<string, unknown> | string, message?: string): void {
    this.write('warn', payload, message);
  }

  error(payload: Record<string, unknown> | string, message?: string): void {
    this.write('error', payload, message);
  }

  debug(payload: Record<string, unknown> | string, message?: string): void {
    this.write('debug', payload, message);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new PinoAdapter(this.inner.child(bindings));
  }

  private write(
    level: 'info' | 'warn' | 'error' | 'debug',
    payload: Record<string, unknown> | string,
    message?: string,
  ): void {
    if (typeof payload === 'string') {
      this.inner[level](payload);
      return;
    }
    if (message === undefined) {
      this.inner[level](payload);
      return;
    }
    this.inner[level](payload, message);
  }
}

/**
 * Create a structured logger. In production, output is single-line JSON for
 * downstream log shippers. In development, pino-pretty is enabled when
 * available to give a readable stream.
 */
export function createLogger(options: ILoggerOptions = {}): ILogger {
  const opts: LoggerOptions = {
    level: options.level ?? 'info',
    base: options.base ?? { service: 'sentinel-server' },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (options.pretty) {
    try {
      opts.transport = {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      };
    } catch {
      // pino-pretty not installed; fall through to JSON output.
    }
  }

  const inner = options.destination
    ? pino(opts, options.destination)
    : pino(opts);
  return new PinoAdapter(inner);
}
