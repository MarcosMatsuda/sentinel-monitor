// ============================================================
// CameraBinding — a persisted association between this viewer
// (dashboardId) and a remote camera (cameraId), with a label
// the user can rename. No connection state lives here; that is
// computed at runtime by presentation/state.
// ============================================================

export type CameraBindingId = string;

export interface CameraBindingProps {
  readonly id: CameraBindingId;
  readonly cameraId: string;
  readonly label: string;
  readonly addedAt: number;
}

export class CameraBindingEntity {
  readonly id: CameraBindingId;
  readonly cameraId: string;
  readonly label: string;
  readonly addedAt: number;

  private constructor(props: CameraBindingProps) {
    this.id = props.id;
    this.cameraId = props.cameraId;
    this.label = props.label;
    this.addedAt = props.addedAt;
  }

  static create(props: CameraBindingProps): CameraBindingEntity {
    if (!props.id) throw new Error('CameraBinding.id is required');
    if (!props.cameraId) throw new Error('CameraBinding.cameraId is required');
    if (!props.label || props.label.trim().length === 0) {
      throw new Error('CameraBinding.label is required');
    }
    return new CameraBindingEntity(props);
  }

  rename(label: string): CameraBindingEntity {
    if (!label || label.trim().length === 0) {
      throw new Error('label cannot be empty');
    }
    return new CameraBindingEntity({ ...this.toJSON(), label: label.trim() });
  }

  toJSON(): CameraBindingProps {
    return {
      id: this.id,
      cameraId: this.cameraId,
      label: this.label,
      addedAt: this.addedAt,
    };
  }
}
