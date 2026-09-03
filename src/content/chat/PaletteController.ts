import type { ChatActionService } from '../../application/ChatActionService';
import {
  resolveEmojiClick,
  resolvePresetClick,
  type ClickModifiers,
} from '../../application/clickPolicy';
import type { ContextService } from '../../application/ContextService';
import type { EmojiService } from '../../application/EmojiService';
import type { PresetService } from '../../application/PresetService';
import type { SettingsService } from '../../application/SettingsService';
import type { VideoContext } from '../../domain/context';
import {
  favoritesForChannel,
  isFavorite,
  isGlobalEmoji,
  type AvailableEmoji,
  type EmojiIdentity,
  type EmojiReference,
} from '../../domain/emoji';
import { splitPresetsForChannel, type MessagePreset, type PresetScope } from '../../domain/preset';
import { logger } from '../../shared/logger';
import type { ResultError } from '../../shared/result';
import type { PaletteTab, StorageSchema } from '../../storage/schema';
import type { StorageRepository } from '../../storage/StorageRepository';
import { LiveChatPalette } from '../../ui/LiveChatPalette';
import {
  createInitialState,
  type Notice,
  type PaletteHandlers,
  type PaletteState,
} from '../../ui/state';
import { STRINGS } from '../../ui/strings';
import type { EmojiPickerAdapter } from '../../youtube/EmojiPickerAdapter';
import { detectTheme, observeTheme } from '../../youtube/theme';

export interface PaletteControllerDeps {
  host: HTMLElement;
  doc: Document;
  win: Window;
  repo: StorageRepository;
  presets: PresetService;
  emojis: EmojiService;
  settings: SettingsService;
  actions: ChatActionService;
  emojiPicker: EmojiPickerAdapter;
  contextService: ContextService;
  openOptions: () => void;
}

const noticeFor = (error: ResultError): Notice => {
  switch (error.code) {
    case 'SEND_LOCKED':
      return { kind: 'info', text: STRINGS.sendLocked };
    case 'SEND_DISABLED':
    case 'SEND_BUTTON_NOT_FOUND':
      return { kind: 'error', text: STRINGS.sendFailed };
    case 'EMOJI_UNAVAILABLE':
      return { kind: 'error', text: STRINGS.emojiUnavailable };
    case 'EMOJI_PICKER_NOT_RENDERED':
    case 'EMOJI_PICKER_NOT_OPENED':
    case 'EMOJI_TOGGLE_NOT_FOUND':
      return { kind: 'error', text: STRINGS.emojiUnsupported };
    case 'INPUT_NOT_FOUND':
      return { kind: 'error', text: STRINGS.chatUnsupported };
    case 'CHANNEL_UNKNOWN':
      return { kind: 'error', text: STRINGS.channelUnknown };
    case 'INVALID_TEXT':
      return { kind: 'error', text: error.message };
    default:
      return { kind: 'error', text: STRINGS.insertFailed };
  }
};

/** Glues services, adapters and the palette view together inside the Live Chat frame. */
export class PaletteController {
  private state: PaletteState;
  private readonly view: LiveChatPalette;
  private readonly handlers: PaletteHandlers;
  private readonly disposers: (() => void)[] = [];
  private disposed = false;

  constructor(private readonly deps: PaletteControllerDeps) {
    this.state = createInitialState(detectTheme(deps.doc, deps.win));
    this.view = new LiveChatPalette(deps.host);
    this.handlers = this.createHandlers();
  }

  get currentState(): PaletteState {
    return this.state;
  }

  async start(): Promise<void> {
    this.render();
    this.disposers.push(
      observeTheme(this.deps.doc, this.deps.win, (theme) => {
        this.setState({ theme });
      }),
      this.deps.repo.subscribe((schema) => {
        this.applySchema(schema, this.state.context);
      }),
      this.deps.contextService.onChange((context) => {
        void this.onContextChange(context);
      }),
    );
    const [schema, context] = await Promise.all([
      this.deps.repo.load(),
      this.deps.contextService.start(),
    ]);
    if (this.disposed) return;
    this.applySchema(schema, context, { resetEmojis: true });
    await this.onContextChange(context);
  }

