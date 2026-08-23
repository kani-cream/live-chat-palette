import { describe, expect, it, vi } from 'vitest';
import { detectTheme, observeTheme } from '../../../src/youtube/theme';

const matchMediaFor = (dark: boolean) => {
  const listeners = new Set<() => void>();
  const mql = {
    matches: dark,
    addEventListener: (_: string, l: () => void) => listeners.add(l),
    removeEventListener: (_: string, l: () => void) => listeners.delete(l),
  };
  return {
    win: { matchMedia: () => mql as unknown as MediaQueryList },
    setDark: (value: boolean) => {
      mql.matches = value;
      for (const l of listeners) l();
    },
    listeners,
  };
};

describe('detectTheme', () => {
  it('prefers the html[dark] attribute YouTube sets', () => {
    document.documentElement.setAttribute('dark', '');
    expect(detectTheme(document, matchMediaFor(false).win)).toBe('dark');
  });
  it('falls back to the OS preference', () => {
    expect(detectTheme(document, matchMediaFor(true).win)).toBe('dark');
    expect(detectTheme(document, matchMediaFor(false).win)).toBe('light');
    expect(detectTheme(document, null)).toBe('light');
  });
});

describe('observeTheme', () => {
  it('reports attribute and media changes, and stops after dispose', async () => {
    const media = matchMediaFor(false);
    const onChange = vi.fn();
    const stop = observeTheme(document, media.win, onChange);
    document.documentElement.setAttribute('dark', '');
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange).toHaveBeenLastCalledWith('dark');
    document.documentElement.removeAttribute('dark');
    media.setDark(true);
    expect(onChange).toHaveBeenLastCalledWith('dark');
    media.setDark(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(onChange).toHaveBeenLastCalledWith('light');
    stop();
    expect(media.listeners.size).toBe(0);
  });
});
