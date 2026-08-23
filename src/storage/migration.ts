import { CURRENT_SCHEMA_VERSION, sanitizeSchema, type StorageSchema } from './schema';

/** A migration transforms raw stored data from version N to N+1. */
export interface Migration {
  from: number;
  to: number;
  migrate: (raw: Record<string, unknown>) => Record<string, unknown>;
}

/**
 * Ordered migration chain. v1.0 starts at schemaVersion 1, so the chain is empty;
 * future versions append `{ from: 1, to: 2, migrate }` etc.
 */
export const MIGRATIONS: readonly Migration[] = [];

export interface MigrationResult {
  schema: StorageSchema;
  migrated: boolean;
}

const readVersion = (raw: unknown): number => {
  if (typeof raw !== 'object' || raw === null) return 0;
  const v = (raw as Record<string, unknown>).schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v > 0 ? v : 0;
};

/**
 * Bring stored data to the current schema version.
 * - Missing/unknown version (fresh install or corrupted) -> defaults merged with salvageable data.
 * - Older version -> run migrations in order, then sanitize.
 * - Newer version (downgrade) -> sanitize what we understand; never throw.
 */
export const migrateToCurrent = (
  raw: unknown,
  migrations: readonly Migration[] = MIGRATIONS,
): MigrationResult => {
  const version = readVersion(raw);
  if (version === CURRENT_SCHEMA_VERSION) {
    return { schema: sanitizeSchema(raw), migrated: false };
  }
  if (version === 0 || version > CURRENT_SCHEMA_VERSION) {
    return { schema: sanitizeSchema(raw), migrated: true };
  }
  let current = raw as Record<string, unknown>;
  let currentVersion = version;
  for (const migration of migrations) {
    if (migration.from !== currentVersion) continue;
    current = { ...migration.migrate(current), schemaVersion: migration.to };
    currentVersion = migration.to;
  }
  if (currentVersion !== CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `No migration path from schema version ${version} to ${CURRENT_SCHEMA_VERSION}`,
    );
  }
  return { schema: sanitizeSchema(current), migrated: true };
};
