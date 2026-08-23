import { describe, expect, it } from 'vitest';
import { DomChatInputAdapter } from '../../../src/youtube/ChatInputAdapter';
import { DomEmojiPickerAdapter, isCustomEmojiImage } from '../../../src/youtube/EmojiPickerAdapter';
import { CH_A, EMOJI_CATEGORIES, mountLiveChat } from '../../helpers/liveChatDom';

const adapter = () =>
  new DomEmojiPickerAdapter(document, new DomChatInputAdapter(document), {
    openTimeoutMs: 200,
    pollIntervalMs: 5,
  });

const WAVE_A = { channelId: CH_A, familyName: 'Channel A members', emojiName: ':_wave:' };

describe('isCustomEmojiImage', () => {
  const img = (attrs: Record<string, string>): HTMLImageElement => {
    const el = document.createElement('img');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  it('recognizes channel-owned ids and :_shortcodes:', () => {
    expect(isCustomEmojiImage(img({ 'data-emoji-id': `${CH_A}/abc` }))).toBe(true);
    expect(isCustomEmojiImage(img({ alt: ':_hello:' }))).toBe(true);
  });
  it('rejects standard emojis', () => {
    expect(isCustomEmojiImage(img({ 'data-emoji-id': '😀', alt: '😀' }))).toBe(false);
    expect(isCustomEmojiImage(img({ alt: ':smile:' }))).toBe(false);
  });
});

describe('DomEmojiPickerAdapter.scanAvailableEmojis', () => {
  it('fails when the picker is not rendered', () => {
    mountLiveChat();
    const result = adapter().scanAvailableEmojis(CH_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMOJI_PICKER_NOT_RENDERED');
  });
  it('detects custom emojis with family names and skips standard emojis', () => {
    mountLiveChat({ pickerPreRendered: true, harness: { categories: EMOJI_CATEGORIES } });
    const result = adapter().scanAvailableEmojis(CH_A);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      {
        channelId: CH_A,
        familyName: 'Channel A members',
        emojiName: ':_wave:',
        displayName: ':_wave:',
        imageUrl: 'https://img.example/a/wave.png',
      },
      {
        channelId: CH_A,
        familyName: 'Channel A members',
        emojiName: ':_heart:',
        displayName: ':_heart:',
        imageUrl: 'https://img.example/a/heart.png',
      },
      {
        channelId: CH_A,
        familyName: 'Other family',
        emojiName: ':_wave:',
        displayName: ':_wave:',
        imageUrl: 'https://img.example/b/wave.png',
      },
    ]);
  });
  it('uses the aria-label shortcode as the name and alt as the display name (real markup)', () => {
    // Mirrors a real member emoji: aria-label=":_スバルわたあめうさぎ:", alt="スバルわたあめうさぎ".
    mountLiveChat({
      pickerPreRendered: true,
      harness: {
        categories: [
          {
            name: 'Subaru Ch. 大空スバル',
            custom: true,
            emojis: [
              {
                name: 'スバルわたあめうさぎ',
                shortcode: ':_スバルわたあめうさぎ:',
                id: `${CH_A}/dedVXKPOM5m7`,
                src: 'https://yt3.ggpht.com/x',
              },
            ],
          },
        ],
      },
    });
    const result = adapter().scanAvailableEmojis(CH_A);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      {
        channelId: CH_A,
        familyName: 'Subaru Ch. 大空スバル',
        emojiName: ':_スバルわたあめうさぎ:',
        displayName: 'スバルわたあめうさぎ',
        imageUrl: 'https://yt3.ggpht.com/x',
      },
    ]);
  });
  it('excludes non-custom (global/unicode) categories', () => {
    mountLiveChat({
      pickerPreRendered: true,
      harness: {
        categories: [
          {
            name: 'YouTube',
            emojis: [
              { name: 'hand-pink-waving', id: 'UCkszU2WH9gy1mb0dV-11UJg/x', src: 'https://x/1' },
            ],
          },
          {
            name: 'Members',
            custom: true,
            emojis: [{ name: ':_ok:', id: `${CH_A}/ok`, src: 'https://x/2' }],
          },
        ],
      },
    });
    const result = adapter().scanAvailableEmojis(CH_A);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((e) => e.familyName)).toEqual(['Members']);
    }
  });
  it('works on a hidden (closed) picker without opening it', () => {
    mountLiveChat({
      pickerPreRendered: true,
      pickerHidden: true,
      harness: { categories: EMOJI_CATEGORIES },
    });
    const a = adapter();
    expect(a.isPickerRendered()).toBe(true);
    expect(a.isPickerOpen()).toBe(false);
    expect(a.scanAvailableEmojis(CH_A).ok).toBe(true);
  });
  it('skips images without a name and tolerates missing category titles', () => {
    mountLiveChat({ pickerPreRendered: true, harness: { categories: EMOJI_CATEGORIES } });
    document.querySelector('yt-emoji-picker-category-renderer #title')?.remove();
    const nameless = document.createElement('img');
    nameless.className = 'emoji';
    nameless.setAttribute('data-emoji-id', `${CH_A}/x`);
    document.querySelector('yt-emoji-picker-category-renderer #emoji')?.append(nameless);
    const result = adapter().scanAvailableEmojis(CH_A);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.filter((e) => e.familyName === '')).toHaveLength(2);
      expect(result.value.some((e) => e.emojiName === '')).toBe(false);
    }
  });
  it('fails closed when several pickers exist', () => {
    mountLiveChat({ pickerPreRendered: true, harness: { categories: EMOJI_CATEGORIES } });
    const picker = document.querySelector('yt-emoji-picker-renderer');
    picker?.parentElement?.append(picker.cloneNode(true));
    expect(adapter().scanAvailableEmojis(CH_A).ok).toBe(false);
  });
});

