/**
 * Ordered-strategy querying with fail-closed semantics:
 * - A strategy matches only when it yields exactly one element of the expected kind.
 * - Several distinct matches mean the DOM is ambiguous -> treat as not found.
 */
export const queryUnique = <T extends Element>(
  root: ParentNode,
  selectors: readonly string[],
  accept: (el: Element) => el is T,
): T | null => {
  for (const selector of selectors) {
    const matches = [...root.querySelectorAll(selector)].filter(accept);
    if (matches.length === 1) return matches[0] ?? null;
    if (matches.length > 1) return null;
  }
  return null;
};

export const isHtmlElement = (el: Element): el is HTMLElement => el instanceof HTMLElement;

export const isButtonElement = (el: Element): el is HTMLButtonElement =>
  el instanceof HTMLButtonElement;

export const isImageElement = (el: Element): el is HTMLImageElement =>
  el instanceof HTMLImageElement;

const HIDDEN_DISPLAY = /(^|;)\s*display\s*:\s*none/;

/** True when the element or an ancestor is explicitly hidden via attributes/inline style. */
export const isExplicitlyHidden = (el: Element): boolean => {
  let current: Element | null = el;
  while (current) {
    if (current.hasAttribute('hidden')) return true;
    if (current.getAttribute('aria-hidden') === 'true') return true;
    const style = current.getAttribute('style');
    if (style && HIDDEN_DISPLAY.test(style)) return true;
    current = current.parentElement;
  }
  return false;
};
