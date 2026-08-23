export type Lang = 'en' | 'ja';

/**
 * All user-facing UI text. English and Japanese must have identical shapes, which TypeScript
 * enforces because both are typed as `Strings`. The active language is chosen at startup from the
 * browser UI language; `STRINGS` is a live binding, so importers always read the current language.
 */
export interface Strings {
  appName: string;
  appTagline: string;
  settingsPageTitle: string;
  // Palette shell
  tabEmoji: string;
  tabPreset: string;
  collapse: string;
  expand: string;
  openSettings: string;
  dismiss: string;
  // Presets
  presetEmptyTitle: string;
  presetEmptyHint: string;
  addPreset: string;
  presetTextLabel: string;
  presetScopeLabel: string;
  scopeGlobal: string;
  scopeChannel: string;
  save: string;
  cancel: string;
  presetHint: string;
  presetHintInstant: string;
  insertPreset: (text: string) => string;
  // Emojis
  emojiEmptyTitle: string;
  emojiEmptyHint: string;
  refreshEmojis: string;
  refreshing: string;
  availableEmojis: string;
  noCustomEmojis: string;
  favorites: string;
  addFavorite: (name: string) => string;
  removeFavorite: (name: string) => string;
  insertEmoji: (name: string) => string;
  insertEmojiTitle: string;
  insertEmojiHint: string;
  emojiUnavailableBadge: string;
  // Error / state notices
  emojiUnavailable: string;
  chatUnsupported: string;
  emojiUnsupported: string;
  channelUnknown: string;
  channelUnknownEmoji: string;
  sendFailed: string;
  insertFailed: string;
  sendLocked: string;
  // Options page
  optionsTagline: string;
  optionsGeneral: string;
  optionsInstantSend: string;
  optionsEmojiNeverSend: string;
  optionsDefaultTab: string;
  optionsGlobalPresets: string;
  optionsChannelPresets: string;
  optionsChannelPresetsHint: string;
  optionsFavoriteEmojis: string;
  optionsNoPresets: string;
  optionsNoChannelPresets: string;
  optionsNoFavorites: string;
  optionsNewGlobalPreset: string;
  optionsAdd: string;
  optionsEdit: string;
  optionsDelete: string;
  optionsRemove: string;
  optionsLoadError: string;
  moveUp: (label: string) => string;
  moveDown: (label: string) => string;
  editItem: (label: string) => string;
  deleteItem: (label: string) => string;
  removeFavoriteItem: (label: string) => string;
}

