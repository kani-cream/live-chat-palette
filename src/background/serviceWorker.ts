import { MessageRouter } from '../messaging/router';
import { logger } from '../shared/logger';
import { SessionContextStore } from '../storage/SessionContextStore';
import { chromeStorageArea } from '../storage/StorageArea';

/**
 * MV3 service worker. It may be stopped at any time, so no state lives in
 * module globals: contexts are stored in chrome.storage.session and read back per message.
 */
const router = new MessageRouter({
  contexts: new SessionContextStore(chromeStorageArea(chrome.storage.session, 'session')),
  broadcastToTab: async (tabId, message) => {
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (error: unknown) {
      // No listener in that tab yet (chat frame not loaded) is normal.
      logger.debug('broadcast skipped', error);
    }
  },
  openOptionsPage: () => chrome.runtime.openOptionsPage(),
});

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return false;
  const tabId = sender.tab?.id;
  void router
    .handle(message, {
      ...(tabId !== undefined ? { tabId } : {}),
      ...(sender.frameId !== undefined ? { frameId: sender.frameId } : {}),
    })
    .then((reply) => {
      sendResponse(reply);
    })
    .catch((error: unknown) => {
      logger.error('message handling failed', error);
      sendResponse(null);
    });
  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void router.handleTabRemoved(tabId);
});
