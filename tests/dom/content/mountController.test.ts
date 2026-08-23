import { describe, expect, it, vi } from 'vitest';
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
  const refresh = vi.fn();
  const controller = new MountController({
    doc: document,
    anchor: new DomPaletteAnchorAdapter(document),
    debounceMs: 10,
    createPalette: (host) => {
      created.push(host);
      return {
        refresh,
        dispose: () => {
          disposed.push(host);
        },
      };
    },
  });
  return { controller, created, disposed, refresh };
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
  it('asks the palette to refresh on unrelated mutations instead of remounting', async () => {
    mountLiveChat();
    const { controller, created, refresh } = setup();
    controller.start();
    document.querySelector('#items')?.append(document.createElement('div'));
    await tick();
    expect(refresh).toHaveBeenCalled();
    expect(created).toHaveLength(1);
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
