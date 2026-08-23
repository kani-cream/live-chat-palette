import { describe, expect, it, vi } from 'vitest';
import { ContextService } from '../../../src/application/ContextService';
import type { VideoContext } from '../../../src/domain/context';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';
const VIDEO_A = 'aaaaaaaaaaa';
const VIDEO_B = 'bbbbbbbbbbb';

const setup = (initial: VideoContext | null, ownVideoId: string | null = null) => {
  const listeners = new Set<(c: VideoContext) => void>();
  const service = new ContextService({
    request: () => Promise.resolve(initial),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ownVideoId,
  });
  const broadcast = (context: VideoContext): void => {
    for (const l of listeners) l(context);
  };
  return { service, broadcast, listeners };
};

describe('ContextService', () => {
  it('resolves the initial context from the background', async () => {
    const { service } = setup({ videoId: VIDEO_A, channelId: CH_A });
    expect(await service.start()).toEqual({ videoId: VIDEO_A, channelId: CH_A });
  });

  it('treats a null reply as unknown context', async () => {
    const { service } = setup(null);
    expect(await service.start()).toEqual({});
  });

  it('notifies listeners on broadcast changes only when something changed', async () => {
    const { service, broadcast } = setup({ videoId: VIDEO_A, channelId: CH_A });
    await service.start();
    const listener = vi.fn();
    service.onChange(listener);
    broadcast({ videoId: VIDEO_A, channelId: CH_A });
    expect(listener).not.toHaveBeenCalled();
    broadcast({ videoId: VIDEO_B, channelId: CH_B });
    expect(listener).toHaveBeenCalledWith({ videoId: VIDEO_B, channelId: CH_B });
    expect(service.context.channelId).toBe(CH_B);
  });

  it('rejects a context for a different video when the frame knows its own video (popup chat)', async () => {
    const { service, broadcast } = setup({ videoId: VIDEO_B, channelId: CH_B }, VIDEO_A);
    expect(await service.start()).toEqual({ videoId: VIDEO_A });
    broadcast({ videoId: VIDEO_A, channelId: CH_A });
    expect(service.context).toEqual({ videoId: VIDEO_A, channelId: CH_A });
  });

  it('fills in its own video id when the background context lacks one', async () => {
    const { service } = setup({ channelId: CH_A }, VIDEO_A);
    expect(await service.start()).toEqual({ channelId: CH_A, videoId: VIDEO_A });
  });

  it('fills in the channel from a local hint when the watch frame has not resolved one', async () => {
    const { service, broadcast } = setup({ videoId: VIDEO_A });
    await service.start();
    const listener = vi.fn();
    service.onChange(listener);
    service.applyChannelHint(CH_A);
    expect(service.context).toEqual({ videoId: VIDEO_A, channelId: CH_A });
    expect(listener).toHaveBeenCalledWith({ videoId: VIDEO_A, channelId: CH_A });
    // A later watch-frame update without a channelId keeps the hinted channel.
    broadcast({ videoId: VIDEO_A });
    expect(service.context.channelId).toBe(CH_A);
  });

  it('lets the watch-frame channelId take precedence over the hint', async () => {
    const { service, broadcast } = setup({ videoId: VIDEO_A });
    await service.start();
    service.applyChannelHint(CH_B);
    broadcast({ videoId: VIDEO_A, channelId: CH_A });
    expect(service.context.channelId).toBe(CH_A);
  });

  it('stops listening on stop()', async () => {
    const { service, broadcast, listeners } = setup({});
    await service.start();
    const listener = vi.fn();
    service.onChange(listener);
    service.stop();
    expect(listeners.size).toBe(0);
    broadcast({ channelId: CH_A });
    expect(listener).not.toHaveBeenCalled();
  });
});
