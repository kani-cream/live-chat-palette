import { isVideoContext, type VideoContext } from '../domain/context';
import type { StorageArea } from './StorageArea';

const keyFor = (tabId: number): string => `tabContext:${tabId}`;

/**
 * Per-tab video context kept in chrome.storage.session so that it survives
 * service worker restarts. Nothing here relies on worker globals.
 */
export class SessionContextStore {
  constructor(private readonly area: StorageArea) {}

  async get(tabId: number): Promise<VideoContext | null> {
    const stored = await this.area.get(keyFor(tabId));
    const value = stored[keyFor(tabId)];
    return isVideoContext(value) ? value : null;
  }

  async set(tabId: number, context: VideoContext): Promise<void> {
    await this.area.set({ [keyFor(tabId)]: context });
  }

  async remove(tabId: number): Promise<void> {
    await this.area.remove(keyFor(tabId));
  }
}