const EN: Strings = {
  appName: 'Live Chat Palette',
  appTagline: 'Live Chat Palette',
  settingsPageTitle: 'Live Chat Palette – Settings',
  tabEmoji: 'Emojis',
  tabPreset: 'Presets',
  collapse: 'Collapse Live Chat Palette',
  expand: 'Expand Live Chat Palette',
  openSettings: 'Open settings',
  dismiss: 'Dismiss',
  presetEmptyTitle: 'No message presets yet.',
  presetEmptyHint: 'Add a preset to insert it into the chat with one click.',
  addPreset: '+ Add preset',
  presetTextLabel: 'Preset text',
  presetScopeLabel: 'Scope',
  scopeGlobal: 'All channels',
  scopeChannel: 'This channel only',
  save: 'Save',
  cancel: 'Cancel',
  presetHint: 'Click to insert. Cmd/Ctrl + Click to insert and send.',
  presetHintInstant: 'Instant send is on: clicking a preset inserts and sends it.',
  insertPreset: (text) => `Insert preset: ${text}`,
  emojiEmptyTitle: 'No favorite emojis yet.',
  emojiEmptyHint: "Open or refresh YouTube's emoji picker to discover available custom emojis.",
  refreshEmojis: 'Refresh emojis',
  refreshing: 'Refreshing…',
  availableEmojis: 'Available custom emojis',
  noCustomEmojis: 'No custom emojis were found in the emoji picker.',
  favorites: 'Favorites',
  addFavorite: (name) => `Add ${name} to favorites`,
  removeFavorite: (name) => `Remove ${name} from favorites`,
  insertEmoji: (name) => `Insert ${name}`,
  insertEmojiTitle: 'Insert a custom emoji',
  insertEmojiHint: "Refresh from the Emojis tab to insert this channel's custom emojis here.",
  emojiUnavailableBadge: 'Currently unavailable',
  emojiUnavailable: 'This favorite emoji is not currently available.',
  chatUnsupported: "YouTube's chat input could not be recognized.",
  emojiUnsupported: 'Custom emojis are currently unavailable.',
  channelUnknown: 'Channel information could not be determined. Global presets remain available.',
  channelUnknownEmoji:
    'Channel information could not be determined. Favorite emojis are unavailable.',
  sendFailed: 'The comment could not be sent. Your draft has been kept when possible.',
  insertFailed: 'The text could not be inserted into the chat input.',
  sendLocked: 'Please wait a moment before sending again.',
  optionsTagline:
    'Message presets and favorite custom emojis for YouTube Live Chat. All data is stored locally in your browser.',
  optionsGeneral: 'General',
  optionsInstantSend:
    'Send message presets immediately when clicked (Cmd/Ctrl + Click always sends)',
  optionsEmojiNeverSend: 'Emojis are always inserted only; they are never sent immediately.',
  optionsDefaultTab: 'Default palette tab',
  optionsGlobalPresets: 'Global presets',
  optionsChannelPresets: 'Channel presets',
  optionsChannelPresetsHint:
    'Channel presets are created from the palette while watching a stream.',
  optionsFavoriteEmojis: 'Favorite emojis',
  optionsNoPresets: 'No presets yet.',
  optionsNoChannelPresets: 'No channel presets yet.',
  optionsNoFavorites: 'No favorite emojis yet.',
  optionsNewGlobalPreset: 'New global preset',
  optionsAdd: 'Add',
  optionsEdit: 'Edit',
  optionsDelete: 'Delete',
  optionsRemove: 'Remove',
  optionsLoadError: 'Settings could not be loaded. Please reload this page.',
  moveUp: (label) => `Move up: ${label}`,
  moveDown: (label) => `Move down: ${label}`,
  editItem: (label) => `Edit: ${label}`,
  deleteItem: (label) => `Delete: ${label}`,
  removeFavoriteItem: (label) => `Remove favorite: ${label}`,
};

