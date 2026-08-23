/**
 * Every YouTube DOM selector lives here. Selectors are ordered strategies:
 * the adapter tries them in order and fails closed when none matches unambiguously.
 * Fixtures under tests/fixtures mirror this structure; they are test inputs,
 * not a claim that YouTube's DOM is stable.
 */
export const CHAT_SELECTORS = {
  messageInputRenderer: 'yt-live-chat-message-input-renderer',
  /** The contenteditable editor YouTube uses for composing a chat message. */
  chatInput: [
    'yt-live-chat-message-input-renderer yt-live-chat-text-input-field-renderer #input[contenteditable]',
    'yt-live-chat-text-input-field-renderer #input[contenteditable]',
  ],
  /** Native send control. Must be a <button> inside YouTube's send container. */
  sendButtonContainer: 'yt-live-chat-message-input-renderer #send-button',
  sendButton: [
    'yt-live-chat-message-input-renderer #send-button button',
    'yt-live-chat-message-input-renderer #send-button yt-icon-button button',
  ],
  /** Toggle that opens/closes the native emoji picker. */
  emojiToggle: [
    'yt-live-chat-message-input-renderer yt-live-chat-icon-toggle-button-renderer#emoji button',
    'yt-live-chat-message-input-renderer #emoji button',
  ],
  emojiPicker: 'yt-emoji-picker-renderer',
  emojiCategory: 'yt-emoji-picker-category-renderer',
  emojiCategoryTitle: ['#title', '.category-title'],
  emojiImage: 'img.emoji',
  /** Inline emoji images YouTube places inside the editor. */
  editorEmojiImage: 'img',
} as const;

export const WATCH_SELECTORS = {
  /** Explicit /channel/UC... link in the video owner block (most trustworthy when present). */
  ownerChannelLink: 'ytd-video-owner-renderer a[href*="/channel/UC"]',
  ownerName: [
    'ytd-video-owner-renderer ytd-channel-name #text a',
    'ytd-video-owner-renderer ytd-channel-name #text',
  ],
  /** Server-rendered metadata; only trusted when it still describes the current video. */
  metaChannelId: 'meta[itemprop="channelId"]',
  metaVideoIdentifier: ['meta[itemprop="identifier"]', 'meta[itemprop="videoId"]'],
  metaAuthorName: 'span[itemprop="author"] link[itemprop="name"]',
} as const;

export const FRAME_HOSTS = ['www.youtube.com'] as const;
export const LIVE_CHAT_PATH = '/live_chat';
export const WATCH_PATH = '/watch';
export const LIVE_PATH_PREFIX = '/live/';
