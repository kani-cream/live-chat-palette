import { afterEach } from 'vitest';

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
  document.documentElement.removeAttribute('dark');
  document.documentElement.removeAttribute('light');
});
