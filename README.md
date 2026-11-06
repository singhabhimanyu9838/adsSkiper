# AutoSkip

AutoSkip is a privacy-first Chromium extension that activates a recognized, visible, enabled YouTube skip-ad control. It does not block advertisements, remove ad delivery, or skip ads that have no available skip control. YouTube's player DOM is not a stable public API, so selectors may stop matching when YouTube changes its interface.

## Development

Requires Node.js 20 or newer and npm.

```sh
npm install
npm test
npm run lint
npm run build
npm run package
```

`npm run package` builds the extension and creates `artifacts/autoskip-chromium.zip`. The archive contains the loadable extension directory contents and is reproducible from the source and lockfile.

## Install for testing

1. Run `npm run build`.
2. In Chrome, open `chrome://extensions`; in Edge, open `edge://extensions`.
3. Enable Developer mode, select **Load unpacked**, and choose this project's `dist` directory.
4. Open a YouTube video and the AutoSkip toolbar popup. The same Chromium build is used for Chrome and Edge.

To test the ZIP, extract it to a new directory and load that directory as an unpacked extension. The ZIP is not signed and is not a store-ready CRX/package.

## Architecture

- `src/content/` owns selector detection, validation, player observation, and click/confirmation behavior.
- `src/shared/` normalizes local settings and statistics.
- `src/popup/` provides the per-tab status and master toggle; `src/options/` controls diagnostics and local statistics.
- `scripts/build.js` bundles browser modules into the files referenced by the MV3 manifest.
- `tests/unit/` uses Happy DOM fixtures. These tests are deterministic simulations, not live YouTube tests.

The observer watches for player insertion/replacement and watches the current player subtree for changes. Recognized controls are revalidated immediately before activation. If the same control remains visible and enabled, AutoSkip retries once after a 120 ms cooldown, then stops. A confirmation is recorded only when the player was in its `ad-showing` state before an attempt and afterward that state and the control are both gone. This is an observable heuristic, not a guarantee that the click caused the transition.

## Permissions and privacy

- `storage`: store the enable preference and optional aggregate attempt/confirmation totals using `chrome.storage.local`.
- `debugger`: briefly attach to the active YouTube tab to dispatch a mouse input at a revalidated, known skip control when a DOM click is rejected. Chromium may show a debugger warning while attached; the extension detaches immediately after the input. This permission is sensitive and can reduce store approval prospects.
- The content script match pattern limits injection to `https://www.youtube.com/*`; no separate broad host permission is requested.

AutoSkip does not access browsing history, cookies, account identifiers, authentication data, full video URLs, or remote services. Diagnostic messages are off by default. When enabled, they log local verified action events to the browser console. Statistics are on by default and can be disabled or reset in Settings. No statistics leave the device.

## Test and verification status

- Unit tests cover known and unknown selectors, visibility, disabled/stale/out-of-player controls, duplicate actions, disabled preferences, malformed settings, storage, and attempt-versus-confirmation counts.
- Player replacement, navigation, and observer cleanup are covered by DOM observer tests where supported.
- No live YouTube integration test is included. A mocked DOM cannot establish that selectors match YouTube's current production UI.
- Chrome and Edge installation and playback have not been verified in this development environment. The extension requires a Chromium browser with Manifest V3 support.

## Known limitations and troubleshooting

- YouTube can change its player markup or class names; AutoSkip then safely does nothing until selectors are updated and tested.
- A browser-generated script click may not be accepted by every player state, even after the bounded retry. The debugger fallback can also be unavailable or rejected by browser policy. AutoSkip does not modify ad delivery, seek, or force playback.
- Only `www.youtube.com` pages are matched. Embedded players, other domains, and alternate YouTube hosts are outside scope.
- If no action occurs, confirm the extension is enabled, reload the YouTube tab after installation, and check whether YouTube exposes a supported visible skip control. Enable diagnostic messages to see verified action events in the page console.
- If the popup reports no player, open or reload a YouTube video. The popup cannot message inactive or unsupported pages.

## Store readiness

Before submission:

- Review the current [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/), including [permission use](https://developer.chrome.com/docs/webstore/program-policies/permissions/) and [Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements/), and the [Microsoft Edge Add-ons developer policies](https://learn.microsoft.com/en-us/legal/microsoft-edge/extensions/developer-policies). These official pages were reviewed on 2026-10-29; recheck them at submission because requirements can change.
- Verify the final permission set, privacy disclosures, listing claims, screenshots, support contact, and developer account details against each store's current forms.
- Prepare store-sized PNG icons and screenshots from the actual extension UI; the included SVG is development artwork and should be reviewed for final brand/store requirements.
- Test the built extension in current stable Chrome and Edge, including an ordinary video, skippable and non-skippable ads when available, SPA navigation, disabled mode, and extension restart.
- Inspect the packaged ZIP, bump the version in `package.json` and `manifest.json` together, run tests/lint/build/package, and retain the exact release archive.

Store review outcomes and future selector compatibility cannot be guaranteed.
