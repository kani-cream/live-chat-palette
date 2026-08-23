import type { ObservableStorageArea, StorageChangeListener } from '../../src/storage/StorageArea';

/** In-memory stand-in for chrome.storage.local / chrome.storage.session with change events. */
export class FakeStorageArea implements ObservableStorageArea {
  private data = new Map<string, unknown>();
  private readonly listeners = new Set<StorageChangeListener>();
  public failNextSet = false;

  constructor(initial: Record<string, unknown> = {}) {
    for (const [k, v] of Object.entries(initial)) this.data.set(k, structuredClone(v));
  }

  get(keys: string | string[] | null): Promise<Record<string, unknown>> {
    const wanted = keys === null ? [...this.data.keys()] : Array.isArray(keys) ? keys : [keys];
    const out: Record<string, unknown> = {};
    for (const key of wanted) {
      if (this.data.has(key)) out[key] = structuredClone(this.data.get(key));
    }
    return Promise.resolve(out);
  }

  set(items: Record<string, unknown>): Promise<void> {
    if (this.failNextSet) {
      this.failNextSet = false;
      return Promise.reject(new Error('storage write failed'));
    }
    const changes: Record<string, { newValue?: unknown }> = {};
    for (const [k, v] of Object.entries(items)) {
      this.data.set(k, structuredClone(v));
      changes[k] = { newValue: structuredClone(v) };
    }
    this.emit(changes);
    return Promise.resolve();
  }

  remove(keys: string | string[]): Promise<void> {
    const changes: Record<string, { newValue?: unknown }> = {};
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      this.data.delete(key);
      changes[key] = {};
    }
    this.emit(changes);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    const changes: Record<string, { newValue?: unknown }> = {};
    for (const key of this.data.keys()) changes[key] = {};
    this.data.clear();
    this.emit(changes);
    return Promise.resolve();
  }

  onChanged(listener: StorageChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Raw snapshot for assertions. */
  snapshot(): Record<string, unknown> {
    return Object.fromEntries([...this.data.entries()].map(([k, v]) => [k, structuredClone(v)]));
  }

  /** Overwrite raw contents without emitting (simulates data written by another version). */
  seed(items: Record<string, unknown>): void {
    this.data = new Map(Object.entries(items).map(([k, v]) => [k, structuredClone(v)]));
  }

  private emit(changes: Record<string, { newValue?: unknown }>): void {
    for (const listener of this.listeners) listener(changes);
  }
}

export const flushPromises = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
