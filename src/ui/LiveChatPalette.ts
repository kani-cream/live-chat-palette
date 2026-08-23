import type { PaletteTab } from '../storage/schema';
import { h } from './dom';
import { renderEmojiPanel } from './EmojiPanel';
import { renderNotice } from './ErrorMessage';
import { renderPresetPanel } from './PresetPanel';
import type { PaletteHandlers, PaletteState } from './state';
import { STRINGS } from './strings';
import styles from './styles.css?inline';

const TABS: readonly { id: PaletteTab; label: string }[] = [
  { id: 'emoji', label: STRINGS.tabEmoji },
  { id: 'preset', label: STRINGS.tabPreset },
];

const renderTabs = (state: PaletteState, handlers: PaletteHandlers): HTMLElement => {
  const onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const index = TABS.findIndex((t) => t.id === state.tab);
    const nextIndex = (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    if (next) handlers.onSelectTab(next.id);
  };
  return h(
    'div',
    { className: 'lcp-tabs', attrs: { role: 'tablist', 'aria-label': STRINGS.appName } },
    ...TABS.map((tab) =>
      h('button', {
        className: 'lcp-tab',
        text: tab.label,
        attrs: {
          type: 'button',
          role: 'tab',
          id: `lcp-tab-${tab.id}`,
          'aria-selected': String(state.tab === tab.id),
          'aria-controls': `lcp-panel-${tab.id}`,
          tabindex: state.tab === tab.id ? '0' : '-1',
        },
        dataset: { tab: tab.id, focusKey: `tab:${tab.id}`, testid: `tab-${tab.id}` },
        on: {
          click: () => {
            handlers.onSelectTab(tab.id);
          },
          keydown: onKeydown,
        },
      }),
    ),
  );
};

const renderHeader = (state: PaletteState, handlers: PaletteHandlers): HTMLElement =>
  h(
    'div',
    { className: 'lcp-header' },
    h('span', { className: 'lcp-title', text: STRINGS.appName }),
    !state.collapsed && renderTabs(state, handlers),
    h('button', {
      className: 'lcp-icon-button',
      text: '⚙',
      attrs: { type: 'button', 'aria-label': STRINGS.openSettings, title: STRINGS.openSettings },
      dataset: { focusKey: 'settings', testid: 'open-settings' },
      on: { click: handlers.onOpenOptions },
    }),
    h('button', {
      className: 'lcp-icon-button',
      text: state.collapsed ? '▼' : '▲',
      attrs: {
        type: 'button',
        'aria-label': state.collapsed ? STRINGS.expand : STRINGS.collapse,
        'aria-expanded': String(!state.collapsed),
        title: state.collapsed ? STRINGS.expand : STRINGS.collapse,
      },
      dataset: { focusKey: 'collapse', testid: 'toggle-collapse' },
      on: { click: handlers.onToggleCollapse },
    }),
  );

/** Shadow-DOM hosted palette. Re-renders the whole tree from state; restores focus by key. */
export class LiveChatPalette {
  private readonly shadow: ShadowRoot;
  private readonly container: HTMLElement;

  constructor(private readonly host: HTMLElement) {
    this.shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = styles;
    this.container = h('div', { className: 'lcp-panel', dataset: { testid: 'lcp-panel' } });
    this.shadow.append(style, this.container);
  }

  get root(): ShadowRoot {
    return this.shadow;
  }

  render(state: PaletteState, handlers: PaletteHandlers): void {
    const focused = this.shadow.activeElement;
    const focusKey = focused instanceof HTMLElement ? focused.dataset.focusKey : undefined;

    this.host.dataset.theme = state.theme;
    this.container.dataset.collapsed = String(state.collapsed);
    this.container.dataset.tab = state.tab;
    this.container.replaceChildren(renderHeader(state, handlers));
    if (!state.collapsed) {
      if (state.notice) {
        this.container.append(renderNotice(state.notice, handlers.onDismissNotice));
      }
      if (!state.chatInputAvailable && !state.notice) {
        this.container.append(
          renderNotice({ kind: 'info', text: STRINGS.chatUnsupported }, handlers.onDismissNotice),
        );
      }
      const body = h('div', { className: 'lcp-body' });
      body.append(
        state.tab === 'preset'
          ? renderPresetPanel(state, handlers)
          : renderEmojiPanel(state, handlers),
      );
      this.container.append(body);
    }

    if (focusKey !== undefined) {
      const next = this.container.querySelector<HTMLElement>(`[data-focus-key="${focusKey}"]`);
      next?.focus();
    }
  }

  dispose(): void {
    this.container.replaceChildren();
  }
}
