import { describe, expect, it } from 'vitest';
import type { AvailableEmoji } from '../../../src/domain/emoji';
import { renderEmojiText, tokenizeEmojiText } from '../../../src/ui/emojiText';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const emoji = (
  name: string,
  imageUrl: string | undefined = 'https://img/x.png',
): AvailableEmoji => ({
  channelId: CH_A,
  familyName: 'Members',
  emojiName: name,
  displayName: name,
  ...(imageUrl !== undefined ? { imageUrl } : {}),
});

describe('tokenizeEmojiText', () => {
  const available = [emoji(':_wave:'), emoji(':_heart:')];

  it('keeps plain text as a single token', () => {
    expect(tokenizeEmojiText('hello world', available)).toEqual([
      { type: 'text', value: 'hello world' },
    ]);
  });
  it('splits known shortcodes into emoji tokens with surrounding text', () => {
    const tokens = tokenizeEmojiText('おつ :_wave: またね', available);
    expect(tokens.map((t) => (t.type === 'text' ? t.value : t.emoji.emojiName))).toEqual([
      'おつ ',
      ':_wave:',
      ' またね',
    ]);
  });
  it('handles consecutive emojis', () => {
    const tokens = tokenizeEmojiText(':_wave::_heart:', available);
    expect(tokens.map((t) => (t.type === 'emoji' ? t.emoji.emojiName : t.value))).toEqual([
      ':_wave:',
      ':_heart:',
    ]);
  });
  it('leaves unknown or not-yet-discovered shortcodes as literal text', () => {
    expect(tokenizeEmojiText('x :_unknown: y', available)).toEqual([
      { type: 'text', value: 'x :_unknown: y' },
    ]);
  });
  it('treats known non-underscore shortcodes (official stamps) as emojis', () => {
    const tokens = tokenizeEmojiText(':hourglass-purple-sand-orange:', [
      emoji(':hourglass-purple-sand-orange:'),
    ]);
    expect(tokens).toEqual([{ type: 'emoji', emoji: emoji(':hourglass-purple-sand-orange:') }]);
  });
  it('leaves shortcode-looking text (e.g. times) as text when not in the catalog', () => {
    expect(tokenizeEmojiText('開始は 12:30:45 です', available)).toEqual([
      { type: 'text', value: '開始は 12:30:45 です' },
    ]);
  });
  it('does not render an emoji that has no image', () => {
    const noImage: AvailableEmoji = {
      channelId: CH_A,
      familyName: 'Members',
      emojiName: ':_wave:',
      displayName: ':_wave:',
    };
    expect(tokenizeEmojiText(':_wave:', [noImage])).toEqual([{ type: 'text', value: ':_wave:' }]);
  });
});

describe('renderEmojiText', () => {
  it('builds <img> nodes for known emojis and strings for text', () => {
    const nodes = renderEmojiText('hi :_wave:', [emoji(':_wave:')]);
    expect(nodes[0]).toBe('hi ');
    const img = nodes[1] as HTMLImageElement;
    expect(img).toBeInstanceOf(HTMLImageElement);
    expect(img.getAttribute('src')).toBe('https://img/x.png');
    expect(img.getAttribute('alt')).toBe(''); // decorative; identity is on the enclosing control
    expect(img.className).toContain('lcp-inline-emoji');
  });
});
