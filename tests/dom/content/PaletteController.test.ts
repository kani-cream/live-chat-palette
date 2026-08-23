import { afterEach, describe, expect, it } from 'vitest';
import { ChatActionService } from '../../../src/application/ChatActionService';
import { ContextService } from '../../../src/application/ContextService';
import { EmojiService } from '../../../src/application/EmojiService';
import { PresetService } from '../../../src/application/PresetService';
import { SettingsService } from '../../../src/application/SettingsService';
import { PaletteController } from '../../../src/content/chat/PaletteController';
import type { VideoContext } from '../../../src/domain/context';
import { emojiIdentityKey } from '../../../src/domain/emoji';
import { StorageRepository } from '../../../src/storage/StorageRepository';
import { DomChatInputAdapter } from '../../../src/youtube/ChatInputAdapter';
import { DomEmojiPickerAdapter } from '../../../src/youtube/EmojiPickerAdapter';
import { DomSendButtonAdapter } from '../../../src/youtube/SendButtonAdapter';
import { FakeStorageArea, flushPromises } from '../../helpers/fakeChrome';
import { CH_A, CH_B, EMOJI_CATEGORIES, mountLiveChat } from '../../helpers/liveChatDom';
import type { LiveChatFixtureOptions } from '../../fixtures/liveChatPage';

const VIDEO_A = 'aaaaaaaaaaa';
const VIDEO_B = 'bbbbbbbbbbb';

interface SetupOptions {
  fixture?: LiveChatFixtureOptions;
  context?: VideoContext | null;
  area?: FakeStorageArea;
  ownVideoId?: string | null;
}

const setup = async (options: SetupOptions = {}) => {
  const harness = mountLiveChat({
    harness: { categories: EMOJI_CATEGORIES },
    ...options.fixture,
  });
  const host = document.createElement('div');
  document.body.prepend(host);
  const area = options.area ?? new FakeStorageArea();
  const repo = new StorageRepository(area);
  const chatInput = new DomChatInputAdapter(document);
  const sendButton = new DomSendButtonAdapter(document);
  const emojiPicker = new DomEmojiPickerAdapter(document, chatInput, {
    openTimeoutMs: 200,
    pollIntervalMs: 5,
  });
  let now = 1000;
  const actions = new ChatActionService(chatInput, sendButton, emojiPicker, { clock: () => now });
  const contextListeners = new Set<(c: VideoContext) => void>();
  const contextService = new ContextService({
    request: () =>
      Promise.resolve(
        options.context === undefined ? { videoId: VIDEO_A, channelId: CH_A } : options.context,
      ),
    subscribe: (l) => {
      contextListeners.add(l);
      return () => contextListeners.delete(l);
    },
    ownVideoId: options.ownVideoId ?? null,
  });
  const opened: number[] = [];
  const controller = new PaletteController({
    host,
    doc: document,
    win: window,
    repo,
    presets: new PresetService(repo),
    emojis: new EmojiService(repo),
    settings: new SettingsService(repo),
    actions,
    emojiPicker,
    contextService,
    openOptions: () => opened.push(1),
  });
  await controller.start();
  await flushPromises();
  const shadow = host.shadowRoot;
  if (!shadow) throw new Error('shadow root missing');
  const q = <T extends HTMLElement = HTMLElement>(selector: string): T | null =>
    shadow.querySelector<T>(selector);
  const qa = <T extends HTMLElement = HTMLElement>(selector: string): T[] => [
    ...shadow.querySelectorAll<T>(selector),
  ];
  const click = (el: HTMLElement | null, init: MouseEventInit = {}) => {
    if (!el) throw new Error('element missing');
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, ...init }));
  };
  const broadcast = (context: VideoContext) => {
    for (const l of contextListeners) l(context);
  };
  const settle = async (ms = 20) => {
    await flushPromises();
    await new Promise((r) => setTimeout(r, ms));
    await flushPromises();
  };
  return {
    controller,
    harness,
    host,
    shadow,
    q,
    qa,
    click,
    broadcast,
    settle,
    repo,
    area,
    opened,
    advance: (ms: number) => {
      now += ms;
    },
    presets: new PresetService(repo),
    emojis: new EmojiService(repo),
  };
};

