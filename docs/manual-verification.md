# Manual verification checklist

Almost everything is covered by automated tests (unit, DOM fixtures, and Playwright Extension E2E
against a mocked YouTube). The items below are the **only** things the automated environment cannot
reproduce, because they depend on real Google/YouTube state that cannot be created in CI:

- A signed-in YouTube account
- Real channel **membership** and the member/custom emojis it unlocks
- An actually-live stream and real comment submission
- YouTube's real, current chat DOM (fixtures approximate it; they are not a copy)

## Minimal manual test (target: ≤ 5 steps)

1. Build and load the extension:
   ```bash
   npm ci && npm run build
   ```
   Then `chrome://extensions` → Developer mode → **Load unpacked** → select `dist/`.
2. Open one **YouTube Live** stream that has chat enabled while signed in.
3. Add a preset from the palette (Presets tab → **+ Add preset**), then click it once and confirm the
   text appears in the chat box **without being sent**.
4. On a channel where you are a **member**, click **Refresh emojis**, star one member emoji, then
   click the favorite and confirm it is inserted into the chat box (and never auto-sent).
5. Post one comment manually (or with **Cmd/Ctrl + Click** on a preset) and confirm it sends exactly
   once.

## What each item confirms that CI cannot

| Manual step                           | Why it can't be automated                 |
| ------------------------------------- | ----------------------------------------- |
| Real live chat opens & palette mounts | Real YouTube DOM / live chat iframe       |
| Preset inserts without sending        | Real contenteditable + send button wiring |
| Member emoji favorite inserts         | Real membership-gated custom emojis       |
| Manual/Cmd-Click send posts once      | Real posting through YouTube's pipeline   |

If a step fails, capture your Chrome version and the chat state (member-only, slow mode, logged out)
and file an issue — selector breakage from YouTube DOM changes is expected over time.
