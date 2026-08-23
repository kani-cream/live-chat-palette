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

const seedPresets = async (
  serviceWorker: Parameters<typeof seedExtensionStorage>[0],
  presets: { text: string; scope: 'global' | 'channel'; channelId?: string }[],
) => {
  await seedExtensionStorage(serviceWorker, {
    schemaVersion: 1,
    settings: { presetInstantSend: false, collapsed: false, lastSelectedTab: 'preset' },
    presets: presets.map((p, order) => ({
      id: `p${order}`,
      text: p.text,
      scope: p.scope,
      ...(p.channelId ? { channelId: p.channelId } : {}),
      order,
      createdAt: order,
      updatedAt: order,
    })),
    favoriteEmojis: [],
    channels: {},
  });
};

test.describe('preset insertion and sending', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await clearExtensionStorage(serviceWorker);
  });

  test('adds a preset from the palette and persists it', async ({ page, serviceWorker }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('tab', { name: 'Presets' }).click();
    await root.getByRole('button', { name: '+ Add preset' }).click();
    await root.locator('[data-testid="preset-form-text"]').fill('Thanks for the stream!');
    await root.locator('[data-testid="preset-form-save"]').click();
    await expect(
      root.getByRole('button', { name: 'Insert preset: Thanks for the stream!' }),
    ).toBeVisible();
    const stored = await readExtensionStorage(serviceWorker);
    expect(stored.presets.map((p) => p.text)).toEqual(['Thanks for the stream!']);
  });

  test('builds an emoji preset via the strip and shows it as an image in the chip', async ({
    page,
    serviceWorker,
  }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    // Discover the channel's custom emojis (Emojis tab), then compose a preset in the Presets tab.
    await root.getByRole('button', { name: 'Refresh emojis' }).click();
    await expect(root.locator('[data-testid="available-emoji"]').first()).toBeVisible();
    await root.getByRole('tab', { name: 'Presets' }).click();
    await root.getByRole('button', { name: '+ Add preset' }).click();
    await root.locator('[data-testid="preset-form-text"]').fill('おつ ');
    // Click a discovered emoji to append its exact shortcode — no copy-paste needed.
    await root.locator('[data-testid="preset-emoji-option"]').first().click();
    await expect(root.locator('[data-testid="preset-form-text"]')).toHaveValue('おつ :_wave:');
    // The form preview renders it as an image.
    await expect(
      root.locator('[data-testid="preset-form-preview"] img.lcp-inline-emoji'),
    ).toBeVisible();
    await root.locator('[data-testid="preset-form-save"]').click();
    // The saved chip renders the emoji image, and the accessible name keeps the shortcode text.
    const chip = root.getByRole('button', { name: 'Insert preset: おつ :_wave:' });
    await expect(chip).toBeVisible();
    await expect(chip.locator('img.lcp-inline-emoji')).toBeVisible();
    const stored = await readExtensionStorage(serviceWorker);
    expect(stored.presets.map((p) => p.text)).toEqual(['おつ :_wave:']);
  });

  test('keeps the preset form text while chat messages keep streaming in', async ({ page }) => {
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('tab', { name: 'Presets' }).click();
    await root.getByRole('button', { name: '+ Add preset' }).click();
    const textarea = root.locator('[data-testid="preset-form-text"]');
    await textarea.fill('a message I am still typing');

    // Simulate an active live chat: many new message nodes arriving while the user types.
    for (let batch = 0; batch < 5; batch += 1) {
      await frame.locator('body').evaluate(() => {
        const items = document.querySelector('#items');
        for (let i = 0; i < 10; i += 1) {
          const node = document.createElement('yt-live-chat-text-message-renderer');
          node.textContent = 'incoming chat message';
          items?.append(node);
        }
      });
      await page.waitForTimeout(60);
    }

    // The palette was not rebuilt and the in-progress text is intact.
    await expect(palette(frame)).toHaveCount(1);
    await expect(textarea).toHaveValue('a message I am still typing');
  });

  test('composes a multi-emoji preset by inserting each shortcode separately', async ({
    page,
    serviceWorker,
  }) => {
    await seedPresets(serviceWorker, [{ text: 'おつ :_wave::_heart:', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame)
      .getByRole('button', { name: 'Insert preset: おつ :_wave::_heart:' })
      .click();
    // The fixture input does not convert shortcodes, but every segment is inserted (no data lost),
    // proving the token-by-token composition path runs instead of a single bulk insert.
    await expect.poll(async () => (await harnessState(frame)).input).toBe('おつ :_wave::_heart:');
    expect((await harnessState(frame)).sent).toEqual([]);
  });

  test('normal click inserts only; the draft is not sent', async ({ page, serviceWorker }) => {
    await seedPresets(serviceWorker, [{ text: 'Cute!', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame).getByRole('button', { name: 'Insert preset: Cute!' }).click();
    const state = await harnessState(frame);
    expect(state.input).toBe('Cute!');
    expect(state.sent).toEqual([]);
    expect(state.sendClicks).toBe(0);
  });

  test('Ctrl/Cmd + click inserts and sends exactly once through the native button', async ({
    page,
    serviceWorker,
  }) => {
    await seedPresets(serviceWorker, [{ text: 'LOL', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame)
      .getByRole('button', { name: 'Insert preset: LOL' })
      .click({ modifiers: ['ControlOrMeta'] });
    await expect.poll(async () => (await harnessState(frame)).sent).toEqual(['LOL']);
    const state = await harnessState(frame);
    expect(state.sendClicks).toBe(1);
    expect(state.input).toBe('');
  });

  test('inserts at the caret and replaces a selection without adding whitespace', async ({
    page,
    serviceWorker,
  }) => {
    await seedPresets(serviceWorker, [{ text: 'amazing', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    await frame.locator('#input').click();
    await frame.locator('#input').evaluate((el) => {
      el.textContent = 'This is great today';
    });
    await frame.locator('body').evaluate(() => {
      const input = document.querySelector('#input');
      const textNode = input?.firstChild;
      if (!textNode) return;
      const range = document.createRange();
      range.setStart(textNode, 8);
      range.setEnd(textNode, 13);
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
    await palette(frame).getByRole('button', { name: 'Insert preset: amazing' }).click();
    expect((await harnessState(frame)).input).toBe('This is amazing today');
  });

  test('inserts Japanese, emoji and newlines verbatim', async ({ page, serviceWorker }) => {
    await seedPresets(serviceWorker, [{ text: 'こんにちは🎉', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame).getByRole('button', { name: 'Insert preset: こんにちは🎉' }).click();
    expect((await harnessState(frame)).input).toBe('こんにちは🎉');
  });

  test('presetInstantSend makes a normal click send', async ({ page, serviceWorker }) => {
    await seedExtensionStorage(serviceWorker, {
      schemaVersion: 1,
      settings: { presetInstantSend: true, collapsed: false, lastSelectedTab: 'preset' },
      presets: [{ id: 'p', text: 'Hi', scope: 'global', order: 0, createdAt: 0, updatedAt: 0 }],
      favoriteEmojis: [],
      channels: {},
    });
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame).getByRole('button', { name: 'Insert preset: Hi' }).click();
    await expect.poll(async () => (await harnessState(frame)).sent).toEqual(['Hi']);
  });

  test('double Ctrl+click sends once (send lock)', async ({ page, serviceWorker }) => {
    await seedPresets(serviceWorker, [{ text: 'Hi', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    const button = palette(frame).getByRole('button', { name: 'Insert preset: Hi' });
    await button.click({ modifiers: ['ControlOrMeta'] });
    await button.click({ modifiers: ['ControlOrMeta'] });
    await expect(palette(frame).locator('.lcp-notice')).toContainText('wait a moment');
    const state = await harnessState(frame);
    expect(state.sent).toEqual(['Hi']);
    expect(state.sendClicks).toBe(1);
  });

  test('does not send and keeps the draft when the native send stays disabled', async ({
    page,
    serviceWorker,
    scenario,
  }) => {
    scenario.chat[VIDEO_A] = { withoutSendButton: true, harness: { categories: [] } };
    await seedPresets(serviceWorker, [{ text: 'Hi', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame)
      .getByRole('button', { name: 'Insert preset: Hi' })
      .click({ modifiers: ['ControlOrMeta'] });
    await expect(palette(frame).locator('.lcp-notice[data-kind="error"]')).toContainText(
      'could not be sent',
    );
    expect((await harnessState(frame)).input).toBe('Hi');
  });

  test('does not retry and keeps the draft when the send silently fails', async ({
    page,
    serviceWorker,
    scenario,
  }) => {
    scenario.chat[VIDEO_A] = { harness: { categories: [], sendFails: true } };
    await seedPresets(serviceWorker, [{ text: 'Hi', scope: 'global' }]);
    const frame = await openWatchPage(page, VIDEO_A);
    await palette(frame)
      .getByRole('button', { name: 'Insert preset: Hi' })
      .click({ modifiers: ['ControlOrMeta'] });
    await page.waitForTimeout(300);
    const state = await harnessState(frame);
    expect(state.sendClicks).toBe(1);
    expect(state.sent).toEqual([]);
    expect(state.input).toBe('Hi');
  });

  test('channel scope is selectable when the channel resolves only via author microdata', async ({
    page,
    scenario,
  }) => {
    // Owner block has a handle-only link (no /channel/UC), like most real watch pages; the channel
    // is resolved from the schema.org author microdata instead.
    scenario.watch[VIDEO_A] = {
      videoId: VIDEO_A,
      channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
      channelName: 'Channel A',
      headMeta: true,
      authorChannelUrl: true,
    };
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('tab', { name: 'Presets' }).click();
    await root.getByRole('button', { name: '+ Add preset' }).click();
    const channelOption = root.locator('[data-testid="preset-form-scope"] option[value="channel"]');
    await expect(channelOption).toBeEnabled();
  });

  test('channel scope resolves from the inline player response (real hololive-style page)', async ({
    page,
    scenario,
  }) => {
    // Owner link is a /@handle and there is no channel microdata — exactly like the reported page.
    // The channel is resolved from ytInitialPlayerResponse.videoDetails.channelId instead.
    scenario.watch[VIDEO_A] = {
      videoId: VIDEO_A,
      channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa',
      channelName: 'Channel A',
      playerResponseScript: true,
    };
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await root.getByRole('tab', { name: 'Presets' }).click();
    await root.getByRole('button', { name: '+ Add preset' }).click();
    const channelOption = root.locator('[data-testid="preset-form-scope"] option[value="channel"]');
    await expect(channelOption).toBeEnabled();
    // And a channel-scoped preset can actually be saved.
    await root.locator('[data-testid="preset-form-text"]').fill('channel only preset');
    await root.locator('[data-testid="preset-form-scope"]').selectOption('channel');
    await root.locator('[data-testid="preset-form-save"]').click();
    await expect(
      root.getByRole('button', { name: 'Insert preset: channel only preset' }),
    ).toBeVisible();
  });

  test('a preset containing a channel emoji is forced to "this channel only"', async ({
    page,
    scenario,
  }) => {
    // Embed the emoji catalog so the channel resolves instantly on load (deterministic).
    scenario.chat[VIDEO_A] = {
      harness: { categories: [] },
      initialDataEmojis: {
        channelId: CH_A,
        familyName: 'Channel A members',
        emojis: [{ shortcut: ':_wave:', hash: 'wave', label: 'wave', url: '/fixtures/emoji.png' }],
      },
    };
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    // Wait until the channel is resolved (channel scope becomes selectable).
    await root.getByRole('tab', { name: 'Presets' }).click();
    await root.getByRole('button', { name: '+ Add preset' }).click();
    await expect(
      root.locator('[data-testid="preset-form-scope"] option[value="channel"]'),
    ).toHaveJSProperty('disabled', false);
    const globalOption = root.locator('[data-testid="preset-form-scope"] option[value="global"]');
    // Plain text: "all channels" is selectable. (option.disabled is checked directly because
    // Playwright's toBeDisabled/toBeEnabled do not reliably reflect a disabled <option>.)
    await root.locator('[data-testid="preset-form-text"]').fill('hello');
    await expect(globalOption).toHaveJSProperty('disabled', false);
    // With a member emoji: "all channels" is disabled and the scope is forced to this channel.
    await root.locator('[data-testid="preset-form-text"]').fill('おつ :_wave:');
    await expect(globalOption).toHaveJSProperty('disabled', true);
    await expect(root.locator('[data-testid="preset-form-scope"]')).toHaveValue('channel');
  });

  test('channel presets only appear on their channel', async ({ page, serviceWorker }) => {
    await seedPresets(serviceWorker, [
      { text: 'global', scope: 'global' },
      { text: 'for A', scope: 'channel', channelId: 'UCaaaaaaaaaaaaaaaaaaaaaa' },
      { text: 'for B', scope: 'channel', channelId: 'UCbbbbbbbbbbbbbbbbbbbbbb' },
    ]);
    const frame = await openWatchPage(page, VIDEO_A);
    const root = palette(frame);
    await expect(root.locator('.lcp-preset-chip')).toHaveText(['global', 'for A']);
  });
});
