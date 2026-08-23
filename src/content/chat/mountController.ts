import { logger } from '../../shared/logger';
import {
  MOUNT_ROOT_ATTRIBUTE,
  type PaletteAnchorAdapter,
} from '../../youtube/PaletteAnchorAdapter';

export interface MountedPalette {
  dispose: () => void;
}

export interface MountControllerOptions {
  doc: Document;
  anchor: PaletteAnchorAdapter;
  createPalette: (host: HTMLElement) => MountedPalette;
  debounceMs?: number;
}

export const DEFAULT_MOUNT_DEBOUNCE_MS = 200;

/**
 * Owns the palette host element lifecycle:
 * - mounts once before YouTube's message input (guarded by a root attribute)
 * - unmounts when the anchor disappears, remounts when it comes back
 * - reacts to DOM reconstruction through one debounced observer
 *
 * It deliberately does NOT re-render the palette on ordinary chat DOM churn (new chat messages
 * mutate the DOM many times per second). While the host stays connected, the mounted palette is
 * left untouched, so an in-progress preset form or the native chat draft is never rebuilt out from
 * under the user. Content updates come from the palette's own storage/context/theme subscriptions.
 */
export class MountController {
  private readonly debounceMs: number;
  private observer: MutationObserver | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private host: HTMLElement | null = null;
  private mounted: MountedPalette | null = null;

  constructor(private readonly options: MountControllerOptions) {
    this.debounceMs = options.debounceMs ?? DEFAULT_MOUNT_DEBOUNCE_MS;
  }

  start(): void {
    this.evaluate();
    this.observer = new MutationObserver(() => {
      this.schedule();
    });
    this.observer.observe(this.options.anchor.findObserveRoot(), {
      childList: true,
      subtree: true,
    });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.unmount();
  }

  isMounted(): boolean {
    return this.host?.isConnected ?? false;
  }

  /** Mount/unmount re-evaluation; exposed for tests and manual triggers. Never re-renders. */
  evaluate(): void {
    const anchor = this.options.anchor.findAnchor();
    if (!anchor) {
      this.unmount();
      return;
    }
    // Already mounted and still connected: leave the palette exactly as it is. This is the common
    // case on every chat-message mutation, and re-rendering here would wipe an open preset form.
    if (this.host?.isConnected) return;
    if (this.host && !this.host.isConnected) this.unmount();
    const existing = this.options.doc.querySelector(`[${MOUNT_ROOT_ATTRIBUTE}]`);
    if (existing) {
      logger.debug('another palette root is already mounted; skipping');
      return;
    }
    const host = this.options.doc.createElement('div');
    host.setAttribute(MOUNT_ROOT_ATTRIBUTE, 'true');
    anchor.before(host);
    this.host = host;
    this.mounted = this.options.createPalette(host);
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.evaluate();
    }, this.debounceMs);
  }

  private unmount(): void {
    this.mounted?.dispose();
    this.mounted = null;
    this.host?.remove();
    this.host = null;
  }
}
