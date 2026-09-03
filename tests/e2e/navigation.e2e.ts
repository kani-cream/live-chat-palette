import {
  CH_A,
  CH_B,
  VIDEO_A,
  VIDEO_B,
  chatFrame,
  clearExtensionStorage,
  expect,
  palette,
  popupChatUrl,
  seedExtensionStorage,
  test,
  watchUrl,
} from './extension';

const seedBothChannels = (serviceWorker: Parameters<typeof seedExtensionStorage>[0]) =>
  seedExtensionStorage(serviceWorker, {
    schemaVersion: 1,
    settings: { presetInstantSend: false, collapsed: false, lastSelectedTab: 'preset' },
    presets: [
      { id: 'g', text: 'global', scope: 'global', order: 0, createdAt: 0, updatedAt: 0 },
      {
        id: 'a',
        text: 'for A',
        scope: 'channel',
        channelId: CH_A,
        order: 1,
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'b',
        text: 'for B',
        scope: 'channel',
        channelId: CH_B,
        order: 2,
        createdAt: 2,
        updatedAt: 2,
      },
    ],
    favoriteEmojis: [],
    channels: {},
  });

test.describe('SPA navigation and iframe handling', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await clearExtensionStorage(serviceWorker);
  });

  test('switches channel presets on SPA navigation without keeping the old channel', async ({
    page,
    serviceWorker,
  }) => {
    await seedBothChannels(serviceWorker);
    await page.goto(watchUrl(VIDEO_A));
    const root = palette(chatFrame(page));
    await expect(root.locator('.lcp-preset-chip')).toHaveText(['for A', 'global']);
    await expect(
      root.locator('[data-testid="preset-section-channel"] .lcp-preset-chip'),
    ).toHaveText(['for A']);

    // Simulate YouTube swapping the video (and chat iframe src) without a full reload.
    await page.evaluate(
      ([videoId, channelId]) => {
        (
          window as unknown as {
            __lcpNavigate: (opts: {
              videoId: string;
              channelId: string;
              channelName: string;
              ownerChannelLink: boolean;
              chatSrc: string;
            }) => void;
          }
        ).__lcpNavigate({
          videoId,
          channelId,
          channelName: 'Channel B',
          ownerChannelLink: true,
          chatSrc: `https://www.youtube.com/live_chat?v=${videoId}`,
        });
      },
      [VIDEO_B, CH_B] as const,
    );

    const rootB = palette(chatFrame(page));
    // Channel A presets are gone, channel B presets appear, globals remain — in section order.
    await expect(rootB.locator('.lcp-preset-chip')).toHaveText(['for B', 'global']);
    await expect(
      rootB.locator('[data-testid="preset-section-channel"] .lcp-preset-chip'),
    ).toHaveText(['for B']);
    await expect(
      rootB.locator('[data-testid="preset-section-global"] .lcp-preset-chip'),
    ).toHaveText(['global']);
    // Exactly one palette instance, not double-mounted.
    await expect(palette(chatFrame(page))).toHaveCount(1);
  });

  test('ignores irrelevant frames and only mounts in the chat frame', async ({
    page,
    scenario,
  }) => {
    scenario.watch[VIDEO_A] = {
      ...scenario.watch[VIDEO_A],
      videoId: VIDEO_A,
      irrelevantFrameSrc: 'https://www.youtube.com/embed/xxxxxxxxxxx',
    };
    await page.goto(watchUrl(VIDEO_A));
    await expect(palette(chatFrame(page)).locator('[data-testid="lcp-panel"]')).toBeVisible();
    // No palette in the top frame or the embed frame.
    await expect(palette(page)).toHaveCount(0);
    await expect(
      page.frameLocator('#irrelevant').locator('[data-live-chat-palette-root]'),
    ).toHaveCount(0);
  });

  test('popup live chat mounts and fails closed on channel presets (best-effort)', async ({
    page,
    serviceWorker,
  }) => {
    await seedBothChannels(serviceWorker);
    const popup = await page.context().newPage();
    await popup.goto(popupChatUrl(VIDEO_A));
    const root = palette(popup);
    await expect(root.locator('[data-testid="lcp-panel"]')).toBeVisible();
    await root.getByRole('tab', { name: 'Presets' }).click();
    // The popup tab has no resolved channel, so only global presets appear; it never
    // guesses a channel from the video id alone (design §31 best-effort / fail closed).
    await expect(root.locator('.lcp-preset-chip')).toHaveText(['global']);
    await expect(root.locator('[data-testid="preset-section-channel"]')).toHaveCount(0);
    await popup.close();
  });
});
