import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type FrameLocator,
  type Page,
  type Worker,
} from '@playwright/test';
import type { HarnessEmojiCategory } from '../fixtures/harness';
import { renderLiveChatPage, type LiveChatFixtureOptions } from '../fixtures/liveChatPage';
import { renderWatchPage, type WatchPageOptions } from '../fixtures/watchPage';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../..');
export const DIST = path.join(ROOT, 'dist');
const HARNESS_FILE = path.join(ROOT, 'tests/fixtures/harness.js');

export const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
export const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';
export const VIDEO_A = 'aaaaaaaaaaa';
export const VIDEO_B = 'bbbbbbbbbbb';

export const CATEGORIES_A: HarnessEmojiCategory[] = [
  {
    name: 'Channel A members',
    emojis: [
      { name: ':_wave:', id: `${CH_A}/wave`, src: '/fixtures/emoji.png' },
      { name: ':_heart:', id: `${CH_A}/heart`, src: '/fixtures/emoji.png' },
    ],
  },
  {
    name: 'Smileys',
    emojis: [{ name: '😀', id: '😀', src: '/fixtures/emoji.png' }],
  },
];

export const CATEGORIES_B: HarnessEmojiCategory[] = [
  {
    name: 'Channel B members',
    emojis: [{ name: ':_b_party:', id: `${CH_B}/party`, src: '/fixtures/emoji.png' }],
  },
];

/** What the fake youtube.com serves. Mutable so tests can simulate server-side changes. */
export interface YouTubeScenario {
  watch: Record<string, WatchPageOptions>;
  chat: Record<string, LiveChatFixtureOptions>;
  /** Fallback chat fixture for unknown video ids / continuation URLs. */
  defaultChat?: LiveChatFixtureOptions;
}

const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

export const defaultScenario = (): YouTubeScenario => ({
  watch: {
    [VIDEO_A]: {
      videoId: VIDEO_A,
      channelId: CH_A,
      channelName: 'Channel A',
      ownerChannelLink: true,
      headMeta: true,
    },
    [VIDEO_B]: {
      videoId: VIDEO_B,
      channelId: CH_B,
      channelName: 'Channel B',
      ownerChannelLink: true,
      headMeta: true,
    },
  },
  chat: {
    [VIDEO_A]: { harness: { categories: CATEGORIES_A } },
    [VIDEO_B]: { harness: { categories: CATEGORIES_B } },
  },
  defaultChat: { harness: { categories: [] } },
});

export const installYouTubeMock = async (
  context: BrowserContext,
  scenario: YouTubeScenario,
): Promise<void> => {
  const harness = await readFile(HARNESS_FILE, 'utf8');
  await context.route('https://www.youtube.com/**', async (route) => {
    const url = new URL(route.request().url());
    const videoId = url.searchParams.get('v') ?? '';
    if (url.pathname === '/fixtures/harness.js') {
      await route.fulfill({ contentType: 'application/javascript', body: harness });
      return;
    }
    if (url.pathname === '/fixtures/emoji.png') {
      await route.fulfill({ contentType: 'image/png', body: TRANSPARENT_PNG });
      return;
    }
    if (url.pathname === '/watch') {
      const options = scenario.watch[videoId];
      if (!options) {
        await route.fulfill({ status: 404, contentType: 'text/html', body: 'no such video' });
        return;
      }
      await route.fulfill({ contentType: 'text/html', body: renderWatchPage(options) });
      return;
    }
    if (url.pathname === '/live_chat') {
      const options = scenario.chat[videoId] ?? scenario.defaultChat ?? {};
      await route.fulfill({ contentType: 'text/html', body: renderLiveChatPage(options) });
      return;
    }
    if (url.pathname.startsWith('/embed/')) {
      await route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><html><body><div id="player">embed</div></body></html>',
      });
      return;
    }
    await route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><body><h1>Fake YouTube</h1><p>${url.pathname}</p></body></html>`,
    });
  });
};

export interface ExtensionFixtures {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  scenario: YouTubeScenario;
  page: Page;
}

export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(os.tmpdir(), 'lcp-e2e-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      channel: 'chromium',
      headless: true,
      // Pin the UI language so locale-dependent assertions are deterministic in CI.
      args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`, '--lang=en-US'],
    });
    await use(context);
    await context.close();
    await rm(userDataDir, { recursive: true, force: true });
  },
  serviceWorker: async ({ context }, use) => {
    const existing = context.serviceWorkers()[0];
    const worker = existing ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
  scenario: async ({ context }, use) => {
    const scenario = defaultScenario();
    await installYouTubeMock(context, scenario);
    await use(scenario);
  },
  page: async ({ context, scenario }, use) => {
    void scenario;
    const page = await context.newPage();
    await use(page);
    await page.close();
  },
});

export { expect };

export const watchUrl = (videoId: string): string => `https://www.youtube.com/watch?v=${videoId}`;
export const popupChatUrl = (videoId: string): string =>
  `https://www.youtube.com/live_chat?is_popout=1&v=${videoId}`;

/** Locator scoped to the Live Chat iframe on a watch page. */
export const chatFrame = (page: Page): FrameLocator => page.frameLocator('#chatframe');

/** The palette root inside a chat frame (or top-level popup chat). */
export const palette = (scope: Page | FrameLocator) =>
  scope.locator('[data-live-chat-palette-root]');

export const openWatchPage = async (page: Page, videoId: string) => {
  await page.goto(watchUrl(videoId));
  const frame = chatFrame(page);
  await expect(palette(frame).locator('[data-testid="lcp-panel"]')).toBeVisible();
  return frame;
};

export const harnessState = (scope: Page | FrameLocator) =>
  scope.locator('body').evaluate((_el) => {
    const api = (
      window as unknown as { __lcpHarness?: { state: unknown; readInput: () => string } }
    ).__lcpHarness;
    if (!api) throw new Error('harness missing');
    return {
      ...(api.state as { sent: string[]; sendClicks: number; pickerOpens: number }),
      input: api.readInput(),
    };
  });

export const harnessCall = (scope: Page | FrameLocator, method: string, ...args: unknown[]) =>
  scope.locator('body').evaluate(
    (_el, [m, a]) => {
      const api = (
        window as unknown as { __lcpHarness?: Record<string, (...x: unknown[]) => unknown> }
      ).__lcpHarness;
      if (!api) throw new Error('harness missing');
      const fn = api[m];
      if (typeof fn !== 'function') throw new Error(`harness.${m} missing`);
      return fn(...a);
    },
    [method, args] as [string, unknown[]],
  );

export const clearExtensionStorage = async (serviceWorker: Worker) => {
  await serviceWorker.evaluate(async () => {
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
  });
};

export const readExtensionStorage = (serviceWorker: Worker) =>
  serviceWorker.evaluate(async () => {
    const all = await chrome.storage.local.get(null);
    return all.liveChatPalette as {
      presets: { text: string; scope: string; channelId?: string }[];
      favoriteEmojis: { channelId: string; familyName: string; emojiName: string }[];
      settings: { presetInstantSend: boolean; collapsed: boolean; lastSelectedTab: string };
    };
  });

export const seedExtensionStorage = async (
  serviceWorker: Worker,
  data: Record<string, unknown>,
) => {
  await serviceWorker.evaluate(async (value) => {
    await chrome.storage.local.set({ liveChatPalette: value });
  }, data);
};
