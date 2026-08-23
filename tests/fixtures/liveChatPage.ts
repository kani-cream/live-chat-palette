import type { HarnessConfig } from './harness';

export interface LiveChatFixtureOptions {
  /** Omit the whole message input block (e.g. logged out / chat disabled). */
  withoutInputRenderer?: boolean;
  withoutInput?: boolean;
  withoutSendButton?: boolean;
  /** Render two send buttons to simulate an ambiguous DOM. */
  duplicateSendButton?: boolean;
  duplicateInput?: boolean;
  withoutEmojiToggle?: boolean;
  /** Pre-rendered picker (as if the user already opened it once). */
  pickerPreRendered?: boolean;
  pickerHidden?: boolean;
  initialDraft?: string;
  dark?: boolean;
  harness?: HarnessConfig;
}

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const renderPickerHtml = (categories: HarnessConfig['categories'] = []): string =>
  `<yt-emoji-picker-renderer><div id="categories">${categories
    .map(
      (category) =>
        `<yt-emoji-picker-category-renderer><div id="title">${escapeHtml(category.name)}</div><div id="emoji">${category.emojis
          .map(
            (e) =>
              `<img class="emoji" alt="${escapeHtml(e.name)}" shared-tooltip-text="${escapeHtml(e.name)}" data-emoji-id="${escapeHtml(e.id)}" src="${escapeHtml(e.src)}">`,
          )
          .join('')}</div></yt-emoji-picker-category-renderer>`,
    )
    .join('')}</div></yt-emoji-picker-renderer>`;

/** Minimal Live Chat frame body. Mirrors only the structure the adapters rely on. */
export const renderLiveChatBody = (options: LiveChatFixtureOptions = {}): string => {
  const input = options.withoutInput
    ? ''
    : `<div id="input" contenteditable="true" role="textbox" aria-label="Chat">${escapeHtml(options.initialDraft ?? '')}</div>`;
  const sendButton = options.withoutSendButton
    ? ''
    : `<div id="send-button" disabled><yt-button-renderer><button aria-label="Send" aria-disabled="true" disabled>Send</button>${
        options.duplicateSendButton ? '<button aria-label="Send">Send</button>' : ''
      }</yt-button-renderer></div>`;
  const emojiToggle = options.withoutEmojiToggle
    ? ''
    : `<yt-live-chat-icon-toggle-button-renderer id="emoji"><yt-icon-button id="button"><button aria-label="Emoji">😀</button></yt-icon-button></yt-live-chat-icon-toggle-button-renderer>`;
  const pickerHost = `<div id="emoji-picker-host"${options.pickerHidden ? ' hidden' : ''}>${
    options.pickerPreRendered ? renderPickerHtml(options.harness?.categories) : ''
  }</div>`;
  const inputRenderer = options.withoutInputRenderer
    ? '<yt-live-chat-restricted-participation-renderer>Sign in to chat</yt-live-chat-restricted-participation-renderer>'
    : `<yt-live-chat-message-input-renderer>
        <div id="container">
          <div id="input-container">
            <yt-live-chat-text-input-field-renderer id="input-field">
              ${input}${options.duplicateInput ? '<div id="input" contenteditable="true"></div>' : ''}
              <div id="label">Chat…</div>
            </yt-live-chat-text-input-field-renderer>
          </div>
          <div id="pickers">${emojiToggle}</div>
          <div id="buttons">${sendButton}</div>
          ${pickerHost}
        </div>
      </yt-live-chat-message-input-renderer>`;
  return `<yt-live-chat-app>
    <yt-live-chat-renderer>
      <div id="chat"><div id="item-list"><div id="items"></div></div></div>
      <div id="input-panel">${inputRenderer}</div>
    </yt-live-chat-renderer>
  </yt-live-chat-app>`;
};

/** Complete HTML document for Playwright (loads the harness as a module from /fixtures/harness.js). */
export const renderLiveChatPage = (options: LiveChatFixtureOptions = {}): string => `<!doctype html>
<html${options.dark ? ' dark' : ''} lang="en">
<head><meta charset="utf-8"><title>Live chat</title>
<style>body{margin:0;font-family:sans-serif;background:${options.dark ? '#0f0f0f' : '#fff'};color:${options.dark ? '#fff' : '#000'}}
#input{min-height:20px;border:1px solid #888;padding:4px}
#emoji-picker-host img.emoji{width:24px;height:24px;cursor:pointer}
#emoji-picker-host[hidden]{display:none}</style>
</head>
<body>
${renderLiveChatBody(options)}
<script type="module">
  import { installHarness } from '/fixtures/harness.js';
  installHarness(document, ${JSON.stringify(options.harness ?? {})});
</script>
</body>
</html>`;
