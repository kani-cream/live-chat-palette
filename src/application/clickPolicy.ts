export type ClickAction = 'insert' | 'insert-and-send';

export interface ClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
}

/**
 * Message presets: normal click inserts only; Cmd/Ctrl+Click or the
 * `presetInstantSend` setting upgrades the click to insert-and-send.
 */
export const resolvePresetClick = (
  modifiers: ClickModifiers,
  presetInstantSend: boolean,
): ClickAction =>
  presetInstantSend || modifiers.metaKey || modifiers.ctrlKey ? 'insert-and-send' : 'insert';

/** Emojis never send immediately, regardless of modifiers or settings. */
export const resolveEmojiClick = (_modifiers: ClickModifiers): 'insert' => 'insert';
