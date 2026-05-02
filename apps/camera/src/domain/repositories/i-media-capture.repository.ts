// Domain port for media capture (audio + video).
// Implementations live in `infrastructure/media`.
export interface IMediaCaptureRepository {
  requestAudioVideo(): Promise<MediaStream>;
}
