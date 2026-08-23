import type { PresetScope } from '../domain/preset';
import { MAX_PRESET_LENGTH } from '../domain/preset';
import { h } from './dom';
import { renderEmptyState } from './EmptyState';
import type { PaletteHandlers, PaletteState } from './state';
import { STRINGS } from './strings';

const renderPresetForm = (state: PaletteState, handlers: PaletteHandlers): HTMLElement => {
  const textarea = h('textarea', {
    attrs: {
      rows: '2',
      maxlength: String(MAX_PRESET_LENGTH),
      'aria-label': STRINGS.presetTextLabel,
    },
    dataset: { focusKey: 'preset-form-text', testid: 'preset-form-text' },
  });
  const channelKnown = state.context.channelId !== undefined;
  const select = h(
    'select',
    {
      attrs: { 'aria-label': STRINGS.presetScopeLabel },
      dataset: { testid: 'preset-form-scope' },
    },
    h('option', { text: STRINGS.scopeGlobal, attrs: { value: 'global' } }),
    h('option', {
      text: STRINGS.scopeChannel,
      attrs: { value: 'channel' },
      props: { disabled: !channelKnown },
    }),
  );
  const submit = (event: Event): void => {
    event.preventDefault();
    const scope: PresetScope = select.value === 'channel' ? 'channel' : 'global';
    handlers.onSubmitPreset(textarea.value, scope);
  };
  return h(
    'form',
    { className: 'lcp-form', dataset: { testid: 'preset-form' }, on: { submit } },
    h('label', {}, STRINGS.presetTextLabel, textarea),
    h('label', {}, STRINGS.presetScopeLabel, select),
    h(
      'div',
      { className: 'lcp-actions' },
      h('button', {
        className: 'lcp-button lcp-button-primary',
        text: STRINGS.save,
        attrs: { type: 'submit' },
        dataset: { testid: 'preset-form-save' },
      }),
      h('button', {
        className: 'lcp-button',
        text: STRINGS.cancel,
        attrs: { type: 'button' },
        on: { click: handlers.onClosePresetForm },
      }),
    ),
  );
};

export const renderPresetPanel = (state: PaletteState, handlers: PaletteHandlers): HTMLElement => {
  const container = h('div', {
    attrs: { role: 'tabpanel', id: 'lcp-panel-preset', 'aria-labelledby': 'lcp-tab-preset' },
    dataset: { testid: 'preset-panel' },
  });

  if (state.presets.length === 0 && !state.presetFormOpen) {
    container.append(
      renderEmptyState({
        title: STRINGS.presetEmptyTitle,
        hint: STRINGS.presetEmptyHint,
        action: {
          label: STRINGS.addPreset,
          onClick: handlers.onOpenPresetForm,
          focusKey: 'preset-add',
        },
      }),
    );
    return container;
  }

  if (state.presets.length > 0) {
    container.append(
      h('p', {
        className: 'lcp-hint',
        text: state.presetInstantSend ? STRINGS.presetHintInstant : STRINGS.presetHint,
      }),
      h(
        'ul',
        { className: 'lcp-preset-list' },
        ...state.presets.map((preset) =>
          h(
            'li',
            {},
            h('button', {
              className: 'lcp-preset-chip',
              text: preset.text,
              attrs: {
                type: 'button',
                'aria-label': STRINGS.insertPreset(preset.text),
                title: STRINGS.insertPreset(preset.text),
              },
              dataset: {
                scope: preset.scope,
                presetId: preset.id,
                focusKey: `preset:${preset.id}`,
              },
              props: { disabled: !state.chatInputAvailable || state.busy },
              on: {
                // Keep focus/caret inside YouTube's input; the click still fires.
                mousedown: (event) => {
                  event.preventDefault();
                },
                click: (event) => {
                  handlers.onPresetClick(preset, {
                    metaKey: event.metaKey,
                    ctrlKey: event.ctrlKey,
                  });
                },
              },
            }),
          ),
        ),
      ),
    );
  }

  if (state.presetFormOpen) {
    container.append(renderPresetForm(state, handlers));
  } else {
    container.append(
      h(
        'div',
        { className: 'lcp-actions' },
        h('button', {
          className: 'lcp-button',
          text: STRINGS.addPreset,
          attrs: { type: 'button' },
          dataset: { focusKey: 'preset-add', testid: 'preset-add' },
          on: { click: handlers.onOpenPresetForm },
        }),
      ),
    );
  }
  return container;
};
