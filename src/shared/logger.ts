type Level = 'debug' | 'warn' | 'error';

const PREFIX = '[LiveChatPalette]';
const DEBUG_ENABLED = import.meta.env.DEV;

const write = (level: Level, args: unknown[]): void => {
  if (level === 'debug' && !DEBUG_ENABLED) return;
  const target =
    level === 'debug' ? console.debug : level === 'warn' ? console.warn : console.error;
  target(PREFIX, ...args);
};

export const logger = {
  debug: (...args: unknown[]): void => {
    write('debug', args);
  },
  warn: (...args: unknown[]): void => {
    write('warn', args);
  },
  error: (...args: unknown[]): void => {
    write('error', args);
  },
};
