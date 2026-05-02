import { MEDIA_CONSTRAINTS } from '@sentinel-monitor/webrtc-config';
import type { IMediaCaptureRepository } from '../../domain/repositories/i-media-capture.repository';

export class BrowserMediaCaptureRepository implements IMediaCaptureRepository {
  constructor(
    private readonly getUserMedia: (
      constraints: MediaStreamConstraints,
    ) => Promise<MediaStream> = (constraints) =>
      navigator.mediaDevices.getUserMedia(constraints),
  ) {}

  async requestAudioVideo(): Promise<MediaStream> {
    return this.getUserMedia(MEDIA_CONSTRAINTS);
  }
}
