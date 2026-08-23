import type { VideoContext } from '../domain/context';
import { emojiIdentityKey } from '../domain/emoji';
import type { AvailableEmoji, EmojiIdentity, EmojiReference } from '../domain/emoji';
import type { MessagePreset, PresetScope } from '../domain/preset';
import type { PaletteTab } from '../storage/schema';
import type { Theme } from '../youtube/theme';
import type { ClickModifiers } from '../application/clickPolicy';

export type NoticeKind = 'error' | 'info';

export interface Notice {
  kind: NoticeKind;
  text: string;
}

export type EmojiScanState = 'idle' | 'scanning' | 'scanned' | 'unsupported';

export interface PaletteState {
  theme: Theme;
  tab: PaletteTab;
  collapsed: boolean;
  context: VideoContext;
  chatInputAvailable: boolean;
  presetInstantSend: boolean;
  /** Presets already filtered for the current channel. */
  presets: readonly MessagePreset[];
  /** Favorites already filtered for the current channel. */
  favorites: readonly EmojiReference[];
  /** Custom emojis discovered in the native picker (in-memory, per channel). */
  availableEmojis: readonly AvailableEmoji[];
  emojiScan: EmojiScanState;
  notice: Notice | null;
  presetFormOpen: boolean;
  presetFormText: string;
  busy: boolean;
}

export interface PaletteHandlers {
  onSelectTab: (tab: PaletteTab) => void;
  onToggleCollapse: () => void;
  onOpenOptions: () => void;
  onDismissNotice: () => void;
  onPresetClick: (preset: MessagePreset, modifiers: ClickModifiers) => void;
  onOpenPresetForm: () => void;
  onClosePresetForm: () => void;
  onPresetFormInput: (text: string) => void;
  onSubmitPreset: (text: string, scope: PresetScope) => void;
  onEmojiClick: (emoji: EmojiReference, modifiers: ClickModifiers) => void;
  onToggleFavorite: (emoji: AvailableEmoji) => void;
  onRemoveFavorite: (identity: EmojiIdentity) => void;
  onRefreshEmojis: () => void;
}

export const createInitialState = (theme: Theme): PaletteState => ({
  theme,
  tab: 'emoji',
  collapsed: false,
  context: {},
  chatInputAvailable: false,
  presetInstantSend: false,
  presets: [],
  favorites: [],
  availableEmojis: [],
  emojiScan: 'idle',
  notice: null,
  presetFormOpen: false,
  presetFormText: '',
  busy: false,
});

/**
 * Emojis usable for rendering shortcodes as images: the cached/scanned catalog plus favorites
 * (favorites carry their own cached image, so preset shortcodes render even before any live scan).
 */
export const renderableEmojis = (state: PaletteState): AvailableEmoji[] => {
  const byIdentity = new Map<string, AvailableEmoji>();
  for (const emoji of [...state.availableEmojis, ...state.favorites]) {
    byIdentity.set(emojiIdentityKey(emoji), emoji);
  }
  return [...byIdentity.values()];
};
