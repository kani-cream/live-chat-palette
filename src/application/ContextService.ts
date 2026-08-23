import { sameContext, type VideoContext } from '../domain/context';

export interface ContextPorts {
  /** Ask the background for the tab's current context (null when unknown). */
  request: () => Promise<VideoContext | null>;
  /** Subscribe to context broadcasts from the background. */
  subscribe: (listener: (context: VideoContext) => void) => () => void;
  /** Video id this chat frame knows about itself (popup chat URL), if any. */
  ownVideoId: string | null;
}

export type ContextListener = (context: VideoContext) => void;

/**
 * Chat-frame view of the current video/channel context.
 * A context describing a different video than this frame is rejected (stale),
 * so channel-specific features fail closed instead of showing another stream's data.
 */
export class ContextService {
  private accepted: VideoContext = {};
  private emitted: VideoContext = {};
  /** A reliable channelId derived from this stream's own data (its custom emoji ids). */
  private channelHint: string | undefined;
  private readonly listeners = new Set<ContextListener>();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly ports: ContextPorts) {}

  get context(): VideoContext {
    return this.emitted;
  }

  async start(): Promise<VideoContext> {
    this.unsubscribe ??= this.ports.subscribe((context) => {
      this.apply(context);
    });
    const initial = await this.ports.request();
    this.apply(initial ?? {});
    return this.emitted;
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  onChange(listener: ContextListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Adopt a channelId discovered locally (from the chat frame's own emoji data) as a fallback. This
   * makes channel features work from the first load, without waiting for the watch frame's slower
   * cross-frame detection. The watch frame's channelId, when it arrives, always takes precedence.
   */
  applyChannelHint(channelId: string): void {
    if (this.channelHint === channelId) return;
    this.channelHint = channelId;
    this.recompute();
  }

  private apply(incoming: VideoContext): void {
    this.accepted = this.accept(incoming);
    this.recompute();
  }

  private recompute(): void {
    const merged =
      this.channelHint !== undefined && this.accepted.channelId === undefined
        ? { ...this.accepted, channelId: this.channelHint }
        : this.accepted;
    if (sameContext(merged, this.emitted)) return;
    this.emitted = merged;
    for (const listener of this.listeners) listener(merged);
  }

  private accept(incoming: VideoContext): VideoContext {
    const own = this.ports.ownVideoId;
    if (own !== null && incoming.videoId !== undefined && incoming.videoId !== own) {
      return { videoId: own };
    }
    if (own !== null && incoming.videoId === undefined) {
      return { ...incoming, videoId: own };
    }
    return incoming;
  }
}
