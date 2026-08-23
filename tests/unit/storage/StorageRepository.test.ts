import { describe, expect, it, vi } from 'vitest';
import { createDefaultSchema } from '../../../src/storage/schema';
import { STORAGE_ROOT_KEY, StorageRepository } from '../../../src/storage/StorageRepository';
import { FakeStorageArea } from '../../helpers/fakeChrome';

describe('StorageRepository', () => {
  it('initializes and persists defaults on first load', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    const schema = await repo.load();
    expect(schema).toEqual(createDefaultSchema());
    expect(area.snapshot()[STORAGE_ROOT_KEY]).toEqual(createDefaultSchema());
  });

  it('persists updates immutably and returns the new schema', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    const before = await repo.load();
    const after = await repo.update((s) => ({
      ...s,
      settings: { ...s.settings, collapsed: true },
    }));
    expect(after.settings.collapsed).toBe(true);
    expect(before.settings.collapsed).toBe(false);
    expect((await repo.load()).settings.collapsed).toBe(true);
  });

  it('sanitizes whatever an updater returns', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    const after = await repo.update((s) => ({ ...s, presets: [{ id: 'broken' } as never] }));
    expect(after.presets).toEqual([]);
  });

  it('serializes concurrent updates so none are lost', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        repo.update((s) => ({
          ...s,
          presets: [
            ...s.presets,
            { id: `p${i}`, text: `t${i}`, scope: 'global', order: i, createdAt: i, updatedAt: i },
          ],
        })),
      ),
    );
    expect((await repo.load()).presets).toHaveLength(5);
  });

  it('recovers from a failed write and keeps subsequent updates working', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    area.failNextSet = true;
    await expect(repo.load()).rejects.toThrow('storage write failed');
    const after = await repo.update((s) => ({
      ...s,
      settings: { ...s.settings, collapsed: true },
    }));
    expect(after.settings.collapsed).toBe(true);
  });

  it('repairs incomplete and invalid stored data on load', async () => {
    const area = new FakeStorageArea({
      [STORAGE_ROOT_KEY]: { schemaVersion: 1, settings: { collapsed: 'x' }, presets: 'nope' },
    });
    const repo = new StorageRepository(area);
    const schema = await repo.load();
    expect(schema.settings.collapsed).toBe(false);
    expect(schema.presets).toEqual([]);
  });

  it('notifies subscribers with a sanitized schema on change', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    await repo.load();
    const listener = vi.fn();
    const unsubscribe = repo.subscribe(listener);
    await repo.update((s) => ({ ...s, settings: { ...s.settings, collapsed: true } }));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ settings: { collapsed: true } });
    unsubscribe();
    await repo.update((s) => ({ ...s, settings: { ...s.settings, collapsed: false } }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores changes to unrelated keys', async () => {
    const area = new FakeStorageArea();
    const repo = new StorageRepository(area);
    const listener = vi.fn();
    repo.subscribe(listener);
    await area.set({ somethingElse: 1 });
    expect(listener).not.toHaveBeenCalled();
  });

  it('two repositories over the same area see each other (service worker restart equivalent)', async () => {
    const area = new FakeStorageArea();
    const first = new StorageRepository(area);
    await first.update((s) => ({ ...s, settings: { ...s.settings, collapsed: true } }));
    const second = new StorageRepository(area);
    expect((await second.load()).settings.collapsed).toBe(true);
  });
});
