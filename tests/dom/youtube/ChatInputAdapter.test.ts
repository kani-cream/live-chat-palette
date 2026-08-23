import { describe, expect, it } from 'vitest';
import { DomChatInputAdapter, serializeEditorContent } from '../../../src/youtube/ChatInputAdapter';
import { mountLiveChat } from '../../helpers/liveChatDom';

const adapter = () => new DomChatInputAdapter(document);

describe('DomChatInputAdapter.findInput', () => {
  it('finds the single contenteditable input', () => {
    mountLiveChat();
    expect(adapter().findInput()?.getAttribute('contenteditable')).toBe('true');
  });
  it('returns null when the input is missing', () => {
    mountLiveChat({ withoutInput: true });
    expect(adapter().findInput()).toBeNull();
  });
  it('returns null when the whole input renderer is missing (logged out)', () => {
    mountLiveChat({ withoutInputRenderer: true });
    expect(adapter().findInput()).toBeNull();
  });
  it('fails closed when multiple candidate inputs exist', () => {
    mountLiveChat({ duplicateInput: true });
    expect(adapter().findInput()).toBeNull();
  });
  it('ignores unrelated DOM', () => {
    document.body.innerHTML = '<div id="input" contenteditable="true"></div><textarea></textarea>';
    expect(adapter().findInput()).toBeNull();
  });
});

describe('DomChatInputAdapter.readDraft', () => {
  it('serializes text and inline emoji images', () => {
    mountLiveChat({ initialDraft: 'hello ' });
    const input = adapter().findInput();
    const img = document.createElement('img');
    img.setAttribute('alt', ':_wave:');
    input?.append(img, document.createTextNode(' world'));
    expect(adapter().readDraft()).toBe('hello :_wave: world');
  });
  it('returns an empty string without an input', () => {
    mountLiveChat({ withoutInput: true });
    expect(adapter().readDraft()).toBe('');
  });
  it('serializes <br> as newline', () => {
    const div = document.createElement('div');
    div.append('a', document.createElement('br'), 'b');
    expect(serializeEditorContent(div)).toBe('a\nb');
  });
});

