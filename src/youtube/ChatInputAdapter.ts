import { err, okVoid, type Result } from '../shared/result';
import { isHtmlElement, queryUnique } from './query';
import { CHAT_SELECTORS } from './selectors';

export interface ChatInputAdapter {
  findInput(): HTMLElement | null;
  readDraft(): string;
  insertText(text: string): Result<void>;
}

/** Serialize editor content to plain text; inline emoji images become their alt/shortcode. */
export const serializeEditorContent = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
  if (node instanceof HTMLImageElement) return node.getAttribute('alt') ?? '';
  if (node instanceof HTMLBRElement) return '\n';
  let out = '';
  for (const child of node.childNodes) out += serializeEditorContent(child);
  return out;
};

const rangeText = (range: Range): string => serializeEditorContent(range.cloneContents());

export class DomChatInputAdapter implements ChatInputAdapter {
  constructor(private readonly root: ParentNode & Node) {}

  findInput(): HTMLElement | null {
    return queryUnique(this.root, CHAT_SELECTORS.chatInput, isHtmlElement);
  }

  readDraft(): string {
    const input = this.findInput();
    return input ? serializeEditorContent(input) : '';
  }

  /**
   * Insert text at the caret (replacing the current selection when it lies inside the editor).
   * No whitespace is added. The insertion is verified by re-reading the editor; if the
   * result differs from `before + text + after`, the caller must treat it as failed.
   */
  insertText(text: string): Result<void> {
    const input = this.findInput();
    if (!input) return err('INPUT_NOT_FOUND', 'Chat input not found.');
    const doc = input.ownerDocument;
    const selection = doc.getSelection();
    if (!selection) return err('NO_SELECTION_API', 'Selection API unavailable.');

    // Capture the caret/selection before focusing: focusing an editable element may move
    // the selection (to its start) in some engines, and the user's caret must win.
    const range = (
      this.currentRangeWithin(input, selection) ?? this.rangeAtEnd(input)
    ).cloneRange();
    input.focus();
    selection.removeAllRanges();
    selection.addRange(range);

    const beforeRange = doc.createRange();
    beforeRange.setStart(input, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    const afterRange = doc.createRange();
    afterRange.setStart(range.endContainer, range.endOffset);
    afterRange.setEnd(input, input.childNodes.length);
    const expected = rangeText(beforeRange) + text + rangeText(afterRange);
    const before = serializeEditorContent(input);

    // Preferred path: let the browser perform a *native* text insertion. YouTube's chat editor is
    // framework-managed; a hand-built DOM mutation is reverted on the next re-render, so inserted
    // text "disappears". execCommand('insertText') routes through the same path real typing uses,
    // updating YouTube's own editor model, so the text sticks. It is deprecated but has no modern
    // equivalent for framework-owned contenteditables. The result is still verified, and we fall
    // back to a manual insertion when the environment ignores execCommand (e.g. jsdom in tests).
    if (this.tryNativeInsert(doc, text)) {
      const after = serializeEditorContent(input);
      if (after === expected) return okVoid();
      // The native insert changed the editor but not as expected — do not compound it.
      if (after !== before) {
        return err('INSERT_UNCONFIRMED', 'Inserted text could not be confirmed in the editor.');
      }
      // Native insert was a no-op; fall through to the manual path below.
    }

    range.deleteContents();
    const textNode = doc.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    input.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }),
    );

    if (serializeEditorContent(input) !== expected) {
      return err('INSERT_UNCONFIRMED', 'Inserted text could not be confirmed in the editor.');
    }
    return okVoid();
  }

  /**
   * Native text insertion via execCommand; returns false when the environment ignores it.
   * execCommand is deprecated but is intentionally used here: it is the only API that inserts into
   * a framework-managed contenteditable through the real editing pipeline, so YouTube keeps the
   * text. There is no non-deprecated equivalent, so the deprecation lint is disabled for this line.
   */
  private tryNativeInsert(doc: Document, text: string): boolean {
    const runner = doc as Document & {
      execCommand?: (command: string, showUi?: boolean, value?: string) => boolean;
    };
    try {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (typeof runner.execCommand !== 'function') return false;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      return runner.execCommand('insertText', false, text);
    } catch {
      return false;
    }
  }

  private currentRangeWithin(input: HTMLElement, selection: Selection): Range | null {
    if (selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    if (!input.contains(range.startContainer) || !input.contains(range.endContainer)) return null;
    return range;
  }

  private rangeAtEnd(input: HTMLElement): Range {
    const range = input.ownerDocument.createRange();
    range.selectNodeContents(input);
    range.collapse(false);
    return range;
  }
}
