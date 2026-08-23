import { describe, expect, it } from 'vitest';
import { EmojiService } from '../../../src/application/EmojiService';
import type { AvailableEmoji } from '../../../src/domain/emoji';
import { StorageRepository } from '../../../src/storage/StorageRepository';
import { FakeStorageArea } from '../../helpers/fakeChrome';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const CH_B = 'UCbbbbbbbbbbbbbbbbbbbbbb';

const emoji = (overrides: Partial<AvailableEmoji> = {}): AvailableEmoji => ({
  channelId: CH_A,
  familyName: 'Members',
  emojiName: ':_wave:',
  displayName: ':_wave:',
  imageUrl: 'https://img.example/wave.png',
  ...overrides,
});

const setup = () => {
  const area = new FakeStorageArea();
  const repo = new StorageRepository(area);
  let now = 0;
  let seq = 0;
  const service = new EmojiService(
    repo,
    () => (now += 10),
    () => `fav-${(seq += 1)}`,
  );
  return { area, repo, service };
};

describe('EmojiService', () => {
  it('registers and unregisters favorites, persisted across instances', async () => {
    const { service, area } = setup();
    expect((await service.addFavorite(emoji())).ok).toBe(true);
    expect(await service.favoritesFor(CH_A)).toHaveLength(1);
    expect((await new StorageRepository(area).load()).favoriteEmojis).toHaveLength(1);
    await service.removeFavorite(emoji());
    expect(await service.favoritesFor(CH_A)).toEqual([]);
  });

  it('refuses favorites without a valid channel', async () => {
    const { service } = setup();
    const result = await service.addFavorite(emoji({ channelId: 'x' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CHANNEL_UNKNOWN');
  });

  it('scopes favorites per channel and supports multiple channels', async () => {
    const { service } = setup();
    await service.addFavorite(emoji());
    await service.addFavorite(emoji({ channelId: CH_B }));
    expect((await service.favoritesFor(CH_A)).map((f) => f.channelId)).toEqual([CH_A]);
    expect((await service.favoritesFor(CH_B)).map((f) => f.channelId)).toEqual([CH_B]);
    expect(await service.favoritesFor(undefined)).toEqual([]);
    expect(await service.allFavorites()).toHaveLength(2);
  });

  it('distinguishes same-name emojis by family, and ignores imageUrl changes', async () => {
    const { service } = setup();
    await service.addFavorite(emoji());
    await service.addFavorite(emoji({ familyName: 'Other' }));
    await service.addFavorite(emoji({ imageUrl: 'https://img.example/wave-new.png' }));
    const favorites = await service.favoritesFor(CH_A);
    expect(favorites).toHaveLength(2);
    expect(favorites[0]?.imageUrl).toBe('https://img.example/wave-new.png');
  });

  it('recordScan refreshes metadata only for seen favorites', async () => {
    const { service } = setup();
    await service.addFavorite(emoji());
    await service.addFavorite(emoji({ emojiName: ':_gone:' }));
    await service.recordScan([emoji({ imageUrl: 'https://img.example/v2.png' })]);
    const favorites = await service.favoritesFor(CH_A);
    expect(favorites[0]?.imageUrl).toBe('https://img.example/v2.png');
    expect(favorites[0]?.lastSeenAt).toBeGreaterThan(favorites[1]?.lastSeenAt ?? Infinity);
  });

  it('moves favorites within a channel', async () => {
    const { service } = setup();
    await service.addFavorite(emoji({ emojiName: ':_a:' }));
    await service.addFavorite(emoji({ emojiName: ':_b:' }));
    await service.moveFavorite(emoji({ emojiName: ':_b:' }), 'up');
    expect((await service.favoritesFor(CH_A)).map((f) => f.emojiName)).toEqual([':_b:', ':_a:']);
  });

  it('remembers channels with names, keeping an existing name when none is given', async () => {
    const { service, repo } = setup();
    await service.rememberChannel(CH_A, 'Channel A');
    await service.rememberChannel(CH_A, undefined);
    await service.rememberChannel('bad', 'x');
    const { channels } = await repo.load();
    expect(Object.keys(channels)).toEqual([CH_A]);
    expect(channels[CH_A]?.channelName).toBe('Channel A');
  });
});
