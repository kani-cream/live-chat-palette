import { isHtmlElement } from './query';
import { CHAT_SELECTORS } from './selectors';

export const MOUNT_ROOT_ATTRIBUTE = 'data-live-chat-palette-root';

export interface PaletteAnchorAdapter {
  /** The native element the palette is mounted directly before (YouTube's message input block). */
  findAnchor(): HTMLElement | null;
  /** Container whose subtree the mount guard observes for reconstruction. */
  findObserveRoot(): Node;
}

export class DomPaletteAnchorAdapter implements PaletteAnchorAdapter {
  constructor(private readonly doc: Document) {}

  findAnchor(): HTMLElement | null {
    const candidates = [...this.doc.querySelectorAll(CHAT_SELECTORS.messageInputRenderer)].filter(
      isHtmlElement,
    );
    const candidate = candidates.length === 1 ? candidates[0] : undefined;
    return candidate?.parentElement ? candidate : null;
  }

  findObserveRoot(): Node {
    return this.doc.body;
  }
}
