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
  private current: VideoContext = {};
  private readonly listeners = new Set<ContextListener>();
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly ports: ContextPorts) {}

  get context(): VideoContext {
    return this.current;
  }

  async start(): Promise<VideoContext> {
    this.unsubscribe ??= this.ports.subscribe((context) => {
      this.apply(context);
    });
    const initial = await this.ports.request();
    this.apply(initial ?? {});
    return this.current;
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

  private apply(incoming: VideoContext): void {
    const next = this.accept(incoming);
    if (sameContext(next, this.current)) return;
    this.current = next;
    for (const listener of this.listeners) listener(next);
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
