import { describe, expect, it, vi } from 'vitest';
import { LiveChatPalette } from '../../../src/ui/LiveChatPalette';
import { createInitialState, type PaletteHandlers, type PaletteState } from '../../../src/ui/state';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';

const handlers = (): PaletteHandlers => ({
  onSelectTab: vi.fn(),
  onToggleCollapse: vi.fn(),
  onOpenOptions: vi.fn(),
  onDismissNotice: vi.fn(),
  onPresetClick: vi.fn(),
  onOpenPresetForm: vi.fn(),
  onClosePresetForm: vi.fn(),
  onSubmitPreset: vi.fn(),
  onEmojiClick: vi.fn(),
  onToggleFavorite: vi.fn(),
  onRemoveFavorite: vi.fn(),
  onRefreshEmojis: vi.fn(),
});

const state = (patch: Partial<PaletteState> = {}): PaletteState => ({
  ...createInitialState('light'),
  context: { channelId: CH_A },
  chatInputAvailable: true,
  ...patch,
});

const mount = () => {
  const host = document.createElement('div');
  document.body.append(host);
  const palette = new LiveChatPalette(host);
  return { host, palette, root: palette.root };
};

describe('LiveChatPalette rendering', () => {
  it('uses a shadow root and injects its own styles', () => {
    const { host, root } = mount();
    expect(host.shadowRoot).toBe(root);
    expect(root.querySelector('style')?.textContent).toContain('.lcp-panel');
  });
  it('every button has an accessible name', () => {
    const { palette, root } = mount();
    palette.render(
      state({
        tab: 'emoji',
        favorites: [
          {
            id: 'f',
            channelId: CH_A,
            familyName: 'fam',
            emojiName: ':_a:',
            displayName: 'A',
            lastSeenAt: 1,
          },
        ],
        availableEmojis: [
          { channelId: CH_A, familyName: 'fam', emojiName: ':_a:', displayName: 'A' },
          { channelId: CH_A, familyName: 'fam', emojiName: ':_b:', displayName: 'B' },
        ],
        emojiScan: 'scanned',
        notice: { kind: 'error', text: 'boom' },
      }),
      handlers(),
    );
    for (const button of root.querySelectorAll('button')) {
      const name = button.getAttribute('aria-label') ?? button.textContent?.trim();
      expect(name, button.outerHTML).toBeTruthy();
    }
    expect(root.querySelector('[data-testid="favorite-emoji"]')?.getAttribute('aria-label')).toBe(
      'Insert A',
    );
    expect(
      [...root.querySelectorAll('[data-testid="favorite-toggle"]')].map((b) =>
        b.getAttribute('aria-label'),
      ),
    ).toEqual(['Remove A from favorites', 'Add B to favorites']);
    expect(root.querySelector('[data-testid="favorite-remove"]')?.getAttribute('aria-label')).toBe(
      'Remove A from favorites',
    );
  });
  it('renders tabs with proper roles and a roving tabindex', () => {
    const { palette, root } = mount();
    palette.render(state({ tab: 'preset' }), handlers());
    const tabs = root.querySelectorAll('[role="tab"]');
    expect(tabs).toHaveLength(2);
    expect(tabs[1]?.getAttribute('aria-selected')).toBe('true');
    expect(tabs[1]?.getAttribute('tabindex')).toBe('0');
    expect(tabs[0]?.getAttribute('tabindex')).toBe('-1');
    expect(root.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(
      'lcp-tab-preset',
    );
  });
  it('renders empty states instead of a blank panel', () => {
    const { palette, root } = mount();
    palette.render(state({ tab: 'preset' }), handlers());
    expect(root.querySelector('[role="status"]')?.textContent).toContain('No message presets yet.');
    palette.render(state({ tab: 'emoji' }), handlers());
    expect(root.querySelector('[role="status"]')?.textContent).toContain('No favorite emojis yet.');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('Refresh emojis');
  });
  it('renders error notices with role=alert and a dismiss control', () => {
    const { palette, root } = mount();
    const h = handlers();
    palette.render(state({ notice: { kind: 'error', text: 'Send failed.' } }), h);
    const notice = root.querySelector('.lcp-notice');
    expect(notice?.getAttribute('role')).toBe('alert');
    notice?.querySelector('button')?.click();
    expect(h.onDismissNotice).toHaveBeenCalled();
  });
  it('hides the body when collapsed and exposes aria-expanded', () => {
    const { palette, root } = mount();
    palette.render(state({ collapsed: true }), handlers());
    expect(root.querySelector('.lcp-body')).toBeNull();
    expect(
      root.querySelector('[data-testid="toggle-collapse"]')?.getAttribute('aria-expanded'),
    ).toBe('false');
  });
  it('restores focus to the same control across re-renders', () => {
    const { palette, root } = mount();
    palette.render(state({ tab: 'preset' }), handlers());
    root.querySelector<HTMLElement>('[data-focus-key="preset-add"]')?.focus();
    palette.render(state({ tab: 'preset', notice: { kind: 'info', text: 'x' } }), handlers());
    expect((root.activeElement as HTMLElement | null)?.dataset.focusKey).toBe('preset-add');
  });
  it('sets the theme on the host', () => {
    const { palette, host } = mount();
    palette.render(state({ theme: 'dark' }), handlers());
    expect(host.dataset.theme).toBe('dark');
    palette.render(state({ theme: 'light' }), handlers());
    expect(host.dataset.theme).toBe('light');
  });
  it('disables preset and emoji buttons while the chat input is unavailable', () => {
    const { palette, root } = mount();
    palette.render(
      state({
        tab: 'preset',
        chatInputAvailable: false,
        presets: [{ id: 'p', text: 'Hi', scope: 'global', order: 0, createdAt: 1, updatedAt: 1 }],
      }),
      handlers(),
    );
    expect(root.querySelector<HTMLButtonElement>('.lcp-preset-chip')?.disabled).toBe(true);
    expect(root.querySelector('.lcp-notice')?.textContent).toContain(
      'chat input could not be recognized',
    );
  });
  it('passes modifier keys to preset and emoji handlers', () => {
    const { palette, root } = mount();
    const h = handlers();
    palette.render(
      state({
        tab: 'preset',
        presets: [{ id: 'p', text: 'Hi', scope: 'global', order: 0, createdAt: 1, updatedAt: 1 }],
      }),
      h,
    );
    root
      .querySelector('.lcp-preset-chip')
      ?.dispatchEvent(new MouseEvent('click', { metaKey: true, bubbles: true }));
    expect(h.onPresetClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'p' }), {
      metaKey: true,
      ctrlKey: false,
    });
  });
});
