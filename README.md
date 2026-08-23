# Live Chat Palette

A Chrome extension (Manifest V3) that adds a compact palette next to YouTube Live Chat for
inserting **reusable message presets** and **favorite custom/member emojis** with a single click.

Live Chat Palette is a **manual posting aid, not an auto-chat bot**. It never posts on its own:
every comment still originates from an explicit action of yours, and the extension uses YouTube's
own native chat input and send button rather than any private API.

> **Single purpose:** make manually participating in YouTube Live Chat faster by providing local
> message presets and favorite custom emojis.

## Features

- **Message presets** — global (all channels) and per-channel, added/edited/deleted/reordered.
- **Favorite custom emojis** — discovered from YouTube's native emoji picker, scoped per channel.
- **Safe insertion** — presets and emojis are inserted at the caret, replacing a selection when one
  exists, with **no automatic whitespace** (important for Japanese and other languages).
- **Explicit sending** — a normal click only inserts. A preset can be sent with **Cmd/Ctrl + Click**
  (or by opting into "instant send" in settings). **Emojis never send immediately.**
- **Fail closed** — if the chat input, send button, or an emoji can't be confidently identified, the
  extension stops instead of guessing, and your draft is preserved.
- **Empty & error states**, light/dark theme, Shadow-DOM isolation, keyboard-accessible controls.
- **English / Japanese UI** — follows your browser language automatically (日本語対応).
- **SPA-aware** — follows YouTube navigation between streams without breaking or double-mounting.

## Interaction summary

| Action                            | Result                    |
| --------------------------------- | ------------------------- |
| Click a preset                    | Insert only               |
| Cmd/Ctrl + Click a preset         | Insert **and** send       |
| Click / Cmd/Ctrl a favorite emoji | Insert only (never sends) |

## Installation (from source)

1. Build the extension:
   ```bash
   npm ci
   npm run build
   ```
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select the `dist/` folder.
4. Open a YouTube Live stream with chat — the palette appears above the chat input.

A packaged `live-chat-palette.zip` (for manual Chrome Web Store upload) can be produced with
`npm run package`. Publishing to the Chrome Web Store is always manual; CI never publishes.

## Development

Requires **Node.js 24 LTS**.

```bash
npm ci             # install exact dependencies
npm run build      # build the MV3 extension into dist/
npm run typecheck  # tsc, no emit (source + e2e)
npm run lint       # ESLint + Prettier check
npm run test       # Vitest: unit + DOM/integration (jsdom)
npm run test:e2e   # Playwright: real Chromium with the extension side-loaded
npm run validate   # manifest / dist / package validation
npm run package    # produce live-chat-palette.zip from dist/
npm run check      # everything above, the local pre-flight gate
```

`npm run check` runs typecheck → lint → test → build → validate → e2e. CI runs the same gates on
Node 24 for every pull request and every push to `main`.

### Architecture

YouTube DOM access is isolated behind adapters so the rest of the code never touches YouTube
selectors directly:

```
UI (Shadow DOM) → Application services → YouTube adapters → YouTube DOM
```

- `src/youtube/` — `ChatInputAdapter`, `SendButtonAdapter`, `EmojiPickerAdapter`,
  `WatchContextAdapter`, plus the single `selectors.ts` where every selector lives.
- `src/application/` — preset, emoji, settings, context and chat-action services (pure, testable).
- `src/domain/` — immutable data models and rules (presets, emoji identity, context).
- `src/storage/` — `chrome.storage.local`/`session` repositories, schema validation & migrations.
- `src/content/` — watch-frame context publisher and chat-frame palette mount lifecycle.
- `src/background/serviceWorker.ts` — stateless message router (no recoverable state in globals).
- `src/ui/`, `src/options/` — the palette and the options page.

### Testing

The most fragile part of any YouTube extension is the DOM dependency, so it is tested heavily:

- **Unit tests** (`tests/unit`) cover domain rules, services, storage, migrations, the message
  protocol and the click/send policy.
- **DOM fixture tests** (`tests/dom`) run the adapters and UI against a minimal, hand-written
  YouTube-like DOM (`tests/fixtures`) — never a copy of a real YouTube page.
- **Playwright Extension E2E** (`tests/e2e`) build the real extension, side-load it into the
  Playwright-bundled Chromium (`--load-extension`), and drive it against a mocked `www.youtube.com`
  served from the same fixtures. No Google login, YouTube account, membership, or live stream is
  required.

The mocked environment cannot reproduce real YouTube membership emojis, live posting, or slow/
member-only mode — see [docs/manual-verification.md](docs/manual-verification.md) for the short
manual checklist that covers exactly those.

## Privacy

Live Chat Palette stores your presets, favorite emojis and UI preferences **locally** in your
browser (`chrome.storage.local`), plus per-tab video/channel context in `chrome.storage.session`.

- No backend server, no analytics, no telemetry.
- No Google OAuth, no access to your Google/YouTube account, tokens or cookies.
- No collection of browsing history, comment history or message contents.
- Nothing is ever sent to any extension-owned or third-party server.

## Permissions

| Permission                                     | Why                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `storage`                                      | Save your presets, favorite emojis and preferences locally.                                                |
| Content scripts on `https://www.youtube.com/*` | Read the chat/watch DOM to place the palette and use YouTube's native input, emoji picker and send button. |

No host permissions are requested, and none of `tabs`, `history`, `cookies`, `identity`,
`webRequest`, `downloads`, `clipboardRead`/`clipboardWrite`, or `scripting` are used. The extension
contains no remote code (`eval`, `new Function`, and remote/CDN scripts are forbidden and checked by
`npm run validate`).

## License

[Apache-2.0](LICENSE).

## Contributing

Issues and pull requests are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Please run
`npm run check` before opening a PR.
