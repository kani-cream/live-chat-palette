import type { AvailableEmoji, EmojiIdentity } from '../domain/emoji';
import { sameEmoji } from '../domain/emoji';
import { err, ok, okVoid, type Result } from '../shared/result';
import { serializeEditorContent, type ChatInputAdapter } from './ChatInputAdapter';
import { isButtonElement, isExplicitlyHidden, isImageElement, queryUnique } from './query';
import { CHAT_SELECTORS } from './selectors';

export interface EmojiPickerAdapter {
  isPickerRendered(): boolean;
  isPickerOpen(): boolean;
  openPicker(): Promise<Result<void>>;
  closePicker(): Promise<void>;
  /** Inspect the native picker as currently rendered. Fails when the picker is not in the DOM. */
  scanAvailableEmojis(channelId: string): Result<AvailableEmoji[]>;
  resolveEmoji(ref: EmojiIdentity): Result<AvailableEmoji>;
  /** Resolve + click the native emoji image so YouTube performs the insertion itself. */
  insertEmoji(ref: EmojiIdentity): Promise<Result<void>>;
}

const CUSTOM_EMOJI_ID = /^UC[\w-]{22}\//;
const CUSTOM_SHORTCODE = /^:_[^:\s]+:$/;

export interface EmojiPickerAdapterOptions {
  /** Wait budget for the picker to render after toggling it. */
  openTimeoutMs?: number;
  pollIntervalMs?: number;
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export class DomEmojiPickerAdapter implements EmojiPickerAdapter {
  private readonly openTimeoutMs: number;
  private readonly pollIntervalMs: number;

  constructor(
    private readonly root: ParentNode,
    private readonly chatInput: ChatInputAdapter,
    options: EmojiPickerAdapterOptions = {},
  ) {
    this.openTimeoutMs = options.openTimeoutMs ?? 1500;
    this.pollIntervalMs = options.pollIntervalMs ?? 50;
  }

  isPickerRendered(): boolean {
    return this.findPicker() !== null;
  }

  isPickerOpen(): boolean {
    const picker = this.findPicker();
    return picker !== null && !isExplicitlyHidden(picker);
  }

  async openPicker(): Promise<Result<void>> {
    if (this.isPickerOpen()) return okVoid();
    const toggle = this.findToggle();
    if (!toggle) return err('EMOJI_TOGGLE_NOT_FOUND', 'Emoji picker button not found.');
    toggle.click();
    const deadline = Date.now() + this.openTimeoutMs;
    while (Date.now() < deadline) {
      if (this.isPickerOpen()) return okVoid();
      await wait(this.pollIntervalMs);
    }
    return err('EMOJI_PICKER_NOT_OPENED', 'Emoji picker did not open.');
  }

  async closePicker(): Promise<void> {
    if (!this.isPickerOpen()) return;
    const toggle = this.findToggle();
    if (!toggle) return;
    toggle.click();
    const deadline = Date.now() + this.openTimeoutMs;
    while (Date.now() < deadline && this.isPickerOpen()) {
      await wait(this.pollIntervalMs);
    }
  }

  scanAvailableEmojis(channelId: string): Result<AvailableEmoji[]> {
    const picker = this.findPicker();
    if (!picker) return err('EMOJI_PICKER_NOT_RENDERED', 'Emoji picker is not available.');
    const found: AvailableEmoji[] = [];
    for (const { familyName, image } of this.customEmojiImages(picker)) {
      const emoji = toAvailableEmoji(channelId, familyName, image);
      if (emoji && !found.some((e) => sameEmoji(e, emoji))) found.push(emoji);
    }
    return ok(found);
  }

  resolveEmoji(ref: EmojiIdentity): Result<AvailableEmoji> {
    const scanned = this.scanAvailableEmojis(ref.channelId);
    if (!scanned.ok) return scanned;
    const match = scanned.value.find((e) => sameEmoji(e, ref));
    return match ? ok(match) : err('EMOJI_UNAVAILABLE', 'Emoji is not currently available.');
  }

  async insertEmoji(ref: EmojiIdentity): Promise<Result<void>> {
    const input = this.chatInput.findInput();
    if (!input) return err('INPUT_NOT_FOUND', 'Chat input not found.');
    const openedByUs = !this.isPickerOpen();
    if (openedByUs) {
      const opened = await this.openPicker();
      if (!opened.ok) return opened;
    }
    try {
      const image = this.findImage(ref);
      if (!image) return err('EMOJI_UNAVAILABLE', 'Emoji is not currently available.');
      const before = serializeEditorContent(input);
      image.click();
      const changed = await this.waitForEditorChange(input, before);
      if (!changed) return err('INSERT_UNCONFIRMED', 'Emoji insertion could not be confirmed.');
      return okVoid();
    } finally {
      if (openedByUs) await this.closePicker();
    }
  }

  private async waitForEditorChange(input: HTMLElement, before: string): Promise<boolean> {
    const deadline = Date.now() + this.openTimeoutMs;
    while (Date.now() < deadline) {
      if (serializeEditorContent(input) !== before) return true;
      await wait(this.pollIntervalMs);
    }
    return false;
  }

  private findPicker(): Element | null {
    const pickers = this.root.querySelectorAll(CHAT_SELECTORS.emojiPicker);
    return pickers.length === 1 ? (pickers[0] ?? null) : null;
  }

  private findToggle(): HTMLButtonElement | null {
    return queryUnique(this.root, CHAT_SELECTORS.emojiToggle, isButtonElement);
  }

  private findImage(ref: EmojiIdentity): HTMLImageElement | null {
    const picker = this.findPicker();
    if (!picker) return null;
    const matches = this.customEmojiImages(picker).filter(({ familyName, image }) => {
      const emoji = toAvailableEmoji(ref.channelId, familyName, image);
      return emoji !== null && sameEmoji(emoji, ref);
    });
    return matches.length === 1 ? (matches[0]?.image ?? null) : null;
  }

  private customEmojiImages(picker: Element): { familyName: string; image: HTMLImageElement }[] {
    const result: { familyName: string; image: HTMLImageElement }[] = [];
    for (const category of picker.querySelectorAll(CHAT_SELECTORS.emojiCategory)) {
      const familyName = categoryTitle(category);
      for (const image of category.querySelectorAll(CHAT_SELECTORS.emojiImage)) {
        if (isImageElement(image) && isCustomEmojiImage(image)) result.push({ familyName, image });
      }
    }
    return result;
  }
}

const categoryTitle = (category: Element): string => {
  for (const selector of CHAT_SELECTORS.emojiCategoryTitle) {
    const text = category.querySelector(selector)?.textContent?.trim();
    if (text) return text;
  }
  return '';
};

export const isCustomEmojiImage = (image: HTMLImageElement): boolean => {
  const emojiId = image.getAttribute('data-emoji-id') ?? '';
  if (CUSTOM_EMOJI_ID.test(emojiId)) return true;
  const alt = (image.getAttribute('alt') ?? '').trim();
  return CUSTOM_SHORTCODE.test(alt);
};

const toAvailableEmoji = (
  channelId: string,
  familyName: string,
  image: HTMLImageElement,
): AvailableEmoji | null => {
  const emojiName = (image.getAttribute('alt') ?? '').trim();
  if (emojiName.length === 0) return null;
  const tooltip = (image.getAttribute('shared-tooltip-text') ?? '').trim();
  const imageUrl = image.getAttribute('src') ?? undefined;
  return {
    channelId,
    familyName,
    emojiName,
    displayName: tooltip || emojiName,
    ...(imageUrl !== undefined ? { imageUrl } : {}),
  };
};
