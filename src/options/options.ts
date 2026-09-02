import { EmojiService } from '../application/EmojiService';
import { PresetService } from '../application/PresetService';
import { SettingsService } from '../application/SettingsService';
import { isGlobalEmoji, type AvailableEmoji, type EmojiReference } from '../domain/emoji';
import { sortPresets, type MessagePreset } from '../domain/preset';
import { logger } from '../shared/logger';
import type { StorageSchema } from '../storage/schema';
import { chromeStorageArea } from '../storage/StorageArea';
import { StorageRepository } from '../storage/StorageRepository';
import { h } from '../ui/dom';
import { renderEmojiText } from '../ui/emojiText';
import { STRINGS, detectAndApplyLang } from '../ui/strings';

export interface OptionsDeps {
  root: HTMLElement;
  repo: StorageRepository;
  presets: PresetService;
  emojis: EmojiService;
  settings: SettingsService;
}

const groupBy = <T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> => {
  const map = new Map<string, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
};

/** Options page: settings, preset management, favorite management. Re-renders from storage. */
export class OptionsPage {
  private editingId: string | null = null;
  private error: string | null = null;
  private schema: StorageSchema | null = null;

  constructor(private readonly deps: OptionsDeps) {}

  async start(): Promise<void> {
    this.deps.repo.subscribe((schema) => {
      this.schema = schema;
      this.render();
    });
    this.schema = await this.deps.repo.load();
    this.render();
  }

  render(): void {
    const schema = this.schema;
    if (!schema) return;
    const root = this.deps.root;
    root.setAttribute('aria-busy', 'false');
    root.replaceChildren(
      ...[
        h('h1', { text: STRINGS.appName }),
        h('p', {
          className: 'subtitle',
          text: STRINGS.optionsTagline,
        }),
        this.error
          ? h('p', { className: 'error', text: this.error, attrs: { role: 'alert' } })
          : null,
        this.renderGeneral(schema),
        this.renderGlobalPresets(schema),
        this.renderChannelPresets(schema),
        this.renderFavorites(schema),
      ].filter((node): node is HTMLElement => node !== null),
    );
  }

  private renderGeneral(schema: StorageSchema): HTMLElement {
    const instant = h('input', {
      attrs: { type: 'checkbox', id: 'preset-instant-send' },
      props: { checked: schema.settings.presetInstantSend },
      on: {
        change: () => {
          void this.deps.settings.update({ presetInstantSend: instant.checked });
        },
      },
    });
    const tabRadio = (value: 'emoji' | 'preset', label: string): HTMLElement => {
      const input = h('input', {
        attrs: { type: 'radio', name: 'default-tab', value },
        props: { checked: schema.settings.lastSelectedTab === value },
        on: {
          change: () => {
            void this.deps.settings.update({ lastSelectedTab: value });
          },
        },
      });
      return h('label', { className: 'field' }, input, label);
    };
    return h(
      'section',
      {},
      h('h2', { text: STRINGS.optionsGeneral }),
      h('label', { className: 'field' }, instant, STRINGS.optionsInstantSend),
      h('p', {
        className: 'muted',
        text: STRINGS.optionsEmojiNeverSend,
      }),
      h(
        'fieldset',
        {},
        h('legend', { text: STRINGS.optionsDefaultTab }),
        tabRadio('emoji', STRINGS.tabEmoji),
        tabRadio('preset', STRINGS.tabPreset),
      ),
    );
  }

  private renderPresetList(presets: readonly MessagePreset[]): HTMLElement {
    if (presets.length === 0) return h('p', { className: 'empty', text: STRINGS.optionsNoPresets });
    return h(
      'ul',
      { className: 'list' },
      ...presets.map((preset, index) => this.renderPresetItem(preset, index, presets.length)),
    );
  }

