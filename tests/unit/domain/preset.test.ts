import { describe, expect, it } from 'vitest';
import {
  isMessagePreset,
  movePreset,
  normalizeOrders,
  presetsForChannel,
  sortPresets,
  validatePresetText,
  type MessagePreset,
} from '../../../src/domain/preset';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';

const preset = (overrides: Partial<MessagePreset> & { id: string }): MessagePreset => ({
  text: `text-${overrides.id}`,
  scope: 'global',
  order: 0,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

describe('isMessagePreset', () => {
  it('accepts a valid global preset', () => {
    expect(isMessagePreset(preset({ id: 'a' }))).toBe(true);
  });
  it('accepts a valid channel preset', () => {
    expect(isMessagePreset(preset({ id: 'a', scope: 'channel', channelId: CH_A }))).toBe(true);
  });
  it.each([
    ['missing id', { ...preset({ id: 'a' }), id: '' }],
    ['wrong scope', { ...preset({ id: 'a' }), scope: 'team' }],
    ['channel scope without channelId', { ...preset({ id: 'a' }), scope: 'channel' }],
    [
      'channel scope with bad channelId',
      { ...preset({ id: 'a' }), scope: 'channel', channelId: 'nope' },
    ],
    ['global with channelId', { ...preset({ id: 'a' }), channelId: CH_A }],
    ['non-numeric order', { ...preset({ id: 'a' }), order: 'first' }],
    ['NaN order', { ...preset({ id: 'a' }), order: Number.NaN }],
    ['null', null],
    ['string', 'preset'],
  ])('rejects %s', (_label, value) => {
    expect(isMessagePreset(value)).toBe(false);
  });
});

describe('validatePresetText', () => {
  it('rejects empty text', () => {
    expect(validatePresetText('')).not.toBeNull();
  });
  it('accepts whitespace-only text (users may want leading/trailing spaces)', () => {
    expect(validatePresetText('  ')).toBeNull();
  });
  it('rejects text over the limit', () => {
    expect(validatePresetText('a'.repeat(201))).not.toBeNull();
    expect(validatePresetText('a'.repeat(200))).toBeNull();
  });
  it('accepts Japanese, emoji and newlines', () => {
    expect(validatePresetText('こんにちは🎉\n2行目')).toBeNull();
  });
});

describe('presetsForChannel', () => {
  const presets = [
    preset({ id: 'g2', order: 1 }),
    preset({ id: 'g1', order: 0 }),
    preset({ id: 'a1', scope: 'channel', channelId: CH_A, order: 0 }),
    preset({ id: 'b1', scope: 'channel', channelId: CH_B, order: 0 }),
  ];
  it('returns globals plus matching channel presets, sorted', () => {
    expect(presetsForChannel(presets, CH_A).map((p) => p.id)).toEqual(['g1', 'a1', 'g2']);
  });
  it('returns only globals when the channel is unknown', () => {
    expect(presetsForChannel(presets, undefined).map((p) => p.id)).toEqual(['g1', 'g2']);
  });
  it('never leaks another channel preset', () => {
    expect(presetsForChannel(presets, CH_B).map((p) => p.id)).not.toContain('a1');
  });
  it('does not mutate the input', () => {
    const copy = structuredClone(presets);
    presetsForChannel(presets, CH_A);
    expect(presets).toEqual(copy);
  });
});

describe('sortPresets', () => {
  it('breaks order ties by createdAt', () => {
    const list = [preset({ id: 'late', createdAt: 5 }), preset({ id: 'early', createdAt: 1 })];
    expect(sortPresets(list).map((p) => p.id)).toEqual(['early', 'late']);
  });
});

describe('normalizeOrders', () => {
  it('renumbers per scope group densely', () => {
    const list = [
      preset({ id: 'g', order: 7 }),
      preset({ id: 'a1', scope: 'channel', channelId: CH_A, order: 9 }),
      preset({ id: 'a2', scope: 'channel', channelId: CH_A, order: 3 }),
    ];
    const result = normalizeOrders(list);
    expect(result.find((p) => p.id === 'g')?.order).toBe(0);
    expect(result.find((p) => p.id === 'a2')?.order).toBe(0);
    expect(result.find((p) => p.id === 'a1')?.order).toBe(1);
  });
});

describe('movePreset', () => {
  const list = [
    preset({ id: 'g1', order: 0 }),
    preset({ id: 'g2', order: 1 }),
    preset({ id: 'g3', order: 2 }),
    preset({ id: 'a1', scope: 'channel', channelId: CH_A, order: 0 }),
  ];
  const ids = (l: MessagePreset[]): string[] =>
    sortPresets(l.filter((p) => p.scope === 'global')).map((p) => p.id);

  it('moves a preset up within its group', () => {
    expect(ids(movePreset(list, 'g2', 'up', 10))).toEqual(['g2', 'g1', 'g3']);
  });
  it('moves a preset down within its group', () => {
    expect(ids(movePreset(list, 'g2', 'down', 10))).toEqual(['g1', 'g3', 'g2']);
  });
  it('is a no-op at the boundaries', () => {
    expect(ids(movePreset(list, 'g1', 'up', 10))).toEqual(['g1', 'g2', 'g3']);
    expect(ids(movePreset(list, 'g3', 'down', 10))).toEqual(['g1', 'g2', 'g3']);
  });
  it('is a no-op for unknown ids and never touches other groups', () => {
    const result = movePreset(list, 'missing', 'up', 10);
    expect(ids(result)).toEqual(['g1', 'g2', 'g3']);
    expect(result.find((p) => p.id === 'a1')?.order).toBe(0);
  });
  it('stamps updatedAt on moved presets only', () => {
    const result = movePreset(list, 'g2', 'up', 99);
    expect(result.find((p) => p.id === 'g2')?.updatedAt).toBe(99);
    expect(result.find((p) => p.id === 'g1')?.updatedAt).toBe(99);
    expect(result.find((p) => p.id === 'g3')?.updatedAt).toBe(1);
  });
  it('does not mutate the input', () => {
    const copy = structuredClone(list);
    movePreset(list, 'g2', 'up', 10);
    expect(list).toEqual(copy);
  });
});
