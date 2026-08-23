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
 *  A. explicit /channel/UC... link in the owner block (live; updates on SPA navigation)
 *  B. ytInitialPlayerResponse.videoDetails.channelId, read from the inline <script> text
 *  C. schema.org author microdata channel URL (/channel/UC...)
 *  D. server-rendered <meta itemprop="channelId">
 * B–D are only trusted while their own video id still equals the current URL's video id, since that
 * server-rendered data is not guaranteed to refresh on SPA navigation. On real watch pages the
 * owner block and author microdata usually carry only a /@handle, so B (the authoritative source
 * YouTube embeds for the player) is what makes channel features work on a fresh load.
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
    return (
      this.channelFromOwnerLink() ??
      this.channelFromPlayerResponse() ??
      this.channelFromAuthorMicrodata() ??
      this.channelFromFreshMeta()
    );
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

  /**
   * Read videoDetails.channelId from the inline ytInitialPlayerResponse script. This is YouTube's
   * own authoritative channel id for the current video. We scope to the videoDetails object and
   * require its videoId to equal the current URL video id, so a stale (SPA-navigated) script is
   * ignored rather than trusted.
   */
  private channelFromPlayerResponse(): string | null {
    const videoId = this.detectVideoId();
    if (videoId === null) return null;
    for (const script of this.doc.querySelectorAll('script')) {
      const text = script.textContent ?? '';
      if (!text.includes('ytInitialPlayerResponse') || !text.includes('videoDetails')) continue;
      const start = text.indexOf('"videoDetails"');
      if (start < 0) return null;
      const segment = text.slice(start, start + 5000);
      const scriptVideoId = /"videoId":"([\w-]{11})"/.exec(segment)?.[1];
      const scriptChannelId = /"channelId":"(UC[\w-]{22})"/.exec(segment)?.[1];
      if (scriptVideoId === videoId && isChannelId(scriptChannelId)) return scriptChannelId;
      return null;
    }
    return null;
  }

  private channelFromAuthorMicrodata(): string | null {
    if (!this.isHeadMetadataFresh()) return null;
    const ids = new Set<string>();
    for (const selector of WATCH_SELECTORS.authorChannelUrl) {
      for (const el of this.doc.querySelectorAll(selector)) {
        const href = el.getAttribute('href') ?? el.getAttribute('content') ?? '';
        const match = CHANNEL_HREF.exec(href);
        if (match?.[1] && isChannelId(match[1])) ids.add(match[1]);
      }
    }
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
