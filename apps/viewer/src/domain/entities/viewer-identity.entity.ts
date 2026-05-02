// ============================================================
// ViewerIdentity — a stable dashboardId for this device/browser.
// Generated once on first launch and persisted forever.
// ============================================================

export interface ViewerIdentityProps {
  readonly dashboardId: string;
  readonly createdAt: number;
}

export class ViewerIdentityEntity {
  readonly dashboardId: string;
  readonly createdAt: number;

  private constructor(props: ViewerIdentityProps) {
    this.dashboardId = props.dashboardId;
    this.createdAt = props.createdAt;
  }

  static create(props: ViewerIdentityProps): ViewerIdentityEntity {
    if (!props.dashboardId) throw new Error('dashboardId is required');
    return new ViewerIdentityEntity(props);
  }

  toJSON(): ViewerIdentityProps {
    return { dashboardId: this.dashboardId, createdAt: this.createdAt };
  }
}
