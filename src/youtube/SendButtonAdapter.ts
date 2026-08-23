import { err, okVoid, type Result } from '../shared/result';
import { isButtonElement, isExplicitlyHidden, queryUnique } from './query';
import { CHAT_SELECTORS } from './selectors';

export interface SendButtonAdapter {
  findSendButton(): HTMLButtonElement | null;
  isSendEnabled(): boolean;
  /** Trigger YouTube's native send exactly once. Never retried by the adapter. */
  send(): Result<void>;
}

export class DomSendButtonAdapter implements SendButtonAdapter {
  constructor(private readonly root: ParentNode) {}

  findSendButton(): HTMLButtonElement | null {
    const containers = this.root.querySelectorAll(CHAT_SELECTORS.sendButtonContainer);
    if (containers.length !== 1) return null;
    return queryUnique(this.root, CHAT_SELECTORS.sendButton, isButtonElement);
  }

  isSendEnabled(): boolean {
    const button = this.findSendButton();
    if (!button) return false;
    if (button.disabled || button.getAttribute('aria-disabled') === 'true') return false;
    const container = button.closest(CHAT_SELECTORS.sendButtonContainer);
    if (!container || container.hasAttribute('disabled')) return false;
    if (isExplicitlyHidden(button)) return false;
    return true;
  }

  send(): Result<void> {
    const button = this.findSendButton();
    if (!button) return err('SEND_BUTTON_NOT_FOUND', 'Send button not found.');
    if (!this.isSendEnabled()) return err('SEND_DISABLED', 'Sending is currently unavailable.');
    button.click();
    return okVoid();
  }
}
