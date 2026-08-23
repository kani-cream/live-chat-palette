import { describe, expect, it, vi } from 'vitest';
import { MessageRouter } from '../../../src/messaging/router';
import { SessionContextStore } from '../../../src/storage/SessionContextStore';
import { FakeStorageArea } from '../../helpers/fakeChrome';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';

const setup = (area = new FakeStorageArea()) => {
  const broadcastToTab = vi.fn(() => Promise.resolve());
  const openOptionsPage = vi.fn(() => Promise.resolve());
  const router = new MessageRouter({
    contexts: new SessionContextStore(area),
    broadcastToTab,
    openOptionsPage,
  });
  return { router, broadcastToTab, openOptionsPage, area };
};

describe('MessageRouter', () => {
  it('stores CONTEXT_UPDATED per tab and broadcasts it to that tab', async () => {
    const { router, broadcastToTab } = setup();
    const context = { videoId: 'dQw4w9WgXcQ', channelId: CH_A };
    const reply = await router.handle({ type: 'CONTEXT_UPDATED', context }, { tabId: 5 });
    expect(reply).toEqual({ type: 'ACK' });
    expect(broadcastToTab).toHaveBeenCalledWith(5, { type: 'CONTEXT_UPDATED', context });
    expect(await router.handle({ type: 'GET_CONTEXT' }, { tabId: 5 })).toEqual({
      type: 'CONTEXT_RESPONSE',
      context,
    });
  });
  it('keeps contexts isolated between tabs', async () => {
    const { router } = setup();
    await router.handle({ type: 'CONTEXT_UPDATED', context: { channelId: CH_A } }, { tabId: 1 });
    expect(await router.handle({ type: 'GET_CONTEXT' }, { tabId: 2 })).toEqual({
      type: 'CONTEXT_RESPONSE',
      context: null,
    });
  });
  it('ignores messages without a tab (not from a content script)', async () => {
    const { router, broadcastToTab } = setup();
    expect(await router.handle({ type: 'CONTEXT_UPDATED', context: {} }, {})).toBeNull();
    expect(broadcastToTab).not.toHaveBeenCalled();
    expect(await router.handle({ type: 'GET_CONTEXT' }, {})).toEqual({
      type: 'CONTEXT_RESPONSE',
      context: null,
    });
  });
  it('drops invalid messages', async () => {
    const { router } = setup();
    expect(await router.handle({ type: 'HACK' }, { tabId: 1 })).toBeNull();
    expect(await router.handle(undefined, { tabId: 1 })).toBeNull();
  });
  it('opens the options page on request', async () => {
    const { router, openOptionsPage } = setup();
    expect(await router.handle({ type: 'OPEN_OPTIONS' }, { tabId: 1 })).toEqual({ type: 'ACK' });
    expect(openOptionsPage).toHaveBeenCalledTimes(1);
  });
  it('forgets a tab when it closes', async () => {
    const { router } = setup();
    await router.handle({ type: 'CONTEXT_UPDATED', context: { channelId: CH_A } }, { tabId: 1 });
    await router.handleTabRemoved(1);
    expect(await router.handle({ type: 'GET_CONTEXT' }, { tabId: 1 })).toEqual({
      type: 'CONTEXT_RESPONSE',
      context: null,
    });
  });
  it('serves contexts after a service worker restart (fresh router, same session area)', async () => {
    const area = new FakeStorageArea();
    const first = setup(area);
    await first.router.handle(
      { type: 'CONTEXT_UPDATED', context: { channelId: CH_A } },
      { tabId: 9 },
    );
    const second = setup(area);
    expect(await second.router.handle({ type: 'GET_CONTEXT' }, { tabId: 9 })).toEqual({
      type: 'CONTEXT_RESPONSE',
      context: { channelId: CH_A },
    });
  });
});
