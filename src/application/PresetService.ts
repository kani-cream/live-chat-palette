import { isChannelId } from '../domain/context';
import {
  movePreset,
  normalizeOrders,
  sortPresets,
  validatePresetText,
  type MessagePreset,
  type PresetScope,
} from '../domain/preset';
import { generateId } from '../shared/ids';
import { err, ok, type Result } from '../shared/result';
import { systemClock, type Clock } from '../shared/time';
import type { StorageRepository } from '../storage/StorageRepository';

export interface NewPresetInput {
  text: string;
  scope: PresetScope;
  channelId?: string;
}

export class PresetService {
  constructor(
    private readonly repo: StorageRepository,
    private readonly clock: Clock = systemClock,
    private readonly newId: () => string = generateId,
  ) {}

  async list(): Promise<MessagePreset[]> {
    return sortPresets((await this.repo.load()).presets);
  }

  async add(input: NewPresetInput): Promise<Result<MessagePreset>> {
    const textError = validatePresetText(input.text);
    if (textError) return err('INVALID_TEXT', textError);
    if (input.scope === 'channel' && !isChannelId(input.channelId)) {
      return err('CHANNEL_UNKNOWN', 'Channel presets require a known channel.');
    }
    const now = this.clock();
    const preset: MessagePreset = {
      id: this.newId(),
      text: input.text,
      scope: input.scope,
      order: Number.MAX_SAFE_INTEGER,
      createdAt: now,
      updatedAt: now,
      ...(input.scope === 'channel' && input.channelId !== undefined
        ? { channelId: input.channelId }
        : {}),
    };
    await this.repo.update((s) => ({ ...s, presets: normalizeOrders([...s.presets, preset]) }));
    return ok(preset);
  }

  async edit(id: string, text: string): Promise<Result<void>> {
    const textError = validatePresetText(text);
    if (textError) return err('INVALID_TEXT', textError);
    let found = false;
    await this.repo.update((s) => ({
      ...s,
      presets: s.presets.map((p) => {
        if (p.id !== id) return p;
        found = true;
        return { ...p, text, updatedAt: this.clock() };
      }),
    }));
    return found ? ok(undefined) : err('NOT_FOUND', 'Preset not found.');
  }

  async remove(id: string): Promise<void> {
    await this.repo.update((s) => ({
      ...s,
      presets: normalizeOrders(s.presets.filter((p) => p.id !== id)),
    }));
  }

  async move(id: string, direction: 'up' | 'down'): Promise<void> {
    await this.repo.update((s) => ({
      ...s,
      presets: movePreset(s.presets, id, direction, this.clock()),
    }));
  }
}