  dispose(): void {
    this.disposed = true;
    for (const dispose of this.disposers) dispose();
    this.disposers.length = 0;
    this.view.dispose();
  }

  private setState(patch: Partial<PaletteState>): void {
    this.state = { ...this.state, ...patch };
    this.render();
  }

  private render(): void {
    if (this.disposed) return;
    this.state = { ...this.state, chatInputAvailable: this.deps.actions.isChatInputAvailable() };
    this.view.render(this.state, this.handlers);
  }

  private applySchema(
    schema: StorageSchema,
    context: VideoContext,
    options: { resetEmojis?: boolean } = {},
  ): void {
    // availableEmojis is derived from the persisted per-channel catalog, so when the MAIN-world
    // discovery caches emojis (or a Refresh updates them), the storage subscription re-renders here.
    // YouTube-official (global) stamps are cached under YouTube's own channelId, so they are split
    // out and kept renderable regardless of which channel is being watched.
    const cached =
      context.channelId !== undefined
        ? (schema.emojiCatalog[context.channelId] ?? []).filter((e) => !isGlobalEmoji(e))
        : [];
    const globalEmojis = Object.values(schema.emojiCatalog).flat().filter(isGlobalEmoji);
    const presetSections = splitPresetsForChannel(schema.presets, context.channelId);
    this.setState({
      context,
      channelPresets: presetSections.channel,
      globalPresets: presetSections.global,
      favorites: favoritesForChannel(schema.favoriteEmojis, context.channelId),
      availableEmojis: cached,
      globalEmojis,
      presetInstantSend: schema.settings.presetInstantSend,
      collapsed: schema.settings.collapsed,
      tab: schema.settings.lastSelectedTab,
      ...(options.resetEmojis ? { emojiScan: 'idle' as const } : {}),
    });
  }

  private async onContextChange(context: VideoContext): Promise<void> {
    const videoChanged = context.videoId !== this.state.context.videoId;
    const schema = await this.deps.repo.load();
    if (this.disposed) return;
    this.applySchema(schema, context, { resetEmojis: true });
    // Only reset an open preset form when the stream actually changed — not when the channel id
    // simply resolves for the same video (which would otherwise close the form the user just opened).
    if (videoChanged) {
      this.setState({ notice: null, presetFormOpen: false, presetFormText: '' });
    }
    if (context.channelId !== undefined) {
      await this.deps.emojis.rememberChannel(context.channelId, context.channelName);
    }
  }

  private async scanEmojis(options: { mayOpenPicker: boolean }): Promise<void> {
    const channelId = this.state.context.channelId;
    if (channelId === undefined) return;
    this.setState({ emojiScan: 'scanning' });
    let openedByUs = false;
    if (options.mayOpenPicker && !this.deps.emojiPicker.isPickerRendered()) {
      const opened = await this.deps.emojiPicker.openPicker();
      if (!opened.ok) {
        this.setState({ emojiScan: 'unsupported', notice: noticeFor(opened.error) });
        return;
      }
      openedByUs = true;
    }
    try {
      const scanned = this.deps.emojiPicker.scanAvailableEmojis(channelId);
      if (!scanned.ok) {
        this.setState({ emojiScan: 'unsupported' });
        return;
      }
      // recordScan persists into the catalog; the storage subscription refreshes availableEmojis.
      await this.deps.emojis.recordScan(scanned.value);
      if (this.disposed || this.state.context.channelId !== channelId) return;
      this.setState({ emojiScan: 'scanned' });
    } finally {
      if (openedByUs) await this.deps.emojiPicker.closePicker();
    }
  }

