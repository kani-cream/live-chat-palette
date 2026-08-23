import { describe, expect, it } from 'vitest';
import {
  ack,
  contextResponse,
  contextUpdated,
  getContext,
  isExtensionMessage,
  openOptions,
} from '../../../src/messaging/messages';

const CH_A = 'UCaaaaaaaaaaaaaaaaaaaaaa';

describe('message protocol', () => {
  it('builders produce valid messages', () => {
    for (const message of [
      contextUpdated({ videoId: 'dQw4w9WgXcQ', channelId: CH_A }),
      getContext(),
      contextResponse(null),
      contextResponse({ channelId: CH_A }),
      openOptions(),
      ack(),
    ]) {
      expect(isExtensionMessage(message)).toBe(true);
    }
  });
  it('rejects unknown types and malformed payloads', () => {
    expect(isExtensionMessage({ type: 'NOPE' })).toBe(false);
    expect(isExtensionMessage({ type: 'CONTEXT_UPDATED' })).toBe(false);
    expect(isExtensionMessage({ type: 'CONTEXT_UPDATED', context: { channelId: 'bad' } })).toBe(
      false,
    );
    expect(isExtensionMessage({ type: 'CONTEXT_RESPONSE', context: 'x' })).toBe(false);
    expect(isExtensionMessage('GET_CONTEXT')).toBe(false);
    expect(isExtensionMessage(null)).toBe(false);
  });
});
