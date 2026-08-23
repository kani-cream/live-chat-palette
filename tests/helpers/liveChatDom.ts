import { installHarness, type HarnessApi } from '../fixtures/harness';
import { renderLiveChatBody, type LiveChatFixtureOptions } from '../fixtures/liveChatPage';

export const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
export const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';

// Mirrors the verified real picker markup: custom (member) categories are CATEGORY_TYPE_CUSTOM with
// each img carrying an aria-label shortcode; the smileys category is a non-custom unicode category.
export const EMOJI_CATEGORIES = [
  {
    name: 'Channel A members',
    custom: true,
    emojis: [
      { name: ':_wave:', id: `${CH_A}/wave`, src: 'https://img.example/a/wave.png' },
      { name: ':_heart:', id: `${CH_A}/heart`, src: 'https://img.example/a/heart.png' },
    ],
  },
  {
    name: 'Other family',
    custom: true,
    emojis: [{ name: ':_wave:', id: `${CH_B}/wave`, src: 'https://img.example/b/wave.png' }],
  },
  {
    name: 'Smileys',
    emojis: [{ name: '😀', id: '😀', src: 'https://fonts.example/emoji/grin.svg' }],
  },
];

/** Render the Live Chat fixture into the jsdom document and attach the behaviour harness. */
export const mountLiveChat = (options: LiveChatFixtureOptions = {}): HarnessApi => {
  document.body.innerHTML = renderLiveChatBody(options);
  return installHarness(document, options.harness ?? {});
};
