import { describe, expect, it } from 'vitest';
import { resolveEmojiClick, resolvePresetClick } from '../../../src/application/clickPolicy';

describe('preset click policy', () => {
  it('inserts only by default', () => {
    expect(resolvePresetClick({ metaKey: false, ctrlKey: false }, false)).toBe('insert');
  });
  it('sends with Cmd or Ctrl', () => {
    expect(resolvePresetClick({ metaKey: true, ctrlKey: false }, false)).toBe('insert-and-send');
    expect(resolvePresetClick({ metaKey: false, ctrlKey: true }, false)).toBe('insert-and-send');
  });
  it('sends when presetInstantSend is enabled', () => {
    expect(resolvePresetClick({ metaKey: false, ctrlKey: false }, true)).toBe('insert-and-send');
  });
});

describe('emoji click policy', () => {
  it('never sends, regardless of modifiers', () => {
    expect(resolveEmojiClick({ metaKey: false, ctrlKey: false })).toBe('insert');
    expect(resolveEmojiClick({ metaKey: true, ctrlKey: false })).toBe('insert');
    expect(resolveEmojiClick({ metaKey: false, ctrlKey: true })).toBe('insert');
    expect(resolveEmojiClick({ metaKey: true, ctrlKey: true })).toBe('insert');
  });
});