describe('DomChatInputAdapter.insertText', () => {
  it('inserts into an empty input and enables the native send button', () => {
    const harness = mountLiveChat();
    const result = adapter().insertText('Cute!');
    expect(result.ok).toBe(true);
    expect(harness.readInput()).toBe('Cute!');
    expect(document.querySelector<HTMLButtonElement>('#send-button button')?.disabled).toBe(false);
  });
  it('appends at the end when there is no caret inside the editor', () => {
    const harness = mountLiveChat({ initialDraft: 'hello' });
    document.getSelection()?.removeAllRanges();
    adapter().insertText(' world');
    expect(harness.readInput()).toBe('hello world');
  });
  it('inserts at the caret: start, middle, end', () => {
    const cases: [number, string][] = [
      [0, 'Xabc'],
      [1, 'aXbc'],
      [3, 'abcX'],
    ];
    for (const [offset, expected] of cases) {
      const harness = mountLiveChat({ initialDraft: 'abc' });
      harness.select(offset);
      expect(adapter().insertText('X').ok).toBe(true);
      expect(harness.readInput()).toBe(expected);
    }
  });
  it('replaces the current selection', () => {
    const harness = mountLiveChat({ initialDraft: 'This is great today' });
    harness.select(8, 13);
    adapter().insertText('amazing');
    expect(harness.readInput()).toBe('This is amazing today');
  });
  it('adds no automatic whitespace', () => {
    const harness = mountLiveChat({ initialDraft: 'abc' });
    harness.select(3);
    adapter().insertText('def');
    expect(harness.readInput()).toBe('abcdef');
  });
  it('preserves leading/trailing whitespace contained in the preset itself', () => {
    const harness = mountLiveChat({ initialDraft: 'a' });
    harness.select(1);
    adapter().insertText('  b  ');
    expect(harness.readInput()).toBe('a  b  ');
  });
  it('handles Japanese, emoji and newlines verbatim', () => {
    const harness = mountLiveChat();
    adapter().insertText('こんにちは🎉\nline2');
    expect(harness.readInput()).toBe('こんにちは🎉\nline2');
  });
  it('places the caret right after the inserted text for repeated composition', () => {
    const harness = mountLiveChat({ initialDraft: 'ab' });
    harness.select(1);
    adapter().insertText('X');
    adapter().insertText('Y');
    expect(harness.readInput()).toBe('aXYb');
  });
  it('ignores a selection outside the editor and appends instead', () => {
    const harness = mountLiveChat({ initialDraft: 'draft' });
    const outside = document.createElement('p');
    outside.textContent = 'outside';
    document.body.append(outside);
    const range = document.createRange();
    range.selectNodeContents(outside);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    adapter().insertText('!');
    expect(harness.readInput()).toBe('draft!');
    expect(outside.textContent).toBe('outside');
  });
  it('fails closed when the input is missing', () => {
    mountLiveChat({ withoutInput: true });
    const result = adapter().insertText('x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INPUT_NOT_FOUND');
  });
  it('reports INSERT_UNCONFIRMED when YouTube rewrites the editor unexpectedly', () => {
    const harness = mountLiveChat();
    const input = adapter().findInput();
    input?.addEventListener('input', () => {
      input.replaceChildren('something else');
    });
    const result = adapter().insertText('x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSERT_UNCONFIRMED');
    expect(harness.readInput()).toBe('something else');
  });
  it('prefers the native execCommand insertion path when the browser supports it', () => {
    const harness = mountLiveChat({ initialDraft: 'ab' });
    harness.select(1);
    let nativeCalls = 0;
    let manualInputEvents = 0;
    adapter()
      .findInput()
      ?.addEventListener('input', () => {
        manualInputEvents += 1;
      });
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand = (command: string, _showUi?: boolean, value?: string): boolean => {
      if (command !== 'insertText') return false;
      nativeCalls += 1;
      const selection = document.getSelection();
      const range = selection?.getRangeAt(0);
      if (!range) return false;
      range.deleteContents();
      range.insertNode(document.createTextNode(value ?? ''));
      range.collapse(false);
      return true;
    };
    const result = adapter().insertText('X');
    expect(result.ok).toBe(true);
    expect(nativeCalls).toBe(1);
    // The manual fallback (which dispatches its own input event) must not run.
    expect(manualInputEvents).toBe(0);
    expect(harness.readInput()).toBe('aXb');
  });

  it('falls back to manual insertion when execCommand reports success but does nothing', () => {
    const harness = mountLiveChat({ initialDraft: 'ab' });
    harness.select(1);
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    document.execCommand = () => true; // lies: returns true but leaves the editor unchanged
    const result = adapter().insertText('X');
    expect(result.ok).toBe(true);
    expect(harness.readInput()).toBe('aXb');
  });

  it('insertChunk appends at the caret and confirms only that the editor changed', () => {
    const harness = mountLiveChat({ initialDraft: 'ab' });
    harness.select(1);
    expect(adapter().insertChunk(':_wave:').ok).toBe(true);
    expect(harness.readInput()).toBe('a:_wave:b');
    // The caret is left after the inserted chunk, so the next chunk continues in place.
    expect(adapter().insertChunk(':_heart:').ok).toBe(true);
    expect(harness.readInput()).toBe('a:_wave::_heart:b');
  });
  it('insertChunk fails closed when the input is missing', () => {
    mountLiveChat({ withoutInput: true });
    const result = adapter().insertChunk('x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INPUT_NOT_FOUND');
  });
  it('insertChunk reports failure when the editor does not change', () => {
    const harness = mountLiveChat();
    const input = adapter().findInput();
    // Simulate YouTube reverting the insertion (nothing sticks).
    input?.addEventListener('input', () => {
      input.replaceChildren();
    });
    const result = adapter().insertChunk('x');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSERT_UNCONFIRMED');
    expect(harness.readInput()).toBe('');
  });
  it('dispatches an input event so YouTube can update its own state', () => {
    mountLiveChat();
    const input = adapter().findInput();
    let seen: Event | null = null;
    input?.addEventListener('input', (e) => {
      seen = e;
    });
    adapter().insertText('x');
    expect(seen).toBeInstanceOf(InputEvent);
    expect((seen as unknown as InputEvent).inputType).toBe('insertText');
  });
});