describe('DomEmojiPickerAdapter.resolveEmoji', () => {
  it('resolves by logical identity even when the image URL changed', () => {
    mountLiveChat({ pickerPreRendered: true, harness: { categories: EMOJI_CATEGORIES } });
    const result = adapter().resolveEmoji(WAVE_A);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.imageUrl).toBe('https://img.example/a/wave.png');
  });
  it('does not resolve an emoji whose family differs or that was removed', () => {
    mountLiveChat({ pickerPreRendered: true, harness: { categories: EMOJI_CATEGORIES } });
    expect(adapter().resolveEmoji({ ...WAVE_A, familyName: 'Nope' }).ok).toBe(false);
    expect(adapter().resolveEmoji({ ...WAVE_A, emojiName: ':_removed:' }).ok).toBe(false);
  });
});

describe('DomEmojiPickerAdapter.openPicker / closePicker', () => {
  it('opens and closes via the native toggle', async () => {
    const harness = mountLiveChat({ harness: { categories: EMOJI_CATEGORIES } });
    const a = adapter();
    expect((await a.openPicker()).ok).toBe(true);
    expect(a.isPickerOpen()).toBe(true);
    expect(harness.pickerOpen()).toBe(true);
    await a.closePicker();
    expect(a.isPickerOpen()).toBe(false);
    expect(a.isPickerRendered()).toBe(true);
  });
  it('fails when the toggle is missing', async () => {
    mountLiveChat({ withoutEmojiToggle: true });
    const result = await adapter().openPicker();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMOJI_TOGGLE_NOT_FOUND');
  });
  it('fails when the picker never renders', async () => {
    mountLiveChat({ harness: { pickerNeverRenders: true } });
    const result = await adapter().openPicker();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMOJI_PICKER_NOT_OPENED');
  });
});

describe('DomEmojiPickerAdapter.insertEmoji', () => {
  it('clicks the native emoji image so YouTube inserts it, then closes the picker it opened', async () => {
    const harness = mountLiveChat({ harness: { categories: EMOJI_CATEGORIES } });
    const a = adapter();
    const result = await a.insertEmoji(WAVE_A);
    expect(result.ok).toBe(true);
    expect(harness.readInput()).toBe(':_wave:');
    expect(a.isPickerOpen()).toBe(false);
    expect(harness.state.sent).toEqual([]);
  });
  it('leaves the picker open if the user had it open', async () => {
    const harness = mountLiveChat({
      pickerPreRendered: true,
      harness: { categories: EMOJI_CATEGORIES },
    });
    const a = adapter();
    expect(a.isPickerOpen()).toBe(true);
    await a.insertEmoji(WAVE_A);
    expect(a.isPickerOpen()).toBe(true);
    expect(harness.readInput()).toBe(':_wave:');
  });
  it('inserts at the caret and supports repeated composition', async () => {
    const harness = mountLiveChat({
      pickerPreRendered: true,
      harness: { categories: EMOJI_CATEGORIES },
      initialDraft: 'ab',
    });
    harness.select(1);
    await adapter().insertEmoji(WAVE_A);
    await adapter().insertEmoji({ ...WAVE_A, emojiName: ':_heart:' });
    expect(harness.readInput()).toBe('a:_wave::_heart:b');
  });
  it('fails closed for an unavailable emoji and never fabricates an image', async () => {
    const harness = mountLiveChat({
      pickerPreRendered: true,
      harness: { categories: EMOJI_CATEGORIES },
    });
    const result = await adapter().insertEmoji({ ...WAVE_A, emojiName: ':_gone:' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMOJI_UNAVAILABLE');
    expect(harness.readInput()).toBe('');
    expect(document.querySelector('#input img')).toBeNull();
  });
  it('fails closed when the picker cannot be opened', async () => {
    mountLiveChat({ harness: { pickerNeverRenders: true } });
    const result = await adapter().insertEmoji(WAVE_A);
    expect(result.ok).toBe(false);
  });
  it('fails when the input is missing', async () => {
    mountLiveChat({
      withoutInput: true,
      pickerPreRendered: true,
      harness: { categories: EMOJI_CATEGORIES },
    });
    const result = await adapter().insertEmoji(WAVE_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INPUT_NOT_FOUND');
  });
  it('reports INSERT_UNCONFIRMED when the native click does not change the editor', async () => {
    mountLiveChat({ pickerPreRendered: true, harness: { categories: EMOJI_CATEGORIES } });
    for (const img of document.querySelectorAll('yt-emoji-picker-renderer img')) {
      img.replaceWith(img.cloneNode(true)); // drop the harness click listener
    }
    const result = await adapter().insertEmoji(WAVE_A);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSERT_UNCONFIRMED');
  });
});
