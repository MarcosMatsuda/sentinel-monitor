import { spawn, type ChildProcess } from 'node:child_process';
import type { ILogger } from '../logging/logger';

// Optional: spawn the go2rtc binary as a subprocess of the gateway. In
// production we run go2rtc as a sibling docker container (compose file)
// so this is dev-only convenience. Toggled via env GATEWAY_SPAWN_GO2RTC=true.

export interface Go2RtcProcessOptions {
  readonly binaryPath?: string; // defaults to 'go2rtc' on PATH
  readonly configPath?: string; // YAML config file for go2rtc
  readonly logger: ILogger;
}

export class Go2RtcProcessManager {
  private child: ChildProcess | null = null;

  constructor(private readonly opts: Go2RtcProcessOptions) {}

  async start(): Promise<void> {
    if (this.child) return;
    const binary = this.opts.binaryPath ?? 'go2rtc';
    const args = this.opts.configPath ? ['-config', this.opts.configPath] : [];

    this.child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    this.opts.logger.info(
      { event: 'go2rtc.spawned', pid: this.child.pid, binary },
      'go2rtc subprocess started',
    );

    this.child.stdout?.on('data', (chunk: Buffer) => {
      this.opts.logger.debug({ event: 'go2rtc.stdout', line: chunk.toString().trim() });
    });
    this.child.stderr?.on('data', (chunk: Buffer) => {
      this.opts.logger.debug({ event: 'go2rtc.stderr', line: chunk.toString().trim() });
    });
    this.child.on('exit', (code) => {
      this.opts.logger.warn({ event: 'go2rtc.exited', code }, 'go2rtc subprocess exited');
      this.child = null;
    });
  }

  async stop(): Promise<void> {
    if (!this.child) return;
    return new Promise<void>((resolve) => {
      const child = this.child!;
      const onExit = (): void => {
        this.child = null;
        resolve();
      };
      child.once('exit', onExit);
      child.kill('SIGTERM');
      // Hard kill after 5s if still alive.
      setTimeout(() => {
        if (this.child) child.kill('SIGKILL');
      }, 5_000);
    });
  }

  isRunning(): boolean {
    return this.child !== null;
  }
}
