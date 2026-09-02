import { describe, expect, it, vi } from 'vitest';
import { ChatActionService } from '../../../src/application/ChatActionService';
import { err, ok, okVoid, type Result } from '../../../src/shared/result';
import type { ChatInputAdapter } from '../../../src/youtube/ChatInputAdapter';
import type { EmojiPickerAdapter } from '../../../src/youtube/EmojiPickerAdapter';
import type { SendButtonAdapter } from '../../../src/youtube/SendButtonAdapter';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';
const REF = { channelId: CH_A, familyName: 'Members', emojiName: ':_wave:' };

interface Options {
  insertResult?: Result<void>;
  chunkResult?: Result<void>;
  sendEnabled?: boolean;
  sendResult?: Result<void>;
  emojiResult?: Result<void>;
  clock?: () => number;
}

const setup = (options: Options = {}) => {
  let draft = '';
  const chatInput: ChatInputAdapter = {
    findInput: vi.fn(() => document.createElement('div')),
    readDraft: () => draft,
    insertText: vi.fn((text: string) => {
      const result = options.insertResult ?? okVoid();
      if (result.ok) draft += text;
      return result;
    }),
    insertChunk: vi.fn((text: string) => {
      const result = options.chunkResult ?? okVoid();
      if (result.ok) draft += text;
      return result;
    }),
  };
  const sendButton: SendButtonAdapter = {
    findSendButton: vi.fn(() => null),
    isSendEnabled: vi.fn(() => options.sendEnabled ?? true),
    send: vi.fn(() => options.sendResult ?? okVoid()),
  };
  const emojiPicker: EmojiPickerAdapter = {
    isPickerRendered: () => true,
    isPickerOpen: () => false,
    openPicker: () => Promise.resolve(okVoid()),
    closePicker: () => Promise.resolve(),
    scanAvailableEmojis: () => ok([]),
    resolveEmoji: () => err('EMOJI_UNAVAILABLE', 'x'),
    insertEmoji: vi.fn(() => Promise.resolve(options.emojiResult ?? okVoid())),
  };
  const service = new ChatActionService(chatInput, sendButton, emojiPicker, {
    sendLockMs: 800,
    chunkDelayMs: 0,
    sleep: () => Promise.resolve(),
    ...(options.clock ? { clock: options.clock } : {}),
  });
  return { service, chatInput, sendButton, emojiPicker, draft: () => draft };
};

