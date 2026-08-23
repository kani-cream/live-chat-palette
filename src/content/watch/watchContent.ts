import { sendToBackground } from '../../messaging/client';
import { contextUpdated } from '../../messaging/messages';
import { detectFrameRole } from '../../youtube/frame';
import { DomWatchContextAdapter } from '../../youtube/WatchContextAdapter';
import { ContextPublisher } from './ContextPublisher';

export const createWatchContentScript = (doc: Document, win: Window): ContextPublisher | null => {
  const role = detectFrameRole({ href: win.location.href, isTopFrame: win.top === win });
  if (role !== 'watch') return null;
  return new ContextPublisher({
    adapter: new DomWatchContextAdapter(doc, () => new URL(win.location.href)),
    publish: async (context) => {
      await sendToBackground(contextUpdated(context));
    },
    events: doc,
  });
};

if (typeof window !== 'undefined' && !import.meta.env.VITEST) {
  createWatchContentScript(document, window)?.start();
}
