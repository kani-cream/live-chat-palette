import {
  CH_A,
  VIDEO_A,
  clearExtensionStorage,
  expect,
  harnessState,
  openWatchPage,
  palette,
  readExtensionStorage,
  seedExtensionStorage,
  test,
} from './extension';

test.describe('custom emoji favorites', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await clearExtensionStorage(serviceWorker);
  });

  test('refresh discovers custom emojis via the native picker and closes it again', async ({
    page,
  }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('button', { name: 'Refresh emojis' }).click();
    await expect(root.locator('[data-testid="available-emoji"]')).toHaveCount(2);
    // Standard 😀 is excluded; only :_wave: and :_heart: are custom.
    await expect(root.locator('[data-testid="favorite-toggle"]').first()).toHaveAttribute(
      'aria-label',
      'Add :_wave: to favorites',
    );
    // The native picker was opened then closed by the extension (non-intrusive).
    await expect(frame.locator('#emoji-picker-host')).toHaveAttribute('hidden', '');
    const state = await harnessState(frame);
    expect(state.pickerOpens).toBe(1);
  });

  test('favoriting persists with logical identity and never stores imageUrl as identity', async ({
    page,
    serviceWorker,
  }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('button', { name: 'Refresh emojis' }).click();
    await root.getByRole('button', { name: 'Add :_wave: to favorites' }).click();
    await expect(root.locator('[data-testid="favorite-emoji"]')).toHaveCount(1);
    const stored = await readExtensionStorage(serviceWorker);
    expect(stored.favoriteEmojis).toHaveLength(1);
    expect(stored.favoriteEmojis[0]).toMatchObject({
      channelId: CH_A,
      familyName: 'Channel A members',
      emojiName: ':_wave:',
    });
  });

  test('favorite click inserts only — even with Ctrl/Cmd — and never sends', async ({
    page,
    serviceWorker,
  }) => {
    await seedExtensionStorage(serviceWorker, {
      schemaVersion: 1,
      settings: { presetInstantSend: true, collapsed: false, lastSelectedTab: 'emoji' },
      presets: [],
      favoriteEmojis: [
        {
          id: 'f1',
          channelId: CH_A,
          familyName: 'Channel A members',
          emojiName: ':_wave:',
          displayName: ':_wave:',
          lastSeenAt: 0,
        },
      ],
      channels: {},
    });
    const frame = await openWatchPage(page, VIDEO_A);
    const button = palette(frame).getByRole('button', { name: 'Insert :_wave:' });
    await button.click({ modifiers: ['ControlOrMeta'] });
    await expect.poll(async () => (await harnessState(frame)).input).toBe(':_wave:');
    const state = await harnessState(frame);
    expect(state.sent).toEqual([]);
    expect(state.sendClicks).toBe(0);
  });

  test('composes multiple emojis and text without auto whitespace', async ({
    page,
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
          familyName: 'Channel A members',
          emojiName: ':_wave:',
          displayName: ':_wave:',
          lastSeenAt: 0,
        },
        {
          id: 'f2',
          channelId: CH_A,
          familyName: 'Channel A members',
          emojiName: ':_heart:',
          displayName: ':_heart:',
          lastSeenAt: 0,
        },
      ],
      channels: {},
    });
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('button', { name: 'Insert :_wave:' }).click();
    await root.getByRole('button', { name: 'Insert :_heart:' }).click();
    await expect.poll(async () => (await harnessState(frame)).input).toBe(':_wave::_heart:');
  });

  test('a gone favorite stays usable in the UI but fails closed on click (no fabricated image)', async ({
    page,
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
          familyName: 'Channel A members',
          emojiName: ':_gone:',
          displayName: ':_gone:',
          imageUrl: 'https://img.example/a/gone.png',
          lastSeenAt: 0,
        },
      ],
      channels: {},
    });
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    const favorite = root.locator('[data-testid="favorite-emoji"]');
    // Shown as a usable image on load (from cached metadata), not pre-marked unavailable.
    await expect(favorite).toBeEnabled();
    // Clicking re-resolves against the live picker and fails closed since it is not there.
    await favorite.click();
    await expect(root.locator('.lcp-notice[data-kind="error"]')).toContainText(
      'not currently available',
    );
    expect((await harnessState(frame)).input).toBe('');
  });

  test('emoji favorites are scoped per channel', async ({ page, serviceWorker }) => {
    await seedExtensionStorage(serviceWorker, {
      schemaVersion: 1,
      settings: { presetInstantSend: false, collapsed: false, lastSelectedTab: 'emoji' },
      presets: [],
      favoriteEmojis: [
        {
          id: 'a',
          channelId: CH_A,
          familyName: 'Channel A members',
          emojiName: ':_wave:',
          displayName: 'wave',
          lastSeenAt: 0,
        },
        {
          id: 'b',
          channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb',
          familyName: 'Channel B members',
          emojiName: ':_b_party:',
          displayName: 'party',
          lastSeenAt: 0,
        },
      ],
      channels: {},
    });
    const frame = await openWatchPage(page, VIDEO_A);
    await expect(palette(frame).locator('[data-testid="favorite-emoji"]')).toHaveCount(1);
  });
});
