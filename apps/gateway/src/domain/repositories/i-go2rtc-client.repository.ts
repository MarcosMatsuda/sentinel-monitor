// go2rtc is the LAN bridge that ingests RTSP from IP cams and re-publishes
// each as a WebRTC stream over its WHEP endpoint. The gateway talks to
// it over HTTP only — never instantiates RTCPeerConnection itself for the
// camera side. That keeps the gateway portable to Pi/ARM (no native deps).

export interface Go2RtcStreamHealth {
  readonly streamId: string;
  readonly online: boolean;
  readonly producers: number;
}

export interface IGo2RtcClient {
  /** GET /api/streams — succeeds when go2rtc reachable. */
  health(): Promise<{ ok: true; version?: string }>;

  /** POST /api/streams?name=streamId&src=rtspUrl — registers an RTSP source. */
  registerStream(streamId: string, rtspUrl: string): Promise<void>;

  /** DELETE /api/streams?src=streamId — removes a previously registered source. */
  removeStream(streamId: string): Promise<void>;

  /** Per-stream health snapshot, useful for liveness checks. */
  getStreamHealth(streamId: string): Promise<Go2RtcStreamHealth>;

  /**
   * URL the dashboard's WebRTC subscriber consumes via WHEP (WebRTC-HTTP
   * Egress Protocol). The gateway proxies this URL through the signaling
   * server so the dashboard never sees the LAN address directly.
   */
  getWhepUrl(streamId: string): string;
}
