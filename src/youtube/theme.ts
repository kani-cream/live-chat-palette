export type Theme = 'light' | 'dark';

/** YouTube marks dark mode with a `dark` attribute on <html>; fall back to the OS preference. */
export const detectTheme = (doc: Document, win: Pick<Window, 'matchMedia'> | null): Theme => {
  if (doc.documentElement.hasAttribute('dark')) return 'dark';
  if (doc.documentElement.hasAttribute('light')) return 'light';
  if (win && typeof win.matchMedia === 'function') {
    if (win.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  }
  return 'light';
};

export const observeTheme = (
  doc: Document,
  win: Pick<Window, 'matchMedia'> | null,
  onChange: (theme: Theme) => void,
): (() => void) => {
  let last = detectTheme(doc, win);
  const emit = (): void => {
    const next = detectTheme(doc, win);
    if (next === last) return;
    last = next;
    onChange(next);
  };
  const observer = new MutationObserver(emit);
  observer.observe(doc.documentElement, { attributes: true, attributeFilter: ['dark', 'light'] });
  const media =
    win && typeof win.matchMedia === 'function'
      ? win.matchMedia('(prefers-color-scheme: dark)')
      : null;
  media?.addEventListener('change', emit);
  return () => {
    observer.disconnect();
    media?.removeEventListener('change', emit);
  };
};
