import { vi } from 'vitest';
import { FakeStorageArea } from './fakeChrome';

type Listener = (...args: unknown[]) => unknown;

const event = () => {
  const listeners = new Set<Listener>();
  return {
    addListener: (l: Listener) => listeners.add(l),
    removeListener: (l: Listener) => listeners.delete(l),
    hasListener: (l: Listener) => listeners.has(l),
    emit: (...args: unknown[]) => [...listeners].map((l) => l(...args)),
    listeners,
  };
};

/** Minimal chrome.* stand-in for content-script and options-page integration tests. */
export const installFakeChrome = () => {
  const local = new FakeStorageArea();
  const session = new FakeStorageArea();
  const storageChanged = event();
  const bridge = (area: FakeStorageArea, name: string) => {
    area.onChanged((changes) => storageChanged.emit(changes, name));
    return {
      get: (keys: string | string[] | null) => area.get(keys),
      set: (items: Record<string, unknown>) => area.set(items),
      remove: (keys: string | string[]) => area.remove(keys),
      clear: () => area.clear(),
    };
  };
  const runtimeMessage = event();
  const tabsRemoved = event();
  const sendMessage = vi.fn((_message: unknown) => Promise.resolve(null as unknown));
  const fake = {
    runtime: {
      id: 'fake-extension-id',
      sendMessage,
      onMessage: runtimeMessage,
      openOptionsPage: vi.fn(() => Promise.resolve()),
    },
    storage: {
      local: bridge(local, 'local'),
      session: bridge(session, 'session'),
      onChanged: storageChanged,
    },
    tabs: {
      sendMessage: vi.fn(() => Promise.resolve()),
      onRemoved: tabsRemoved,
    },
  };
  (globalThis as unknown as { chrome: unknown }).chrome = fake;
  return {
    fake,
    local,
    session,
    sendMessage,
    /** Deliver a message from the background to content-script listeners. */
    deliver: (message: unknown) =>
      runtimeMessage.emit(message, { id: 'fake-extension-id' }, () => undefined),
    uninstall: () => {
      delete (globalThis as unknown as { chrome?: unknown }).chrome;
    },
  };
};
