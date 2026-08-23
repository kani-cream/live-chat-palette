import { h } from './dom';

export interface EmptyStateProps {
  title: string;
  hint: string;
  action?: { label: string; onClick: () => void; disabled?: boolean; focusKey: string };
}

export const renderEmptyState = ({ title, hint, action }: EmptyStateProps): HTMLElement =>
  h(
    'div',
    { className: 'lcp-empty', attrs: { role: 'status' } },
    h('p', { className: 'lcp-empty-title', text: title }),
    h('p', { text: hint }),
    action &&
      h('button', {
        className: 'lcp-button lcp-button-primary',
        text: action.label,
        attrs: { type: 'button' },
        dataset: { focusKey: action.focusKey },
        props: { disabled: action.disabled ?? false },
        on: { click: action.onClick },
      }),
  );
