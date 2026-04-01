# Privacy Policy — Launchpad

**Last updated:** April 2026

## Summary

Launchpad does **not** collect, transmit, or share any user data. All data stays on your device.

## Data Storage

Launchpad stores the following data locally using Chrome's `chrome.storage.local` API:

- **Settings** — Theme, layout preferences, font size, and other UI configuration.
- **Session state** — Last viewed bookmark folder and expanded sidebar folders, so your view is restored on next use.
- **Bookmark metadata** — Pinned/hidden flags for individual bookmarks.
- **Tab modifier rules** — URL matching rules you create for customizing tab titles and icons.

This data never leaves your browser. It is not synced, uploaded, or shared with any server or third party.

## Network Requests

Launchpad makes **zero** network requests. There is no analytics, telemetry, crash reporting, or remote code loading of any kind.

## Permissions

| Permission | Why it's needed |
|-----------|-----------------|
| `bookmarks` | Read and organize your Chrome bookmarks |
| `favicon` | Display website icons next to bookmarks |
| `storage` | Persist your settings and preferences locally |
| `tabs` | Apply tab modifier rules (custom titles/icons) to open tabs |
| `scripting` | Inject title and icon changes into tabs matched by your rules |
| Host: `<all_urls>` | Required for tab modifier rules to match any website URL |

## Third-Party Services

None. Launchpad has no dependencies on external services.

## Contact

If you have questions about this policy, please open an issue on the project's GitHub repository.
