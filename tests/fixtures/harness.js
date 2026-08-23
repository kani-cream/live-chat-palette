// Behavioural stand-in for YouTube's Live Chat input, send button and emoji picker.
// Used both by jsdom tests (imported as a module) and by Playwright pages (served as /fixtures/harness.js).
// It is a minimal simulation, not a copy of YouTube; real YouTube behaviour must be verified manually.

/**
 * @typedef {{ name: string, custom?: boolean, emojis: { name: string, shortcode?: string, id: string, src: string }[] }} EmojiCategory
 * @typedef {{
 *   categories?: EmojiCategory[],
 *   sendFails?: boolean,
 *   pickerNeverRenders?: boolean,
 *   pickerToggleMissing?: boolean,
 * }} HarnessConfig
 */

const textOf = (node) => {
  if (node.nodeType === 3) return node.nodeValue ?? '';
  if (node.nodeName === 'IMG') return node.getAttribute('alt') ?? '';
  let out = '';
  for (const child of node.childNodes) out += textOf(child);
  return out;
};

/**
 * @param {Document} doc
 * @param {HarnessConfig} config
 */
export const installHarness = (doc, config = {}) => {
  const win = doc.defaultView;
  const state = { sent: [], sendClicks: 0, pickerOpens: 0, config: { categories: [], ...config } };

  const input = doc.querySelector('yt-live-chat-text-input-field-renderer #input[contenteditable]');
  const sendButton = doc.querySelector('#send-button button');
  const sendContainer = doc.querySelector('#send-button');
  const toggle = doc.querySelector('#emoji button');
  const pickerHost = doc.querySelector('#emoji-picker-host');

  const syncSendState = () => {
    if (!sendButton || !input) return;
    const empty = textOf(input).length === 0;
    sendButton.disabled = empty;
    sendButton.setAttribute('aria-disabled', String(empty));
    if (sendContainer) {
      if (empty) sendContainer.setAttribute('disabled', '');
      else sendContainer.removeAttribute('disabled');
    }
    const label = doc.querySelector('yt-live-chat-text-input-field-renderer #label');
    if (label) label.toggleAttribute('hidden', !empty);
  };

  const insertNodeAtCaret = (node) => {
    if (!input) return;
    const selection = doc.getSelection();
    let range = null;
    if (selection && selection.rangeCount > 0) {
      const r = selection.getRangeAt(0);
      if (input.contains(r.startContainer)) range = r;
    }
    if (!range) {
      range = doc.createRange();
      range.selectNodeContents(input);
      range.collapse(false);
    }
    range.deleteContents();
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
    input.dispatchEvent(new win.InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  };

  input?.addEventListener('input', syncSendState);

  sendButton?.addEventListener('click', () => {
    state.sendClicks += 1;
    if (sendButton.disabled || state.config.sendFails) return;
    state.sent.push(textOf(input));
    input.replaceChildren();
    input.dispatchEvent(new win.InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
    const items = doc.querySelector('#items');
    if (items) {
      const item = doc.createElement('yt-live-chat-text-message-renderer');
      item.textContent = state.sent[state.sent.length - 1];
      items.append(item);
    }
  });

  // Clicking a native picker emoji inserts an <img> into the input, exactly like YouTube:
  // the inserted node carries class "emoji", data-emoji-id and alt (the display name).
  const bindEmojiImage = (img, emoji) => {
    img.addEventListener('click', () => {
      const inserted = doc.createElement('img');
      inserted.className = 'emoji yt-formatted-string';
      inserted.setAttribute('alt', emoji.name);
      inserted.setAttribute('data-emoji-id', emoji.id);
      inserted.setAttribute('src', emoji.src);
      insertNodeAtCaret(inserted);
    });
  };

  // A picker that was rendered server-side (pickerPreRendered fixtures) needs behaviour too.
  for (const img of pickerHost?.querySelectorAll('yt-emoji-picker-category-renderer img') ?? []) {
    bindEmojiImage(img, {
      name: img.getAttribute('alt') ?? '',
      id: img.getAttribute('id') ?? '',
      src: img.getAttribute('src') ?? '',
    });
  }

  const renderPicker = () => {
    const picker = doc.createElement('yt-emoji-picker-renderer');
    const categories = doc.createElement('div');
    categories.id = 'categories';
    for (const category of state.config.categories) {
      const renderer = doc.createElement('yt-emoji-picker-category-renderer');
      const title = doc.createElement('div');
      title.id = 'title';
      title.textContent = category.name;
      const grid = doc.createElement('div');
      grid.id = 'emoji';
      grid.setAttribute('role', 'listbox');
      // Real YouTube marks the member/custom emoji listbox with CATEGORY_TYPE_CUSTOM.
      grid.className = category.custom ? 'CATEGORY_TYPE_CUSTOM' : 'CATEGORY_TYPE_UNICODE_EMOJI';
      for (const emoji of category.emojis) {
        const img = doc.createElement('img');
        img.setAttribute('role', 'option');
        img.setAttribute('alt', emoji.name);
        // Custom emojis: aria-label is the :_shortcode:, id is "<channelId>/<hash>".
        img.setAttribute('aria-label', emoji.shortcode ?? emoji.name);
        img.setAttribute('id', emoji.id);
        img.setAttribute('src', emoji.src);
        bindEmojiImage(img, emoji);
        grid.append(img);
      }
      renderer.append(title, grid);
      categories.append(renderer);
    }
    picker.append(categories);
    return picker;
  };

  if (state.config.pickerToggleMissing) toggle?.remove();

  toggle?.addEventListener('click', () => {
    if (!pickerHost) return;
    let picker = pickerHost.querySelector('yt-emoji-picker-renderer');
    if (!picker) {
      if (state.config.pickerNeverRenders) return;
      picker = renderPicker();
      pickerHost.append(picker);
      pickerHost.removeAttribute('hidden');
      state.pickerOpens += 1;
      toggle.setAttribute('aria-pressed', 'true');
      return;
    }
    const open = !pickerHost.hasAttribute('hidden');
    pickerHost.toggleAttribute('hidden', open);
    toggle.setAttribute('aria-pressed', String(!open));
    if (!open) state.pickerOpens += 1;
  });

  syncSendState();

  const api = {
    state,
    readInput: () => (input ? textOf(input) : ''),
    /** Type text at the caret as a user would (text node + input event). */
    type: (text) => {
      insertNodeAtCaret(doc.createTextNode(text));
    },
    /** Place the caret at a character offset of the first text node, or select a range. */
    select: (start, end = start) => {
      if (!input) return;
      const textNode = [...input.childNodes].find((n) => n.nodeType === 3) ?? input;
      const range = doc.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, end);
      const selection = doc.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    },
    setConfig: (patch) => {
      Object.assign(state.config, patch);
    },
    /** Simulate YouTube rebuilding the message input block. */
    rebuildInputRenderer: () => {
      const renderer = doc.querySelector('yt-live-chat-message-input-renderer');
      if (!renderer) return;
      const clone = renderer.cloneNode(true);
      renderer.replaceWith(clone);
      installHarness(doc, state.config);
    },
    /** Simulate YouTube removing the whole input (e.g. chat disabled). */
    removeInputRenderer: () => {
      doc.querySelector('yt-live-chat-message-input-renderer')?.remove();
    },
    pickerOpen: () =>
      pickerHost !== null &&
      !pickerHost.hasAttribute('hidden') &&
      pickerHost.querySelector('yt-emoji-picker-renderer') !== null,
  };
  win.__lcpHarness = api;
  return api;
};
