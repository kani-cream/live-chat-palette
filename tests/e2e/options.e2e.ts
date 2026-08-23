import {
  CH_A,
  VIDEO_A,
  chatFrame,
  clearExtensionStorage,
  expect,
  palette,
  readExtensionStorage,
  seedExtensionStorage,
  test,
  watchUrl,
} from './extension';

const optionsUrl = (extensionId: string): string =>
  `chrome-extension://${extensionId}/options/index.html`;

test.describe('options page', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await clearExtensionStorage(serviceWorker);
  });

  test('manages settings and presets, reflected live in an open palette', async ({
    page,
    context,
    extensionId,
    serviceWorker,
  }) => {
    // Palette open on a watch page.
    await page.goto(watchUrl(VIDEO_A));
    await expect(palette(chatFrame(page)).locator('[data-testid="lcp-panel"]')).toBeVisible();

    const options = await context.newPage();
    await options.goto(optionsUrl(extensionId));
    await expect(options.getByRole('heading', { name: 'Live Chat Palette' })).toBeVisible();

    // Toggle instant send.
    await options.locator('#preset-instant-send').check();
    await expect
      .poll(async () => (await readExtensionStorage(serviceWorker)).settings.presetInstantSend)
      .toBe(true);

    // Add a global preset.
    await options.getByPlaceholder('New global preset').fill('From options');
    await options.getByRole('button', { name: 'Add' }).click();
    await expect(options.locator('[data-section="global-presets"] .text')).toHaveText([
      'From options',
    ]);

    // The open palette reflects it live.
    const root = palette(chatFrame(page));
    await root.getByRole('tab', { name: 'Presets' }).click();
    await expect(root.getByRole('button', { name: 'Insert preset: From options' })).toBeVisible();

    // Edit then delete.
    await options.getByRole('button', { name: 'Edit: From options' }).click();
    await options.getByRole('textbox', { name: 'Preset text' }).fill('Edited');
    await options.getByRole('button', { name: 'Save' }).click();
    await expect(options.locator('[data-section="global-presets"] .text')).toHaveText(['Edited']);
    await options.getByRole('button', { name: 'Delete: Edited' }).click();
    await expect(options.locator('[data-section="global-presets"] .empty')).toBeVisible();
    await options.close();
  });

  test('lists and removes favorites grouped by channel', async ({
    context,
    extensionId,
    serviceWorker,
  }) => {
    await seedExtensionStorage(serviceWorker, {
      schemaVersion: 1,
      settings: { presetInstantSend: false, collapsed: false, lastSelectedTab: 'emoji' },
      presets: [],
      favoriteEmojis: [
        {
          id: 'f1',
          channelId: CH_A,
          familyName: 'fam',
          emojiName: ':_a:',
          displayName: 'A',
          lastSeenAt: 0,
        },
      ],
      channels: { [CH_A]: { channelId: CH_A, channelName: 'Channel A', lastSeenAt: 0 } },
    });
    const options = await context.newPage();
    await options.goto(optionsUrl(extensionId));
    await expect(options.locator('[data-section="favorite-emojis"] h3')).toHaveText(
      `Channel A (${CH_A})`,
    );
    await options.getByRole('button', { name: 'Remove favorite: A' }).click();
    await expect
      .poll(async () => (await readExtensionStorage(serviceWorker)).favoriteEmojis.length)
      .toBe(0);
    await options.close();
  });
});
