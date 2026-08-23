import { EmojiService } from '../application/EmojiService';
import { PresetService } from '../application/PresetService';
import { SettingsService } from '../application/SettingsService';
import type { EmojiReference } from '../domain/emoji';
import { sortPresets, type MessagePreset } from '../domain/preset';
import { logger } from '../shared/logger';
import type { StorageSchema } from '../storage/schema';
import { chromeStorageArea } from '../storage/StorageArea';
import { StorageRepository } from '../storage/StorageRepository';
import { h } from '../ui/dom';

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
        h('h1', { text: 'Live Chat Palette' }),
        h('p', {
          className: 'subtitle',
          text: 'Message presets and favorite custom emojis for YouTube Live Chat. All data is stored locally in your browser.',
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
      h('h2', { text: 'General' }),
      h(
        'label',
        { className: 'field' },
        instant,
        'Send message presets immediately when clicked (Cmd/Ctrl + Click always sends)',
      ),
      h('p', {
        className: 'muted',
        text: 'Emojis are always inserted only; they are never sent immediately.',
      }),
      h(
        'fieldset',
        {},
        h('legend', { text: 'Default palette tab' }),
        tabRadio('emoji', 'Emojis'),
        tabRadio('preset', 'Presets'),
      ),
    );
  }

  private renderPresetList(presets: readonly MessagePreset[]): HTMLElement {
    if (presets.length === 0) return h('p', { className: 'empty', text: 'No presets yet.' });
    return h(
      'ul',
      { className: 'list' },
      ...presets.map((preset, index) => this.renderPresetItem(preset, index, presets.length)),
    );
  }

  private renderPresetItem(preset: MessagePreset, index: number, total: number): HTMLElement {
    if (this.editingId === preset.id) {
      const input = h('input', {
        attrs: { type: 'text', 'aria-label': 'Preset text', maxlength: '200' },
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
          text: 'Save',
          className: 'primary',
          attrs: { type: 'button' },
          on: { click: save },
        }),
        h('button', {
          text: 'Cancel',
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
      h('span', { className: 'text', text: preset.text }),
      h('button', {
        text: '↑',
        attrs: { type: 'button', 'aria-label': `Move up: ${label}` },
        props: { disabled: index === 0 },
        on: {
          click: () => {
            void this.deps.presets.move(preset.id, 'up');
          },
        },
      }),
      h('button', {
        text: '↓',
        attrs: { type: 'button', 'aria-label': `Move down: ${label}` },
        props: { disabled: index === total - 1 },
        on: {
          click: () => {
            void this.deps.presets.move(preset.id, 'down');
          },
        },
      }),
      h('button', {
        text: 'Edit',
        attrs: { type: 'button', 'aria-label': `Edit: ${label}` },
        on: {
          click: () => {
            this.editingId = preset.id;
            this.render();
          },
        },
      }),
      h('button', {
        text: 'Delete',
        className: 'danger',
        attrs: { type: 'button', 'aria-label': `Delete: ${label}` },
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
        placeholder: 'New global preset',
        'aria-label': 'New global preset',
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
      h('button', { text: 'Add', className: 'primary', attrs: { type: 'submit' } }),
    );
    return h(
      'section',
      { dataset: { section: 'global-presets' } },
      h('h2', { text: 'Global presets' }),
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
      h('h2', { text: 'Channel presets' }),
      h('p', {
        className: 'muted',
        text: 'Channel presets are created from the palette while watching a stream.',
      }),
      groups.size === 0 ? h('p', { className: 'empty', text: 'No channel presets yet.' }) : null,
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
      h('h2', { text: 'Favorite emojis' }),
      groups.size === 0 ? h('p', { className: 'empty', text: 'No favorite emojis yet.' }) : null,
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
        attrs: { type: 'button', 'aria-label': `Move up: ${favorite.displayName}` },
        props: { disabled: index === 0 },
        on: {
          click: () => {
            void this.deps.emojis.moveFavorite(favorite, 'up');
          },
        },
      }),
      h('button', {
        text: '↓',
        attrs: { type: 'button', 'aria-label': `Move down: ${favorite.displayName}` },
        props: { disabled: index === total - 1 },
        on: {
          click: () => {
            void this.deps.emojis.moveFavorite(favorite, 'down');
          },
        },
      }),
      h('button', {
        text: 'Remove',
        className: 'danger',
        attrs: { type: 'button', 'aria-label': `Remove favorite: ${favorite.displayName}` },
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
          text: 'Settings could not be loaded. Please reload this page.',
        }),
      );
    });
  }
}
