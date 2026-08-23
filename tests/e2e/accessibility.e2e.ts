import {
  VIDEO_A,
  clearExtensionStorage,
  expect,
  openWatchPage,
  palette,
  seedExtensionStorage,
  test,
} from './extension';

test.describe('accessibility', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await clearExtensionStorage(serviceWorker);
  });

  test('every control exposes an accessible name', async ({ page, serviceWorker }) => {
    await seedExtensionStorage(serviceWorker, {
      schemaVersion: 1,
      settings: { presetInstantSend: false, collapsed: false, lastSelectedTab: 'emoji' },
      presets: [{ id: 'p', text: 'Hi', scope: 'global', order: 0, createdAt: 0, updatedAt: 0 }],
      favoriteEmojis: [
        {
          id: 'f',
          channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
          familyName: 'Channel A members',
          emojiName: ':_wave:',
          displayName: ':_wave:',
          lastSeenAt: 0,
        },
      ],
      channels: {},
    });
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    const missing = await root.evaluate((host) => {
      const shadow = host.shadowRoot;
      if (!shadow) return ['no shadow root'];
      return [...shadow.querySelectorAll('button')]
        .filter((b) => !(b.getAttribute('aria-label') ?? b.textContent ?? '').trim())
        .map((b) => b.outerHTML);
    });
    expect(missing).toEqual([]);
  });

  test('tabs are keyboard operable with arrow keys and visible focus', async ({ page }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    const emojiTab = root.getByRole('tab', { name: 'Emojis' });
    await emojiTab.focus();
    await expect(emojiTab).toBeFocused();
    const outline = await emojiTab.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('');
    await page.keyboard.press('ArrowRight');
    await expect(root.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'lcp-tab-preset');
    await page.keyboard.press('ArrowLeft');
    await expect(root.locator('[data-testid="emoji-panel"]')).toBeVisible();
  });

  test('the preset add button is reachable and operable by keyboard', async ({ page }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('tab', { name: 'Presets' }).click();
    const addButton = root.getByRole('button', { name: '+ Add preset' });
    await addButton.focus();
    await expect(addButton).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(root.locator('[data-testid="preset-form"]')).toBeVisible();
  });
});
