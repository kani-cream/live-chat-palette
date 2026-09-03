# Release procedure

How to ship a new version to the Chrome Web Store and record it on GitHub. The GitHub Release is
created **after** the Web Store listing is actually published, so the release always points at a
version users can install.

## 1. Prepare the release

All feature/fix PRs for the release are merged to `main` first. Then, on a release branch:

1. Bump the version (same value in all three files):
   - `manifest.json` → `"version"`
   - `package.json` → `"version"`
   - `package-lock.json` → `npm install --package-lock-only`
2. Run the full gate and build the Store artifact:
   ```bash
   npm run check     # typecheck + lint + test + build + validate + e2e
   npm run package   # dist/ -> live-chat-palette.zip (repo root)
   ```
3. Confirm the zip carries the new version:
   ```bash
   unzip -p live-chat-palette.zip manifest.json | grep '"version"'
   ```
4. Open a PR (`chore: bump version to X.Y.Z`), merge it to `main`.

Also run through [docs/manual-verification.md](./manual-verification.md) on a real live stream if
the release touches anything the automated tests cannot cover.

## 2. Publish to the Chrome Web Store

1. Open the [developer dashboard](https://chrome.google.com/webstore/devconsole) and select the
   Live Chat Palette item.
2. **Package → Upload new package** → upload `live-chat-palette.zip`.
3. Update the store listing (description, screenshots) if the UI changed.
4. **Submit for review.** Permissions/host access changes make review slower — call them out in the
   submission notes if any.
5. Wait for approval and publication (auto-publish, unless deferred publishing was chosen).

## 3. After publication: tag and GitHub Release

Only once the new version is live on the Web Store:

1. Tag the version-bump merge commit on `main` and push the tag:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z: <one-line summary>" <merge-commit>
   git push origin vX.Y.Z
   ```
2. Create the GitHub Release for that tag, attaching the **exact same zip** that was uploaded to
   the Store:
   ```bash
   gh release create vX.Y.Z live-chat-palette.zip --title "vX.Y.Z" --notes "<changelog>"
   ```
   Release notes should summarize user-facing changes and end with a compare link
   (`https://github.com/kani-cream/live-chat-palette/compare/vPREV...vX.Y.Z`).

That's it — the tag and Release exist only for versions that are actually published, and the
attached zip is byte-for-byte what the Store reviewed.
