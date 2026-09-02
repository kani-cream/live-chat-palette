import { CATALOG_MESSAGE, CATALOG_REQUEST, type EmojiCatalogMessage } from './emojiCatalogBridge';
import { extractPickerEmojis } from '../../youtube/emojiCatalog';

/**
 * Runs in the page's MAIN world (declared with `"world": "MAIN"`), because `window.ytInitialData` is
 * a page global the isolated content script cannot read, and YouTube removes the inline script that
 * sets it before the isolated script runs. This reads the current channel's custom emojis from that
 * global — WITHOUT opening the native picker — and posts them to the isolated content script, which
 * caches them. It re-posts on SPA navigation and on request, so discovery is automatic on every load
 * and follows the creator's stamp updates.
 */
const postCatalog = (win: Window): void => {
  try {
    const emojis = extractPickerEmojis((win as { ytInitialData?: unknown }).ytInitialData);
    if (emojis.length === 0) return;
    const message: EmojiCatalogMessage = { [CATALOG_MESSAGE]: true, emojis };
    win.postMessage(message, win.location.origin);
  } catch {
    // Never disturb the page if the data shape is unexpected.
  }
};

const install = (win: Window): void => {
  const post = (): void => {
    postCatalog(win);
  };
  // A couple of attempts so the isolated listener (whatever the injection order) receives it.
  post();
  win.setTimeout(post, 500);
  win.setTimeout(post, 1500);
  // Re-post on SPA navigation (new video -> new ytInitialData) and on explicit request.
  win.document.addEventListener('yt-navigate-finish', () => win.setTimeout(post, 300));
  win.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== win) return;
    const data: unknown = event.data;
    if (
      typeof data === 'object' &&
      data !== null &&
      (data as Record<string, unknown>)[CATALOG_REQUEST] === true
    ) {
      post();
    }
  });
};

if (typeof window !== 'undefined' && !import.meta.env.VITEST) {
  install(window);
}
