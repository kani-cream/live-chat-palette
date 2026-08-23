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

test.describe('storage, schema and service worker resilience', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await clearExtensionStorage(serviceWorker);
  });

  test('initializes a versioned schema on first run', async ({ page, serviceWorker }) => {
    await page.goto(watchUrl(VIDEO_A));
    await expect(palette(chatFrame(page)).locator('[data-testid="lcp-panel"]')).toBeVisible();
    const raw = await serviceWorker.evaluate(async () => {
      const all = await chrome.storage.local.get('liveChatPalette');
      return all.liveChatPalette as { schemaVersion: number };
    });
    expect(raw.schemaVersion).toBe(1);
  });

  test('repairs corrupt stored data instead of breaking', async ({ page, serviceWorker }) => {
    await seedExtensionStorage(serviceWorker, {
      schemaVersion: 1,
      settings: { presetInstantSend: 'yes', collapsed: 'no', lastSelectedTab: 'weird' },
      presets: [
        { id: 'ok', text: 'kept', scope: 'global', order: 0, createdAt: 0, updatedAt: 0 },
        { id: 'bad' },
        42,
      ],
      favoriteEmojis: 'not an array',
      channels: null,
    });
    await page.goto(watchUrl(VIDEO_A));
    const root = palette(chatFrame(page));
    await expect(root.locator('[data-testid="lcp-panel"]')).toBeVisible();
    // Sanitized on load, before any UI interaction changes settings.
    const stored = await readExtensionStorage(serviceWorker);
    expect(stored.settings).toEqual({
      presetInstantSend: false,
      collapsed: false,
      lastSelectedTab: 'emoji',
    });
    expect(stored.favoriteEmojis).toEqual([]);
    await root.getByRole('tab', { name: 'Presets' }).click();
    await expect(root.locator('.lcp-preset-chip')).toHaveText(['kept']);
  });

  test('persists context in session storage and recovers after a service worker restart', async ({
    page,
    serviceWorker,
    context,
    extensionId,
  }) => {
    await page.goto(watchUrl(VIDEO_A));
    await expect(palette(chatFrame(page)).locator('[data-testid="lcp-panel"]')).toBeVisible();

    // The service worker stored the tab context in chrome.storage.session, keyed by tab id.
    // Nothing recoverable lives in worker globals, so this survives a worker restart.
    const readContexts = () =>
      serviceWorker.evaluate(async () => {
        const all = await chrome.storage.session.get(null);
        return Object.entries(all)
          .filter(([k]) => k.startsWith('tabContext:'))
          .map(([, v]) => v as { channelId?: string });
      });
    await expect.poll(readContexts).not.toEqual([]);
    const contexts = await readContexts();
    expect(contexts.some((c) => c.channelId === CH_A)).toBe(true);

    // A fresh page (like a woken worker with empty globals) still resolves the context.
    const options = await context.newPage();
    await options.goto(`chrome-extension://${extensionId}/options/index.html`);
    await expect(options.getByRole('heading', { name: 'Live Chat Palette' })).toBeVisible();
    await options.close();
    expect(await readContexts()).not.toEqual([]);
  });

  test('a favorite added in one tab appears in a second tab (shared local storage)', async ({
    page,
    context,
    serviceWorker,
  }) => {
    await seedExtensionStorage(serviceWorker, {
      schemaVersion: 1,
      settings: { presetInstantSend: false, collapsed: false, lastSelectedTab: 'emoji' },
      presets: [],
      favoriteEmojis: [],
      channels: {},
    });
    await page.goto(watchUrl(VIDEO_A));
    const second = await context.newPage();
    await second.goto(watchUrl(VIDEO_A));
    const firstRoot = palette(chatFrame(page));
    await firstRoot.getByRole('button', { name: 'Refresh emojis' }).click();
    await firstRoot.getByRole('button', { name: 'Add :_wave: to favorites' }).click();
    // The second tab reflects the new favorite through the storage change event.
    const secondRoot = palette(chatFrame(second));
    await expect(secondRoot.locator('[data-testid="favorite-emoji"]')).toHaveCount(1);
    await second.close();
  });
});
