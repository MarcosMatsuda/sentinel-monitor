// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { PairingStateEntity } from '../../src/domain/entities/pairing-state.entity';
import { PairingScreen } from '../../src/presentation/screens/pairing.screen';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

const mountIn = (screen: PairingScreen): HTMLElement => {
  const target = document.createElement('div');
  document.body.appendChild(target);
  screen.mount(target);
  return target;
};

describe('PairingScreen', () => {
  test('renders code, url, countdown and disables regenerate while live', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const screen = new PairingScreen({
      state: new PairingStateEntity('ABCDEF', 60_000),
      cameraId: 'cam-1',
      pairingUrl: 'https://example.test/?code=ABCDEF',
      onRegenerate: vi.fn(),
      onCopy: vi.fn().mockResolvedValue(undefined),
    });
    const target = mountIn(screen);
    expect(target.querySelector('[data-testid="pairing-code"]')?.textContent).toBe('ABCDEF');
    expect(target.querySelector('[data-testid="pairing-url"]')?.textContent).toContain(
      'ABCDEF',
    );
    expect(target.querySelector('[data-testid="pairing-countdown"]')?.textContent).toMatch(
      /Expira em 1:00/,
    );
    const btn = target.querySelector<HTMLButtonElement>('[data-testid="regenerate-button"]')!;
    expect(btn.disabled).toBe(true);
    screen.unmount();
  });

  test('marks the code expired and enables regenerate after expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onRegenerate = vi.fn();
    const screen = new PairingScreen({
      state: new PairingStateEntity('ABCDEF', 1_000),
      cameraId: 'cam-1',
      pairingUrl: 'https://example.test',
      onRegenerate,
    });
    const target = mountIn(screen);

    vi.setSystemTime(2_000);
    vi.advanceTimersByTime(1_000);

    const countdown = target.querySelector('[data-testid="pairing-countdown"]')!;
    expect(countdown.textContent).toBe('Código expirado.');
    expect(countdown.classList.contains('pairing__countdown--expired')).toBe(true);

    const btn = target.querySelector<HTMLButtonElement>('[data-testid="regenerate-button"]')!;
    expect(btn.disabled).toBe(false);
    btn.click();
    expect(onRegenerate).toHaveBeenCalledOnce();
  });

  test('copy button invokes the supplied copy handler with the current code', () => {
    const onCopy = vi.fn().mockResolvedValue(undefined);
    const screen = new PairingScreen({
      state: new PairingStateEntity('ABCDEF', Date.now() + 60_000),
      cameraId: 'cam-1',
      pairingUrl: 'https://example.test',
      onRegenerate: vi.fn(),
      onCopy,
    });
    const target = mountIn(screen);
    target.querySelector<HTMLButtonElement>('[data-testid="copy-button"]')!.click();
    expect(onCopy).toHaveBeenCalledWith('ABCDEF');
    screen.unmount();
  });

  test('updateState refreshes the rendered code', () => {
    const screen = new PairingScreen({
      state: new PairingStateEntity('OLD123', Date.now() + 60_000),
      cameraId: 'cam-1',
      pairingUrl: 'https://example.test',
      onRegenerate: vi.fn(),
    });
    const target = mountIn(screen);
    screen.updateState(new PairingStateEntity('NEW456', Date.now() + 60_000));
    expect(target.querySelector('[data-testid="pairing-code"]')?.textContent).toBe('NEW456');
    screen.unmount();
  });
});
