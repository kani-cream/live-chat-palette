import { isChannelId } from '../../domain/context';
import type { AvailableEmoji } from '../../domain/emoji';

/**
 * Contract for the tiny MAIN-world script that reads window.ytInitialData (a page global the
 * isolated content script cannot see) and posts the current channel's custom emojis to the isolated
 * world via window.postMessage. Kept in its own module so both sides share the exact message shape.
 */
export const CATALOG_MESSAGE = '__lcpEmojiCatalog';
export const CATALOG_REQUEST = '__lcpEmojiCatalogRequest';

export interface EmojiCatalogMessage {
  [CATALOG_MESSAGE]: true;
  emojis: AvailableEmoji[];
}

export interface EmojiCatalogRequest {
  [CATALOG_REQUEST]: true;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Validate a single emoji entry from an untrusted postMessage payload (page could be spoofed). */
const sanitizeEmoji = (value: unknown): AvailableEmoji | null => {
  if (!isRecord(value)) return null;
  if (!isChannelId(value.channelId)) return null;
  if (typeof value.familyName !== 'string') return null;
  if (typeof value.emojiName !== 'string' || value.emojiName.length === 0) return null;
  if (typeof value.displayName !== 'string') return null;
  if (value.imageUrl !== undefined && typeof value.imageUrl !== 'string') return null;
  if (value.global !== undefined && value.global !== true) return null;
  return {
    channelId: value.channelId,
    familyName: value.familyName,
    emojiName: value.emojiName,
    displayName: value.displayName,
    ...(typeof value.imageUrl === 'string' ? { imageUrl: value.imageUrl } : {}),
    ...(value.global === true ? { global: true as const } : {}),
  };
};

export const parseCatalogMessage = (data: unknown): AvailableEmoji[] | null => {
  if (!isRecord(data) || data[CATALOG_MESSAGE] !== true || !Array.isArray(data.emojis)) return null;
  return data.emojis.map(sanitizeEmoji).filter((e): e is AvailableEmoji => e !== null);
};

export const isCatalogRequest = (data: unknown): boolean =>
  isRecord(data) && data[CATALOG_REQUEST] === true;