const addPresetViaForm = async (
  t: Awaited<ReturnType<typeof setup>>,
  text: string,
  scope: 'global' | 'channel' = 'global',
) => {
  t.click(t.q('[data-testid="tab-preset"]'));
  t.click(t.q('[data-focus-key="preset-add"]'));
  const textarea = t.q<HTMLTextAreaElement>('[data-testid="preset-form-text"]');
  const select = t.q<HTMLSelectElement>('[data-testid="preset-form-scope"]');
  if (!textarea || !select) throw new Error('form missing');
  textarea.value = text;
  select.value = scope;
  t.q<HTMLFormElement>('[data-testid="preset-form"]')?.dispatchEvent(
    new Event('submit', { cancelable: true }),
  );
  await t.settle();
};

describe('PaletteController – mount & shell', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('renders inside a shadow root with tabs, settings and collapse controls', async () => {
    const t = await setup();
    expect(t.host.shadowRoot).not.toBeNull();
    expect(t.q('[role="tablist"]')).not.toBeNull();
    expect(t.qa('[role="tab"]').map((b) => b.textContent)).toEqual(['Emojis', 'Presets']);
    expect(t.q('[data-testid="open-settings"]')?.getAttribute('aria-label')).toBe('Open settings');
    expect(t.q('[data-testid="toggle-collapse"]')?.getAttribute('aria-label')).toBe(
      'Collapse Live Chat Palette',
    );
    t.controller.dispose();
  });
  it('opens the options page through the provided port', async () => {
    const t = await setup();
    t.click(t.q('[data-testid="open-settings"]'));
    expect(t.opened).toHaveLength(1);
    t.controller.dispose();
  });
  it('switches tabs (click and arrow keys) and persists the selection', async () => {
    const t = await setup();
    expect(t.q('[data-testid="emoji-panel"]')).not.toBeNull();
    t.click(t.q('[data-testid="tab-preset"]'));
    expect(t.q('[data-testid="preset-panel"]')).not.toBeNull();
    await t.settle();
    expect((await t.repo.load()).settings.lastSelectedTab).toBe('preset');
    t.q('[data-testid="tab-preset"]')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    expect(t.q('[data-testid="emoji-panel"]')).not.toBeNull();
    t.controller.dispose();
  });
  it('collapses/expands and persists the state', async () => {
    const t = await setup();
    t.click(t.q('[data-testid="toggle-collapse"]'));
    expect(t.q('.lcp-body')).toBeNull();
    expect(t.q('[data-testid="toggle-collapse"]')?.getAttribute('aria-expanded')).toBe('false');
    await t.settle();
    expect((await t.repo.load()).settings.collapsed).toBe(true);
    t.click(t.q('[data-testid="toggle-collapse"]'));
    expect(t.q('.lcp-body')).not.toBeNull();
    t.controller.dispose();
  });
  it('applies the YouTube theme and follows changes', async () => {
    document.documentElement.setAttribute('dark', '');
    const t = await setup();
    expect(t.host.dataset.theme).toBe('dark');
    document.documentElement.removeAttribute('dark');
    await t.settle();
    expect(t.host.dataset.theme).toBe('light');
    t.controller.dispose();
  });
  it('shows the chat-unsupported state when the input cannot be recognized', async () => {
    const t = await setup({ fixture: { withoutInput: true } });
    expect(t.q('.lcp-notice')?.textContent).toContain(
      "YouTube's chat input could not be recognized",
    );
    t.controller.dispose();
  });
  it('stops rendering after dispose', async () => {
    const t = await setup();
    t.controller.dispose();
    expect(t.shadow.querySelector('.lcp-panel')?.childElementCount).toBe(0);
    await t.presets.add({ text: 'x', scope: 'global' });
    await t.settle();
    expect(t.shadow.querySelector('.lcp-panel')?.childElementCount).toBe(0);
  });
});

