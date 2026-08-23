import { logger } from '../shared/logger';
import { migrateToCurrent } from './migration';
import { sanitizeSchema, type StorageSchema } from './schema';
import type { ObservableStorageArea } from './StorageArea';

export const STORAGE_ROOT_KEY = 'liveChatPalette';

export type SchemaListener = (schema: StorageSchema) => void;

/**
 * Persistent storage (chrome.storage.local) behind a single root key.
 * Every read validates/migrates, every write goes through an immutable updater.
 */
export class StorageRepository {
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(private readonly area: ObservableStorageArea) {}

  async load(): Promise<StorageSchema> {
    const stored = await this.area.get(STORAGE_ROOT_KEY);
    const raw = stored[STORAGE_ROOT_KEY];
    const { schema, migrated } = migrateToCurrent(raw);
    if (migrated) {
      logger.debug('storage schema initialized/migrated');
      await this.area.set({ [STORAGE_ROOT_KEY]: schema });
    }
    return schema;
  }

  /** Apply an immutable update atomically (serialized per repository instance). */
  update(updater: (current: StorageSchema) => StorageSchema): Promise<StorageSchema> {
    const run = async (): Promise<StorageSchema> => {
      const current = await this.load();
      const next = sanitizeSchema(updater(current));
      await this.area.set({ [STORAGE_ROOT_KEY]: next });
      return next;
    };
    const result = this.writeQueue.then(run, run);
    this.writeQueue = result.catch(() => undefined);
    return result;
  }

  subscribe(listener: SchemaListener): () => void {
    return this.area.onChanged((changes) => {
      const change = changes[STORAGE_ROOT_KEY];
      if (!change) return;
      listener(migrateToCurrent(change.newValue).schema);
    });
  }
}
