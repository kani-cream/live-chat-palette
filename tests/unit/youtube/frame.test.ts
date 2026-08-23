import { describe, expect, it } from 'vitest';
import { detectFrameRole, videoIdFromChatUrl } from '../../../src/youtube/frame';

describe('detectFrameRole', () => {
  it('identifies the main watch frame', () => {
    expect(
      detectFrameRole({ href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', isTopFrame: true }),
    ).toBe('watch');
    expect(
      detectFrameRole({ href: 'https://www.youtube.com/live/dQw4w9WgXcQ', isTopFrame: true }),
    ).toBe('watch');
  });
  it('identifies live chat frames whether embedded or popped out', () => {
    expect(
      detectFrameRole({
        href: 'https://www.youtube.com/live_chat?continuation=abc',
        isTopFrame: false,
      }),
    ).toBe('chat');
    expect(
      detectFrameRole({
        href: 'https://www.youtube.com/live_chat?is_popout=1&v=dQw4w9WgXcQ',
        isTopFrame: true,
      }),
    ).toBe('chat');
  });
  it('ignores irrelevant frames', () => {
    expect(detectFrameRole({ href: 'https://www.youtube.com/watch?v=x', isTopFrame: false })).toBe(
      'irrelevant',
    );
    expect(detectFrameRole({ href: 'https://www.youtube.com/embed/abc', isTopFrame: false })).toBe(
      'irrelevant',
    );
    expect(detectFrameRole({ href: 'https://www.youtube.com/', isTopFrame: true })).toBe(
      'irrelevant',
    );
    expect(
      detectFrameRole({ href: 'https://www.youtube.com/live_chat_replay?v=x', isTopFrame: false }),
    ).toBe('irrelevant');
    expect(detectFrameRole({ href: 'https://m.youtube.com/watch?v=x', isTopFrame: true })).toBe(
      'irrelevant',
    );
    expect(detectFrameRole({ href: 'http://www.youtube.com/watch?v=x', isTopFrame: true })).toBe(
      'irrelevant',
    );
    expect(detectFrameRole({ href: 'https://evil.example/live_chat', isTopFrame: false })).toBe(
      'irrelevant',
    );
    expect(detectFrameRole({ href: 'not a url', isTopFrame: true })).toBe('irrelevant');
  });
});

describe('videoIdFromChatUrl', () => {
  it('extracts a valid v param', () => {
    expect(videoIdFromChatUrl('https://www.youtube.com/live_chat?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ',
    );
  });
  it('returns null for missing or malformed ids', () => {
    expect(videoIdFromChatUrl('https://www.youtube.com/live_chat?continuation=abc')).toBeNull();
    expect(videoIdFromChatUrl('https://www.youtube.com/live_chat?v=bad')).toBeNull();
    expect(videoIdFromChatUrl('::')).toBeNull();
  });
});
