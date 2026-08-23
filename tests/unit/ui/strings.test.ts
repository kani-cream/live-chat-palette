import { afterEach, describe, expect, it } from 'vitest';
import { STRINGS, resolveLang, setLang } from '../../../src/ui/strings';

afterEach(() => {
  setLang('en');
});

describe('resolveLang', () => {
  it('selects Japanese for ja variants and English otherwise', () => {
    expect(resolveLang('ja')).toBe('ja');
    expect(resolveLang('ja-JP')).toBe('ja');
    expect(resolveLang('JA')).toBe('ja');
    expect(resolveLang('en-US')).toBe('en');
    expect(resolveLang('fr')).toBe('en');
    expect(resolveLang('')).toBe('en');
  });
});

describe('setLang', () => {
  it('switches the live STRINGS binding and back', () => {
    expect(STRINGS.tabPreset).toBe('Presets');
    setLang('ja');
    expect(STRINGS.tabPreset).toBe('定型文');
    expect(STRINGS.insertPreset('やあ')).toContain('やあ');
    expect(STRINGS.addFavorite(':_wave:')).toContain(':_wave:');
    setLang('en');
    expect(STRINGS.tabPreset).toBe('Presets');
    expect(STRINGS.insertPreset('hi')).toBe('Insert preset: hi');
  });
});

describe('dictionary completeness', () => {
  it('English and Japanese expose exactly the same keys', () => {
    setLang('en');
    const enKeys = Object.keys(STRINGS).sort();
    setLang('ja');
    const jaKeys = Object.keys(STRINGS).sort();
    expect(jaKeys).toEqual(enKeys);
  });

  it('every Japanese entry is a non-empty string or function', () => {
    setLang('ja');
    for (const [key, value] of Object.entries(STRINGS)) {
      if (typeof value === 'function') {
        expect((value as (arg: string) => string)('x'), key).toBeTruthy();
      } else {
        expect(value, key).toBeTruthy();
      }
    }
  });
});
