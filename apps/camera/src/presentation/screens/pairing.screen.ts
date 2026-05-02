import { PairingStateEntity } from '../../domain/entities/pairing-state.entity';

export interface PairingScreenProps {
  readonly state: PairingStateEntity;
  readonly cameraId: string;
  readonly pairingUrl: string;
  readonly onRegenerate: () => void;
  readonly onCopy?: (text: string) => Promise<void>;
}

interface CountdownHandle {
  stop(): void;
}

export class PairingScreen {
  private rootEl: HTMLElement | null = null;
  private countdownEl: HTMLElement | null = null;
  private regenerateBtn: HTMLButtonElement | null = null;
  private countdownTimer: CountdownHandle | null = null;
  private currentState: PairingStateEntity;
  private readonly props: PairingScreenProps;
  private readonly onCopy: (text: string) => Promise<void>;

  constructor(props: PairingScreenProps) {
    this.props = props;
    this.currentState = props.state;
    this.onCopy =
      props.onCopy ??
      ((text) =>
        navigator.clipboard?.writeText
          ? navigator.clipboard.writeText(text)
          : Promise.resolve());
  }

  mount(target: HTMLElement): HTMLElement {
    target.innerHTML = '';
    const root = document.createElement('section');
    root.className = 'screen';

    const title = document.createElement('h1');
    title.className = 'screen__title';
    title.textContent = 'Emparelhar câmera';

    const subtitle = document.createElement('p');
    subtitle.className = 'screen__subtitle';
    subtitle.textContent =
      'Abra o painel em outro dispositivo e digite este código.';

    const code = document.createElement('div');
    code.className = 'pairing__code';
    code.setAttribute('data-testid', 'pairing-code');
    code.textContent = this.currentState.code;

    const url = document.createElement('div');
    url.className = 'pairing__url';
    url.setAttribute('data-testid', 'pairing-url');
    url.textContent = this.props.pairingUrl;

    const countdown = document.createElement('div');
    countdown.className = 'pairing__countdown';
    countdown.setAttribute('data-testid', 'pairing-countdown');

    const actions = document.createElement('div');
    actions.className = 'pairing__actions';

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn';
    copyBtn.setAttribute('data-testid', 'copy-button');
    copyBtn.textContent = 'Copiar código';
    copyBtn.addEventListener('click', () => {
      void this.onCopy(this.currentState.code);
    });

    const regenerateBtn = document.createElement('button');
    regenerateBtn.type = 'button';
    regenerateBtn.className = 'btn btn--primary';
    regenerateBtn.setAttribute('data-testid', 'regenerate-button');
    regenerateBtn.textContent = 'Gerar novo código';
    regenerateBtn.disabled = !this.currentState.isExpired();
    regenerateBtn.addEventListener('click', () => {
      this.props.onRegenerate();
    });

    actions.append(copyBtn, regenerateBtn);
    root.append(title, subtitle, code, url, countdown, actions);
    target.appendChild(root);

    this.rootEl = root;
    this.countdownEl = countdown;
    this.regenerateBtn = regenerateBtn;
    this.startCountdown();

    return root;
  }

  updateState(state: PairingStateEntity): void {
    this.currentState = state;
    if (!this.rootEl) return;
    const codeEl = this.rootEl.querySelector('[data-testid="pairing-code"]');
    if (codeEl) codeEl.textContent = state.code;
    this.renderCountdown();
  }

  unmount(): void {
    this.countdownTimer?.stop();
    this.countdownTimer = null;
    if (this.rootEl?.parentElement) {
      this.rootEl.parentElement.removeChild(this.rootEl);
    }
    this.rootEl = null;
    this.countdownEl = null;
    this.regenerateBtn = null;
  }

  private startCountdown(): void {
    this.countdownTimer?.stop();
    this.renderCountdown();
    const interval = setInterval(() => {
      this.renderCountdown();
    }, 1000);
    this.countdownTimer = {
      stop: () => clearInterval(interval),
    };
  }

  private renderCountdown(): void {
    if (!this.countdownEl) return;
    const expired = this.currentState.isExpired();
    if (expired) {
      this.countdownEl.textContent = 'Código expirado.';
      this.countdownEl.classList.add('pairing__countdown--expired');
      if (this.regenerateBtn) this.regenerateBtn.disabled = false;
      return;
    }
    const seconds = this.currentState.remainingSeconds();
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    const padded = `${m}:${s.toString().padStart(2, '0')}`;
    this.countdownEl.textContent = `Expira em ${padded}`;
    this.countdownEl.classList.remove('pairing__countdown--expired');
    if (this.regenerateBtn) this.regenerateBtn.disabled = true;
  }
}
