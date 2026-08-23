import { describe, expect, it } from 'vitest';
import { SessionContextStore } from '../../../src/storage/SessionContextStore';
import { FakeStorageArea } from '../../helpers/fakeChrome';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';

describe('SessionContextStore', () => {
  it('stores and reads per-tab contexts', async () => {
    const store = new SessionContextStore(new FakeStorageArea());
    await store.set(1, { videoId: 'dQw4w9WgXcQ', channelId: CH_A });
    await store.set(2, { videoId: 'aaaaaaaaaaa' });
    expect(await store.get(1)).toEqual({ videoId: 'dQw4w9WgXcQ', channelId: CH_A });
    expect(await store.get(2)).toEqual({ videoId: 'aaaaaaaaaaa' });
    expect(await store.get(3)).toBeNull();
  });
  it('removes contexts', async () => {
    const store = new SessionContextStore(new FakeStorageArea());
    await store.set(1, { videoId: 'dQw4w9WgXcQ' });
    await store.remove(1);
    expect(await store.get(1)).toBeNull();
  });
  it('ignores corrupt stored values', async () => {
    const area = new FakeStorageArea({ 'tabContext:1': { channelId: 'bad' } });
    expect(await new SessionContextStore(area).get(1)).toBeNull();
  });
  it('survives a new store instance over the same area (worker restart)', async () => {
    const area = new FakeStorageArea();
    await new SessionContextStore(area).set(7, { channelId: CH_A });
    expect(await new SessionContextStore(area).get(7)).toEqual({ channelId: CH_A });
  });
});
