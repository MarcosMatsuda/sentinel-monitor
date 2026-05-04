import { GatewayCameraPublisher } from '../../src/infrastructure/webrtc/gateway-camera-publisher';

const silentLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  child: jest.fn(),
};

const makeFetch = (impl: (req: { url: string; method: string; body?: string }) => Response | Promise<Response>) => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fn = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === 'string' ? input : input.toString();
    const body = init?.body === undefined ? undefined : String(init.body);
    const call = { url, method: init?.method ?? 'GET', body };
    calls.push(call);
    return impl(call);
  }) as typeof fetch;
  return { fn, calls };
};

const ok = (body = '', headers: Record<string, string> = {}): Response =>
  new Response(body, { status: 200, headers });

const created = (body: string, location: string): Response =>
  new Response(body, { status: 201, headers: { location } });

describe('GatewayCameraPublisher', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    silentLogger.child.mockReturnValue(silentLogger);
  });

  describe('handleViewerSignal — offer', () => {
    it('POSTs SDP to WHEP and returns the answer', async () => {
      const { fn, calls } = makeFetch(() => created('v=0\r\nanswer-sdp', '/api/webrtc/sess-1'));
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });

      const result = await pub.handleViewerSignal('dash-1', {
        type: 'offer',
        sdp: 'v=0\r\noffer-sdp',
      });

      expect(result).toEqual({ type: 'answer', sdp: 'v=0\r\nanswer-sdp' });
      expect(calls[0]!.method).toBe('POST');
      expect(calls[0]!.body).toBe('v=0\r\noffer-sdp');
      expect(pub.sessionCount()).toBe(1);
    });

    it('throws when WHEP rejects the offer', async () => {
      const { fn } = makeFetch(() => new Response('bad', { status: 400 }));
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });
      await expect(
        pub.handleViewerSignal('dash-1', { type: 'offer', sdp: 'v=0' }),
      ).rejects.toThrow(/HTTP 400/);
      expect(pub.sessionCount()).toBe(0);
    });

    it('renegotiates by tearing down the previous session before opening a new one', async () => {
      let callCount = 0;
      const { fn, calls } = makeFetch(() => {
        callCount++;
        // First call: initial offer success. Second call: DELETE old session.
        // Third call: new offer success.
        if (callCount === 1) return created('v=0\r\nanswer-1', '/api/webrtc/sess-1');
        if (callCount === 2) return ok();
        return created('v=0\r\nanswer-2', '/api/webrtc/sess-2');
      });
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });

      await pub.handleViewerSignal('dash-1', { type: 'offer', sdp: 'v=0\r\noffer-1' });
      await pub.handleViewerSignal('dash-1', { type: 'offer', sdp: 'v=0\r\noffer-2' });

      expect(calls[0]!.method).toBe('POST');
      expect(calls[1]!.method).toBe('DELETE');
      expect(calls[2]!.method).toBe('POST');
      expect(pub.sessionCount()).toBe(1);
    });
  });

  describe('handleViewerSignal — ice-candidate', () => {
    it('PATCHes the WHEP resource URL with the candidate', async () => {
      let n = 0;
      const { fn, calls } = makeFetch(() => {
        n++;
        if (n === 1) return created('v=0\r\nanswer', '/api/webrtc/sess-1');
        return ok();
      });
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });

      await pub.handleViewerSignal('dash-1', { type: 'offer', sdp: 'v=0' });
      const result = await pub.handleViewerSignal('dash-1', {
        type: 'ice-candidate',
        candidate: { candidate: 'candidate:1 1 udp 2113937151 192.168.0.5 54400 typ host', sdpMid: '0' },
      });

      expect(result).toBeNull();
      expect(calls[1]!.method).toBe('PATCH');
      expect(calls[1]!.url).toBe('/api/webrtc/sess-1');
      expect(calls[1]!.body).toContain('a=mid:0');
      expect(calls[1]!.body).toContain('candidate:1 1 udp');
    });

    it('swallows ICE candidate when no session exists yet', async () => {
      const { fn, calls } = makeFetch(() => ok());
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });
      const result = await pub.handleViewerSignal('dash-unknown', {
        type: 'ice-candidate',
        candidate: { candidate: 'candidate:1', sdpMid: '0' },
      });
      expect(result).toBeNull();
      expect(calls).toHaveLength(0);
    });

    it('swallows PATCH failures (best-effort trickle)', async () => {
      let n = 0;
      const { fn } = makeFetch(() => {
        n++;
        if (n === 1) return created('v=0', '/api/webrtc/sess-1');
        return new Response('', { status: 500 });
      });
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });
      await pub.handleViewerSignal('dash-1', { type: 'offer', sdp: 'v=0' });
      await expect(
        pub.handleViewerSignal('dash-1', {
          type: 'ice-candidate',
          candidate: { candidate: 'candidate:1', sdpMid: '0' },
        }),
      ).resolves.toBeNull();
    });
  });

  describe('handleViewerSignal — answer', () => {
    it('logs and returns null (gateway is the answerer side)', async () => {
      const { fn } = makeFetch(() => ok());
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });
      const result = await pub.handleViewerSignal('dash-1', { type: 'answer', sdp: 'v=0' });
      expect(result).toBeNull();
    });
  });

  describe('closeSession + closeAllSessions', () => {
    it('DELETEs the WHEP resource', async () => {
      let n = 0;
      const { fn, calls } = makeFetch(() => {
        n++;
        if (n === 1) return created('v=0', '/api/webrtc/sess-1');
        return ok();
      });
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });
      await pub.handleViewerSignal('dash-1', { type: 'offer', sdp: 'v=0' });
      await pub.closeSession('dash-1');

      expect(calls[1]!.method).toBe('DELETE');
      expect(pub.sessionCount()).toBe(0);
    });

    it('closes all sessions in parallel', async () => {
      let n = 0;
      const { fn } = makeFetch(() => {
        n++;
        if (n <= 2) return created('v=0', `/api/webrtc/sess-${n}`);
        return ok();
      });
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });
      await pub.handleViewerSignal('dash-1', { type: 'offer', sdp: 'v=0' });
      await pub.handleViewerSignal('dash-2', { type: 'offer', sdp: 'v=0' });
      expect(pub.sessionCount()).toBe(2);

      await pub.closeAllSessions();
      expect(pub.sessionCount()).toBe(0);
    });

    it('closeSession is a no-op for unknown session', async () => {
      const { fn, calls } = makeFetch(() => ok());
      const pub = new GatewayCameraPublisher({
        cameraId: 'cam-1',
        streamId: 'cam-1',
        whepBaseUrl: 'http://127.0.0.1:1984/api/webrtc?src=cam-1',
        fetchImpl: fn,
        logger: silentLogger,
      });
      await pub.closeSession('ghost');
      expect(calls).toHaveLength(0);
    });
  });
});
