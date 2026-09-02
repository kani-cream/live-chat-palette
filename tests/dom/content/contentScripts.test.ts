import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createChatContentScript } from '../../../src/content/chat/chatContent';
import { createWatchContentScript } from '../../../src/content/watch/watchContent';
import { MOUNT_ROOT_ATTRIBUTE } from '../../../src/youtube/PaletteAnchorAdapter';
import { installFakeChrome } from '../../helpers/fakeChromeGlobal';
import { CH_A, mountLiveChat } from '../../helpers/liveChatDom';

type MessageListener = (event: MessageEvent) => void;

const fakeWindow = (href: string, isTop: boolean) => {
  const listeners: MessageListener[] = [];
  const posted: unknown[] = [];
  const win = {
    location: new URL(href),
    matchMedia: undefined,
    addEventListener: (type: string, listener: MessageListener) => {
      if (type === 'message') listeners.push(listener);
    },
    postMessage: (message: unknown) => {
      posted.push(message);
    },
  } as unknown as Window & {
    top: Window | null;
    deliver: (data: unknown) => void;
    posted: unknown[];
  };
  win.top = isTop ? win : ({} as Window);
  win.posted = posted;
  win.deliver = (data: unknown) => {
    for (const listener of listeners) listener({ source: win, data } as unknown as MessageEvent);
  };
  return win;
};

describe('content script frame roles', () => {
  let chromeEnv: ReturnType<typeof installFakeChrome>;
  beforeEach(() => {
    chromeEnv = installFakeChrome();
    chromeEnv.sendMessage.mockResolvedValue({ type: 'CONTEXT_RESPONSE', context: null });
  });
  afterEach(() => {
    chromeEnv.uninstall();
  });

  it('chat script initializes only in live chat frames', async () => {
    mountLiveChat();
    const embedded = createChatContentScript(
      document,
      fakeWindow('https://www.youtube.com/live_chat?continuation=abc', false),
    );
    expect(embedded).not.toBeNull();
    embedded?.start();
    await new Promise((r) => setTimeout(r, 0));
    expect(document.querySelectorAll(`[${MOUNT_ROOT_ATTRIBUTE}]`)).toHaveLength(1);
    embedded?.stop();
    expect(document.querySelectorAll(`[${MOUNT_ROOT_ATTRIBUTE}]`)).toHaveLength(0);
  });
  it('requests and caches the custom-emoji catalog posted from the MAIN world', async () => {
    mountLiveChat();
    const win = fakeWindow('https://www.youtube.com/live_chat?v=aaaaaaaaaaa', true);
    const controller = createChatContentScript(document, win);
    // On init it asks the MAIN-world script to (re)post the catalog.
    const posted = (win as unknown as { posted: Record<string, unknown>[] }).posted;
    expect(posted.some((m) => m.__lcpEmojiCatalogRequest === true)).toBe(true);
    // Delivering a catalog message caches the emojis in storage (no palette mount required).
    (win as unknown as { deliver: (d: unknown) => void }).deliver({
      __lcpEmojiCatalog: true,
      emojis: [
        {
          channelId: CH_A,
          familyName: 'Members',
          emojiName: ':_wave:',
          displayName: 'wave',
          imageUrl: 'https://img.example/wave.png',
        },
        {
          // Official stamp: cached under YouTube's own channelId, marked global. Its presence
          // must not confuse the "single channelId identifies this stream" context hint.
          channelId: 'UCkszU2WH9gy1mb0dV11UJgx',
          familyName: 'YouTube',
          emojiName: ':hourglass-purple-sand-orange:',
          displayName: 'hourglass',
          imageUrl: 'https://img.example/hourglass.png',
          global: true,
        },
        { channelId: 'bad', emojiName: '' }, // spoofed/invalid -> dropped
      ],
    });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const stored = await chromeEnv.local.get('liveChatPalette');
    const schema = stored.liveChatPalette as {
      emojiCatalog: Record<string, { emojiName: string; global?: true }[]>;
    };
    expect(schema.emojiCatalog[CH_A]?.map((e) => e.emojiName)).toEqual([':_wave:']);
    expect(schema.emojiCatalog.UCkszU2WH9gy1mb0dV11UJgx?.map((e) => e.global)).toEqual([true]);
    controller?.stop();
  });
  it('chat script also runs in a popped-out chat (top frame)', () => {
    mountLiveChat();
    expect(
      createChatContentScript(
        document,
        fakeWindow('https://www.youtube.com/live_chat?v=aaaaaaaaaaa', true),
      ),
    ).not.toBeNull();
  });
  it('chat script does nothing in the watch frame or irrelevant frames', () => {
    mountLiveChat();
    expect(
      createChatContentScript(
        document,
        fakeWindow('https://www.youtube.com/watch?v=aaaaaaaaaaa', true),
      ),
    ).toBeNull();
    expect(
      createChatContentScript(document, fakeWindow('https://www.youtube.com/embed/x', false)),
    ).toBeNull();
    expect(document.querySelectorAll(`[${MOUNT_ROOT_ATTRIBUTE}]`)).toHaveLength(0);
  });
  it('watch script initializes only in the top-level watch frame', () => {
    expect(
      createWatchContentScript(
        document,
        fakeWindow('https://www.youtube.com/watch?v=aaaaaaaaaaa', true),
      ),
    ).not.toBeNull();
    expect(
      createWatchContentScript(
        document,
        fakeWindow('https://www.youtube.com/watch?v=aaaaaaaaaaa', false),
      ),
    ).toBeNull();
    expect(
      createWatchContentScript(
        document,
        fakeWindow('https://www.youtube.com/live_chat?v=aaaaaaaaaaa', true),
      ),
    ).toBeNull();
    expect(
      createWatchContentScript(document, fakeWindow('https://www.youtube.com/', true)),
    ).toBeNull();
  });
  it('watch script publishes the detected context to the background', async () => {
    document.body.innerHTML = `<ytd-video-owner-renderer><a href="/channel/UCaaaaaaaaaaaaaaaaaaaaaa"></a></ytd-video-owner-renderer>`;
    const publisher = createWatchContentScript(
      document,
      fakeWindow('https://www.youtube.com/watch?v=aaaaaaaaaaa', true),
    );
    publisher?.start();
    await new Promise((r) => setTimeout(r, 0));
    expect(chromeEnv.sendMessage).toHaveBeenCalledWith({
      type: 'CONTEXT_UPDATED',
      context: { videoId: 'aaaaaaaaaaa', channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa' },
    });
    publisher?.stop();
  });
});
