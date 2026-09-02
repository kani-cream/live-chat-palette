import { describe, expect, it } from 'vitest';
import {
  CATALOG_MESSAGE,
  CATALOG_REQUEST,
  isCatalogRequest,
  parseCatalogMessage,
} from '../../../src/content/chat/emojiCatalogBridge';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';

describe('parseCatalogMessage', () => {
  it('accepts a valid catalog message and drops spoofed/invalid entries', () => {
    const result = parseCatalogMessage({
      [CATALOG_MESSAGE]: true,
      emojis: [
        { channelId: CH_A, familyName: 'm', emojiName: ':_a:', displayName: 'a', imageUrl: 'u' },
        { channelId: 'nope', familyName: 'm', emojiName: ':_b:', displayName: 'b' },
        { channelId: CH_A, familyName: 'm', emojiName: '', displayName: 'c' },
        'garbage',
      ],
    });
    expect(result?.map((e) => e.emojiName)).toEqual([':_a:']);
  });
  it('carries the global flag through and rejects non-true values', () => {
    const result = parseCatalogMessage({
      [CATALOG_MESSAGE]: true,
      emojis: [
        {
          channelId: CH_A,
          familyName: 'YouTube',
          emojiName: ':stamp:',
          displayName: 's',
          global: true,
        },
        { channelId: CH_A, familyName: 'YouTube', emojiName: ':bad:', displayName: 'b', global: 1 },
      ],
    });
    expect(result).toEqual([
      {
        channelId: CH_A,
        familyName: 'YouTube',
        emojiName: ':stamp:',
        displayName: 's',
        global: true,
      },
    ]);
  });
  it('rejects non-catalog payloads', () => {
    expect(parseCatalogMessage(null)).toBeNull();
    expect(parseCatalogMessage({ emojis: [] })).toBeNull();
    expect(parseCatalogMessage({ [CATALOG_MESSAGE]: true, emojis: 'x' })).toBeNull();
  });
});

describe('isCatalogRequest', () => {
  it('detects a request', () => {
    expect(isCatalogRequest({ [CATALOG_REQUEST]: true })).toBe(true);
    expect(isCatalogRequest({})).toBe(false);
    expect(isCatalogRequest(null)).toBe(false);
  });
});
