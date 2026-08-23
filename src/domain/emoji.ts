import { isChannelId } from './context';

/** Persistent favorite reference. Logical identity = channelId + familyName + emojiName. */
export interface EmojiReference {
  id: string;
  channelId: string;
  familyName: string;
  emojiName: string;
  displayName: string;
  imageUrl?: string;
  lastSeenAt: number;
}

/** Emoji observed in YouTube's native picker right now. */
export interface AvailableEmoji {
  channelId: string;
  familyName: string;
  emojiName: string;
  displayName: string;
  imageUrl?: string;
}

export interface EmojiIdentity {
  channelId: string;
  familyName: string;
  emojiName: string;
}

/** Identity key with unit-separator delimiters (names may contain spaces; U+001F never appears in them). */
export const emojiIdentityKey = (e: EmojiIdentity): string =>
  [e.channelId, e.familyName, e.emojiName].join('\u001f');

export const sameEmoji = (a: EmojiIdentity, b: EmojiIdentity): boolean =>
  a.channelId === b.channelId && a.familyName === b.familyName && a.emojiName === b.emojiName;

export const isEmojiReference = (value: unknown): value is EmojiReference => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (!isChannelId(v.channelId)) return false;
  if (typeof v.familyName !== 'string') return false;
  if (typeof v.emojiName !== 'string' || v.emojiName.length === 0) return false;
  if (typeof v.displayName !== 'string') return false;
  if (v.imageUrl !== undefined && typeof v.imageUrl !== 'string') return false;
  if (typeof v.lastSeenAt !== 'number') return false;
  return true;
};

export const findFavorite = (
  favorites: readonly EmojiReference[],
  identity: EmojiIdentity,
): EmojiReference | undefined => favorites.find((f) => sameEmoji(f, identity));

export const isFavorite = (
  favorites: readonly EmojiReference[],
  identity: EmojiIdentity,
): boolean => findFavorite(favorites, identity) !== undefined;

/** Update display metadata (imageUrl, displayName) of a favorite from a freshly seen emoji. */
export const refreshFavorite = (
  favorite: EmojiReference,
  seen: AvailableEmoji,
  now: number,
): EmojiReference => ({
  ...favorite,
  displayName: seen.displayName,
  lastSeenAt: now,
  ...(seen.imageUrl !== undefined ? { imageUrl: seen.imageUrl } : {}),
});

export const addFavorite = (
  favorites: readonly EmojiReference[],
  emoji: AvailableEmoji,
  id: string,
  now: number,
): EmojiReference[] => {
  const existing = findFavorite(favorites, emoji);
  if (existing) {
    return favorites.map((f) => (f === existing ? refreshFavorite(f, emoji, now) : f));
  }
  const created: EmojiReference = {
    id,
    channelId: emoji.channelId,
    familyName: emoji.familyName,
    emojiName: emoji.emojiName,
    displayName: emoji.displayName,
    lastSeenAt: now,
    ...(emoji.imageUrl !== undefined ? { imageUrl: emoji.imageUrl } : {}),
  };
  return [...favorites, created];
};

export const removeFavorite = (
  favorites: readonly EmojiReference[],
  identity: EmojiIdentity,
): EmojiReference[] => favorites.filter((f) => !sameEmoji(f, identity));

/** Refresh every favorite that matches a currently available emoji. */
export const refreshFavorites = (
  favorites: readonly EmojiReference[],
  available: readonly AvailableEmoji[],
  now: number,
): EmojiReference[] =>
  favorites.map((f) => {
    const seen = available.find((a) => sameEmoji(a, f));
    return seen ? refreshFavorite(f, seen, now) : f;
  });

export const favoritesForChannel = (
  favorites: readonly EmojiReference[],
  channelId: string | undefined,
): EmojiReference[] =>
  channelId === undefined ? [] : favorites.filter((f) => f.channelId === channelId);

export const DEFAULT_CATALOG_CAP = 300;

/**
 * Upsert freshly discovered emojis into a per-channel catalog (cache), keeping at most `cap`
 * entries by most-recently-seen. Existing entries keep their id and get refreshed metadata.
 */
export const upsertEmojiCatalog = (
  existing: readonly EmojiReference[],
  available: readonly AvailableEmoji[],
  newId: () => string,
  now: number,
  cap: number = DEFAULT_CATALOG_CAP,
): EmojiReference[] => {
  let catalog = [...existing];
  for (const emoji of available) {
    const index = catalog.findIndex((e) => sameEmoji(e, emoji));
    if (index >= 0) {
      const current = catalog[index];
      if (current) catalog[index] = refreshFavorite(current, emoji, now);
    } else {
      catalog.push({
        id: newId(),
        channelId: emoji.channelId,
        familyName: emoji.familyName,
        emojiName: emoji.emojiName,
        displayName: emoji.displayName,
        lastSeenAt: now,
        ...(emoji.imageUrl !== undefined ? { imageUrl: emoji.imageUrl } : {}),
      });
    }
  }
  if (catalog.length > cap) {
    catalog = [...catalog].sort((a, b) => b.lastSeenAt - a.lastSeenAt).slice(0, cap);
  }
  return catalog;
};

/** Swap a favorite with its neighbour inside the same channel group (array order = display order). */
export const moveFavorite = (
  favorites: readonly EmojiReference[],
  identity: EmojiIdentity,
  direction: 'up' | 'down',
): EmojiReference[] => {
  const list = [...favorites];
  const index = list.findIndex((f) => sameEmoji(f, identity));
  const target = list[index];
  if (!target) return list;
  const group = list.filter((f) => f.channelId === target.channelId);
  const groupIndex = group.findIndex((f) => sameEmoji(f, identity));
  const swapWith = group[direction === 'up' ? groupIndex - 1 : groupIndex + 1];
  if (!swapWith) return list;
  const swapIndex = list.indexOf(swapWith);
  return list.map((f, i) => (i === index ? swapWith : i === swapIndex ? target : f));
};
