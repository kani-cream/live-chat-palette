import { isChannelId } from '../domain/context';
import { isEmojiReference, type EmojiReference } from '../domain/emoji';
import { isMessagePreset, normalizeOrders, type MessagePreset } from '../domain/preset';

export const CURRENT_SCHEMA_VERSION = 1;

export type PaletteTab = 'emoji' | 'preset';

export interface Settings {
  presetInstantSend: boolean;
  collapsed: boolean;
  lastSelectedTab: PaletteTab;
}

export interface KnownChannel {
  channelId: string;
  channelName?: string;
  lastSeenAt: number;
}

export interface StorageSchema {
  schemaVersion: typeof CURRENT_SCHEMA_VERSION;
  settings: Settings;
  presets: MessagePreset[];
  favoriteEmojis: EmojiReference[];
  channels: Record<string, KnownChannel>;
}

export const DEFAULT_SETTINGS: Settings = {
  presetInstantSend: false,
  collapsed: false,
  lastSelectedTab: 'emoji',
};

export const createDefaultSchema = (): StorageSchema => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  presets: [],
  favoriteEmojis: [],
  channels: {},
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeSettings = (value: unknown): Settings => {
  const v = isRecord(value) ? value : {};
  return {
    presetInstantSend:
      typeof v.presetInstantSend === 'boolean'
        ? v.presetInstantSend
        : DEFAULT_SETTINGS.presetInstantSend,
    collapsed: typeof v.collapsed === 'boolean' ? v.collapsed : DEFAULT_SETTINGS.collapsed,
    lastSelectedTab:
      v.lastSelectedTab === 'emoji' || v.lastSelectedTab === 'preset'
        ? v.lastSelectedTab
        : DEFAULT_SETTINGS.lastSelectedTab,
  };
};

const sanitizeChannels = (value: unknown): Record<string, KnownChannel> => {
  if (!isRecord(value)) return {};
  const entries = Object.entries(value).flatMap(([key, raw]): [string, KnownChannel][] => {
    if (!isRecord(raw) || !isChannelId(raw.channelId) || raw.channelId !== key) return [];
    if (typeof raw.lastSeenAt !== 'number') return [];
    const channel: KnownChannel = {
      channelId: raw.channelId,
      lastSeenAt: raw.lastSeenAt,
      ...(typeof raw.channelName === 'string' ? { channelName: raw.channelName } : {}),
    };
    return [[key, channel]];
  });
  return Object.fromEntries(entries);
};

/**
 * Produce a well-formed schema from arbitrary stored data.
 * Invalid entries are dropped rather than trusted; missing fields get defaults.
 */
export const sanitizeSchema = (value: unknown): StorageSchema => {
  const v = isRecord(value) ? value : {};
  const presets = Array.isArray(v.presets) ? v.presets.filter(isMessagePreset) : [];
  const favoriteEmojis = Array.isArray(v.favoriteEmojis)
    ? v.favoriteEmojis.filter(isEmojiReference)
    : [];
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    settings: sanitizeSettings(v.settings),
    presets: normalizeOrders(dedupeById(presets)),
    favoriteEmojis: dedupeById(favoriteEmojis),
    channels: sanitizeChannels(v.channels),
  };
};

const dedupeById = <T extends { id: string }>(items: readonly T[]): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
};
