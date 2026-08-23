import { FRAME_HOSTS, LIVE_CHAT_PATH, LIVE_PATH_PREFIX, WATCH_PATH } from './selectors';

export type FrameRole = 'watch' | 'chat' | 'irrelevant';

export interface FrameInfo {
  href: string;
  isTopFrame: boolean;
}

/** Decide which responsibility (if any) a content script instance has in this frame. */
export const detectFrameRole = ({ href, isTopFrame }: FrameInfo): FrameRole => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return 'irrelevant';
  }
  if (url.protocol !== 'https:') return 'irrelevant';
  if (!(FRAME_HOSTS as readonly string[]).includes(url.hostname)) return 'irrelevant';
  if (url.pathname === LIVE_CHAT_PATH) return 'chat';
  if (isTopFrame && (url.pathname === WATCH_PATH || url.pathname.startsWith(LIVE_PATH_PREFIX))) {
    return 'watch';
  }
  return 'irrelevant';
};

/** Popup Live Chat (`/live_chat?v=...`) exposes the video id directly. */
export const videoIdFromChatUrl = (href: string): string | null => {
  try {
    const v = new URL(href).searchParams.get('v');
    return v && /^[\w-]{11}$/.test(v) ? v : null;
  } catch {
    return null;
  }
};
