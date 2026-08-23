import { emojiIdentityKey, isFavorite, sameEmoji } from '../domain/emoji';
import type { AvailableEmoji, EmojiReference } from '../domain/emoji';
import { h } from './dom';
import { renderEmptyState } from './EmptyState';
import type { PaletteHandlers, PaletteState } from './state';
import { STRINGS } from './strings';

const renderEmojiImage = (emoji: { imageUrl?: string; displayName: string }): HTMLElement =>
  emoji.imageUrl !== undefined
    ? h('img', {
        attrs: { src: emoji.imageUrl, alt: '', loading: 'lazy', draggable: 'false' },
      })
    : h('span', { className: 'lcp-emoji-fallback', text: emoji.displayName });

const isResolvable = (state: PaletteState, favorite: EmojiReference): boolean =>
  state.availableEmojis.some((a) => sameEmoji(a, favorite));

const renderFavorite = (
  state: PaletteState,
  handlers: PaletteHandlers,
  favorite: EmojiReference,
): HTMLElement => {
  const unavailable = state.emojiScan === 'scanned' && !isResolvable(state, favorite);
  const label = unavailable
    ? `${STRINGS.insertEmoji(favorite.displayName)} (${STRINGS.emojiUnavailableBadge})`
    : STRINGS.insertEmoji(favorite.displayName);
  return h(
    'li',
    { className: 'lcp-emoji-item' },
    h(
      'button',
      {
        className: 'lcp-emoji-button',
        attrs: { type: 'button', 'aria-label': label, title: label },
        dataset: {
          emojiKey: emojiIdentityKey(favorite),
          focusKey: `fav:${emojiIdentityKey(favorite)}`,
          unavailable: String(unavailable),
          testid: 'favorite-emoji',
        },
        props: { disabled: unavailable || !state.chatInputAvailable || state.busy },
        on: {
          // Keep focus/caret inside YouTube's input; the click still fires.
          mousedown: (event) => {
            event.preventDefault();
          },
          click: (event) => {
            handlers.onEmojiClick(favorite, { metaKey: event.metaKey, ctrlKey: event.ctrlKey });
          },
        },
      },
      renderEmojiImage(favorite),
    ),
    unavailable &&
      h('span', {
        className: 'lcp-emoji-badge',
        text: '🔒',
        attrs: { 'aria-hidden': 'true' },
      }),
    h('button', {
      className: 'lcp-star',
      text: '★',
      attrs: {
        type: 'button',
        'aria-label': STRINGS.removeFavorite(favorite.displayName),
        'aria-pressed': 'true',
      },
      dataset: { focusKey: `unfav:${emojiIdentityKey(favorite)}`, testid: 'favorite-remove' },
      on: {
        click: () => {
          handlers.onRemoveFavorite(favorite);
        },
      },
    }),
  );
};

const renderAvailable = (
  state: PaletteState,
  handlers: PaletteHandlers,
  emoji: AvailableEmoji,
): HTMLElement => {
  const favorited = isFavorite(state.favorites, emoji);
  return h(
    'li',
    { className: 'lcp-emoji-item' },
    h(
      'span',
      {
        className: 'lcp-emoji-button',
        attrs: { title: emoji.displayName },
        dataset: { testid: 'available-emoji', emojiKey: emojiIdentityKey(emoji) },
      },
      renderEmojiImage(emoji),
    ),
    h('button', {
      className: 'lcp-star',
      text: favorited ? '★' : '☆',
      attrs: {
        type: 'button',
        'aria-label': favorited
          ? STRINGS.removeFavorite(emoji.displayName)
          : STRINGS.addFavorite(emoji.displayName),
        'aria-pressed': String(favorited),
      },
      dataset: { focusKey: `toggle:${emojiIdentityKey(emoji)}`, testid: 'favorite-toggle' },
      on: {
        click: () => {
          handlers.onToggleFavorite(emoji);
        },
      },
    }),
  );
};

const renderRefreshButton = (state: PaletteState, handlers: PaletteHandlers): HTMLElement =>
  h('button', {
    className: 'lcp-button',
    text: state.emojiScan === 'scanning' ? STRINGS.refreshing : `↻ ${STRINGS.refreshEmojis}`,
    attrs: { type: 'button' },
    dataset: { focusKey: 'emoji-refresh', testid: 'emoji-refresh' },
    props: { disabled: state.emojiScan === 'scanning' || state.busy },
    on: { click: handlers.onRefreshEmojis },
  });

export const renderEmojiPanel = (state: PaletteState, handlers: PaletteHandlers): HTMLElement => {
  const container = h('div', {
    attrs: { role: 'tabpanel', id: 'lcp-panel-emoji', 'aria-labelledby': 'lcp-tab-emoji' },
    dataset: { testid: 'emoji-panel' },
  });

  if (state.context.channelId === undefined) {
    container.append(
      renderEmptyState({ title: STRINGS.emojiEmptyTitle, hint: STRINGS.channelUnknownEmoji }),
    );
    return container;
  }

  if (state.favorites.length === 0 && state.availableEmojis.length === 0) {
    container.append(
      renderEmptyState({
        title: STRINGS.emojiEmptyTitle,
        hint: state.emojiScan === 'unsupported' ? STRINGS.emojiUnsupported : STRINGS.emojiEmptyHint,
        action: {
          label: state.emojiScan === 'scanning' ? STRINGS.refreshing : STRINGS.refreshEmojis,
          onClick: handlers.onRefreshEmojis,
          disabled: state.emojiScan === 'scanning' || state.busy,
          focusKey: 'emoji-refresh',
        },
      }),
    );
    if (state.emojiScan === 'scanned') {
      container.append(h('p', { className: 'lcp-hint', text: STRINGS.noCustomEmojis }));
    }
    return container;
  }

  if (state.favorites.length > 0) {
    container.append(
      h('p', { className: 'lcp-section-title', text: STRINGS.favorites }),
      h(
        'ul',
        { className: 'lcp-emoji-grid', dataset: { testid: 'favorite-grid' } },
        ...state.favorites.map((f) => renderFavorite(state, handlers, f)),
      ),
    );
  } else {
    container.append(
      renderEmptyState({ title: STRINGS.emojiEmptyTitle, hint: STRINGS.emojiEmptyHint }),
    );
  }

  container.append(
    h(
      'div',
      { className: 'lcp-actions', attrs: { style: 'margin-top:6px' } },
      renderRefreshButton(state, handlers),
    ),
  );

  if (state.availableEmojis.length > 0) {
    container.append(
      h('p', { className: 'lcp-section-title', text: STRINGS.availableEmojis }),
      h(
        'ul',
        { className: 'lcp-emoji-grid', dataset: { testid: 'available-grid' } },
        ...state.availableEmojis.map((e) => renderAvailable(state, handlers, e)),
      ),
    );
  } else if (state.emojiScan === 'scanned') {
    container.append(h('p', { className: 'lcp-hint', text: STRINGS.noCustomEmojis }));
  } else if (state.emojiScan === 'unsupported') {
    container.append(h('p', { className: 'lcp-hint', text: STRINGS.emojiUnsupported }));
  }
  return container;
};
