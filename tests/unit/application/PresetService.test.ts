import { describe, expect, it } from 'vitest';
import { PresetService } from '../../../src/application/PresetService';
import { splitPresetsForChannel } from '../../../src/domain/preset';
import { StorageRepository } from '../../../src/storage/StorageRepository';
import { FakeStorageArea } from '../../helpers/fakeChrome';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';

const setup = () => {
  const area = new FakeStorageArea();
  const repo = new StorageRepository(area);
  let now = 1000;
  let seq = 0;
  const service = new PresetService(
    repo,
    () => (now += 1),
    () => `id-${(seq += 1)}`,
  );
  return { area, repo, service };
};

describe('PresetService', () => {
  it('adds global presets in insertion order and persists them', async () => {
    const { service, area, repo } = setup();
    expect((await service.add({ text: 'LOL', scope: 'global' })).ok).toBe(true);
    expect((await service.add({ text: 'Cute!', scope: 'global' })).ok).toBe(true);
    expect((await service.list()).map((p) => p.text)).toEqual(['LOL', 'Cute!']);
    expect((await service.list()).map((p) => p.order)).toEqual([0, 1]);
    // Persisted: a fresh repository over the same area sees the same presets.
    expect((await new StorageRepository(area).load()).presets).toEqual((await repo.load()).presets);
  });

  it('adds channel presets only with a known channel', async () => {
    const { service } = setup();
    const denied = await service.add({ text: 'hi', scope: 'channel' });
    expect(denied.ok).toBe(false);
    if (!denied.ok) expect(denied.error.code).toBe('CHANNEL_UNKNOWN');
    const bad = await service.add({ text: 'hi', scope: 'channel', channelId: 'nope' });
    expect(bad.ok).toBe(false);
    const okResult = await service.add({ text: 'hi', scope: 'channel', channelId: CH_A });
    expect(okResult.ok).toBe(true);
    if (okResult.ok) expect(okResult.value.channelId).toBe(CH_A);
  });

  it('rejects invalid text on add and edit', async () => {
    const { service } = setup();
    expect((await service.add({ text: '', scope: 'global' })).ok).toBe(false);
    const added = await service.add({ text: 'ok', scope: 'global' });
    if (!added.ok) throw new Error('expected ok');
    expect((await service.edit(added.value.id, '')).ok).toBe(false);
    expect((await service.edit(added.value.id, 'x'.repeat(201))).ok).toBe(false);
    expect((await service.list())[0]?.text).toBe('ok');
  });

  it('preserves whitespace, emoji, Japanese and newlines exactly', async () => {
    const { service } = setup();
    const text = '  こんにちは 🎉\nnext line  ';
    const added = await service.add({ text, scope: 'global' });
    expect(added.ok).toBe(true);
    expect((await service.list())[0]?.text).toBe(text);
  });

  it('edits text and bumps updatedAt; missing id fails', async () => {
    const { service } = setup();
    const added = await service.add({ text: 'old', scope: 'global' });
    if (!added.ok) throw new Error('expected ok');
    const edited = await service.edit(added.value.id, 'new');
    expect(edited.ok).toBe(true);
    const stored = (await service.list())[0];
    expect(stored?.text).toBe('new');
    expect(stored?.updatedAt).toBeGreaterThan(added.value.updatedAt);
    expect((await service.edit('missing', 'x')).ok).toBe(false);
  });

  it('removes presets and renumbers order', async () => {
    const { service } = setup();
    await service.add({ text: 'a', scope: 'global' });
    const b = await service.add({ text: 'b', scope: 'global' });
    await service.add({ text: 'c', scope: 'global' });
    if (!b.ok) throw new Error('expected ok');
    await service.remove(b.value.id);
    expect((await service.list()).map((p) => [p.text, p.order])).toEqual([
      ['a', 0],
      ['c', 1],
    ]);
  });

  it('reorders within scope groups and persists the order', async () => {
    const { service, area } = setup();
    await service.add({ text: 'a', scope: 'global' });
    await service.add({ text: 'b', scope: 'global' });
    const c = await service.add({ text: 'c', scope: 'global' });
    await service.add({ text: 'ch', scope: 'channel', channelId: CH_A });
    if (!c.ok) throw new Error('expected ok');
    await service.move(c.value.id, 'up');
    await service.move(c.value.id, 'up');
    await service.move(c.value.id, 'up'); // boundary no-op
    expect(
      splitPresetsForChannel(await service.list(), undefined).global.map((p) => p.text),
    ).toEqual(['c', 'a', 'b']);
    const stored = await new StorageRepository(area).load().then((s) => s.presets);
    const sections = splitPresetsForChannel(stored, CH_A);
    expect(sections.global.map((p) => p.text)).toEqual(['c', 'a', 'b']);
    // Moving a global preset never touches the channel group.
    expect(sections.channel.map((p) => p.text)).toEqual(['ch']);
  });

  it('scopes channel presets and switches with the channel', async () => {
    const { service } = setup();
    await service.add({ text: 'global', scope: 'global' });
    await service.add({ text: 'for A', scope: 'channel', channelId: CH_A });
    await service.add({ text: 'for B', scope: 'channel', channelId: CH_B });
    const all = await service.list();
    const texts = (list: { text: string }[]) => list.map((p) => p.text);
    const forA = splitPresetsForChannel(all, CH_A);
    expect(texts(forA.channel)).toEqual(['for A']);
    expect(texts(forA.global)).toEqual(['global']);
    const forB = splitPresetsForChannel(all, CH_B);
    expect(texts(forB.channel)).toEqual(['for B']);
    expect(texts(forB.global)).toEqual(['global']);
    const unknown = splitPresetsForChannel(all, undefined);
    expect(unknown.channel).toEqual([]);
    expect(texts(unknown.global)).toEqual(['global']);
  });
});
