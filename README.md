# ScriptsAddon

A Firefox browser extension that lets you write, manage, and run custom JavaScript (userscripts) on any website — similar to Tampermonkey or Greasemonkey, but self-contained and without external dependencies.

## Features

- **Full UserScript metadata support** — `@match`, `@include`, `@exclude`, `@run-at`, `@all-frames`, `@delay`, `@grant`, `@connect`, and more
- **Tampermonkey-compatible GM APIs** — `GM_xmlhttpRequest`, `GM_setValue`, and `GM_getValue` for cross-origin requests and per-script storage
- **Tampermonkey-compatible URL matching** — wildcard patterns and regex via `@include`/`@exclude`
- **Run-at timing control** — `document-start`, `document-end`, or `document-idle`
- **Per-script enable/disable toggle** — without deleting the script
- **All-frames injection** — optionally run scripts inside iframes
- **Injection delay** — add an optional delay (ms) before a script executes
- **Live metadata preview** — the editor parses your header block in real time
- **Dark UI** — popup and editor use a clean dark theme

## Installation

### From a release (recommended)

1. Download the latest `.xpi` file from the [Releases](../../releases) page.
2. In Firefox, open `about:addons` (or `Extensions` from the menu).
3. Click the gear icon → **Install Add-on From File…**
4. Select the downloaded `.xpi` and confirm.

### From source

```bash
git clone https://github.com/lghofman/scriptsaddon.git
cd scriptsaddon
```

Then load as a temporary add-on for development (see [Development](#development)).

## Building

Requires `zip` (available on macOS/Linux; use WSL or 7-Zip on Windows).

```bash
bash build.sh
```

This produces `dist/scriptsaddon-<version>.xpi` — a signed-ready zip of the extension files.

## Development

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**
3. Select the `manifest.json` file inside this repository.
4. The extension is now active for this browser session.

To reload after code changes: click **Reload** next to the extension on `about:debugging`.

## Writing a UserScript

Click the **ScriptsAddon** toolbar button, then **+ Add Script**. The editor opens with a starter template:

```js
// ==UserScript==
// @name        My Script
// @description What this script does
// @match       https://example.com/*
// @version     1.0
// @run-at      document-idle
// ==/UserScript==

(function () {
  'use strict';
  // Your code here
})();
```

### Supported metadata fields

| Field | Description |
|---|---|
| `@name` | Display name shown in the popup |
| `@description` | Short description |
| `@version` | Version string |
| `@author` | Author name |
| `@namespace` | Namespace URL (informational) |
| `@match` | URL pattern (Tampermonkey format) — can appear multiple times |
| `@include` | Glob or `/regex/flags` pattern — can appear multiple times |
| `@exclude` | Like `@include`, but excludes matching URLs — takes priority |
| `@run-at` | `document-start`, `document-end`, or `document-idle` (default) |
| `@all-frames` | `true` to inject into iframes as well |
| `@delay` | Milliseconds to wait before executing (e.g. `500`) |
| `@grant` | GM API to expose — can appear multiple times (see [GM APIs](#gm-apis)) |
| `@connect` | Allowed host for `GM_xmlhttpRequest` — can appear multiple times |

### GM APIs

ScriptsAddon supports a subset of Tampermonkey's `@grant` APIs. Add the grants your script needs in the metadata block:

```js
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @connect      api.example.com
```

| Grant | Description |
|---|---|
| `GM_setValue` | Store a per-script value (persisted in extension storage) |
| `GM_getValue` | Read a per-script value synchronously (cached at injection time) |
| `GM_xmlhttpRequest` | Make cross-origin HTTP requests via the extension background |
| `none` | No GM APIs injected — script runs as plain JavaScript |

**`@connect`** restricts which hosts `GM_xmlhttpRequest` may call when present. Supports exact hostnames (`api.openai.com`), wildcard subdomains (`*.openai.com`), and `*`. If no `@connect` entries are listed, all hosts are allowed (the extension already has `<all_urls>` permission).

Other GM APIs (`GM_addStyle`, `GM_notification`, `unsafeWindow`, etc.) are not yet supported.

### URL pattern syntax (`@match`)

Follows the `<scheme>://<host>/<path>` format with wildcard `*`:

```
https://example.com/*          — all pages on example.com
*://example.com/*              — http and https
https://*.example.com/*        — all subdomains
<all_urls>                     — every URL
```

### Glob / regex patterns (`@include` / `@exclude`)

```
*://example.com/*              — glob wildcard
/^https:\/\/example\.com/i     — JavaScript regex (wrapped in slashes)
```

## Project Structure

```
scriptsaddon/
├── manifest.json              # Extension manifest (v2)
├── background/
│   └── background.js          # Script storage, tab monitoring, injection
├── content/
│   └── injector.js            # Content script — executes injected code
├── editor/
│   ├── editor.html
│   ├── editor.js              # Script editor with live metadata preview
│   └── editor.css
├── popup/
│   ├── popup.html
│   ├── popup.js               # Script list, toggle, delete
│   └── popup.css
├── shared/
│   ├── metadata-parser.js     # Parses UserScript header blocks
│   ├── url-matcher.js         # Tampermonkey-compatible URL matching
│   └── gm-shim.js             # GM API preamble injected before scripts
├── icons/
│   ├── icon-48.png
│   └── icon-96.png
└── build.sh                   # Packages the extension into a .xpi
```

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save and load your scripts |
| `tabs` | Detect page navigation to know when to inject |
| `activeTab` | Read the current tab's URL |
| `<all_urls>` | Inject scripts on any website you configure |

## License

MIT
