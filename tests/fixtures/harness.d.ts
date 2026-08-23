export interface HarnessEmoji {
  /** The display name (rendered as the picker img alt and the inserted emoji alt). */
  name: string;
  /** The :_shortcode: (picker img aria-label). Defaults to name when omitted. */
  shortcode?: string;
  /** Emoji id: "<channelId>/<hash>" for custom emojis. */
  id: string;
  src: string;
}

export interface HarnessEmojiCategory {
  name: string;
  /** Marks a member/custom emoji category (CATEGORY_TYPE_CUSTOM listbox). */
  custom?: boolean;
  emojis: HarnessEmoji[];
}

export interface HarnessConfig {
  categories?: HarnessEmojiCategory[];
  sendFails?: boolean;
  pickerNeverRenders?: boolean;
  pickerToggleMissing?: boolean;
}

export interface HarnessState {
  sent: string[];
  sendClicks: number;
  pickerOpens: number;
  config: Required<Pick<HarnessConfig, 'categories'>> & HarnessConfig;
}

export interface HarnessApi {
  state: HarnessState;
  readInput: () => string;
  type: (text: string) => void;
  select: (start: number, end?: number) => void;
  setConfig: (patch: HarnessConfig) => void;
  rebuildInputRenderer: () => void;
  removeInputRenderer: () => void;
  pickerOpen: () => boolean;
}

export function installHarness(doc: Document, config?: HarnessConfig): HarnessApi;
