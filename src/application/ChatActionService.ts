import type { EmojiIdentity } from '../domain/emoji';
import { err, okVoid, type Result } from '../shared/result';
import { systemClock, type Clock } from '../shared/time';
import type { ChatInputAdapter } from '../youtube/ChatInputAdapter';
import type { EmojiPickerAdapter } from '../youtube/EmojiPickerAdapter';
import type { SendButtonAdapter } from '../youtube/SendButtonAdapter';

export const DEFAULT_SEND_LOCK_MS = 800;

export interface ChatActionOptions {
  sendLockMs?: number;
  clock?: Clock;
}

/**
 * The only place that talks to the adapters on behalf of the UI.
 * - insertPreset / insertEmoji never send.
 * - insertAndSendPreset sends once, only after insertion is confirmed and send is enabled.
 * - Sends are never retried; a failed send leaves the draft untouched.
 */
export class ChatActionService {
  private readonly sendLockMs: number;
  private readonly clock: Clock;
  private lockedUntil = 0;
  private emojiInFlight = false;

  constructor(
    private readonly chatInput: ChatInputAdapter,
    private readonly sendButton: SendButtonAdapter,
    private readonly emojiPicker: EmojiPickerAdapter,
    options: ChatActionOptions = {},
  ) {
    this.sendLockMs = options.sendLockMs ?? DEFAULT_SEND_LOCK_MS;
    this.clock = options.clock ?? systemClock;
  }

  isChatInputAvailable(): boolean {
    return this.chatInput.findInput() !== null;
  }

  isSendAvailable(): boolean {
    return this.sendButton.isSendEnabled();
  }

  insertPreset(text: string): Result<void> {
    return this.chatInput.insertText(text);
  }

  insertAndSendPreset(text: string): Result<void> {
    if (this.isSendLocked()) return err('SEND_LOCKED', 'A send was just triggered; wait a moment.');
    const inserted = this.chatInput.insertText(text);
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
