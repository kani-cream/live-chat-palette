import { describe, expect, it, vi } from 'vitest';
import { ContextPublisher } from '../../../src/content/watch/ContextPublisher';
import type { VideoContext } from '../../../src/domain/context';
import type { WatchContextAdapter } from '../../../src/youtube/WatchContextAdapter';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';

const setup = () => {
  let current: VideoContext = { videoId: 'aaaaaaaaaaa', channelId: CH_A };
  const adapter: WatchContextAdapter = {
    detectVideoId: () => current.videoId ?? null,
    detectChannelId: () => current.channelId ?? null,
    detectChannelName: () => current.channelName ?? null,
    detectContext: () => current,
  };
  const publish = vi.fn(() => Promise.resolve());
  const publisher = new ContextPublisher({
    adapter,
    publish,
    events: document,
    pollIntervalMs: 20,
  });
  return {
    publisher,
    publish,
    setContext: (c: VideoContext) => {
      current = c;
    },
  };
};

describe('ContextPublisher', () => {
  it('publishes the initial context once and ignores identical re-detections', () => {
    const { publisher, publish } = setup();
    publisher.start();
    publisher.check();
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(publish).toHaveBeenCalledTimes(1);
    publisher.stop();
  });
  it('publishes on SPA navigation events when the context changed', () => {
    const { publisher, publish, setContext } = setup();
    publisher.start();
    setContext({ videoId: 'bbbbbbbbbbb', channelId: CH_B });
    document.dispatchEvent(new Event('yt-navigate-finish'));
    expect(publish).toHaveBeenLastCalledWith({ videoId: 'bbbbbbbbbbb', channelId: CH_B });
    setContext({ videoId: 'bbbbbbbbbbb' });
    document.dispatchEvent(new Event('popstate'));
    expect(publish).toHaveBeenLastCalledWith({ videoId: 'bbbbbbbbbbb' });
    expect(publish).toHaveBeenCalledTimes(3);
    publisher.stop();
  });
  it('polls as a fallback and stops polling after stop()', async () => {
    const { publisher, publish, setContext } = setup();
    publisher.start();
    setContext({ videoId: 'ccccccccccc' });
    await new Promise((r) => setTimeout(r, 60));
    expect(publish).toHaveBeenLastCalledWith({ videoId: 'ccccccccccc' });
    publisher.stop();
    setContext({ videoId: 'ddddddddddd' });
    await new Promise((r) => setTimeout(r, 60));
    expect(publish).toHaveBeenCalledTimes(2);
  });
});
