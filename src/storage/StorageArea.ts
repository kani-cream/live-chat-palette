/** Minimal async key-value area, satisfied by chrome.storage.local / chrome.storage.session. */
export interface StorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
  clear(): Promise<void>;
}

export type StorageChangeListener = (changes: Record<string, { newValue?: unknown }>) => void;

export interface ObservableStorageArea extends StorageArea {
  onChanged(listener: StorageChangeListener): () => void;
}

/** Adapt a chrome.storage area into the StorageArea interface. */
export const chromeStorageArea = (
  area: chrome.storage.StorageArea,
  areaName: 'local' | 'session',
): ObservableStorageArea => ({
  get: (keys) => area.get(keys),
  set: (items) => area.set(items),
  remove: (keys) => area.remove(keys),
  clear: () => area.clear(),
  onChanged: (listener) => {
    const wrapped = (
      changes: Record<string, chrome.storage.StorageChange>,
      changedArea: string,
    ): void => {
      if (changedArea === areaName) listener(changes);
    };
    chrome.storage.onChanged.addListener(wrapped);
    return () => {
      chrome.storage.onChanged.removeListener(wrapped);
    };
  },
});
