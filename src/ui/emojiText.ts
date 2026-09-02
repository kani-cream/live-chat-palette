import type { AvailableEmoji } from '../domain/emoji';
import { h } from './dom';

/**
 * Any :shortcode: — member/custom (`:_name:`) and YouTube-official stamps (`:name:`). Whether it
 * actually becomes an image is decided by the catalog lookup below, so plain text that merely looks
 * like a shortcode (e.g. times such as "12:30:45") safely stays text.
 */
const SHORTCODE_RE = /:[^:\s]+:/g;

export type EmojiTextToken =
  { type: 'text'; value: string } | { type: 'emoji'; emoji: AvailableEmoji };

/**
 * Split preset/label text into runs of plain text and known emojis. A `:shortcode:` becomes an
 * emoji token only when it matches a currently discovered emoji that has an image; otherwise it
 * stays as text (so unknown/undiscovered shortcodes render literally rather than disappearing).
 */
export const tokenizeEmojiText = (
  text: string,
  available: readonly AvailableEmoji[],
): EmojiTextToken[] => {
  const tokens: EmojiTextToken[] = [];
  let last = 0;
  for (const match of text.matchAll(SHORTCODE_RE)) {
    const shortcode = match[0];
    const index = match.index ?? 0;
    const emoji = available.find((e) => e.emojiName === shortcode && e.imageUrl !== undefined);
    if (!emoji) continue;
    if (index > last) tokens.push({ type: 'text', value: text.slice(last, index) });
    tokens.push({ type: 'emoji', emoji });
    last = index + shortcode.length;
  }
  if (last < text.length) tokens.push({ type: 'text', value: text.slice(last) });
  if (tokens.length === 0) tokens.push({ type: 'text', value: text });
  return tokens;
};

/**
 * Build inline nodes (text + <img>) for a preset/label, rendering known emojis as images so a
 * `:shortcode:` is identifiable at a glance. Images are decorative here (alt=''); callers keep
 * the full text in an accessible name / title.
 */
export const renderEmojiText = (
  text: string,
  available: readonly AvailableEmoji[],
): (string | HTMLElement)[] =>
  tokenizeEmojiText(text, available).map((token) =>
    token.type === 'text'
      ? token.value
      : h('img', {
          className: 'lcp-inline-emoji',
          attrs: {
            src: token.emoji.imageUrl ?? '',
            alt: '',
            title: token.emoji.displayName,
            loading: 'lazy',
            draggable: 'false',
          },
        }),
  );
