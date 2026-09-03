import { describe, expect, it, vi } from 'vitest';
import { LiveChatPalette } from '../../../src/ui/LiveChatPalette';
import type { MessagePreset } from '../../../src/domain/preset';
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
  onPresetFormInput: vi.fn(),
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
        globalPresets: [
          { id: 'p', text: 'Hi', scope: 'global', order: 0, createdAt: 1, updatedAt: 1 },
        ],
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
        globalPresets: [
          { id: 'p', text: 'Hi', scope: 'global', order: 0, createdAt: 1, updatedAt: 1 },
        ],
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

describe('LiveChatPalette preset sections', () => {
  const globalPreset = (id: string, order: number): MessagePreset => ({
    id,
    text: `global ${id}`,
    scope: 'global',
    order,
    createdAt: 1,
    updatedAt: 1,
  });
  const channelPreset = (id: string, order: number): MessagePreset => ({
    id,
    text: `channel ${id}`,
    scope: 'channel',
    channelId: CH_A,
    order,
    createdAt: 1,
    updatedAt: 1,
  });
  const sectionIds = (root: ShadowRoot): string[] =>
    [...root.querySelectorAll<HTMLElement>('[data-testid^="preset-section-"]')].map(
      (el) => el.dataset.testid ?? '',
    );
  const chipTexts = (el: ParentNode | null): string[] =>
    [...(el?.querySelectorAll('.lcp-preset-chip') ?? [])].map((b) => b.textContent ?? '');

  it('renders "This channel" before "All channels" when both scopes are present', () => {
    const { palette, root } = mount();
    palette.render(
      state({
        tab: 'preset',
        channelPresets: [channelPreset('c1', 0), channelPreset('c2', 1)],
        globalPresets: [globalPreset('g1', 0), globalPreset('g2', 1)],
      }),
      handlers(),
    );
    expect(sectionIds(root)).toEqual(['preset-section-channel', 'preset-section-global']);
    const channel = root.querySelector('[data-testid="preset-section-channel"]');
    const global = root.querySelector('[data-testid="preset-section-global"]');
    expect(channel?.querySelector('.lcp-section-title')?.textContent).toContain('This channel');
    expect(global?.querySelector('.lcp-section-title')?.textContent).toContain('All channels');
    expect(chipTexts(channel)).toEqual(['channel c1', 'channel c2']);
    expect(chipTexts(global)).toEqual(['global g1', 'global g2']);
    // Overall DOM order: every channel chip precedes every global chip.
    expect(chipTexts(root)).toEqual(['channel c1', 'channel c2', 'global g1', 'global g2']);
  });
  it('labels each section as a group for assistive technology', () => {
    const { palette, root } = mount();
    palette.render(
      state({
        tab: 'preset',
        channelPresets: [channelPreset('c1', 0)],
        globalPresets: [globalPreset('g1', 0)],
      }),
      handlers(),
    );
    for (const section of root.querySelectorAll<HTMLElement>('[data-testid^="preset-section-"]')) {
      expect(section.getAttribute('role')).toBe('group');
      const labelId = section.getAttribute('aria-labelledby');
      expect(labelId).toBeTruthy();
      expect(root.getElementById(labelId ?? '')).not.toBeNull();
    }
  });
  it('renders the channel name as secondary text when it is known', () => {
    const { palette, root } = mount();
    palette.render(
      state({
        tab: 'preset',
        context: { channelId: CH_A, channelName: 'Channel A' },
        channelPresets: [channelPreset('c1', 0)],
      }),
      handlers(),
    );
    expect(
      root.querySelector('[data-testid="preset-section-channel"] .lcp-section-subtitle')
        ?.textContent,
    ).toBe('Channel A');
  });
  it('omits the secondary text when the channel name is unknown', () => {
    const { palette, root } = mount();
    palette.render(state({ tab: 'preset', channelPresets: [channelPreset('c1', 0)] }), handlers());
    expect(root.querySelector('.lcp-section-subtitle')).toBeNull();
  });
  it('hides the "This channel" section when only global presets exist', () => {
    const { palette, root } = mount();
    palette.render(state({ tab: 'preset', globalPresets: [globalPreset('g1', 0)] }), handlers());
    expect(sectionIds(root)).toEqual(['preset-section-global']);
    expect(chipTexts(root)).toEqual(['global g1']);
  });
  it('hides the "All channels" section when only channel presets exist', () => {
    const { palette, root } = mount();
    palette.render(state({ tab: 'preset', channelPresets: [channelPreset('c1', 0)] }), handlers());
    expect(sectionIds(root)).toEqual(['preset-section-channel']);
    expect(chipTexts(root)).toEqual(['channel c1']);
  });
  it('shows the empty state (no section headings) when neither scope has presets', () => {
    const { palette, root } = mount();
    palette.render(state({ tab: 'preset' }), handlers());
    expect(sectionIds(root)).toEqual([]);
    expect(root.querySelector('[role="status"]')?.textContent).toContain('No message presets yet.');
  });
  it('shows only global presets when the channel is unknown (fail closed)', () => {
    const { palette, root } = mount();
    palette.render(
      state({ tab: 'preset', context: {}, globalPresets: [globalPreset('g1', 0)] }),
      handlers(),
    );
    expect(sectionIds(root)).toEqual(['preset-section-global']);
    expect(root.querySelector('[data-testid="preset-section-channel"]')).toBeNull();
  });
  it('keeps chips ordered per scope regardless of overlapping order values', () => {
    const { palette, root } = mount();
    palette.render(
      state({
        tab: 'preset',
        // Both scopes legitimately start at order 0 — they are independent ordering scopes.
        channelPresets: [channelPreset('c1', 0), channelPreset('c2', 1)],
        globalPresets: [globalPreset('g1', 0), globalPreset('g2', 1)],
      }),
      handlers(),
    );
    expect(chipTexts(root)).toEqual(['channel c1', 'channel c2', 'global g1', 'global g2']);
  });
  it('keeps the preset click contract inside sections (modifiers passed through)', () => {
    const { palette, root } = mount();
    const h = handlers();
    palette.render(
      state({
        tab: 'preset',
        channelPresets: [channelPreset('c1', 0)],
        globalPresets: [globalPreset('g1', 0)],
      }),
      h,
    );
    root
      .querySelector('[data-testid="preset-section-channel"] .lcp-preset-chip')
      ?.dispatchEvent(new MouseEvent('click', { ctrlKey: true, bubbles: true }));
    expect(h.onPresetClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }), {
      metaKey: false,
      ctrlKey: true,
    });
  });
});
