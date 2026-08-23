import { describe, expect, it } from 'vitest';
import { isChannelId, isVideoContext, isVideoId, sameContext } from '../../../src/domain/context';

describe('identifiers', () => {
  it('validates channel ids', () => {
    expect(isChannelId('UCaaaaaaaaaaaaaaaaaaaaaa')).toBe(true);
    expect(isChannelId('UCaaaaaaaaaaaaaaaaaaaa')).toBe(false);
    expect(isChannelId('@handle')).toBe(false);
    expect(isChannelId(12)).toBe(false);
  });
  it('validates video ids', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('short')).toBe(false);
    expect(isVideoId(null)).toBe(false);
  });
});

describe('isVideoContext', () => {
  it('accepts empty and partial contexts', () => {
    expect(isVideoContext({})).toBe(true);
    expect(isVideoContext({ videoId: 'dQw4w9WgXcQ' })).toBe(true);
    expect(isVideoContext({ channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa', channelName: 'n' })).toBe(true);
  });
  it('rejects malformed fields', () => {
    expect(isVideoContext({ videoId: 'x' })).toBe(false);
    expect(isVideoContext({ channelId: 'x' })).toBe(false);
    expect(isVideoContext({ channelName: 1 })).toBe(false);
    expect(isVideoContext(null)).toBe(false);
  });
});

describe('sameContext', () => {
  it('compares by value including null', () => {
    expect(sameContext({ videoId: 'dQw4w9WgXcQ' }, { videoId: 'dQw4w9WgXcQ' })).toBe(true);
    expect(sameContext({ videoId: 'dQw4w9WgXcQ' }, {})).toBe(false);
    expect(sameContext(null, {})).toBe(true);
  });
});
