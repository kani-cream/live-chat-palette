# Contributing to Live Chat Palette

Thanks for your interest! Issues and pull requests are welcome.

## Ground rules

Live Chat Palette is deliberately narrow in scope. Before proposing a feature, check the design
document (`plan/v1.0-design.md`) and the non-goals there. In particular, these are intentionally
out of scope and will not be accepted:

- Automatic, scheduled, or event-triggered posting of any kind.
- Emoji immediate-send shortcuts.
- Automatic retry of failed/ambiguous sends.
- Reproducing YouTube's private posting requests, or reading cookies/tokens.
- Remote/CDN-loaded code, analytics, or a backend.

The quality priority order, when trade-offs are needed, is:

1. Never cause unintended posts.
2. Never destroy the user's draft.
3. Don't break native YouTube behavior.
4. Stay practical for daily use.
5. Keep the YouTube DOM dependency maintainable.

## Development setup

Requires Node.js 24 LTS.

```bash
npm ci
npm run check   # typecheck + lint + test + build + validate + e2e
```

Please make sure `npm run check` passes before opening a PR. CI runs the same gates.

## Conventions

- **All YouTube selectors live in `src/youtube/selectors.ts`.** UI and application code must not
  reference YouTube DOM directly — this is enforced by an ESLint rule.
- Prefer small, focused, immutable modules. Domain logic stays pure and unit-tested.
- Any new adapter behavior needs DOM fixture tests; user-facing flows need a Playwright E2E test.
- Use conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`).

## Reporting issues

When reporting a DOM/breakage issue, please include your Chrome version and, if possible, the state
of the chat (member-only, slow mode, logged out, etc.). Because YouTube changes its DOM without
notice, selector breakages are expected over time and are the most valuable reports.