  private createHandlers(): PaletteHandlers {
    return {
      onSelectTab: (tab: PaletteTab) => {
        this.setState({ tab });
        void this.deps.settings.update({ lastSelectedTab: tab });
      },
      onToggleCollapse: () => {
        const collapsed = !this.state.collapsed;
        this.setState({ collapsed });
        void this.deps.settings.update({ collapsed });
      },
      onOpenOptions: () => {
        this.deps.openOptions();
      },
      onDismissNotice: () => {
        this.setState({ notice: null });
      },
      onPresetClick: (preset, modifiers) => {
        void this.handlePresetClick(preset, modifiers);
      },
      onOpenPresetForm: () => {
        this.setState({ presetFormOpen: true, presetFormText: '' });
      },
      onClosePresetForm: () => {
        this.setState({ presetFormOpen: false, presetFormText: '' });
      },
      onPresetFormInput: (text) => {
        // Keep the in-progress text in state WITHOUT re-rendering, so a later re-render (theme,
        // storage, context) restores it instead of wiping the textarea the user is typing in.
        this.state = { ...this.state, presetFormText: text };
      },
      onSubmitPreset: (text, scope) => {
        void this.submitPreset(text, scope);
      },
      onEmojiClick: (emoji, modifiers) => {
        void this.handleEmojiClick(emoji, modifiers);
      },
      onToggleFavorite: (emoji) => {
        void this.toggleFavorite(emoji);
      },
      onRemoveFavorite: (identity) => {
        void this.deps.emojis.removeFavorite(identity);
      },
      onRefreshEmojis: () => {
        void this.scanEmojis({ mayOpenPicker: true });
      },
    };
  }

  private async handlePresetClick(preset: MessagePreset, modifiers: ClickModifiers): Promise<void> {
    const action = resolvePresetClick(modifiers, this.state.presetInstantSend);
    this.setState({ busy: true });
    const result =
      action === 'insert-and-send'
        ? await this.deps.actions.insertAndSendPreset(preset.text)
        : await this.deps.actions.insertPreset(preset.text);
    if (this.disposed) return;
    if (!result.ok) {
      logger.debug('preset action failed', result.error.code);
      this.setState({ busy: false, notice: noticeFor(result.error) });
      return;
    }
    this.setState({ busy: false, notice: null });
  }

  private async handleEmojiClick(emoji: EmojiReference, modifiers: ClickModifiers): Promise<void> {
    // Emojis only ever insert; the resolved action is always 'insert'.
    resolveEmojiClick(modifiers);
    this.setState({ busy: true });
    const result = await this.deps.actions.insertEmoji(emoji, this.state.context.channelId);
    if (this.disposed) return;
    if (!result.ok) {
      logger.debug('emoji insert failed', result.error.code);
      this.setState({ busy: false, notice: noticeFor(result.error) });
      if (result.error.code === 'EMOJI_UNAVAILABLE' && this.deps.emojiPicker.isPickerRendered()) {
        await this.scanEmojis({ mayOpenPicker: false });
      }
      return;
    }
    this.setState({ busy: false, notice: null });
  }

  private async submitPreset(text: string, scope: PresetScope): Promise<void> {
    const result = await this.deps.presets.add({
      text,
      scope,
      ...(scope === 'channel' && this.state.context.channelId !== undefined
        ? { channelId: this.state.context.channelId }
        : {}),
    });
    if (this.disposed) return;
    if (!result.ok) {
      this.setState({ notice: noticeFor(result.error) });
      return;
    }
    this.setState({ presetFormOpen: false, presetFormText: '', notice: null });
  }

  private async toggleFavorite(emoji: AvailableEmoji): Promise<void> {
    const identity: EmojiIdentity = emoji;
    if (isFavorite(this.state.favorites, identity)) {
      await this.deps.emojis.removeFavorite(identity);
      return;
    }
    const result = await this.deps.emojis.addFavorite(emoji);
    if (!result.ok && !this.disposed) this.setState({ notice: noticeFor(result.error) });
  }
}
