import type { EmojiIdentity } from '../domain/emoji';
import { err, okVoid, type Result } from '../shared/result';
import { systemClock, type Clock } from '../shared/time';
import type { ChatInputAdapter } from '../youtube/ChatInputAdapter';
import type { EmojiPickerAdapter } from '../youtube/EmojiPickerAdapter';
import type { SendButtonAdapter } from '../youtube/SendButtonAdapter';

export const DEFAULT_SEND_LOCK_MS = 800;
/**
 * Delay between inserting preset segments. Verified on a real live stream: inserting all shortcodes
 * in one shot converts only the last emoji, whereas inserting each `:_shortcode:` in its own edit,
 * spaced out, lets YouTube convert every one. This value trades a little latency for correctness.
 */
export const DEFAULT_CHUNK_DELAY_MS = 250;

/** Splits text into `:_shortcode:` tokens and the plain text between them (keeps both). */
const SHORTCODE_SPLIT = /(:_[^:\s]+:)/g;
const HAS_SHORTCODE = /:_[^:\s]+:/;

export interface ChatActionOptions {
  sendLockMs?: number;
  chunkDelayMs?: number;
  clock?: Clock;
  /** Injectable sleep so tests run without real timers. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * The only place that talks to the adapters on behalf of the UI.
 * - insertPreset / insertEmoji never send.
 * - insertAndSendPreset sends once, only after insertion is confirmed and send is enabled.
 * - Sends are never retried; a failed send leaves the draft untouched.
 */
export class ChatActionService {
  private readonly sendLockMs: number;
  private readonly chunkDelayMs: number;
  private readonly clock: Clock;
  private readonly sleep: (ms: number) => Promise<void>;
  private lockedUntil = 0;
  private emojiInFlight = false;
  private composing = false;

  constructor(
    private readonly chatInput: ChatInputAdapter,
    private readonly sendButton: SendButtonAdapter,
    private readonly emojiPicker: EmojiPickerAdapter,
    options: ChatActionOptions = {},
  ) {
    this.sendLockMs = options.sendLockMs ?? DEFAULT_SEND_LOCK_MS;
    this.chunkDelayMs = options.chunkDelayMs ?? DEFAULT_CHUNK_DELAY_MS;
    this.clock = options.clock ?? systemClock;
    this.sleep = options.sleep ?? defaultSleep;
  }

  isChatInputAvailable(): boolean {
    return this.chatInput.findInput() !== null;
  }

  isSendAvailable(): boolean {
    return this.sendButton.isSendEnabled();
  }

  async insertPreset(text: string): Promise<Result<void>> {
    if (this.composing) return err('BUSY', 'Another insertion is in progress.');
    this.composing = true;
    try {
      return await this.compose(text);
    } finally {
      this.composing = false;
    }
  }

  async insertAndSendPreset(text: string): Promise<Result<void>> {
    if (this.isSendLocked()) return err('SEND_LOCKED', 'A send was just triggered; wait a moment.');
    if (this.composing) return err('BUSY', 'Another insertion is in progress.');
    this.composing = true;
    let inserted: Result<void>;
    try {
      inserted = await this.compose(text);
    } finally {
      this.composing = false;
    }
    if (!inserted.ok) return inserted;
    if (!this.sendButton.isSendEnabled()) {
      return err('SEND_DISABLED', 'Sending is currently unavailable. Your draft was kept.');
    }
    this.lockedUntil = this.clock() + this.sendLockMs;
    const sent = this.sendButton.send();
    if (!sent.ok) return sent;
    return okVoid();
  }

  /**
   * Insert a preset. Plain text goes in as one strict, exact insertion. Text containing member
   * emoji shortcodes is inserted segment-by-segment with a delay, so YouTube converts every
   * `:_shortcode:` to its emoji image (a single bulk insertion converts only the last one).
   */
  private async compose(text: string): Promise<Result<void>> {
    if (!HAS_SHORTCODE.test(text)) return this.chatInput.insertText(text);
    const segments = text.split(SHORTCODE_SPLIT).filter((segment) => segment.length > 0);
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      if (segment === undefined) continue;
      const result = this.chatInput.insertChunk(segment);
      if (!result.ok) return result;
      if (i < segments.length - 1) await this.sleep(this.chunkDelayMs);
    }
    return okVoid();
  }

  /**
   * Emoji insertion only; there is deliberately no emoji send path.
   * A favorite from another channel context is never resolved against the current picker.
   */
  async insertEmoji(
    ref: EmojiIdentity,
    currentChannelId: string | undefined,
  ): Promise<Result<void>> {
    if (ref.channelId !== currentChannelId) {
      return err('EMOJI_UNAVAILABLE', 'Emoji belongs to a different channel context.');
    }
    if (this.emojiInFlight) return err('BUSY', 'Another emoji insertion is in progress.');
    this.emojiInFlight = true;
    try {
      return await this.emojiPicker.insertEmoji(ref);
    } finally {
      this.emojiInFlight = false;
    }
  }

  isSendLocked(): boolean {
    return this.clock() < this.lockedUntil;
  }
}
