import { logger } from '../shared/logger';
import { isExtensionMessage, type ExtensionMessage } from './messages';

/** Send a message to the service worker; resolves null when no valid reply arrives. */
export const sendToBackground = async (
  message: ExtensionMessage,
): Promise<ExtensionMessage | null> => {
  try {
    const reply: unknown = await chrome.runtime.sendMessage(message);
    return isExtensionMessage(reply) ? reply : null;
  } catch (error: unknown) {
    logger.debug('sendMessage failed', error);
    return null;
  }
};

/** Listen for messages from the service worker (e.g. context broadcasts). */
export const onBackgroundMessage = (handler: (message: ExtensionMessage) => void): (() => void) => {
  const listener = (raw: unknown, sender: chrome.runtime.MessageSender): undefined => {
    if (sender.id !== chrome.runtime.id) return;
    if (!isExtensionMessage(raw)) return;
    handler(raw);
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => {
    chrome.runtime.onMessage.removeListener(listener);
  };
};
