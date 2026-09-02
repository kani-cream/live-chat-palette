import { isChannelId } from '../domain/context';
import type { AvailableEmoji } from '../domain/emoji';

/**
 * Parse the channel's custom/member emojis AND YouTube's official stamps from `ytInitialData`.
 *
 * Verified against a real live stream: the full emoji set (image URL + shortcode + family) lives in
 * `ytInitialData` under `emojiPickerRenderer.categories[].emojiPickerCategoryRenderer` (with an
 * `emojiIds` list) resolved against a flat `emojis` array. `CATEGORY_TYPE_CUSTOM` holds the
 * channel's member emojis (`:_name:`); `CATEGORY_TYPE_GLOBAL` holds YouTube's official stamps
 * (`:name:`, usable on every channel — marked `global`). This means the full catalog is available
 * on page load WITHOUT opening the native picker, so it can be cached automatically and refreshed
 * on every load. Only `emojiId` (`<channelId>/<hash>`), `shortcuts` (the typeable shortcode),
 * `image.thumbnails[].url` and the accessibility label are used.
 */
const CHANNEL_EMOJI_ID = /^(UC[\w-]{22})\//;

/** Picker category types whose emojis are extracted; unicode emojis stay plain text. */
const EXTRACTED_CATEGORY_TYPES = new Set(['CATEGORY_TYPE_CUSTOM', 'CATEGORY_TYPE_GLOBAL']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Bounded DFS for the first value at `key`; returns undefined if not found within the depth cap. */
const findFirst = (value: unknown, key: string, depth = 0): unknown => {
  if (!isRecord(value) || depth > 12) return undefined;
  if (key in value) return value[key];
  for (const child of Object.values(value)) {
    const found = findFirst(child, key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
};

/** The largest `emojis` array anywhere in the tree (the picker's full emoji map). */
const findEmojiMap = (value: unknown, depth = 0): unknown[] => {
  let best: unknown[] = [];
  const visit = (node: unknown, d: number): void => {
    if (!isRecord(node) || d > 12) return;
    const candidate = node.emojis;
    if (Array.isArray(candidate) && candidate.length > best.length) best = candidate;
    for (const child of Object.values(node)) visit(child, d + 1);
  };
  visit(value, depth);
  return best;
};

const unwrap = (value: unknown, wrapperKey: string): Record<string, unknown> | null => {
  if (!isRecord(value)) return null;
  const inner = value[wrapperKey];
  return isRecord(inner) ? inner : value;
};

const titleText = (title: unknown): string => {
  if (typeof title === 'string') return title;
  if (!isRecord(title)) return '';
  if (typeof title.simpleText === 'string') return title.simpleText;
  if (Array.isArray(title.runs)) {
    return title.runs
      .map((run) => (isRecord(run) && typeof run.text === 'string' ? run.text : ''))
      .join('');
  }
  return '';
};

const firstShortcut = (shortcuts: unknown): string | null => {
  if (!Array.isArray(shortcuts)) return null;
  const strings = (shortcuts as unknown[]).filter((s): s is string => typeof s === 'string');
  return strings.find((s) => s.startsWith(':_')) ?? strings[0] ?? null;
};

const imageUrl = (emoji: Record<string, unknown>): string | undefined => {
  const image = emoji.image;
  if (!isRecord(image) || !Array.isArray(image.thumbnails)) return undefined;
  const last: unknown = (image.thumbnails as unknown[]).at(-1);
  return isRecord(last) && typeof last.url === 'string' ? last.url : undefined;
};

const labelText = (emoji: Record<string, unknown>): string => {
  const image = emoji.image;
  if (!isRecord(image)) return '';
  const a11y = image.accessibility;
  if (!isRecord(a11y)) return '';
  const data = a11y.accessibilityData;
  return isRecord(data) && typeof data.label === 'string' ? data.label : '';
};

export const extractPickerEmojis = (ytInitialData: unknown): AvailableEmoji[] => {
  const picker = findFirst(ytInitialData, 'emojiPickerRenderer');
  if (!isRecord(picker) || !Array.isArray(picker.categories)) return [];

  const byId = new Map<string, Record<string, unknown>>();
  for (const item of findEmojiMap(ytInitialData)) {
    const emoji = unwrap(item, 'emoji');
    if (emoji && typeof emoji.emojiId === 'string') byId.set(emoji.emojiId, emoji);
  }

  const out: AvailableEmoji[] = [];
  const seen = new Set<string>();
  for (const category of picker.categories) {
    const cr = unwrap(category, 'emojiPickerCategoryRenderer');
    if (typeof cr?.categoryType !== 'string' || !EXTRACTED_CATEGORY_TYPES.has(cr.categoryType)) {
      continue;
    }
    const isGlobal = cr.categoryType === 'CATEGORY_TYPE_GLOBAL';
    const familyName = titleText(cr.title);
    const emojiIds: unknown[] = Array.isArray(cr.emojiIds) ? cr.emojiIds : [];
    for (const rawId of emojiIds) {
      if (typeof rawId !== 'string') continue;
      const match = CHANNEL_EMOJI_ID.exec(rawId);
      const emoji = byId.get(rawId);
      if (!match || !emoji) continue;
      const channelId = match[1];
      const shortcut = firstShortcut(emoji.shortcuts);
      if (!channelId || !isChannelId(channelId) || !shortcut) continue;
      const key = `${channelId}${familyName}${shortcut}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const url = imageUrl(emoji);
      out.push({
        channelId,
        familyName,
        emojiName: shortcut,
        displayName: labelText(emoji) || shortcut,
        ...(url !== undefined ? { imageUrl: url } : {}),
        ...(isGlobal ? { global: true as const } : {}),
      });
    }
  }
  return out;
};
