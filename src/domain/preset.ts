import { isChannelId } from './context';

export type PresetScope = 'global' | 'channel';

export interface MessagePreset {
  id: string;
  text: string;
  scope: PresetScope;
  channelId?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
}

export const MAX_PRESET_LENGTH = 200;

export const isMessagePreset = (value: unknown): value is MessagePreset => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || v.id.length === 0) return false;
  if (typeof v.text !== 'string') return false;
  if (v.scope !== 'global' && v.scope !== 'channel') return false;
  if (v.scope === 'channel' && !isChannelId(v.channelId)) return false;
  if (v.scope === 'global' && v.channelId !== undefined) return false;
  if (typeof v.order !== 'number' || !Number.isFinite(v.order)) return false;
  if (typeof v.createdAt !== 'number' || typeof v.updatedAt !== 'number') return false;
  return true;
};

export const validatePresetText = (text: string): string | null => {
  if (text.length === 0) return 'Preset text must not be empty.';
  if (text.length > MAX_PRESET_LENGTH) {
    return `Preset text must be at most ${MAX_PRESET_LENGTH} characters.`;
  }
  return null;
};

const byOrder = (a: MessagePreset, b: MessagePreset): number =>
  a.order - b.order || a.createdAt - b.createdAt;

export const sortPresets = (presets: readonly MessagePreset[]): MessagePreset[] =>
  [...presets].sort(byOrder);

const groupKey = (p: MessagePreset): string =>
  p.scope === 'global' ? 'global' : `channel:${p.channelId ?? ''}`;

/** Presets visible for a context, split by scope so each section keeps its own ordering. */
export interface PresetSections {
  /** Presets scoped to the current channel; always empty when the channel is unknown. */
  channel: MessagePreset[];
  /** Presets shared across all channels. */
  global: MessagePreset[];
}

/**
 * Split presets for a context: globals always, channel presets only for a known matching channel.
 * Each list is sorted on its own; `order` values are never compared across scopes.
 */
export const splitPresetsForChannel = (
  presets: readonly MessagePreset[],
  channelId: string | undefined,
): PresetSections => ({
  channel: sortPresets(
    presets.filter(
      (p) => p.scope === 'channel' && channelId !== undefined && p.channelId === channelId,
    ),
  ),
  global: sortPresets(presets.filter((p) => p.scope === 'global')),
});

/** Re-number `order` within each scope/channel group so it stays dense. */
export const normalizeOrders = (presets: readonly MessagePreset[]): MessagePreset[] => {
  const groups = new Map<string, MessagePreset[]>();
  for (const p of sortPresets(presets)) {
    const key = groupKey(p);
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.values()].flatMap((group) =>
    group.map((p, index) => (p.order === index ? p : { ...p, order: index })),
  );
};

/** Move a preset within its own scope group; returns presets unchanged if the move is impossible. */
export const movePreset = (
  presets: readonly MessagePreset[],
  id: string,
  direction: 'up' | 'down',
  now: number,
): MessagePreset[] => {
  const normalized = normalizeOrders(presets);
  const target = normalized.find((p) => p.id === id);
  if (!target) return normalized;
  const group = sortPresets(normalized.filter((p) => groupKey(p) === groupKey(target)));
  const index = group.findIndex((p) => p.id === id);
  const other = group[direction === 'up' ? index - 1 : index + 1];
  if (!other) return normalized;
  return normalizeOrders(
    normalized.map((p) => {
      if (p.id === target.id) return { ...p, order: other.order, updatedAt: now };
      if (p.id === other.id) return { ...p, order: target.order, updatedAt: now };
      return p;
    }),
  );
};
