import { Go2RtcClient } from '../../src/infrastructure/go2rtc/go2rtc.client';

interface FetchCall {
  url: string;
  method: string;
  signal: AbortSignal | null;
}

const makeFetch = (impl: (call: FetchCall) => Response | Promise<Response>) => {
  const calls: FetchCall[] = [];
  const fn = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input.toString();
    const call: FetchCall = {
      url,
      method: init?.method ?? 'GET',
      signal: init?.signal ?? null,
    };
    calls.push(call);
    return impl(call);
  }) as typeof fetch;
  return { fn, calls };
};

const ok = (body: unknown = {}, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status: 200, headers });

const fail = (status = 500): Response => new Response('', { status });

describe('Go2RtcClient', () => {
  describe('health', () => {
    it('returns ok + version header on 200', async () => {
      const { fn } = makeFetch(() => ok({}, { server: 'go2rtc/1.9.10' }));
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      const result = await client.health();
      expect(result).toEqual({ ok: true, version: 'go2rtc/1.9.10' });
    });

    it('throws on non-200', async () => {
      const { fn } = makeFetch(() => fail(503));
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await expect(client.health()).rejects.toThrow(/HTTP 503/);
    });

    it('uses GET on /api/streams', async () => {
      const { fn, calls } = makeFetch(() => ok());
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await client.health();
      expect(calls[0]!.method).toBe('GET');
      expect(calls[0]!.url).toBe('http://127.0.0.1:1984/api/streams');
    });
  });

  describe('registerStream', () => {
    it('PUTs streams API with name + src params', async () => {
      const { fn, calls } = makeFetch(() => ok());
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await client.registerStream('cam-1', 'rtsp://u:p@192.168.0.42:554/stream1');

      expect(calls[0]!.method).toBe('PUT');
      expect(calls[0]!.url).toContain('/api/streams');
      expect(calls[0]!.url).toContain('name=cam-1');
      expect(calls[0]!.url).toContain('src=rtsp%3A%2F%2Fu%3Ap%40192.168.0.42%3A554%2Fstream1');
    });

    it('rejects non-rtsp URLs without hitting the network', async () => {
      const { fn, calls } = makeFetch(() => ok());
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await expect(client.registerStream('cam-1', 'http://example.com/stream')).rejects.toThrow(
        /must start with rtsp/,
      );
      expect(calls).toHaveLength(0);
    });

    it('throws when go2rtc rejects the registration', async () => {
      const { fn } = makeFetch(() => fail(400));
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await expect(client.registerStream('cam-1', 'rtsp://u:p@host:554/s1')).rejects.toThrow(
        /HTTP 400/,
      );
    });
  });

  describe('removeStream', () => {
    it('DELETEs the stream by id', async () => {
      const { fn, calls } = makeFetch(() => ok());
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await client.removeStream('cam-1');
      expect(calls[0]!.method).toBe('DELETE');
      expect(calls[0]!.url).toContain('src=cam-1');
    });

    it('treats 404 as success (already removed is fine)', async () => {
      const { fn } = makeFetch(() => fail(404));
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await expect(client.removeStream('cam-1')).resolves.toBeUndefined();
    });

    it('throws on other failures', async () => {
      const { fn } = makeFetch(() => fail(500));
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      await expect(client.removeStream('cam-1')).rejects.toThrow(/HTTP 500/);
    });
  });

  describe('getStreamHealth', () => {
    it('reports online + producer count when stream exists', async () => {
      const { fn } = makeFetch(() =>
        ok({
          'cam-1': { producers: [{ url: 'rtsp://...', state: 'connected' }] },
        }),
      );
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      const result = await client.getStreamHealth('cam-1');
      expect(result).toEqual({ streamId: 'cam-1', online: true, producers: 1 });
    });

    it('reports offline + 0 when stream missing', async () => {
      const { fn } = makeFetch(() => ok({}));
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      const result = await client.getStreamHealth('cam-1');
      expect(result).toEqual({ streamId: 'cam-1', online: false, producers: 0 });
    });

    it('reports offline when producers empty', async () => {
      const { fn } = makeFetch(() => ok({ 'cam-1': { producers: [] } }));
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fn });
      const result = await client.getStreamHealth('cam-1');
      expect(result).toEqual({ streamId: 'cam-1', online: false, producers: 0 });
    });
  });

  describe('getWhepUrl', () => {
    it('builds a properly-encoded URL', () => {
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984', fetchImpl: fetch });
      expect(client.getWhepUrl('cam-1')).toBe('http://127.0.0.1:1984/api/webrtc?src=cam-1');
    });

    it('strips trailing slash from baseUrl', () => {
      const client = new Go2RtcClient({ baseUrl: 'http://127.0.0.1:1984/', fetchImpl: fetch });
      expect(client.getWhepUrl('cam-1')).toBe('http://127.0.0.1:1984/api/webrtc?src=cam-1');
    });
  });

  describe('timeout', () => {
    it('aborts via AbortSignal when timeout fires', async () => {
      // Hang forever; abort signal should reject the request.
      const { fn } = makeFetch(
        ({ signal }) =>
          new Promise<Response>((_, reject) => {
            signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            );
          }),
      );
      const client = new Go2RtcClient({
        baseUrl: 'http://127.0.0.1:1984',
        fetchImpl: fn,
        timeoutMs: 50,
      });
      await expect(client.health()).rejects.toThrow();
    });
  });
});
