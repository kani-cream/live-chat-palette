import { afterEach } from 'vitest';

// jsdom does not implement execCommand('insertText'); make it a no-op that returns false so the
// adapter exercises its manual insertion fallback deterministically (real browsers use the native
// path, which the Playwright E2E suite covers).
const stubExecCommand = (): void => {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  document.execCommand = () => false;
};
stubExecCommand();

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  document.documentElement.removeAttribute('dark');
  document.documentElement.removeAttribute('light');
  stubExecCommand();
});