describe('PaletteController – presets', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows an actionable empty state and adds a preset from the palette', async () => {
    const t = await setup();
    t.click(t.q('[data-testid="tab-preset"]'));
    expect(t.q('[role="status"]')?.textContent).toContain('No message presets yet.');
    expect(t.q('[data-focus-key="preset-add"]')).not.toBeNull();
    await addPresetViaForm(t, 'Cute!');
    expect(t.qa('.lcp-preset-chip').map((b) => b.textContent)).toEqual(['Cute!']);
    expect((await t.repo.load()).presets[0]?.text).toBe('Cute!');
    t.controller.dispose();
  });
  it('rejects an empty preset with a visible error', async () => {
    const t = await setup();
    await addPresetViaForm(t, '');
    expect(t.q('.lcp-notice[data-kind="error"]')?.textContent).toContain('must not be empty');
    t.controller.dispose();
  });
  it('normal click inserts only; Cmd/Ctrl+Click inserts and sends once', async () => {
    const t = await setup();
    await addPresetViaForm(t, 'Hello');
    t.click(t.q('.lcp-preset-chip'));
    expect(t.harness.readInput()).toBe('Hello');
    expect(t.harness.state.sent).toEqual([]);
    t.click(t.q('.lcp-preset-chip'), { metaKey: true });
    expect(t.harness.state.sent).toEqual(['HelloHello']);
    expect(t.harness.readInput()).toBe('');
    t.advance(1000);
    t.click(t.q('.lcp-preset-chip'), { ctrlKey: true });
    expect(t.harness.state.sent).toEqual(['HelloHello', 'Hello']);
    t.controller.dispose();
  });
  it('presetInstantSend makes a normal click send', async () => {
    const t = await setup();
    await addPresetViaForm(t, 'Hi');
    await t.repo.update((s) => ({ ...s, settings: { ...s.settings, presetInstantSend: true } }));
    await t.settle();
    expect(t.q('.lcp-hint')?.textContent).toContain('Instant send is on');
    t.click(t.q('.lcp-preset-chip'));
    expect(t.harness.state.sent).toEqual(['Hi']);
    t.controller.dispose();
  });
  it('blocks a second send within the lock window (double click), then allows it', async () => {
    const t = await setup();
    await addPresetViaForm(t, 'Hi');
    t.click(t.q('.lcp-preset-chip'), { metaKey: true });
    t.click(t.q('.lcp-preset-chip'), { metaKey: true });
    expect(t.harness.state.sent).toEqual(['Hi']);
    expect(t.harness.readInput()).toBe('');
    expect(t.q('.lcp-notice')?.textContent).toContain('wait a moment');
    t.advance(800);
    t.click(t.q('.lcp-preset-chip'), { metaKey: true });
    expect(t.harness.state.sent).toEqual(['Hi', 'Hi']);
    t.controller.dispose();
  });
  it('does not send when the native send is unavailable and keeps the draft', async () => {
    const t = await setup({ fixture: { withoutSendButton: true } });
    await addPresetViaForm(t, 'Hi');
    t.click(t.q('.lcp-preset-chip'), { metaKey: true });
    expect(t.harness.readInput()).toBe('Hi');
    expect(t.harness.state.sent).toEqual([]);
    expect(t.q('.lcp-notice[data-kind="error"]')?.textContent).toContain('could not be sent');
    t.controller.dispose();
  });
  it('does not retry and keeps the draft when YouTube silently fails to send', async () => {
    const t = await setup({
      fixture: { harness: { categories: EMOJI_CATEGORIES, sendFails: true } },
    });
    await addPresetViaForm(t, 'Hi');
    t.click(t.q('.lcp-preset-chip'), { metaKey: true });
    t.advance(1000);
    await t.settle(50);
    expect(t.harness.state.sendClicks).toBe(1);
    expect(t.harness.state.sent).toEqual([]);
    expect(t.harness.readInput()).toBe('Hi');
    t.controller.dispose();
  });
  it('inserts at the caret and replaces selections without adding whitespace', async () => {
    const t = await setup({
      fixture: { initialDraft: 'This is great today', harness: { categories: EMOJI_CATEGORIES } },
    });
    await addPresetViaForm(t, 'amazing');
    t.harness.select(8, 13);
    t.click(t.q('.lcp-preset-chip'));
    expect(t.harness.readInput()).toBe('This is amazing today');
    t.controller.dispose();
  });
  it('keeps global presets but hides channel presets when the channel is unknown', async () => {
    const area = new FakeStorageArea();
    const seed = new PresetService(new StorageRepository(area));
    await seed.add({ text: 'global', scope: 'global' });
    await seed.add({ text: 'for A', scope: 'channel', channelId: CH_A });
    const t = await setup({ area, context: { videoId: VIDEO_A } });
    t.click(t.q('[data-testid="tab-preset"]'));
    expect(t.qa('.lcp-preset-chip').map((b) => b.textContent)).toEqual(['global']);
    t.click(t.q('[data-focus-key="preset-add"]'));
    const channelOption = t.q<HTMLOptionElement>(
      '[data-testid="preset-form-scope"] option[value="channel"]',
    );
    expect(channelOption?.disabled).toBe(true);
    t.controller.dispose();
  });
  it('switches channel presets on SPA navigation and does not keep channel A presets', async () => {
    const area = new FakeStorageArea();
    const seed = new PresetService(new StorageRepository(area));
    await seed.add({ text: 'global', scope: 'global' });
    await seed.add({ text: 'for A', scope: 'channel', channelId: CH_A });
    await seed.add({ text: 'for B', scope: 'channel', channelId: CH_B });
    const t = await setup({ area });
    t.click(t.q('[data-testid="tab-preset"]'));
    expect(t.qa('.lcp-preset-chip').map((b) => b.textContent)).toEqual(['global', 'for A']);
    t.broadcast({ videoId: VIDEO_B, channelId: CH_B });
    await t.settle();
    expect(t.qa('.lcp-preset-chip').map((b) => b.textContent)).toEqual(['global', 'for B']);
    t.controller.dispose();
  });
  it('reflects preset changes made elsewhere (options page) live', async () => {
    const t = await setup();
    t.click(t.q('[data-testid="tab-preset"]'));
    await t.presets.add({ text: 'from options', scope: 'global' });
    await t.settle();
    expect(t.qa('.lcp-preset-chip').map((b) => b.textContent)).toEqual(['from options']);
    t.controller.dispose();
  });
});

