import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SignalDto } from '@sentinel-monitor/shared-types';
import { BrowserWebRtcPublisher } from '../../src/infrastructure/webrtc/browser-webrtc-publisher';
import {
  FakeMediaStreamTrack,
  createFakeStream,
  installFakeRtc,
  type InstalledRtc,
} from '../helpers/fake-rtc';

let rtc: InstalledRtc;

beforeEach(() => {
  rtc = installFakeRtc();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const buildStream = (): MediaStream =>
  createFakeStream(new FakeMediaStreamTrack('audio'), new FakeMediaStreamTrack('video'));

describe('BrowserWebRtcPublisher', () => {
  test('throws if an offer arrives before a stream is set', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    await expect(
      pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'v=0' }),
    ).rejects.toThrow(/stream not set/);
  });

  test('answers an incoming offer and emits the answer through the signal handler', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    const sent: SignalDto[] = [];
    pub.onSignalToSend((s) => sent.push(s));

    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'remote-sdp' });

    expect(rtc.peers).toHaveLength(1);
    const peer = rtc.peers[0]!;
    expect(peer.addedTracks).toHaveLength(2);
    expect(peer.remoteDescriptions[0]?.type).toBe('offer');
    expect(peer.localDescription?.type).toBe('answer');

    expect(sent).toHaveLength(1);
    const signal = sent[0]!;
    expect(signal.fromPeerId).toBe('cam-1');
    expect(signal.toPeerId).toBe('dash-1');
    expect(signal.payload.type).toBe('answer');
  });

  test('keeps a separate RTCPeerConnection per dashboard', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());

    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp-1' });
    await pub.handleIncomingSignal('dash-2', { type: 'offer', sdp: 'sdp-2' });

    expect(rtc.peers).toHaveLength(2);
    const ids = pub.getStatuses().map((s) => s.dashboardId).sort();
    expect(ids).toEqual(['dash-1', 'dash-2']);
  });

  test('forwards local ICE candidates back to the originating dashboard', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    const sent: SignalDto[] = [];
    pub.onSignalToSend((s) => sent.push(s));

    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp' });
    sent.length = 0;

    const peer = rtc.peers[0]!;
    const candidate = { toJSON: () => ({ candidate: 'a=candidate' }) } as unknown as RTCIceCandidate;
    peer.fireIceCandidate(candidate);

    expect(sent).toHaveLength(1);
    expect(sent[0]?.payload.type).toBe('ice-candidate');
    expect(sent[0]?.toPeerId).toBe('dash-1');
  });

  test('emits status changes on connection-state transitions', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    const updates: Array<{ dashboardId: string; state: RTCPeerConnectionState }> = [];
    pub.onStatusChange((s) => updates.push({ ...s }));

    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp' });
    rtc.peers[0]!.setStateAndFire('connected');

    expect(updates).toContainEqual({ dashboardId: 'dash-1', state: 'connected' });
  });

  test('routes remote ICE candidates to the matching dashboard PC', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp' });

    await pub.handleIncomingSignal('dash-1', {
      type: 'ice-candidate',
      candidate: { candidate: 'a=ice' } as RTCIceCandidateInit,
    });

    expect(rtc.peers[0]!.addedCandidates).toHaveLength(1);
  });

  test('ignores remote ICE candidates for unknown dashboards', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await pub.handleIncomingSignal('mystery', {
      type: 'ice-candidate',
      candidate: { candidate: 'a=ice' } as RTCIceCandidateInit,
    });
    expect(rtc.peers).toHaveLength(0);
  });

  test('swallows addIceCandidate errors (late or duplicate candidates)', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp' });
    rtc.peers[0]!.addIceCandidateError = new Error('late');
    await expect(
      pub.handleIncomingSignal('dash-1', {
        type: 'ice-candidate',
        candidate: { candidate: 'a=ice' } as RTCIceCandidateInit,
      }),
    ).resolves.toBeUndefined();
  });

  test('ignores stray answer payloads (subscriber-driven, camera never offers)', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await expect(
      pub.handleIncomingSignal('dash-1', { type: 'answer', sdp: 'sdp' }),
    ).resolves.toBeUndefined();
    expect(rtc.peers).toHaveLength(0);
  });

  test('replaces the existing PC when a dashboard re-offers (reconnect)', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'first' });
    const first = rtc.peers[0]!;
    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'second' });

    expect(first.closed).toBe(true);
    expect(rtc.peers).toHaveLength(2);
    expect(pub.getStatuses()).toHaveLength(1);
  });

  test('removeDashboard tears the PC down and forgets the entry', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp' });
    pub.removeDashboard('dash-1');
    expect(rtc.peers[0]!.closed).toBe(true);
    expect(pub.getStatuses()).toHaveLength(0);
  });

  test('removeDashboard is a no-op for unknown dashboards', () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    expect(() => pub.removeDashboard('ghost')).not.toThrow();
  });

  test('closeAll closes every peer connection', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp' });
    await pub.handleIncomingSignal('dash-2', { type: 'offer', sdp: 'sdp' });

    pub.closeAll();
    expect(rtc.peers.every((p) => p.closed)).toBe(true);
    expect(pub.getStatuses()).toHaveLength(0);
  });

  test('does not emit ICE before a signal handler is registered', async () => {
    const pub = new BrowserWebRtcPublisher('cam-1');
    pub.setStream(buildStream());
    await pub.handleIncomingSignal('dash-1', { type: 'offer', sdp: 'sdp' });
    const peer = rtc.peers[0]!;
    expect(() => peer.fireIceCandidate(null)).not.toThrow();
  });
});
