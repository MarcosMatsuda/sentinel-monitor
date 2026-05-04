import type {
  Go2RtcStreamHealth,
  IGo2RtcClient,
} from '../../domain/repositories/i-go2rtc-client.repository';

export interface Go2RtcClientOptions {
  readonly baseUrl: string; // e.g. http://127.0.0.1:1984
  readonly fetchImpl?: typeof fetch; // injectable for tests
  readonly timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;

interface Go2RtcStreamsResponse {
  readonly [streamId: string]:
    | {
        readonly producers?: ReadonlyArray<{ readonly url?: string; readonly state?: string }>;
        readonly consumers?: readonly unknown[];
      }
    | undefined;
}

export class Go2RtcClient implements IGo2RtcClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: Go2RtcClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async health(): Promise<{ ok: true; version?: string }> {
    const res = await this.request('GET', '/api/streams');
    if (!res.ok) {
      throw new Error(`go2rtc health failed: HTTP ${res.status}`);
    }
    const versionHeader = res.headers.get('server') ?? undefined;
    return { ok: true, version: versionHeader };
  }

  async registerStream(streamId: string, rtspUrl: string): Promise<void> {
    if (!rtspUrl.startsWith('rtsp://')) {
      throw new Error(`registerStream: rtspUrl must start with rtsp:// (got "${rtspUrl}")`);
    }
    const url = `/api/streams?name=${encodeURIComponent(streamId)}&src=${encodeURIComponent(rtspUrl)}`;
    const res = await this.request('PUT', url);
    if (!res.ok) {
      throw new Error(`registerStream(${streamId}) failed: HTTP ${res.status}`);
    }
  }

  async removeStream(streamId: string): Promise<void> {
    const url = `/api/streams?src=${encodeURIComponent(streamId)}`;
    const res = await this.request('DELETE', url);
    if (!res.ok && res.status !== 404) {
      throw new Error(`removeStream(${streamId}) failed: HTTP ${res.status}`);
    }
  }

  async getStreamHealth(streamId: string): Promise<Go2RtcStreamHealth> {
    const res = await this.request('GET', '/api/streams');
    if (!res.ok) {
      throw new Error(`getStreamHealth: HTTP ${res.status}`);
    }
    const streams = (await res.json()) as Go2RtcStreamsResponse;
    const entry = streams[streamId];
    if (!entry) {
      return { streamId, online: false, producers: 0 };
    }
    const producers = entry.producers ?? [];
    return {
      streamId,
      online: producers.length > 0,
      producers: producers.length,
    };
  }

  getWhepUrl(streamId: string): string {
    return `${this.baseUrl}/api/webrtc?src=${encodeURIComponent(streamId)}`;
  }

  private async request(method: string, path: string): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}
