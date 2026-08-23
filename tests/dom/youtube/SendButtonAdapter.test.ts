import { describe, expect, it } from 'vitest';
import { DomSendButtonAdapter } from '../../../src/youtube/SendButtonAdapter';
import { mountLiveChat } from '../../helpers/liveChatDom';

const adapter = () => new DomSendButtonAdapter(document);

describe('DomSendButtonAdapter', () => {
  it('finds the native send button', () => {
    mountLiveChat();
    expect(adapter().findSendButton()?.getAttribute('aria-label')).toBe('Send');
  });
  it('returns null when the send button is missing', () => {
    mountLiveChat({ withoutSendButton: true });
    expect(adapter().findSendButton()).toBeNull();
    expect(adapter().isSendEnabled()).toBe(false);
  });
  it('fails closed when multiple send buttons exist', () => {
    mountLiveChat({ duplicateSendButton: true });
    expect(adapter().findSendButton()).toBeNull();
  });
  it('fails closed when multiple send containers exist', () => {
    mountLiveChat();
    const container = document.querySelector('#send-button');
    container?.parentElement?.append(container.cloneNode(true));
    expect(adapter().findSendButton()).toBeNull();
  });
  it('does not match look-alike buttons outside the send container', () => {
    document.body.innerHTML = '<button aria-label="Send">Send</button>';
    expect(adapter().findSendButton()).toBeNull();
  });
  it('reports disabled while the draft is empty and enabled once text exists', () => {
    const harness = mountLiveChat();
    expect(adapter().isSendEnabled()).toBe(false);
    harness.type('hello');
    expect(adapter().isSendEnabled()).toBe(true);
  });
  it('treats aria-disabled and hidden ancestors as disabled', () => {
    const harness = mountLiveChat();
    harness.type('hello');
    const button = adapter().findSendButton();
    button?.setAttribute('aria-disabled', 'true');
    expect(adapter().isSendEnabled()).toBe(false);
    button?.setAttribute('aria-disabled', 'false');
    expect(adapter().isSendEnabled()).toBe(true);
    document.querySelector('#buttons')?.setAttribute('hidden', '');
    expect(adapter().isSendEnabled()).toBe(false);
  });
  it('send() clicks once when enabled and refuses when disabled', () => {
    const harness = mountLiveChat();
    const refused = adapter().send();
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe('SEND_DISABLED');
    expect(harness.state.sendClicks).toBe(0);
    harness.type('hello');
    expect(adapter().send().ok).toBe(true);
    expect(harness.state.sendClicks).toBe(1);
    expect(harness.state.sent).toEqual(['hello']);
  });
  it('send() fails when the button is missing', () => {
    mountLiveChat({ withoutSendButton: true });
    const result = adapter().send();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('SEND_BUTTON_NOT_FOUND');
  });
});
