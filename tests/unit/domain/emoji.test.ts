import { describe, expect, it } from 'vitest';
import {
  addFavorite,
  emojiIdentityKey,
  favoritesForChannel,
  isEmojiReference,
  isFavorite,
  moveFavorite,
  refreshFavorites,
  removeFavorite,
  sameEmoji,
  type AvailableEmoji,
  type EmojiReference,
} from '../../../src/domain/emoji';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';

const available = (overrides: Partial<AvailableEmoji> = {}): AvailableEmoji => ({
  channelId: CH_A,
  familyName: 'Members',
  emojiName: ':_wave:',
  displayName: ':_wave:',
  imageUrl: 'https://img.example/wave-v1.png',
  ...overrides,
});

describe('logical identity', () => {
  it('is channelId + familyName + emojiName, not imageUrl', () => {
    expect(sameEmoji(available(), available({ imageUrl: 'https://img.example/other.png' }))).toBe(
      true,
    );
    expect(sameEmoji(available(), available({ channelId: CH_B }))).toBe(false);
    expect(sameEmoji(available(), available({ familyName: 'Other family' }))).toBe(false);
    expect(sameEmoji(available(), available({ emojiName: ':_wave2:' }))).toBe(false);
  });
  it('produces distinct keys for same-name emojis in different families/channels', () => {
    const keys = new Set([
      emojiIdentityKey(available()),
      emojiIdentityKey(available({ familyName: 'Other' })),
      emojiIdentityKey(available({ channelId: CH_B })),
    ]);
    expect(keys.size).toBe(3);
  });
});

describe('isEmojiReference', () => {
  const valid: EmojiReference = { id: 'x', ...available(), lastSeenAt: 1 };
  it('accepts valid references', () => {
    expect(isEmojiReference(valid)).toBe(true);
    const { imageUrl: _omit, ...withoutImage } = valid;
    expect(isEmojiReference(withoutImage)).toBe(true);
  });
  it.each([
    ['bad channel', { ...valid, channelId: 'nope' }],
    ['empty emojiName', { ...valid, emojiName: '' }],
    ['missing lastSeenAt', { ...valid, lastSeenAt: 'yesterday' }],
    ['non-string imageUrl', { ...valid, imageUrl: 5 }],
    ['null', null],
  ])('rejects %s', (_label, value) => {
    expect(isEmojiReference(value)).toBe(false);
  });
});

describe('favorites', () => {
  it('adds a favorite with a generated id and timestamps', () => {
    const result = addFavorite([], available(), 'id-1', 100);
    expect(result).toEqual([{ id: 'id-1', ...available(), lastSeenAt: 100 }]);
  });
  it('does not duplicate an existing favorite; refreshes metadata instead', () => {
    const first = addFavorite([], available(), 'id-1', 100);
    const again = addFavorite(
      first,
      available({ imageUrl: 'https://img.example/wave-v2.png', displayName: 'Wave' }),
      'id-2',
      200,
    );
    expect(again).toHaveLength(1);
    expect(again[0]).toMatchObject({
      id: 'id-1',
      imageUrl: 'https://img.example/wave-v2.png',
      displayName: 'Wave',
      lastSeenAt: 200,
    });
  });
  it('treats same emojiName in a different family as a different favorite', () => {
    const list = addFavorite(
      addFavorite([], available(), 'id-1', 1),
      available({ familyName: 'Other' }),
      'id-2',
      1,
    );
    expect(list).toHaveLength(2);
  });
  it('removes by identity and reports membership', () => {
    const list = addFavorite([], available(), 'id-1', 1);
    expect(isFavorite(list, available({ imageUrl: 'changed' }))).toBe(true);
    const removed = removeFavorite(list, available({ imageUrl: 'changed' }));
    expect(removed).toEqual([]);
    expect(isFavorite(removed, available())).toBe(false);
  });
  it('does not mutate input arrays', () => {
    const list = addFavorite([], available(), 'id-1', 1);
    const copy = structuredClone(list);
    removeFavorite(list, available());
    addFavorite(list, available({ emojiName: ':_x:' }), 'id-2', 2);
    expect(list).toEqual(copy);
  });
});

describe('refreshFavorites', () => {
  it('updates imageUrl/displayName/lastSeenAt only for emojis seen now', () => {
    const list = [
      ...addFavorite([], available(), 'id-1', 1),
      ...addFavorite([], available({ emojiName: ':_gone:' }), 'id-2', 1),
    ];
    const result = refreshFavorites(
      list,
      [available({ imageUrl: 'https://img.example/new.png' })],
      50,
    );
    expect(result[0]).toMatchObject({ imageUrl: 'https://img.example/new.png', lastSeenAt: 50 });
    expect(result[1]).toMatchObject({ emojiName: ':_gone:', lastSeenAt: 1 });
  });
});

describe('favoritesForChannel', () => {
  const list = [
    ...addFavorite([], available(), 'id-1', 1),
    ...addFavorite([], available({ channelId: CH_B }), 'id-2', 1),
  ];
  it('filters by channel', () => {
    expect(favoritesForChannel(list, CH_A).map((f) => f.id)).toEqual(['id-1']);
    expect(favoritesForChannel(list, CH_B).map((f) => f.id)).toEqual(['id-2']);
  });
  it('fails closed when the channel is unknown', () => {
    expect(favoritesForChannel(list, undefined)).toEqual([]);
  });
});

describe('moveFavorite', () => {
  const list = [
    ...addFavorite([], available({ emojiName: ':_a:' }), 'a', 1),
    ...addFavorite([], available({ emojiName: ':_b:' }), 'b', 1),
    ...addFavorite([], available({ channelId: CH_B, emojiName: ':_c:' }), 'c', 1),
    ...addFavorite([], available({ emojiName: ':_d:' }), 'd', 1),
  ];
  it('swaps with the neighbour in the same channel group', () => {
    expect(moveFavorite(list, available({ emojiName: ':_d:' }), 'up').map((f) => f.id)).toEqual([
      'a',
      'd',
      'c',
      'b',
    ]);
  });
  it('is a no-op at boundaries and for unknown identities', () => {
    expect(moveFavorite(list, available({ emojiName: ':_a:' }), 'up').map((f) => f.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
    expect(moveFavorite(list, available({ emojiName: ':_zzz:' }), 'up')).toEqual(list);
  });
});
