# Chrome Web Store Assets

## Promo Tile (440x280)

1. Open `promo-tile.html` in Chrome
2. Open DevTools (F12) > toggle Device Toolbar (Ctrl+Shift+M)
3. Set viewport to **440 x 280**
4. Take a screenshot: three-dot menu in Device Toolbar > **Capture screenshot**
5. Save as `promo-tile.png`

## Screenshots (1280x800)

1. Load the extension and navigate to the new tab page
2. Run `scripts/seed-screenshots.js` in the DevTools console to populate demo bookmarks
3. Navigate to the **Launchpad Screenshots** folder in the sidebar
4. Set your browser window to **1280x800** (use a window resizer extension or DevTools device emulation)
5. Take screenshots of:
   - Main dashboard with bookmarks (card view)
   - Compact view
   - Settings modal (Appearance tab)
   - Tab Modifier tool
   - Dark and/or light theme variants

## Privacy Policy URL

Use this URL when submitting to the Chrome Web Store:

```
https://github.com/darrylmunsch/launchpad/blob/master/PRIVACY.md
```

This renders the Markdown as a readable page directly on GitHub — no extra hosting needed.

## Cleanup

To remove the seeded bookmarks, run in DevTools console:

```js
// Find and remove the seed folder
const bar = (await chrome.bookmarks.getTree())[0].children[0];
const seed = bar.children.find(c => c.title === 'Launchpad Screenshots');
if (seed) { await chrome.bookmarks.removeTree(seed.id); console.log('Removed!'); }
```
