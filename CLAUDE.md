# Launchpad — Chrome Extension

A Chrome extension (Manifest V3) that replaces the new tab page with a fast, developer-focused dashboard. Features include bookmark management, with more planned.

## Principles

These apply to **all features** of this extension:

- **Visually clean, polished UI/UX** — Every surface should feel intentional and refined
- **Developer audience** — Power-user UX; favor efficiency, keyboard shortcuts, and density over hand-holding
- **FAST is priority #1** — Speed and performance come first. Don't sacrifice UX for speed, but never over-engineer UI in ways that harm speed or performance
- **Stack must support fast, performant actions** — Architectural choices should favor minimal overhead and instant responsiveness
- **Light & dark mode theming** — All features must support both themes via CSS custom properties and the `data-theme` attribute

## Tech Stack

- **Language:** TypeScript (strict mode) — no frameworks
- **Bundler:** esbuild (IIFE output, targeting Chrome 120+)
- **State:** Custom pub/sub `Store` class with granular key-based subscriptions
- **Theming:** CSS custom properties with `html[data-theme="light|dark|system"]`; early theme-init script prevents flash
- **Components:** `init*()` bootstrap pattern, custom DOM events for cross-component communication
- **Styling:** Plain CSS files with variable-driven design tokens

## Build

```
npm run build   # Production build (minified)
npm run dev     # Watch mode with sourcemaps
```