describe('ChatActionService.insertPreset', () => {
  it('inserts plain text without sending, as one strict insertion', async () => {
    const { service, chatInput, sendButton, draft } = setup();
    expect((await service.insertPreset('hi')).ok).toBe(true);
    expect(draft()).toBe('hi');
    expect(chatInput.insertText).toHaveBeenCalledTimes(1);
    expect(chatInput.insertChunk).not.toHaveBeenCalled();
    expect(sendButton.send).not.toHaveBeenCalled();
  });

  it('inserts an emoji preset segment-by-segment so YouTube converts each shortcode', async () => {
    const { service, chatInput } = setup();
    const result = await service.insertPreset('おつ :_wave::_heart:');
    expect(result.ok).toBe(true);
    // Text and each shortcode become separate insertChunk calls; insertText is not used.
    expect(chatInput.insertText).not.toHaveBeenCalled();
    const chunks = (chatInput.insertChunk as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(chunks).toEqual(['おつ ', ':_wave:', ':_heart:']);
  });

  it('also chunks official-stamp shortcodes (no underscore) so each one converts', async () => {
    const { service, chatInput } = setup();
    const result = await service.insertPreset('GG :hourglass-purple-sand-orange::_wave:');
    expect(result.ok).toBe(true);
    const chunks = (chatInput.insertChunk as ReturnType<typeof vi.fn>).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(chunks).toEqual(['GG ', ':hourglass-purple-sand-orange:', ':_wave:']);
  });

  it('stops and reports if a segment fails to insert', async () => {
    const { service, chatInput } = setup({ chunkResult: err('INSERT_UNCONFIRMED', 'x') });
    const result = await service.insertPreset(':_wave::_heart:');
    expect(result.ok).toBe(false);
    // Failed on the first chunk; did not continue.
    expect((chatInput.insertChunk as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });
});

describe('ChatActionService.insertAndSendPreset', () => {
  it('inserts then sends exactly once when send is enabled', async () => {
    const { service, sendButton } = setup();
    expect((await service.insertAndSendPreset('hi')).ok).toBe(true);
    expect(sendButton.send).toHaveBeenCalledTimes(1);
  });
  it('sends an emoji preset once after composing all shortcodes', async () => {
    const { service, sendButton, chatInput } = setup();
    expect((await service.insertAndSendPreset(':_wave::_heart:')).ok).toBe(true);
    expect((chatInput.insertChunk as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    expect(sendButton.send).toHaveBeenCalledTimes(1);
  });
  it('does not send when insertion fails (draft untouched by us)', async () => {
    const { service, sendButton, draft } = setup({ insertResult: err('INSERT_UNCONFIRMED', 'x') });
    const result = await service.insertAndSendPreset('hi');
    expect(result.ok).toBe(false);
    expect(sendButton.send).not.toHaveBeenCalled();
    expect(draft()).toBe('');
  });
  it('does not send when the native send is disabled, and keeps the inserted draft', async () => {
    const { service, sendButton, draft } = setup({ sendEnabled: false });
    const result = await service.insertAndSendPreset('hi');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SEND_DISABLED');
    expect(sendButton.send).not.toHaveBeenCalled();
    expect(draft()).toBe('hi');
  });
  it('reports a failed send without retrying and without clearing the draft', async () => {
    const { service, sendButton, draft } = setup({ sendResult: err('SEND_BUTTON_NOT_FOUND', 'x') });
    const result = await service.insertAndSendPreset('hi');
    expect(result.ok).toBe(false);
    expect(sendButton.send).toHaveBeenCalledTimes(1);
    expect(draft()).toBe('hi');
  });
  it('locks out a second send for 800 ms (double-activation guard), then allows again', async () => {
    let now = 1000;
    const { service, sendButton } = setup({ clock: () => now });
    expect((await service.insertAndSendPreset('a')).ok).toBe(true);
    const second = await service.insertAndSendPreset('b');
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('SEND_LOCKED');
    expect(sendButton.send).toHaveBeenCalledTimes(1);
    now += 799;
    expect((await service.insertAndSendPreset('c')).ok).toBe(false);
    now += 1;
    expect((await service.insertAndSendPreset('d')).ok).toBe(true);
    expect(sendButton.send).toHaveBeenCalledTimes(2);
  });
  it('does not start a second insertion while one is in progress', async () => {
    const { service, chatInput } = setup({ clock: () => 5 });
    const first = service.insertAndSendPreset('a');
    const second = service.insertAndSendPreset('b');
    await Promise.all([first, second]);
    // Only the first ran; the second was rejected as busy before inserting anything.
    expect(chatInput.insertText).toHaveBeenCalledTimes(1);
    expect((await second).ok).toBe(false);
  });
});

describe('ChatActionService.insertEmoji', () => {
  it('delegates to the picker adapter and never touches the send button', async () => {
    const { service, sendButton, emojiPicker } = setup();
    expect((await service.insertEmoji(REF, CH_A)).ok).toBe(true);
    expect(emojiPicker.insertEmoji).toHaveBeenCalledWith(REF);
    expect(sendButton.send).not.toHaveBeenCalled();
    expect(sendButton.isSendEnabled).not.toHaveBeenCalled();
  });
  it('rejects overlapping emoji insertions', async () => {
    let release: (() => void) | undefined;
    const pending = new Promise<Result<void>>((resolve) => {
      release = () => {
        resolve(okVoid());
      };
    });
    const { service, emojiPicker } = setup();
    (emojiPicker.insertEmoji as ReturnType<typeof vi.fn>).mockReturnValueOnce(pending);
    const first = service.insertEmoji(REF, CH_A);
    const second = await service.insertEmoji(REF, CH_A);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('BUSY');
    release?.();
    expect((await first).ok).toBe(true);
  });
  it('never resolves a favorite from another channel context', async () => {
    const { service, emojiPicker } = setup();
    const result = await service.insertEmoji(REF, 'UCbbbbbbbbbbbbbbbbbbbbbb');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('EMOJI_UNAVAILABLE');
    expect(emojiPicker.insertEmoji).not.toHaveBeenCalled();
    expect((await service.insertEmoji(REF, undefined)).ok).toBe(false);
  });
  it('surfaces unavailable emojis as errors', async () => {
    const { service } = setup({ emojiResult: err('EMOJI_UNAVAILABLE', 'x') });
    const result = await service.insertEmoji(REF, CH_A);
    expect(result.ok).toBe(false);
  });
});

describe('ChatActionService availability', () => {
  it('reflects adapter state', () => {
    const { service, chatInput } = setup({ sendEnabled: false });
    expect(service.isChatInputAvailable()).toBe(true);
    expect(service.isSendAvailable()).toBe(false);
    (chatInput.findInput as ReturnType<typeof vi.fn>).mockReturnValue(null);
    expect(service.isChatInputAvailable()).toBe(false);
  });
});
