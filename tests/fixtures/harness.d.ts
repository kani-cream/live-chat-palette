export interface HarnessEmoji {
  name: string;
  id: string;
  src: string;
}

export interface HarnessEmojiCategory {
  name: string;
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
