import type { DashboardPeerStatus } from '../../domain/repositories/i-webrtc-publisher.repository';

export interface StreamingScreenProps {
  readonly stream: MediaStream;
  readonly pairedDashboards: readonly string[];
  readonly statuses: readonly DashboardPeerStatus[];
}

export class StreamingScreen {
  private rootEl: HTMLElement | null = null;
  private summaryEl: HTMLElement | null = null;
  private listEl: HTMLUListElement | null = null;
  private videoEl: HTMLVideoElement | null = null;
  private pairedDashboards: readonly string[];
  private statuses: readonly DashboardPeerStatus[];
  private stream: MediaStream;

  constructor(props: StreamingScreenProps) {
    this.pairedDashboards = props.pairedDashboards;
    this.statuses = props.statuses;
    this.stream = props.stream;
  }

  mount(target: HTMLElement): HTMLElement {
    target.innerHTML = '';
    const root = document.createElement('section');
    root.className = 'screen';

    const title = document.createElement('h1');
    title.className = 'screen__title';
    title.textContent = 'Câmera ativa';

    const preview = document.createElement('div');
    preview.className = 'streaming__preview';

    const video = document.createElement('video');
    video.muted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('data-testid', 'preview-video');
    this.attachStream(video, this.stream);
    preview.appendChild(video);

    const summary = document.createElement('p');
    summary.className = 'streaming__summary';
    summary.setAttribute('data-testid', 'streaming-summary');

    const list = document.createElement('ul');
    list.className = 'streaming__list';
    list.setAttribute('data-testid', 'streaming-list');

    root.append(title, preview, summary, list);
    target.appendChild(root);

    this.rootEl = root;
    this.summaryEl = summary;
    this.listEl = list;
    this.videoEl = video;

    this.renderSummary();
    this.renderList();
    return root;
  }

  setStream(stream: MediaStream): void {
    this.stream = stream;
    if (this.videoEl) this.attachStream(this.videoEl, stream);
  }

  private attachStream(video: HTMLVideoElement, stream: MediaStream): void {
    // Some test envs (happy-dom) reject non-real MediaStream instances.
    // The browser path always succeeds; tests can still observe the assignment
    // via the fallback property.
    try {
      video.srcObject = stream;
    } catch {
      (video as unknown as { _srcObject: MediaStream })._srcObject = stream;
    }
  }

  setPairedDashboards(ids: readonly string[]): void {
    this.pairedDashboards = ids;
    this.renderSummary();
    this.renderList();
  }

  setStatuses(statuses: readonly DashboardPeerStatus[]): void {
    this.statuses = statuses;
    this.renderList();
  }

  unmount(): void {
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
    if (this.rootEl?.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl);
    }
    this.rootEl = null;
    this.summaryEl = null;
    this.listEl = null;
    this.videoEl = null;
  }

  private renderSummary(): void {
    if (!this.summaryEl) return;
    const n = this.pairedDashboards.length;
    this.summaryEl.textContent =
      n === 1
        ? 'Pareado com 1 painel.'
        : `Pareado com ${n} painéis.`;
  }

  private renderList(): void {
    if (!this.listEl) return;
    this.listEl.innerHTML = '';
    const statusByDashboard = new Map<string, RTCPeerConnectionState>();
    for (const s of this.statuses) {
      statusByDashboard.set(s.dashboardId, s.state);
    }
    for (const dashboardId of this.pairedDashboards) {
      const li = document.createElement('li');
      li.className = 'streaming__row';
      li.setAttribute('data-testid', `dashboard-row-${dashboardId}`);

      const idEl = document.createElement('span');
      idEl.textContent = dashboardId.slice(0, 8);

      const state = statusByDashboard.get(dashboardId) ?? 'new';
      const badge = document.createElement('span');
      badge.className = `status-badge status-badge--${state}`;
      badge.textContent = state;

      li.append(idEl, badge);
      this.listEl.appendChild(li);
    }
  }
}