  /** Emojis usable to render a preset's shortcodes as images: the cached catalog plus favorites. */
  private emojisForPreset(preset: MessagePreset): AvailableEmoji[] {
    const schema = this.schema;
    if (!schema) return [];
    const scoped = preset.scope === 'channel' && preset.channelId !== undefined;
    const all = Object.values(schema.emojiCatalog).flat();
    // YouTube-official (global) stamps render for every preset, whatever its channel scope.
    const catalog = scoped
      ? [
          ...(schema.emojiCatalog[preset.channelId ?? ''] ?? []),
          ...all.filter((e) => isGlobalEmoji(e)),
        ]
      : all;
    const favorites = scoped
      ? schema.favoriteEmojis.filter((f) => f.channelId === preset.channelId)
      : schema.favoriteEmojis;
    return [...catalog, ...favorites];
  }

  private renderPresetItem(preset: MessagePreset, index: number, total: number): HTMLElement {
    if (this.editingId === preset.id) {
      const input = h('input', {
        attrs: { type: 'text', 'aria-label': STRINGS.presetTextLabel, maxlength: '200' },
        props: { value: preset.text },
      });
      const save = (): void => {
        void this.deps.presets.edit(preset.id, input.value).then((result) => {
          this.error = result.ok ? null : result.error.message;
          if (result.ok) this.editingId = null;
          this.render();
        });
      };
      return h(
        'li',
        { dataset: { presetId: preset.id } },
        input,
        h('button', {
          text: STRINGS.save,
          className: 'primary',
          attrs: { type: 'button' },
          on: { click: save },
        }),
        h('button', {
          text: STRINGS.cancel,
          attrs: { type: 'button' },
          on: {
            click: () => {
              this.editingId = null;
              this.error = null;
              this.render();
            },
          },
        }),
      );
    }
    const label = preset.text;
    return h(
      'li',
      { dataset: { presetId: preset.id } },
      h(
        'span',
        { className: 'text' },
        ...renderEmojiText(preset.text, this.emojisForPreset(preset)),
      ),
      h('button', {
        text: '↑',
        attrs: { type: 'button', 'aria-label': STRINGS.moveUp(label) },
        props: { disabled: index === 0 },
        on: {
          click: () => {
            void this.deps.presets.move(preset.id, 'up');
          },
        },
      }),
      h('button', {
        text: '↓',
        attrs: { type: 'button', 'aria-label': STRINGS.moveDown(label) },
        props: { disabled: index === total - 1 },
        on: {
          click: () => {
            void this.deps.presets.move(preset.id, 'down');
          },
        },
      }),
      h('button', {
        text: STRINGS.optionsEdit,
        attrs: { type: 'button', 'aria-label': STRINGS.editItem(label) },
        on: {
          click: () => {
            this.editingId = preset.id;
            this.render();
          },
        },
      }),
      h('button', {
        text: STRINGS.optionsDelete,
        className: 'danger',
        attrs: { type: 'button', 'aria-label': STRINGS.deleteItem(label) },
        on: {
          click: () => {
            void this.deps.presets.remove(preset.id);
          },
        },
      }),
    );
  }

  private renderGlobalPresets(schema: StorageSchema): HTMLElement {
    const globals = sortPresets(schema.presets.filter((p) => p.scope === 'global'));
    const input = h('input', {
      attrs: {
        type: 'text',
        placeholder: STRINGS.optionsNewGlobalPreset,
        'aria-label': STRINGS.optionsNewGlobalPreset,
        maxlength: '200',
      },
    });
    const form = h(
      'form',
      {
        className: 'add-form',
        on: {
          submit: (event) => {
            event.preventDefault();
            void this.deps.presets.add({ text: input.value, scope: 'global' }).then((result) => {
              this.error = result.ok ? null : result.error.message;
              if (result.ok) input.value = '';
              this.render();
            });
          },
        },
      },
      input,
      h('button', { text: STRINGS.optionsAdd, className: 'primary', attrs: { type: 'submit' } }),
    );
    return h(
      'section',
      { dataset: { section: 'global-presets' } },
      h('h2', { text: STRINGS.optionsGlobalPresets }),
      this.renderPresetList(globals),
      form,
    );
  }

