// @vitest-environment happy-dom
import { afterEach, describe, expect, test } from 'vitest';
import { StreamingScreen } from '../../src/presentation/screens/streaming.screen';

afterEach(() => {
  document.body.innerHTML = '';
});

const buildStream = (): MediaStream =>
  ({
    getTracks: () => [],
    getAudioTracks: () => [],
    getVideoTracks: () => [],
  }) as unknown as MediaStream;

describe('StreamingScreen', () => {
  test('renders the singular summary when paired with one dashboard', () => {
    const screen = new StreamingScreen({
      stream: buildStream(),
      pairedDashboards: ['dash-1'],
      statuses: [{ dashboardId: 'dash-1', state: 'connected' }],
    });
    const target = document.createElement('div');
    document.body.appendChild(target);
    screen.mount(target);

    const summary = target.querySelector('[data-testid="streaming-summary"]');
    expect(summary?.textContent).toBe('Pareado com 1 painel.');
    const row = target.querySelector('[data-testid="dashboard-row-dash-1"]');
    expect(row).not.toBeNull();
    expect(row?.querySelector('.status-badge')?.classList.contains('status-badge--connected')).toBe(true);
    screen.unmount();
  });

  test('renders the plural summary and updates statuses dynamically', () => {
    const screen = new StreamingScreen({
      stream: buildStream(),
      pairedDashboards: ['a', 'b'],
      statuses: [],
    });
    const target = document.createElement('div');
    document.body.appendChild(target);
    screen.mount(target);

    expect(target.querySelector('[data-testid="streaming-summary"]')?.textContent).toBe(
      'Pareado com 2 painéis.',
    );

    screen.setStatuses([
      { dashboardId: 'a', state: 'connecting' },
      { dashboardId: 'b', state: 'connected' },
    ]);
    expect(
      target
        .querySelector('[data-testid="dashboard-row-a"] .status-badge')
        ?.classList.contains('status-badge--connecting'),
    ).toBe(true);
    expect(
      target
        .querySelector('[data-testid="dashboard-row-b"] .status-badge')
        ?.classList.contains('status-badge--connected'),
    ).toBe(true);
    screen.unmount();
  });

  test('setPairedDashboards re-renders summary and list', () => {
    const screen = new StreamingScreen({
      stream: buildStream(),
      pairedDashboards: ['x'],
      statuses: [],
    });
    const target = document.createElement('div');
    document.body.appendChild(target);
    screen.mount(target);
    screen.setPairedDashboards(['x', 'y', 'z']);
    expect(target.querySelector('[data-testid="streaming-summary"]')?.textContent).toBe(
      'Pareado com 3 painéis.',
    );
    expect(target.querySelectorAll('[data-testid^="dashboard-row-"]')).toHaveLength(3);
    screen.unmount();
  });

  test('setStream stores the stream and survives non-MediaStream values', () => {
    const screen = new StreamingScreen({
      stream: buildStream(),
      pairedDashboards: [],
      statuses: [],
    });
    const target = document.createElement('div');
    document.body.appendChild(target);
    screen.mount(target);
    const next = buildStream();
    expect(() => screen.setStream(next)).not.toThrow();
    screen.unmount();
  });
});
