import {
  CH_A,
  VIDEO_A,
  chatFrame,
  clearExtensionStorage,
  expect,
  harnessCall,
  openWatchPage,
  palette,
  test,
  watchUrl,
} from './extension';

test.describe('palette mount lifecycle', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await clearExtensionStorage(serviceWorker);
  });

  test('mounts once inside the Live Chat frame, never in the watch frame', async ({ page }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    await expect(palette(frame)).toHaveCount(1);
    await expect(palette(page)).toHaveCount(0);
    // Mounted directly before YouTube's message input block.
    const nextSibling = await palette(frame).evaluate((el) =>
      el.nextElementSibling?.tagName.toLowerCase(),
    );
    expect(nextSibling).toBe('yt-live-chat-message-input-renderer');
    // Uses a shadow root with its own styles.
    const shadow = await palette(frame).evaluate((el) => el.shadowRoot !== null);
    expect(shadow).toBe(true);
  });

  test('shows tabs, empty states and channel-aware hints', async ({ page }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await expect(root.getByRole('tab', { name: 'Emojis' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(root.getByRole('status')).toContainText('No favorite emojis yet.');
    await expect(root.getByRole('button', { name: 'Refresh emojis' })).toBeVisible();
    await root.getByRole('tab', { name: 'Presets' }).click();
    await expect(root.getByRole('status')).toContainText('No message presets yet.');
    await expect(root.getByRole('button', { name: '+ Add preset' })).toBeVisible();
    // Channel context reached the chat frame through the service worker.
    await root.getByRole('button', { name: '+ Add preset' }).click();
    await expect(
      root.locator('[data-testid="preset-form-scope"] option[value="channel"]'),
    ).toBeEnabled();
    await expect(
      root.locator('[data-testid="preset-form-scope"] option[value="channel"]'),
    ).toHaveText('This channel only');
    void CH_A;
  });

  test('collapse state persists across reloads', async ({ page }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame).getByRole('button', { name: 'Collapse Live Chat Palette' }).click();
    await expect(
      palette(frame).getByRole('button', { name: 'Expand Live Chat Palette' }),
    ).toBeVisible();
    await page.reload();
    const again = chatFrame(page);
    await expect(
      palette(again).getByRole('button', { name: 'Expand Live Chat Palette' }),
    ).toBeVisible();
    await expect(palette(again).locator('.lcp-body')).toHaveCount(0);
  });

  test('remounts exactly once after YouTube rebuilds the input block, unmounts when it disappears', async ({
    page,
  }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    await harnessCall(frame, 'rebuildInputRenderer');
    await frame.locator('body').evaluate(() => {
      document.querySelector('[data-live-chat-palette-root]')?.remove();
    });
    await expect(palette(frame)).toHaveCount(1);
    await expect(palette(frame).locator('[data-testid="lcp-panel"]')).toBeVisible();
    await harnessCall(frame, 'removeInputRenderer');
    await expect(palette(frame)).toHaveCount(0);
  });

  test('does nothing when the chat has no message input (logged out)', async ({
    page,
    scenario,
  }) => {
    scenario.chat[VIDEO_A] = { withoutInputRenderer: true };
    await page.goto(watchUrl(VIDEO_A));
    const frame = chatFrame(page);
    await expect(frame.locator('yt-live-chat-restricted-participation-renderer')).toBeVisible();
    await expect(palette(frame)).toHaveCount(0);
  });

  test('shows the chat-unsupported notice when the input cannot be recognized', async ({
    page,
    scenario,
  }) => {
    scenario.chat[VIDEO_A] = { withoutInput: true };
    await page.goto(watchUrl(VIDEO_A));
    const root = palette(chatFrame(page));
    await expect(root.locator('.lcp-notice')).toContainText(
      "YouTube's chat input could not be recognized",
    );
  });

  test('follows YouTube dark and light themes', async ({ page, scenario }) => {
    scenario.chat[VIDEO_A] = { dark: true, harness: { categories: [] } };
    await page.goto(watchUrl(VIDEO_A));
    const frame = chatFrame(page);
    await expect(palette(frame)).toHaveAttribute('data-theme', 'dark');
    const darkBg = await palette(frame)
      .locator('[data-testid="lcp-panel"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    await frame.locator('html').evaluate((el) => {
      el.removeAttribute('dark');
    });
    await expect(palette(frame)).toHaveAttribute('data-theme', 'light');
    const lightBg = await palette(frame)
      .locator('[data-testid="lcp-panel"]')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(darkBg).not.toBe(lightBg);
  });
});
