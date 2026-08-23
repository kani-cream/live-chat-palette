import { describe, expect, it } from 'vitest';
import { MountController } from '../../../src/content/chat/mountController';
import {
  DomPaletteAnchorAdapter,
  MOUNT_ROOT_ATTRIBUTE,
} from '../../../src/youtube/PaletteAnchorAdapter';
import { mountLiveChat } from '../../helpers/liveChatDom';

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));

const setup = () => {
  const created: HTMLElement[] = [];
  const disposed: HTMLElement[] = [];
  const controller = new MountController({
    doc: document,
    anchor: new DomPaletteAnchorAdapter(document),
    debounceMs: 10,
    createPalette: (host) => {
      created.push(host);
      return {
        dispose: () => {
          disposed.push(host);
        },
      };
    },
  });
  return { controller, created, disposed };
};

const roots = () => document.querySelectorAll(`[${MOUNT_ROOT_ATTRIBUTE}]`);

describe('MountController', () => {
  it('mounts once before the native message input', () => {
    mountLiveChat();
    const { controller, created } = setup();
    controller.start();
    expect(created).toHaveLength(1);
    expect(roots()).toHaveLength(1);
    expect(roots()[0]?.nextElementSibling?.tagName.toLowerCase()).toBe(
      'yt-live-chat-message-input-renderer',
    );
    controller.evaluate();
    expect(created).toHaveLength(1);
    controller.stop();
  });
  it('does not mount when the anchor is absent (logged out / chat disabled)', () => {
    mountLiveChat({ withoutInputRenderer: true });
    const { controller, created } = setup();
    controller.start();
    expect(created).toHaveLength(0);
    expect(roots()).toHaveLength(0);
    controller.stop();
  });
  it('refuses to double-mount when another root already exists', () => {
    mountLiveChat();
    const foreign = document.createElement('div');
    foreign.setAttribute(MOUNT_ROOT_ATTRIBUTE, 'true');
    document.body.prepend(foreign);
    const { controller, created } = setup();
    controller.start();
    expect(created).toHaveLength(0);
    controller.stop();
  });
  it('remounts after YouTube rebuilds the input block, and unmounts when it disappears', async () => {
    const harness = mountLiveChat();
    const { controller, created, disposed } = setup();
    controller.start();
    expect(created).toHaveLength(1);
    harness.rebuildInputRenderer();
    roots()[0]?.remove(); // simulate YouTube clearing its surroundings
    await tick();
    expect(disposed).toHaveLength(1);
    expect(created).toHaveLength(2);
    expect(roots()).toHaveLength(1);
    harness.removeInputRenderer();
    await tick();
    expect(controller.isMounted()).toBe(false);
    expect(roots()).toHaveLength(0);
    expect(disposed).toHaveLength(2);
    controller.stop();
  });
  it('leaves the mounted palette untouched on unrelated chat mutations (no remount, no dispose)', async () => {
    mountLiveChat();
    const { controller, created, disposed } = setup();
    controller.start();
    const host = roots()[0];
    // Simulate a burst of incoming chat messages.
    for (let i = 0; i < 20; i += 1) {
      document.querySelector('#items')?.append(document.createElement('div'));
    }
    await tick();
    expect(created).toHaveLength(1);
    expect(disposed).toHaveLength(0);
    // The exact same host element is still mounted — it was never rebuilt.
    expect(roots()[0]).toBe(host);
    controller.stop();
  });
  it('stop() unmounts and disposes', () => {
    mountLiveChat();
    const { controller, disposed } = setup();
    controller.start();
    controller.stop();
    expect(disposed).toHaveLength(1);
    expect(roots()).toHaveLength(0);
  });
});
