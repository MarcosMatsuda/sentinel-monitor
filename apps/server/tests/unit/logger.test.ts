import { Writable } from 'stream';
import { createLogger } from '../../src/infrastructure/logging/logger';

interface ICapturedLine {
  level: number;
  msg: string;
  service?: string;
  event?: string;
  correlationId?: string;
  socketId?: string;
  peerId?: string;
  [key: string]: unknown;
}

function captureStream(): {
  stream: Writable;
  lines: () => ICapturedLine[];
} {
  const chunks: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback): void {
      chunks.push(chunk.toString());
      callback();
    },
  });
  return {
    stream,
    lines: (): ICapturedLine[] =>
      chunks
        .join('')
        .split('\n')
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as ICapturedLine),
  };
}

describe('createLogger', () => {
  it('emits structured JSON with service base field', () => {
    const cap = captureStream();
    const log = createLogger({ destination: cap.stream });
    log.info({ event: 'test.event' }, 'hello');
    const [line] = cap.lines();
    expect(line).toBeDefined();
    expect(line!.msg).toBe('hello');
    expect(line!.event).toBe('test.event');
    expect(line!.service).toBe('sentinel-server');
    expect(typeof line!.time).toBe('string');
  });

  it('respects the configured log level', () => {
    const cap = captureStream();
    const log = createLogger({ destination: cap.stream, level: 'warn' });
    log.info({ event: 'noisy' }, 'should not appear');
    log.warn({ event: 'important' }, 'should appear');
    const lines = cap.lines();
    expect(lines).toHaveLength(1);
    expect(lines[0]!.event).toBe('important');
  });

  it('child logger inherits bindings (correlation id propagates)', () => {
    const cap = captureStream();
    const root = createLogger({ destination: cap.stream });
    const child = root.child({ correlationId: 'abc-123', socketId: 'sock-1' });
    child.info({ event: 'connection' }, 'connected');
    const [line] = cap.lines();
    expect(line!.correlationId).toBe('abc-123');
    expect(line!.socketId).toBe('sock-1');
    expect(line!.event).toBe('connection');
  });

  it('supports plain string messages', () => {
    const cap = captureStream();
    const log = createLogger({ destination: cap.stream });
    log.error('plain error');
    const [line] = cap.lines();
    expect(line!.msg).toBe('plain error');
    expect(line!.level).toBe(50);
  });

  it('debug level can be enabled and emits records', () => {
    const cap = captureStream();
    const log = createLogger({ destination: cap.stream, level: 'debug' });
    log.debug({ event: 'trace' }, 'debug msg');
    const [line] = cap.lines();
    expect(line!.event).toBe('trace');
    expect(line!.level).toBe(20);
  });
});
