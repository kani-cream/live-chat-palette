import { ChatActionService } from '../../application/ChatActionService';
import { ContextService } from '../../application/ContextService';
import { EmojiService } from '../../application/EmojiService';
import { PresetService } from '../../application/PresetService';
import { SettingsService } from '../../application/SettingsService';
import { onBackgroundMessage, sendToBackground } from '../../messaging/client';
import { getContext, openOptions } from '../../messaging/messages';
import { logger } from '../../shared/logger';
import { chromeStorageArea } from '../../storage/StorageArea';
import { StorageRepository } from '../../storage/StorageRepository';
import { DomChatInputAdapter } from '../../youtube/ChatInputAdapter';
import { DomEmojiPickerAdapter } from '../../youtube/EmojiPickerAdapter';
import { detectFrameRole, videoIdFromChatUrl } from '../../youtube/frame';
import { DomPaletteAnchorAdapter } from '../../youtube/PaletteAnchorAdapter';
import { DomSendButtonAdapter } from '../../youtube/SendButtonAdapter';
import { detectAndApplyLang } from '../../ui/strings';
import {
  CATALOG_REQUEST,
  parseCatalogMessage,
  type EmojiCatalogRequest,
} from './emojiCatalogBridge';
import { MountController } from './mountController';
import { PaletteController } from './PaletteController';

/**
 * Receive the custom-emoji catalog posted by the MAIN-world script and cache it. This runs
 * independently of whether the palette is mounted, so discovery happens automatically on load and
 * on SPA navigation without the user opening the picker or pressing Refresh.
 */
const listenForEmojiCatalog = (
  win: Window,
  emojis: EmojiService,
  contextService: ContextService,
): void => {
  win.addEventListener('message', (event: MessageEvent) => {
    if (event.source !== win) return;
    const catalog = parseCatalogMessage(event.data);
    if (!catalog || catalog.length === 0) return;
    void emojis.recordScan(catalog).then(() => {
      // Member emojis belong to the streamer's channel; a single distinct channelId reliably
      // identifies this stream, so use it to resolve the context from the very first load.
      const channels = new Set(catalog.map((emoji) => emoji.channelId));
      if (channels.size === 1) {
        const channelId = [...channels][0];
        if (channelId) contextService.applyChannelHint(channelId);
      }
    });
  });
  // Ask the MAIN-world script to (re)post, in case it ran before this listener was registered.
  const request: EmojiCatalogRequest = { [CATALOG_REQUEST]: true };
  win.postMessage(request, win.location.origin);
};

export const createChatContentScript = (doc: Document, win: Window): MountController | null => {
  const role = detectFrameRole({ href: win.location.href, isTopFrame: win.top === win });
  if (role !== 'chat') return null;
  detectAndApplyLang();

  const repo = new StorageRepository(chromeStorageArea(chrome.storage.local, 'local'));
  const chatInput = new DomChatInputAdapter(doc);
  const sendButton = new DomSendButtonAdapter(doc);
  const emojiPicker = new DomEmojiPickerAdapter(doc, chatInput);
  const actions = new ChatActionService(chatInput, sendButton, emojiPicker);
  const contextService = new ContextService({
    request: async () => {
      const reply = await sendToBackground(getContext());
      return reply?.type === 'CONTEXT_RESPONSE' ? reply.context : null;
    },
    subscribe: (listener) =>
      onBackgroundMessage((message) => {
        if (message.type === 'CONTEXT_UPDATED') listener(message.context);
      }),
    ownVideoId: videoIdFromChatUrl(win.location.href),
  });
  listenForEmojiCatalog(win, new EmojiService(repo), contextService);

  return new MountController({
    doc,
    anchor: new DomPaletteAnchorAdapter(doc),
    createPalette: (host) => {
      const controller = new PaletteController({
        host,
        doc,
        win,
        repo,
        presets: new PresetService(repo),
        emojis: new EmojiService(repo),
        settings: new SettingsService(repo),
        actions,
        emojiPicker,
        contextService,
        openOptions: () => {
          void sendToBackground(openOptions());
        },
      });
      void controller.start().catch((error: unknown) => {
        logger.error('palette failed to start', error);
      });
      return {
        dispose: () => {
          controller.dispose();
        },
      };
    },
  });
};

if (typeof window !== 'undefined' && !import.meta.env.VITEST) {
  const controller = createChatContentScript(document, window);
  controller?.start();
}
