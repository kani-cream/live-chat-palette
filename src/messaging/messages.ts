import { isVideoContext, type VideoContext } from '../domain/context';

export type ExtensionMessage =
  | { type: 'CONTEXT_UPDATED'; context: VideoContext }
  | { type: 'GET_CONTEXT' }
  | { type: 'CONTEXT_RESPONSE'; context: VideoContext | null }
  | { type: 'OPEN_OPTIONS' }
  | { type: 'ACK' };

export type MessageType = ExtensionMessage['type'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isExtensionMessage = (value: unknown): value is ExtensionMessage => {
  if (!isRecord(value) || typeof value.type !== 'string') return false;
  switch (value.type) {
    case 'CONTEXT_UPDATED':
      return isVideoContext(value.context);
    case 'CONTEXT_RESPONSE':
      return value.context === null || isVideoContext(value.context);
    case 'GET_CONTEXT':
    case 'OPEN_OPTIONS':
    case 'ACK':
      return true;
    default:
      return false;
  }
};

export const contextUpdated = (context: VideoContext): ExtensionMessage => ({
  type: 'CONTEXT_UPDATED',
  context,
});

export const getContext = (): ExtensionMessage => ({ type: 'GET_CONTEXT' });

export const contextResponse = (context: VideoContext | null): ExtensionMessage => ({
  type: 'CONTEXT_RESPONSE',
  context,
});

export const openOptions = (): ExtensionMessage => ({ type: 'OPEN_OPTIONS' });

export const ack = (): ExtensionMessage => ({ type: 'ACK' });
