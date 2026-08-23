import { isChannelId } from '../domain/context';
import {
  addFavorite,
  favoritesForChannel,
  moveFavorite,
  refreshFavorites,
  removeFavorite,
  type AvailableEmoji,
  type EmojiIdentity,
  type EmojiReference,
} from '../domain/emoji';
import { generateId } from '../shared/ids';
import { err, ok, type Result } from '../shared/result';
import { systemClock, type Clock } from '../shared/time';
import type { StorageRepository } from '../storage/StorageRepository';

export class EmojiService {
  constructor(
    private readonly repo: StorageRepository,
    private readonly clock: Clock = systemClock,
    private readonly newId: () => string = generateId,
  ) {}

  async allFavorites(): Promise<EmojiReference[]> {
    return (await this.repo.load()).favoriteEmojis;
  }

  async favoritesFor(channelId: string | undefined): Promise<EmojiReference[]> {
    return favoritesForChannel(await this.allFavorites(), channelId);
  }

  async addFavorite(emoji: AvailableEmoji): Promise<Result<void>> {
    if (!isChannelId(emoji.channelId)) {
      return err('CHANNEL_UNKNOWN', 'Favorites require a known channel.');
    }
    await this.repo.update((s) => ({
      ...s,
      favoriteEmojis: addFavorite(s.favoriteEmojis, emoji, this.newId(), this.clock()),
    }));
    return ok(undefined);
  }

  async removeFavorite(identity: EmojiIdentity): Promise<void> {
    await this.repo.update((s) => ({
      ...s,
      favoriteEmojis: removeFavorite(s.favoriteEmojis, identity),
    }));
  }

  async moveFavorite(identity: EmojiIdentity, direction: 'up' | 'down'): Promise<void> {
    await this.repo.update((s) => ({
      ...s,
      favoriteEmojis: moveFavorite(s.favoriteEmojis, identity, direction),
    }));
  }

  /** Record fresh display metadata for favorites that were just observed in the native picker. */
  async recordScan(available: readonly AvailableEmoji[]): Promise<void> {
    if (available.length === 0) return;
    await this.repo.update((s) => ({
      ...s,
      favoriteEmojis: refreshFavorites(s.favoriteEmojis, available, this.clock()),
    }));
  }

  async rememberChannel(channelId: string, channelName: string | undefined): Promise<void> {
    if (!isChannelId(channelId)) return;
    await this.repo.update((s) => ({
      ...s,
      channels: {
        ...s.channels,
        [channelId]: {
          channelId,
          lastSeenAt: this.clock(),
          ...(channelName !== undefined
            ? { channelName }
            : s.channels[channelId]?.channelName !== undefined
              ? { channelName: s.channels[channelId].channelName }
              : {}),
        },
      },
    }));
  }
}
