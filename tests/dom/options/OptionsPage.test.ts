import { describe, expect, it } from 'vitest';
import { EmojiService } from '../../../src/application/EmojiService';
import { PresetService } from '../../../src/application/PresetService';
import { SettingsService } from '../../../src/application/SettingsService';
import { OptionsPage } from '../../../src/options/options';
import { StorageRepository } from '../../../src/storage/StorageRepository';
import { FakeStorageArea, flushPromises } from '../../helpers/fakeChrome';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';

const setup = async (area = new FakeStorageArea()) => {
  const root = document.createElement('main');
  document.body.append(root);
  const repo = new StorageRepository(area);
  const presets = new PresetService(repo);
  const emojis = new EmojiService(repo);
  const page = new OptionsPage({
    root,
    repo,
    presets,
    emojis,
    settings: new SettingsService(repo),
  });
  await page.start();
  const settle = async () => {
    await flushPromises();
    await flushPromises();
  };
  const byLabel = (label: string): HTMLElement | null =>
    [...root.querySelectorAll<HTMLElement>('button')].find(
      (b) => b.getAttribute('aria-label') === label,
    ) ?? null;
  return { root, repo, presets, emojis, settle, byLabel };
};

describe('OptionsPage', () => {
  it('renders settings bound to storage', async () => {
    const t = await setup();
    const instant = t.root.querySelector<HTMLInputElement>('#preset-instant-send');
    expect(instant?.checked).toBe(false);
    if (!instant) throw new Error('missing');
    instant.checked = true;
    instant.dispatchEvent(new Event('change'));
    await t.settle();
    expect((await t.repo.load()).settings.presetInstantSend).toBe(true);
    const presetTab = t.root.querySelector<HTMLInputElement>(
      'input[name="default-tab"][value="preset"]',
    );
    if (!presetTab) throw new Error('missing');
    presetTab.checked = true;
    presetTab.dispatchEvent(new Event('change'));
    await t.settle();
    expect((await t.repo.load()).settings.lastSelectedTab).toBe('preset');
  });
  it('adds, edits, reorders and deletes global presets', async () => {
    const t = await setup();
    const input = t.root.querySelector<HTMLInputElement>('input[aria-label="New global preset"]');
    const form = t.root.querySelector<HTMLFormElement>('form.add-form');
    if (!input || !form) throw new Error('missing');
    for (const text of ['one', 'two']) {
      input.value = text;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      await t.settle();
    }
    const texts = () =>
      [...t.root.querySelectorAll('[data-section="global-presets"] .text')].map(
        (e) => e.textContent,
      );
    expect(texts()).toEqual(['one', 'two']);
    t.byLabel('Move up: two')?.click();
    await t.settle();
    expect(texts()).toEqual(['two', 'one']);
    t.byLabel('Edit: one')?.click();
    const edit = t.root.querySelector<HTMLInputElement>('input[aria-label="Preset text"]');
    if (!edit) throw new Error('missing');
    edit.value = 'uno';
    [...t.root.querySelectorAll('button')].find((b) => b.textContent === 'Save')?.click();
    await t.settle();
    expect(texts()).toEqual(['two', 'uno']);
    t.byLabel('Delete: two')?.click();
    await t.settle();
    expect(texts()).toEqual(['uno']);
  });
  it('shows validation errors for empty presets', async () => {
    const t = await setup();
    t.root
      .querySelector<HTMLFormElement>('form.add-form')
      ?.dispatchEvent(new Event('submit', { cancelable: true }));
    await t.settle();
    expect(t.root.querySelector('[role="alert"]')?.textContent).toContain('must not be empty');
  });
  it('groups channel presets and favorites by channel and allows removing favorites', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    await new PresetService(repo).add({ text: 'for A', scope: 'channel', channelId: CH_A });
    const emojis = new EmojiService(repo);
    await emojis.rememberChannel(CH_A, 'Channel A');
    await emojis.addFavorite({
      channelId: CH_A,
      familyName: 'fam',
      emojiName: ':_a:',
      displayName: 'A',
    });
    await emojis.addFavorite({
      channelId: CH_A,
      familyName: 'fam',
      emojiName: ':_b:',
      displayName: 'B',
    });
    const t = await setup(area);
    expect(t.root.querySelector('[data-section="channel-presets"] h3')?.textContent).toBe(
      `Channel A (${CH_A})`,
    );
    expect(t.root.querySelector('[data-section="channel-presets"] .text')?.textContent).toBe(
      'for A',
    );
    const names = () =>
      [...t.root.querySelectorAll('[data-section="favorite-emojis"] .text')].map(
        (e) => e.textContent,
      );
    expect(names()).toEqual(['A', 'B']);
    t.byLabel('Move down: A')?.click();
    await t.settle();
    expect(names()).toEqual(['B', 'A']);
    t.byLabel('Remove favorite: B')?.click();
    await t.settle();
    expect(names()).toEqual(['A']);
  });
  it('re-renders when storage changes elsewhere', async () => {
    const t = await setup();
    await t.presets.add({ text: 'external', scope: 'global' });
    await t.settle();
    expect(t.root.textContent).toContain('external');
  });
});