  private channelLabel(schema: StorageSchema, channelId: string): string {
    const name = schema.channels[channelId]?.channelName;
    return name ? `${name} (${channelId})` : channelId;
  }

  private renderChannelPresets(schema: StorageSchema): HTMLElement {
    const channelPresets = sortPresets(schema.presets.filter((p) => p.scope === 'channel'));
    const groups = groupBy(channelPresets, (p) => p.channelId ?? '');
    return h(
      'section',
      { dataset: { section: 'channel-presets' } },
      h('h2', { text: STRINGS.optionsChannelPresets }),
      h('p', {
        className: 'muted',
        text: STRINGS.optionsChannelPresetsHint,
      }),
      groups.size === 0
        ? h('p', { className: 'empty', text: STRINGS.optionsNoChannelPresets })
        : null,
      ...[...groups.entries()].map(([channelId, presets]) =>
        h(
          'div',
          { dataset: { channelId } },
          h('h3', { text: this.channelLabel(schema, channelId) }),
          this.renderPresetList(presets),
        ),
      ),
    );
  }

  private renderFavorites(schema: StorageSchema): HTMLElement {
    const groups = groupBy(schema.favoriteEmojis, (f) => f.channelId);
    return h(
      'section',
      { dataset: { section: 'favorite-emojis' } },
      h('h2', { text: STRINGS.optionsFavoriteEmojis }),
      groups.size === 0 ? h('p', { className: 'empty', text: STRINGS.optionsNoFavorites }) : null,
      ...[...groups.entries()].map(([channelId, favorites]) =>
        h(
          'div',
          { dataset: { channelId } },
          h('h3', { text: this.channelLabel(schema, channelId) }),
          h(
            'ul',
            { className: 'list emoji-list' },
            ...favorites.map((f, index) => this.renderFavoriteItem(f, index, favorites.length)),
          ),
        ),
      ),
    );
  }

  private renderFavoriteItem(favorite: EmojiReference, index: number, total: number): HTMLElement {
    return h(
      'li',
      { dataset: { favoriteId: favorite.id } },
      favorite.imageUrl !== undefined
        ? h('img', { attrs: { src: favorite.imageUrl, alt: '' } })
        : h('span', { text: '·' }),
      h('span', { className: 'text', text: favorite.displayName }),
      h('span', { className: 'muted', text: favorite.familyName }),
      h('button', {
        text: '↑',
        attrs: { type: 'button', 'aria-label': STRINGS.moveUp(favorite.displayName) },
        props: { disabled: index === 0 },
        on: {
          click: () => {
            void this.deps.emojis.moveFavorite(favorite, 'up');
          },
        },
      }),
      h('button', {
        text: '↓',
        attrs: { type: 'button', 'aria-label': STRINGS.moveDown(favorite.displayName) },
        props: { disabled: index === total - 1 },
        on: {
          click: () => {
            void this.deps.emojis.moveFavorite(favorite, 'down');
          },
        },
      }),
      h('button', {
        text: STRINGS.optionsRemove,
        className: 'danger',
        attrs: { type: 'button', 'aria-label': STRINGS.removeFavoriteItem(favorite.displayName) },
        on: {
          click: () => {
            void this.deps.emojis.removeFavorite(favorite);
          },
        },
      }),
    );
  }
}

if (typeof document !== 'undefined' && !import.meta.env.VITEST) {
  detectAndApplyLang();
  document.title = STRINGS.settingsPageTitle;
  const root = document.getElementById('app');
  if (root) {
    const repo = new StorageRepository(chromeStorageArea(chrome.storage.local, 'local'));
    const page = new OptionsPage({
      root,
      repo,
      presets: new PresetService(repo),
      emojis: new EmojiService(repo),
      settings: new SettingsService(repo),
    });
    page.start().catch((error: unknown) => {
      logger.error('options page failed to start', error);
      root.replaceChildren(
        h('p', {
          className: 'error',
          text: STRINGS.optionsLoadError,
        }),
      );
    });
  }
}
