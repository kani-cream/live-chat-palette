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
import { MountController } from './mountController';
import { PaletteController } from './PaletteController';

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
        refresh: () => {
          controller.refresh();
        },
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