const JA: Strings = {
  appName: 'Live Chat Palette',
  appTagline: 'Live Chat Palette',
  settingsPageTitle: 'Live Chat Palette – 設定',
  tabEmoji: '絵文字',
  tabPreset: '定型文',
  collapse: 'Live Chat Palette を折りたたむ',
  expand: 'Live Chat Palette を展開する',
  openSettings: '設定を開く',
  dismiss: '閉じる',
  presetEmptyTitle: '定型文がまだありません。',
  presetEmptyHint: '定型文を追加すると、ワンクリックでチャット欄に入力できます。',
  addPreset: '＋ 定型文を追加',
  presetTextLabel: '定型文',
  presetScopeLabel: '適用範囲',
  scopeGlobal: 'すべてのチャンネル',
  scopeChannel: 'このチャンネルのみ',
  save: '保存',
  cancel: 'キャンセル',
  presetHint: 'クリックで入力。Cmd/Ctrl + クリックで入力して送信します。',
  presetHintInstant: '即時送信がオン：定型文をクリックすると入力して送信します。',
  insertPreset: (text) => `定型文を入力: ${text}`,
  emojiEmptyTitle: 'お気に入りの絵文字がまだありません。',
  emojiEmptyHint:
    'YouTube の絵文字ピッカーを開くか更新して、利用可能なカスタム絵文字を読み込みます。',
  refreshEmojis: '絵文字を更新',
  refreshing: '更新中…',
  availableEmojis: '利用可能なカスタム絵文字',
  noCustomEmojis: '絵文字ピッカーにカスタム絵文字が見つかりませんでした。',
  favorites: 'お気に入り',
  addFavorite: (name) => `${name} をお気に入りに追加`,
  removeFavorite: (name) => `${name} をお気に入りから削除`,
  insertEmoji: (name) => `${name} を入力`,
  insertEmojiTitle: 'カスタム絵文字を挿入',
  insertEmojiHint:
    '「絵文字」タブで更新すると、このチャンネルのカスタム絵文字をここから挿入できます。',
  emojiUnavailableBadge: '現在利用できません',
  emojiUnavailable: 'このお気に入り絵文字は現在利用できません。',
  chatUnsupported: 'YouTube のチャット入力欄を認識できませんでした。',
  emojiUnsupported: 'カスタム絵文字は現在利用できません。',
  channelUnknown: 'チャンネル情報を特定できませんでした。共通の定型文は引き続き利用できます。',
  channelUnknownEmoji: 'チャンネル情報を特定できませんでした。お気に入り絵文字は利用できません。',
  sendFailed: 'コメントを送信できませんでした。可能な場合、入力内容は保持されています。',
  insertFailed: 'チャット入力欄に文字を挿入できませんでした。',
  sendLocked: '少し待ってから、もう一度送信してください。',
  optionsTagline:
    'YouTube ライブチャット用の定型文とお気に入りカスタム絵文字。すべてのデータはブラウザ内にローカル保存されます。',
  optionsGeneral: '全般',
  optionsInstantSend: '定型文をクリックしたら即時送信する（Cmd/Ctrl + クリックは常に送信）',
  optionsEmojiNeverSend: '絵文字は常に入力のみで、即時送信されることはありません。',
  optionsDefaultTab: '既定のパレットタブ',
  optionsGlobalPresets: '共通の定型文',
  optionsChannelPresets: 'チャンネル別の定型文',
  optionsChannelPresetsHint: 'チャンネル別の定型文は、配信の視聴中にパレットから作成されます。',
  optionsFavoriteEmojis: 'お気に入りの絵文字',
  optionsNoPresets: '定型文がまだありません。',
  optionsNoChannelPresets: 'チャンネル別の定型文がまだありません。',
  optionsNoFavorites: 'お気に入りの絵文字がまだありません。',
  optionsNewGlobalPreset: '新しい共通の定型文',
  optionsAdd: '追加',
  optionsEdit: '編集',
  optionsDelete: '削除',
  optionsRemove: '削除',
  optionsLoadError: '設定を読み込めませんでした。このページを再読み込みしてください。',
  moveUp: (label) => `上へ移動: ${label}`,
  moveDown: (label) => `下へ移動: ${label}`,
  editItem: (label) => `編集: ${label}`,
  deleteItem: (label) => `削除: ${label}`,
  removeFavoriteItem: (label) => `お気に入りから削除: ${label}`,
};

const DICTIONARIES: Record<Lang, Strings> = { en: EN, ja: JA };

/** Live binding: reassigned by setLang, read by every importer at call time. */
export let STRINGS: Strings = EN;

export const resolveLang = (uiLanguage: string): Lang =>
  uiLanguage.toLowerCase().startsWith('ja') ? 'ja' : 'en';

export const setLang = (lang: Lang): void => {
  STRINGS = DICTIONARIES[lang];
};

const currentUiLanguage = (): string => {
  try {
    if (typeof chrome !== 'undefined' && typeof chrome.i18n?.getUILanguage === 'function') {
      return chrome.i18n.getUILanguage();
    }
  } catch {
    /* chrome.i18n unavailable (e.g. tests) */
  }
  if (typeof navigator !== 'undefined' && navigator.language) return navigator.language;
  return 'en';
};

/** Detect the browser UI language and switch the active dictionary. Returns the chosen language. */
export const detectAndApplyLang = (): Lang => {
  const lang = resolveLang(currentUiLanguage());
  setLang(lang);
  return lang;
};
