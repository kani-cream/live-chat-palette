import { isChannelId, isVideoId, type VideoContext } from '../domain/context';
import { LIVE_PATH_PREFIX, WATCH_PATH, WATCH_SELECTORS } from './selectors';

export interface WatchContextAdapter {
  detectVideoId(): string | null;
  detectChannelId(): string | null;
  detectChannelName(): string | null;
  detectContext(): VideoContext;
}

const CHANNEL_HREF = /\/channel\/(UC[\w-]{22})(?:[/?#]|$)/;

/**
 * Resolves video/channel context from the watch page.
 * Channel detection strategies (in order):
 *  A. explicit /channel/UC... link in the owner block
 *  B. server-rendered <meta itemprop="channelId">, accepted only while the
 *     sibling video identifier meta still equals the current URL's video id
 *     (YouTube does not refresh head metadata on SPA navigation)
 * Anything else -> null (fail closed; channel features disable themselves).
 */
export class DomWatchContextAdapter implements WatchContextAdapter {
  constructor(
    private readonly doc: Document,
    private readonly getLocation: () => URL,
  ) {}

  detectVideoId(): string | null {
    const url = this.getLocation();
    if (url.pathname === WATCH_PATH) {
      const v = url.searchParams.get('v');
      return isVideoId(v) ? v : null;
    }
    if (url.pathname.startsWith(LIVE_PATH_PREFIX)) {
      const id = url.pathname.slice(LIVE_PATH_PREFIX.length).split('/')[0];
      return isVideoId(id) ? id : null;
    }
    return null;
  }

  detectChannelId(): string | null {
    return this.channelFromOwnerLink() ?? this.channelFromFreshMeta();
  }

  detectChannelName(): string | null {
    for (const selector of WATCH_SELECTORS.ownerName) {
      const text = this.doc.querySelector(selector)?.textContent?.trim();
      if (text) return text;
    }
    if (this.isHeadMetadataFresh()) {
      const name = this.doc.querySelector(WATCH_SELECTORS.metaAuthorName)?.getAttribute('content');
      if (name?.trim()) return name.trim();
    }
    return null;
  }

  detectContext(): VideoContext {
    const videoId = this.detectVideoId();
    const channelId = this.detectChannelId();
    const channelName = this.detectChannelName();
    return {
      ...(videoId !== null ? { videoId } : {}),
      ...(channelId !== null ? { channelId } : {}),
      ...(channelName !== null ? { channelName } : {}),
    };
  }

  private channelFromOwnerLink(): string | null {
    const links = [...this.doc.querySelectorAll(WATCH_SELECTORS.ownerChannelLink)];
    const ids = new Set(
      links.flatMap((link) => {
        const match = CHANNEL_HREF.exec(link.getAttribute('href') ?? '');
        return match?.[1] && isChannelId(match[1]) ? [match[1]] : [];
      }),
    );
    if (ids.size !== 1) return null;
    return [...ids][0] ?? null;
  }

  private channelFromFreshMeta(): string | null {
    if (!this.isHeadMetadataFresh()) return null;
    const metas = [...this.doc.querySelectorAll(WATCH_SELECTORS.metaChannelId)];
    if (metas.length !== 1) return null;
    const content = metas[0]?.getAttribute('content');
    return isChannelId(content) ? content : null;
  }

  private isHeadMetadataFresh(): boolean {
    const videoId = this.detectVideoId();
    if (videoId === null) return false;
    for (const selector of WATCH_SELECTORS.metaVideoIdentifier) {
      const content = this.doc.querySelector(selector)?.getAttribute('content');
      if (content) return content === videoId;
    }
    return false;
  }
}