describe('PaletteController – emojis', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows the emoji empty state with a refresh action', async () => {
    const t = await setup();
    expect(t.q('[role="status"]')?.textContent).toContain('No favorite emojis yet.');
    expect(t.q('[data-focus-key="emoji-refresh"]')?.textContent).toBe('Refresh emojis');
    t.controller.dispose();
  });
  it('refresh discovers custom emojis via the native picker and closes it afterwards', async () => {
    const t = await setup();
    t.click(t.q('[data-focus-key="emoji-refresh"]'));
    await t.settle(50);
    expect(t.qa('[data-testid="available-emoji"]')).toHaveLength(3);
    expect(t.harness.pickerOpen()).toBe(false);
    expect(t.harness.state.pickerOpens).toBe(1);
    t.controller.dispose();
  });
  it('auto-scans on load only when the picker is already rendered', async () => {
    const t = await setup({
      fixture: {
        pickerPreRendered: true,
        pickerHidden: true,
        harness: { categories: EMOJI_CATEGORIES },
      },
    });
    expect(t.qa('[data-testid="available-emoji"]')).toHaveLength(3);
    expect(t.harness.state.pickerOpens).toBe(0);
    t.controller.dispose();
  });
  it('favorites and unfavorites emojis; favorite click inserts only (even with Cmd/Ctrl)', async () => {
    const t = await setup();
    t.click(t.q('[data-focus-key="emoji-refresh"]'));
    await t.settle(50);
    t.click(t.qa('[data-testid="favorite-toggle"]')[0] ?? null);
    await t.settle();
    expect(t.qa('[data-testid="favorite-emoji"]')).toHaveLength(1);
    expect((await t.repo.load()).favoriteEmojis[0]).toMatchObject({
      channelId: CH_A,
      emojiName: ':_wave:',
    });
    t.click(t.q('[data-testid="favorite-emoji"]'), { metaKey: true, ctrlKey: true });
    await t.settle(50);
    expect(t.harness.readInput()).toBe(':_wave:');
    expect(t.harness.state.sent).toEqual([]);
    expect(t.harness.state.sendClicks).toBe(0);
    t.click(t.q('[data-testid="favorite-remove"]'));
    await t.settle();
    expect(t.qa('[data-testid="favorite-emoji"]')).toHaveLength(0);
    expect((await t.repo.load()).favoriteEmojis).toEqual([]);
    t.controller.dispose();
  });
  it('disables favorites that are no longer available and fails closed on click', async () => {
    const area = new FakeStorageArea();
    await new EmojiService(new StorageRepository(area)).addFavorite({
      channelId: CH_A,
      familyName: 'Channel A members',
      emojiName: ':_gone:',
      displayName: ':_gone:',
    });
    const t = await setup({
      area,
      fixture: {
        pickerPreRendered: true,
        pickerHidden: true,
        harness: { categories: EMOJI_CATEGORIES },
      },
    });
    const button = t.q<HTMLButtonElement>('[data-testid="favorite-emoji"]');
    expect(button?.disabled).toBe(true);
    expect(button?.dataset.unavailable).toBe('true');
    expect(button?.getAttribute('aria-label')).toContain('Currently unavailable');
    expect(t.harness.readInput()).toBe('');
    t.controller.dispose();
  });
  it('reports an unavailable favorite when the picker was not scanned yet', async () => {
    const area = new FakeStorageArea();
    await new EmojiService(new StorageRepository(area)).addFavorite({
      channelId: CH_A,
      familyName: 'Channel A members',
      emojiName: ':_gone:',
      displayName: ':_gone:',
    });
    const t = await setup({ area });
    t.click(t.q('[data-testid="favorite-emoji"]'));
    await t.settle(50);
    expect(t.q('.lcp-notice[data-kind="error"]')?.textContent).toContain('not currently available');
    expect(t.harness.readInput()).toBe('');
    t.controller.dispose();
  });
  it('scopes favorites per channel and resets discovered emojis on navigation', async () => {
    const area = new FakeStorageArea();
    const emojis = new EmojiService(new StorageRepository(area));
    await emojis.addFavorite({
      channelId: CH_A,
      familyName: 'Channel A members',
      emojiName: ':_wave:',
      displayName: 'wave',
    });
    await emojis.addFavorite({
      channelId: CH_B,
      familyName: 'Other',
      emojiName: ':_b:',
      displayName: 'b',
    });
    const t = await setup({ area });
    t.click(t.q('[data-focus-key="emoji-refresh"]'));
    await t.settle(50);
    expect(t.qa('[data-testid="favorite-emoji"]').map((b) => b.dataset.emojiKey)).toEqual([
      emojiIdentityKey({ channelId: CH_A, familyName: 'Channel A members', emojiName: ':_wave:' }),
    ]);
    expect(t.qa('[data-testid="available-emoji"]')).toHaveLength(3);
    t.broadcast({ videoId: VIDEO_B, channelId: CH_B });
    await t.settle();
    expect(t.qa('[data-testid="favorite-emoji"]').map((b) => b.dataset.emojiKey)).toEqual([
      emojiIdentityKey({ channelId: CH_B, familyName: 'Other', emojiName: ':_b:' }),
    ]);
    t.controller.dispose();
  });
  it('shows the channel-unknown state for emojis', async () => {
    const t = await setup({ context: { videoId: VIDEO_A } });
    expect(t.q('[role="status"]')?.textContent).toContain(
      'Channel information could not be determined',
    );
    expect(t.q('[data-focus-key="emoji-refresh"]')).toBeNull();
    t.controller.dispose();
  });
  it('shows the emoji-unsupported state when the picker cannot be opened', async () => {
    const t = await setup({
      fixture: { harness: { categories: EMOJI_CATEGORIES, pickerNeverRenders: true } },
    });
    t.click(t.q('[data-focus-key="emoji-refresh"]'));
    await t.settle(300);
    expect(t.q('.lcp-notice[data-kind="error"]')?.textContent).toContain(
      'Custom emojis are currently unavailable',
    );
    t.controller.dispose();
  });
});
