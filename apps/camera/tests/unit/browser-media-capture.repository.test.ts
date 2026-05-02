import { describe, expect, test, vi } from 'vitest';
import { MEDIA_CONSTRAINTS } from '@sentinel-monitor/webrtc-config';
import { BrowserMediaCaptureRepository } from '../../src/infrastructure/media/browser-media-capture.repository';

describe('BrowserMediaCaptureRepository', () => {
  test('calls getUserMedia with MEDIA_CONSTRAINTS and returns the stream', async () => {
    const fakeStream = {} as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(fakeStream);

    const repo = new BrowserMediaCaptureRepository(getUserMedia);
    const result = await repo.requestAudioVideo();

    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenCalledWith(MEDIA_CONSTRAINTS);
    expect(result).toBe(fakeStream);
  });
});
