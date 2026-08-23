import { describe, expect, it } from 'vitest';
import {
  CURRENT_SCHEMA_VERSION,
  createDefaultSchema,
  DEFAULT_SETTINGS,
  sanitizeSchema,
} from '../../../src/storage/schema';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';

describe('createDefaultSchema', () => {
  it('has version 1, safe defaults and empty collections', () => {
    const schema = createDefaultSchema();
    expect(schema.schemaVersion).toBe(1);
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(schema.settings).toEqual({
      presetInstantSend: false,
      collapsed: false,
      lastSelectedTab: 'emoji',
    });
    expect(schema.presets).toEqual([]);
    expect(schema.favoriteEmojis).toEqual([]);
    expect(schema.channels).toEqual({});
  });
  it('instant send is off by default', () => {
    expect(DEFAULT_SETTINGS.presetInstantSend).toBe(false);
  });
});

describe('sanitizeSchema', () => {
  it('returns defaults for non-object input', () => {
    expect(sanitizeSchema(undefined)).toEqual(createDefaultSchema());
    expect(sanitizeSchema('garbage')).toEqual(createDefaultSchema());
    expect(sanitizeSchema([1, 2])).toEqual(createDefaultSchema());
  });
  it('fills missing settings and drops invalid setting values', () => {
    const schema = sanitizeSchema({
      settings: { presetInstantSend: 'yes', collapsed: true, lastSelectedTab: 'nope' },
    });
    expect(schema.settings).toEqual({
      presetInstantSend: false,
      collapsed: true,
      lastSelectedTab: 'emoji',
    });
  });
  it('drops invalid presets/favorites and keeps valid ones', () => {
    const valid = { id: 'p1', text: 'hi', scope: 'global', order: 3, createdAt: 1, updatedAt: 1 };
    const schema = sanitizeSchema({
      presets: [valid, { id: 'bad' }, null, { ...valid, id: 'p2', scope: 'channel' }],
      favoriteEmojis: [
        {
          id: 'f1',
          channelId: CH_A,
          familyName: 'm',
          emojiName: ':_a:',
          displayName: 'a',
          lastSeenAt: 1,
        },
        { id: 'f2', channelId: 'x' },
      ],
    });
    expect(schema.presets.map((p) => p.id)).toEqual(['p1']);
    expect(schema.presets[0]?.order).toBe(0);
    expect(schema.favoriteEmojis.map((f) => f.id)).toEqual(['f1']);
  });
  it('dedupes entries by id', () => {
    const p = { id: 'p1', text: 'hi', scope: 'global', order: 0, createdAt: 1, updatedAt: 1 };
    expect(sanitizeSchema({ presets: [p, { ...p, text: 'dup' }] }).presets).toHaveLength(1);
  });
  it('drops malformed channel records and mismatched keys', () => {
    const schema = sanitizeSchema({
      channels: {
        [CH_A]: { channelId: CH_A, channelName: 'A', lastSeenAt: 5 },
        UCbbbbbbbbbbbbbbbbbbbbbb: { channelId: CH_A, lastSeenAt: 5 },
        junk: 'x',
      },
    });
    expect(Object.keys(schema.channels)).toEqual([CH_A]);
    expect(schema.channels[CH_A]).toEqual({ channelId: CH_A, channelName: 'A', lastSeenAt: 5 });
  });
  it('always stamps the current schema version', () => {
    expect(sanitizeSchema({ schemaVersion: 99 }).schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });
});
