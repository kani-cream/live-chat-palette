import type { Settings } from '../storage/schema';
import type { StorageRepository } from '../storage/StorageRepository';

export class SettingsService {
  constructor(private readonly repo: StorageRepository) {}

  async get(): Promise<Settings> {
    return (await this.repo.load()).settings;
  }

  async update(patch: Partial<Settings>): Promise<Settings> {
    const next = await this.repo.update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
    return next.settings;
  }
}
