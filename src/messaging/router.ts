import type { SessionContextStore } from '../storage/SessionContextStore';
import { ack, contextResponse, isExtensionMessage, type ExtensionMessage } from './messages';

export interface MessageSender {
  tabId?: number;
  frameId?: number;
}

export interface RouterPorts {
  contexts: SessionContextStore;
  /** Broadcast a message to every frame of a tab (chrome.tabs.sendMessage). */
  broadcastToTab: (tabId: number, message: ExtensionMessage) => Promise<void>;
  openOptionsPage: () => Promise<void>;
}

/**
 * Service-worker message router. Stateless: everything recoverable lives in
 * SessionContextStore so a worker restart loses nothing.
 */
export class MessageRouter {
  constructor(private readonly ports: RouterPorts) {}

  async handle(message: unknown, sender: MessageSender): Promise<ExtensionMessage | null> {
    if (!isExtensionMessage(message)) return null;
    switch (message.type) {
      case 'CONTEXT_UPDATED': {
        if (sender.tabId === undefined) return null;
        await this.ports.contexts.set(sender.tabId, message.context);
        await this.ports.broadcastToTab(sender.tabId, message);
        return ack();
      }
      case 'GET_CONTEXT': {
        if (sender.tabId === undefined) return contextResponse(null);
        return contextResponse(await this.ports.contexts.get(sender.tabId));
      }
      case 'OPEN_OPTIONS': {
        await this.ports.openOptionsPage();
        return ack();
      }
      case 'CONTEXT_RESPONSE':
      case 'ACK':
        return null;
    }
  }

  async handleTabRemoved(tabId: number): Promise<void> {
    await this.ports.contexts.remove(tabId);
  }
}
