import { describe, expect, it } from 'vitest';
import { DomWatchContextAdapter } from '../../../src/youtube/WatchContextAdapter';
import { renderHeadMeta, renderOwnerBlock, type WatchPageOptions } from '../../fixtures/watchPage';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';
const VIDEO_A = 'aaaaaaaaaaa';
const VIDEO_B = 'bbbbbbbbbbb';

const mount = (
  options: WatchPageOptions,
  href = `https://www.youtube.com/watch?v=${options.videoId}`,
) => {
  document.head.innerHTML = renderHeadMeta(options);
  document.body.innerHTML = `<ytd-app><ytd-watch-flexy><div id="owner">${renderOwnerBlock(options)}</div></ytd-watch-flexy></ytd-app>`;
  return new DomWatchContextAdapter(document, () => new URL(href));
};

describe('DomWatchContextAdapter.detectVideoId', () => {
  it('reads v= on /watch and the path on /live/', () => {
    expect(mount({ videoId: VIDEO_A }).detectVideoId()).toBe(VIDEO_A);
    expect(
      mount({ videoId: VIDEO_A }, `https://www.youtube.com/live/${VIDEO_A}?si=x`).detectVideoId(),
    ).toBe(VIDEO_A);
  });
  it('returns null elsewhere or for malformed ids', () => {
    expect(mount({ videoId: VIDEO_A }, 'https://www.youtube.com/').detectVideoId()).toBeNull();
    expect(
      mount({ videoId: VIDEO_A }, 'https://www.youtube.com/watch?v=bad').detectVideoId(),
    ).toBeNull();
  });
});

describe('DomWatchContextAdapter.detectChannelId', () => {
  it('uses an explicit /channel/UC... owner link', () => {
    expect(
      mount({ videoId: VIDEO_A, channelId: CH_A, ownerChannelLink: true }).detectChannelId(),
    ).toBe(CH_A);
  });
  it('uses fresh head metadata when the owner block only has a handle link', () => {
    expect(mount({ videoId: VIDEO_A, channelId: CH_A, headMeta: true }).detectChannelId()).toBe(
      CH_A,
    );
  });
  it('rejects stale head metadata after SPA navigation (identifier != current video)', () => {
    const adapter = mount({
      videoId: VIDEO_B,
      channelId: CH_A,
      headMeta: true,
      staleMetaVideoId: VIDEO_A,
    });
    expect(adapter.detectChannelId()).toBeNull();
  });
  it('fails closed with handle-only links and no metadata', () => {
    expect(mount({ videoId: VIDEO_A, channelId: CH_A }).detectChannelId()).toBeNull();
  });
  it('fails closed when several different channel links exist', () => {
    const adapter = mount({ videoId: VIDEO_A, channelId: CH_A, ownerChannelLink: true });
    const extra = document.createElement('a');
    extra.setAttribute('href', `/channel/${CH_B}`);
    document.querySelector('ytd-video-owner-renderer')?.append(extra);
    expect(adapter.detectChannelId()).toBeNull();
  });
  it('accepts duplicate links pointing at the same channel', () => {
    const adapter = mount({ videoId: VIDEO_A, channelId: CH_A, ownerChannelLink: true });
    expect(document.querySelectorAll(`a[href="/channel/${CH_A}"]`).length).toBeGreaterThan(1);
    expect(adapter.detectChannelId()).toBe(CH_A);
  });
  it('ignores malformed meta content', () => {
    document.head.innerHTML = `<meta itemprop="identifier" content="${VIDEO_A}"><meta itemprop="channelId" content="nope">`;
    document.body.innerHTML = '';
    const adapter = new DomWatchContextAdapter(
      document,
      () => new URL(`https://www.youtube.com/watch?v=${VIDEO_A}`),
    );
    expect(adapter.detectChannelId()).toBeNull();
  });
  it('never guesses from display text alone', () => {
    document.body.innerHTML = `<ytd-video-owner-renderer><ytd-channel-name><yt-formatted-string id="text"><a href="/@handle">${CH_A}</a></yt-formatted-string></ytd-channel-name></ytd-video-owner-renderer>`;
    const adapter = new DomWatchContextAdapter(
      document,
      () => new URL(`https://www.youtube.com/watch?v=${VIDEO_A}`),
    );
    expect(adapter.detectChannelId()).toBeNull();
  });
});

describe('DomWatchContextAdapter.detectChannelName / detectContext', () => {
  it('reads the owner name and builds a context without undefined keys', () => {
    const adapter = mount({
      videoId: VIDEO_A,
      channelId: CH_A,
      channelName: 'Channel A',
      ownerChannelLink: true,
    });
    expect(adapter.detectChannelName()).toBe('Channel A');
    expect(adapter.detectContext()).toEqual({
      videoId: VIDEO_A,
      channelId: CH_A,
      channelName: 'Channel A',
    });
  });
  it('falls back to fresh author metadata for the name', () => {
    document.head.innerHTML = renderHeadMeta({
      videoId: VIDEO_A,
      channelId: CH_A,
      channelName: 'Meta Name',
      headMeta: true,
    });
    document.body.innerHTML = '';
    const adapter = new DomWatchContextAdapter(
      document,
      () => new URL(`https://www.youtube.com/watch?v=${VIDEO_A}`),
    );
    expect(adapter.detectChannelName()).toBe('Meta Name');
  });
  it('omits unknown fields', () => {
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    const adapter = new DomWatchContextAdapter(
      document,
      () => new URL('https://www.youtube.com/feed'),
    );
    expect(adapter.detectContext()).toEqual({});
  });
});
