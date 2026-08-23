import type { PresetScope } from '../domain/preset';
import { MAX_PRESET_LENGTH } from '../domain/preset';
import { emojiIdentityKey } from '../domain/emoji';
import { h } from './dom';
import { renderEmojiText } from './emojiText';
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
    // Seed from state so an unrelated re-render restores what the user was typing.
    props: { value: state.presetFormText },
    on: {
      input: () => {
        sync();
      },
    },
  });

  // Live preview: renders the text with known member emojis as images while composing.
  const preview = h('div', {
    className: 'lcp-preset-preview',
    dataset: { testid: 'preset-form-preview' },
    attrs: { 'aria-hidden': 'true' },
  });
  const sync = (): void => {
    handlers.onPresetFormInput(textarea.value);
    preview.replaceChildren(...renderEmojiText(textarea.value, state.availableEmojis));
  };

  const insertShortcode = (shortcode: string): void => {
    // Append the exact shortcode; YouTube converts it to the member emoji when the preset is sent.
    const el = textarea;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + shortcode + el.value.slice(end);
    const caret = start + shortcode.length;
    el.setSelectionRange(caret, caret);
    el.focus();
    sync();
  };

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

  const form = h(
    'form',
    { className: 'lcp-form', dataset: { testid: 'preset-form' }, on: { submit } },
    h('label', {}, STRINGS.presetTextLabel, textarea),
    preview,
    renderEmojiInserter(state, handlers, insertShortcode),
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
  sync();
  return form;
};

/** A strip of discovered custom emojis; clicking one appends its exact shortcode (no copy-paste). */
const renderEmojiInserter = (
  state: PaletteState,
  handlers: PaletteHandlers,
  insertShortcode: (shortcode: string) => void,
): HTMLElement => {
  const container = h('div', {
    className: 'lcp-emoji-inserter',
    dataset: { testid: 'preset-emoji-inserter' },
  });
  if (state.context.channelId === undefined) return container;
  container.append(h('p', { className: 'lcp-section-title', text: STRINGS.insertEmojiTitle }));
  if (state.availableEmojis.length === 0) {
    container.append(
      h('p', { className: 'lcp-hint', text: STRINGS.insertEmojiHint }),
      h('button', {
        className: 'lcp-button',
        text: state.emojiScan === 'scanning' ? STRINGS.refreshing : `↻ ${STRINGS.refreshEmojis}`,
        attrs: { type: 'button' },
        dataset: { testid: 'preset-emoji-refresh' },
        props: { disabled: state.emojiScan === 'scanning' || state.busy },
        on: { click: handlers.onRefreshEmojis },
      }),
    );
    return container;
  }
  container.append(
    h(
      'div',
      { className: 'lcp-emoji-grid', dataset: { testid: 'preset-emoji-grid' } },
      ...state.availableEmojis.map((emoji) =>
        h(
          'button',
          {
            className: 'lcp-emoji-button',
            attrs: {
              type: 'button',
              'aria-label': STRINGS.insertEmoji(emoji.displayName),
              title: emoji.displayName,
            },
            dataset: { emojiKey: emojiIdentityKey(emoji), testid: 'preset-emoji-option' },
            on: {
              mousedown: (event) => {
                event.preventDefault();
              },
              click: () => {
                insertShortcode(emoji.emojiName);
              },
            },
          },
          emoji.imageUrl !== undefined
            ? h('img', {
                attrs: { src: emoji.imageUrl, alt: '', loading: 'lazy', draggable: 'false' },
              })
            : h('span', { className: 'lcp-emoji-fallback', text: emoji.displayName }),
        ),
      ),
    ),
  );
  return container;
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
            h(
              'button',
              {
                className: 'lcp-preset-chip',
                attrs: {
                  type: 'button',
                  'aria-label': STRINGS.insertPreset(preset.text),
                  title: preset.text,
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
              },
              // Render known member-emoji shortcodes as images so the chip is identifiable.
              ...renderEmojiText(preset.text, state.availableEmojis),
            ),
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
