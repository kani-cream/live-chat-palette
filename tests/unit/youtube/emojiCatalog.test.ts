import { describe, expect, it } from 'vitest';
import { extractPickerEmojis } from '../../../src/youtube/emojiCatalog';

const CH = 'UCvzGlP9oQwU--Y0r9id_jnA';

// Mirrors the real ytInitialData shape verified on a live stream: an emojiPickerRenderer with
// wrapped categories (emojiPickerCategoryRenderer) whose emojiIds resolve against a flat emojis map.
const initialData = (extra: Record<string, unknown> = {}) => ({
  contents: {
    liveChatRenderer: {
      emojiPickerRenderer: {
        categories: [
          {
            emojiPickerCategoryRenderer: {
              categoryId: 'c1',
              title: { simpleText: 'Subaru Ch. 大空スバル' },
              categoryType: 'CATEGORY_TYPE_CUSTOM',
              emojiIds: [`${CH}/wave`, `${CH}/heart`],
            },
          },
          {
            emojiPickerCategoryRenderer: {
              categoryId: 'yt',
              title: { simpleText: 'YouTube' },
              categoryType: 'CATEGORY_TYPE_GLOBAL',
              emojiIds: ['UCkszU2WH9gy1mb0dV-11UJg/x'],
            },
          },
          {
            emojiPickerCategoryRenderer: {
              categoryId: 'u',
              title: { runs: [{ text: 'Smileys' }] },
              categoryType: 'CATEGORY_TYPE_UNICODE_EMOJI',
              emojiIds: ['/grin'],
            },
          },
        ],
      },
      emojis: [
        {
          emojiId: `${CH}/wave`,
          shortcuts: [':スバルwave:', ':_スバルわたあめうさぎ:', ':_wave:'],
          image: {
            thumbnails: [
              { url: 'https://yt3.ggpht.com/small=w24', width: 24 },
              { url: 'https://yt3.ggpht.com/big=w48', width: 48 },
            ],
            accessibility: { accessibilityData: { label: 'スバルわたあめうさぎ' } },
          },
          isCustomEmoji: true,
        },
        {
          emojiId: `${CH}/heart`,
          shortcuts: [':_heart:'],
          image: { thumbnails: [{ url: 'https://yt3.ggpht.com/heart' }] },
          isCustomEmoji: true,
        },
        {
          emojiId: 'UCkszU2WH9gy1mb0dV-11UJg/x',
          shortcuts: [':globalthing:'],
          image: { thumbnails: [{ url: 'https://yt3.ggpht.com/global' }] },
          isCustomEmoji: false,
        },
      ],
      ...extra,
    },
  },
});

describe('extractPickerEmojis', () => {
  it('extracts custom (member) and global (official stamp) emojis, ignoring unicode ones', () => {
    const emojis = extractPickerEmojis(initialData());
    expect(emojis).toEqual([
      {
        channelId: CH,
        familyName: 'Subaru Ch. 大空スバル',
        emojiName: ':_スバルわたあめうさぎ:', // the first :_ shortcode, not the leading : one
        displayName: 'スバルわたあめうさぎ',
        imageUrl: 'https://yt3.ggpht.com/big=w48', // the largest (last) thumbnail
      },
      {
        channelId: CH,
        familyName: 'Subaru Ch. 大空スバル',
        emojiName: ':_heart:',
        displayName: ':_heart:', // no accessibility label -> falls back to the shortcode
        imageUrl: 'https://yt3.ggpht.com/heart',
      },
      {
        channelId: 'UCkszU2WH9gy1mb0dV-11UJg',
        familyName: 'YouTube',
        emojiName: ':globalthing:',
        displayName: ':globalthing:',
        imageUrl: 'https://yt3.ggpht.com/global',
        global: true, // official stamps are marked global (usable on every channel)
      },
    ]);
  });
  it('returns [] for missing/garbage data', () => {
    expect(extractPickerEmojis(undefined)).toEqual([]);
    expect(extractPickerEmojis({})).toEqual([]);
    expect(extractPickerEmojis({ x: { emojiPickerRenderer: {} } })).toEqual([]);
  });
  it('ignores emojiIds without a matching emoji entry', () => {
    const data = initialData();
    // Remove the heart from the emojis map; its category id should be skipped.
    (data.contents.liveChatRenderer.emojis as unknown[]).splice(1, 1);
    expect(extractPickerEmojis(data).map((e) => e.emojiName)).toEqual([
      ':_スバルわたあめうさぎ:',
      ':globalthing:',
    ]);
  });
});
