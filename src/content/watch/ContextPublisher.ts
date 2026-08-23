import { sameContext, type VideoContext } from '../../domain/context';
import type { WatchContextAdapter } from '../../youtube/WatchContextAdapter';

export interface ContextPublisherOptions {
  adapter: WatchContextAdapter;
  publish: (context: VideoContext) => Promise<void>;
  /** Event target that receives YouTube's SPA navigation events (document). */
  events: EventTarget;
  /** Fallback poll interval; YouTube populates owner metadata asynchronously. */
  pollIntervalMs?: number;
}

/** YouTube dispatches these on its document during SPA navigation. */
export const NAVIGATION_EVENTS = [
  'yt-navigate-finish',
  'yt-page-data-updated',
  'popstate',
] as const;

/**
 * Detects the watch-page context and publishes it whenever it changes.
 * Publishing is idempotent per distinct context, so repeated polls are cheap and quiet.
 */
export class ContextPublisher {
  private last: VideoContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly onEvent = (): void => {
    this.check();
  };
  private readonly pollIntervalMs: number;

  constructor(private readonly options: ContextPublisherOptions) {
    this.pollIntervalMs = options.pollIntervalMs ?? 1000;
  }

  start(): void {
    for (const name of NAVIGATION_EVENTS) this.options.events.addEventListener(name, this.onEvent);
    this.timer = setInterval(this.onEvent, this.pollIntervalMs);
    this.check();
  }

  stop(): void {
    for (const name of NAVIGATION_EVENTS) {
      this.options.events.removeEventListener(name, this.onEvent);
    }
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** Detect now and publish if changed. Exposed for tests. */
  check(): void {
    const context = this.options.adapter.detectContext();
    if (sameContext(context, this.last)) return;
    this.last = context;
    void this.options.publish(context);
  }
}
