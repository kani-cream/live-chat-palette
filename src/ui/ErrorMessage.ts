import { h } from './dom';
import type { Notice } from './state';
import { STRINGS } from './strings';

/** Lightweight user-facing notice; never exposes selectors or internal errors. */
export const renderNotice = (notice: Notice, onDismiss: () => void): HTMLElement =>
  h(
    'div',
    {
      className: 'lcp-notice',
      dataset: { kind: notice.kind },
      attrs: { role: notice.kind === 'error' ? 'alert' : 'status' },
    },
    h('span', {
      className: 'lcp-notice-icon',
      text: notice.kind === 'error' ? '!' : 'i',
      attrs: { 'aria-hidden': 'true' },
    }),
    h('span', { className: 'lcp-notice-text', text: notice.text }),
    h('button', {
      className: 'lcp-icon-button',
      text: '×',
      attrs: { type: 'button', 'aria-label': STRINGS.dismiss },
      on: { click: onDismiss },
    }),
  );
