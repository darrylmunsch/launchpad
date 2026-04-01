// ─── Launchpad Performance Test Suite ───
// Paste this entire script into the Chrome DevTools console
// on the Launchpad new tab page (which has chrome.bookmarks access).
//
// Usage:
//   await PerfTest.seed(500)       — Create 500 test bookmarks
//   await PerfTest.seed(2000)      — Create 2000 test bookmarks
//   await PerfTest.measureRender() — Time a full render cycle
//   await PerfTest.measureSearch('github') — Time search + filter + render
//   await PerfTest.measureSort()   — Time all sort modes
//   await PerfTest.runAll()        — Run the full benchmark suite
//   await PerfTest.cleanup()       — Remove all test data
//
// The test folder is named "[PerfTest]" and placed under Bookmarks Bar.

const PerfTest = (() => {
  const TEST_FOLDER_NAME = '[PerfTest]';
  let testFolderId = null;

  // ─── Realistic test data generators ───

  const DOMAINS = [
    'github.com', 'stackoverflow.com', 'developer.mozilla.org',
    'docs.google.com', 'gitlab.com', 'npmjs.com', 'crates.io',
    'reddit.com', 'news.ycombinator.com', 'medium.com',
    'dev.to', 'web.dev', 'typescript-lang.org', 'rust-lang.org',
    'python.org', 'go.dev', 'kubernetes.io', 'docker.com',
    'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com',
    'vercel.com', 'netlify.com', 'cloudflare.com', 'fastly.com',
    'figma.com', 'linear.app', 'notion.so', 'slack.com',
    'discord.com', 'twitch.tv', 'youtube.com', 'x.com',
    'wikipedia.org', 'arxiv.org', 'hn.algolia.com',
    'bundlephobia.com', 'caniuse.com', 'regex101.com',
    'jsonformatter.org', 'excalidraw.com', 'mermaid.live',
  ];

  const TITLE_PREFIXES = [
    'How to', 'Guide:', 'Tutorial:', 'Docs -', 'Reference:',
    'API:', 'Blog:', 'Release:', 'RFC:', 'Issue #',
    'PR #', 'Discussion:', 'Config:', 'Setup:', 'Debugging',
    'Performance', 'Security', 'Architecture', 'Design', 'Testing',
  ];

  const TITLE_TOPICS = [
    'authentication', 'caching', 'database migrations', 'CI/CD pipeline',
    'WebSocket connections', 'REST API design', 'GraphQL schema',
    'Docker containers', 'Kubernetes pods', 'serverless functions',
    'React hooks', 'TypeScript generics', 'CSS Grid layout',
    'browser extensions', 'service workers', 'Web Workers',
    'IndexedDB', 'WebAssembly', 'OAuth 2.0 flow', 'JWT tokens',
    'rate limiting', 'load balancing', 'monitoring', 'logging',
    'error handling', 'state management', 'routing', 'SSR',
    'code splitting', 'tree shaking', 'bundle optimization',
    'accessibility', 'i18n', 'responsive design', 'dark mode',
    'animation performance', 'virtual scrolling', 'lazy loading',
    'memory leaks', 'race conditions', 'deadlock prevention',
  ];

  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function generateBookmark(index) {
    const domain = randomFrom(DOMAINS);
    const prefix = randomFrom(TITLE_PREFIXES);
    const topic = randomFrom(TITLE_TOPICS);
    const slug = topic.replace(/\s+/g, '-').toLowerCase();
    const path = `/${slug}-${index}`;

    return {
      title: `${prefix} ${topic} (${index})`,
      url: `https://${domain}${path}`,
    };
  }

  // ─── Helpers ───

  async function findTestFolder() {
    const results = await chrome.bookmarks.search({ title: TEST_FOLDER_NAME });
    const folder = results.find(r => !r.url);
    return folder ? folder.id : null;
  }

  async function ensureTestFolder() {
    testFolderId = await findTestFolder();
    if (!testFolderId) {
      const folder = await chrome.bookmarks.create({
        parentId: '1', // Bookmarks Bar
        title: TEST_FOLDER_NAME,
      });
      testFolderId = folder.id;
    }
    return testFolderId;
  }

  function time(label, fn) {
    const start = performance.now();
    const result = fn();
    const elapsed = performance.now() - start;
    return { result, elapsed, label };
  }

  async function timeAsync(label, fn) {
    const start = performance.now();
    const result = await fn();
    const elapsed = performance.now() - start;
    return { result, elapsed, label };
  }

  function formatMs(ms) {
    return ms < 1 ? `${(ms * 1000).toFixed(0)}μs` : `${ms.toFixed(2)}ms`;
  }

  function printResult(r) {
    const color = r.elapsed < 16 ? 'green' : r.elapsed < 50 ? 'orange' : 'red';
    console.log(`%c${r.label}: ${formatMs(r.elapsed)}`, `color: ${color}; font-weight: bold`);
  }

  function printSection(title) {
    console.log(`\n%c── ${title} ──`, 'color: #7c3aed; font-weight: bold; font-size: 13px');
  }

  // ─── Core operations ───

  async function seed(count = 500) {
    printSection(`Seeding ${count} bookmarks`);

    const folderId = await ensureTestFolder();

    // Clear existing test bookmarks in the folder
    const existing = await chrome.bookmarks.getChildren(folderId);
    if (existing.length > 0) {
      console.log(`Clearing ${existing.length} existing test bookmarks...`);
      for (const child of existing) {
        if (child.url) {
          await chrome.bookmarks.remove(child.id);
        } else {
          await chrome.bookmarks.removeTree(child.id);
        }
      }
    }

    // Temporarily suppress the extension's bookmark listeners to avoid
    // reloading the tree after every single create. We'll trigger one
    // reload at the end.
    const origListeners = suppressListeners();

    const batchSize = 50;
    const batches = Math.ceil(count / batchSize);
    let created = 0;

    const totalStart = performance.now();

    for (let b = 0; b < batches; b++) {
      const promises = [];
      const end = Math.min(created + batchSize, count);
      for (let i = created; i < end; i++) {
        const bm = generateBookmark(i);
        promises.push(
          chrome.bookmarks.create({
            parentId: folderId,
            title: bm.title,
            url: bm.url,
          })
        );
      }
      await Promise.all(promises);
      created = end;

      // Progress indicator
      if (batches > 1) {
        const pct = Math.round((created / count) * 100);
        console.log(`  Created ${created}/${count} (${pct}%)`);
      }
    }

    const totalElapsed = performance.now() - totalStart;

    // Restore listeners and trigger one reload
    restoreListeners(origListeners);

    console.log(`%c✓ Seeded ${count} bookmarks in ${formatMs(totalElapsed)}`,
      'color: green; font-weight: bold');
    console.log(`  Folder: "${TEST_FOLDER_NAME}" (id: ${folderId})`);
    console.log(`  Click the folder in the sidebar to test rendering.`);

    return folderId;
  }

  // Suppress Chrome bookmark event listeners temporarily
  function suppressListeners() {
    // Store original handlers — the extension adds them via
    // chrome.bookmarks.onCreated etc. We remove all listeners temporarily.
    // Note: Chrome API doesn't expose listener lists, so we monkey-patch
    // the event objects to no-op addListener during seed.
    const events = ['onCreated', 'onRemoved', 'onChanged', 'onMoved'];
    const origDispatchers = {};

    for (const evt of events) {
      origDispatchers[evt] = chrome.bookmarks[evt].dispatch;
      // Replace dispatch with a no-op so listeners don't fire
      chrome.bookmarks[evt].dispatch = function() {};
    }

    return origDispatchers;
  }

  function restoreListeners(origDispatchers) {
    for (const [evt, dispatch] of Object.entries(origDispatchers)) {
      chrome.bookmarks[evt].dispatch = dispatch;
    }
  }

  async function cleanup() {
    printSection('Cleanup');
    const folderId = await findTestFolder();
    if (!folderId) {
      console.log('No test folder found. Nothing to clean up.');
      return;
    }
    const children = await chrome.bookmarks.getChildren(folderId);
    await chrome.bookmarks.removeTree(folderId);
    testFolderId = null;
    console.log(`%c✓ Removed test folder with ${children.length} items`, 'color: green; font-weight: bold');
  }

  async function getTestBookmarkCount() {
    const folderId = await findTestFolder();
    if (!folderId) return 0;
    const children = await chrome.bookmarks.getChildren(folderId);
    return children.filter(c => !!c.url).length;
  }

  // ─── Performance measurements ───

  async function measureRender() {
    printSection('Render Performance');
    const folderId = await findTestFolder();
    if (!folderId) {
      console.warn('No test folder. Run PerfTest.seed() first.');
      return;
    }

    const count = await getTestBookmarkCount();
    console.log(`Testing with ${count} bookmarks...`);

    // Navigate to test folder and measure the full render cycle
    const grid = document.getElementById('bookmark-grid');

    // Measure DOM render by forcing a navigation
    const nav = await timeAsync('Navigate + render', async () => {
      // Access the app's internal navigation
      const { navigateToFolder } = await getAppModule();
      navigateToFolder(folderId);

      // Wait for render to settle (the store subscription fires async)
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    printResult(nav);

    // Count DOM nodes created
    const nodeCount = grid.querySelectorAll('.bookmark-item').length;
    const subfolderCount = grid.querySelectorAll('.bookmark-subfolder').length;
    console.log(`  DOM nodes: ${nodeCount} bookmarks + ${subfolderCount} subfolders`);

    // Measure layout/paint cost
    const layout = await timeAsync('Forced layout reflow', async () => {
      // Reading offsetHeight forces layout recalculation
      void grid.offsetHeight;
      grid.style.display = 'none';
      void grid.offsetHeight;
      grid.style.display = '';
      void grid.offsetHeight;
    });
    printResult(layout);

    // Measure a re-render (simulating data change)
    const rerender = await timeAsync('Full re-render (clear + rebuild)', async () => {
      grid.textContent = '';
      const { navigateToFolder } = await getAppModule();
      navigateToFolder(folderId);
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    printResult(rerender);

    return { nav, layout, rerender, nodeCount };
  }

  async function measureSearch(query = 'github') {
    printSection(`Search Performance (query: "${query}")`);
    const folderId = await findTestFolder();
    if (!folderId) {
      console.warn('No test folder. Run PerfTest.seed() first.');
      return;
    }

    const count = await getTestBookmarkCount();
    console.log(`Searching across ${count} bookmarks...`);

    // Measure recursive fetch
    const fetch = await timeAsync('Recursive bookmark fetch', async () => {
      const children = await getAllBookmarksRecursive(folderId);
      return children;
    });
    printResult(fetch);
    console.log(`  Fetched ${fetch.result.length} bookmarks`);

    // Measure filter
    const filter = time('Filter (title + URL match)', () => {
      const q = query.toLowerCase();
      return fetch.result.filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q)
      );
    });
    printResult(filter);
    console.log(`  Matched ${filter.result.length} bookmarks`);

    // Measure the full search flow via the UI
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      const fullSearch = await timeAsync('Full search (input → render)', async () => {
        searchInput.value = query;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        // Wait for debounce (150ms) + render
        await new Promise(r => setTimeout(r, 200));
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      });
      printResult(fullSearch);

      // Count results shown
      const grid = document.getElementById('bookmark-grid');
      const shown = grid.querySelectorAll('.bookmark-item').length;
      console.log(`  Rendered ${shown} results`);

      // Clear search
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 200));
    }

    return { fetch, filter };
  }

  async function measureSort() {
    printSection('Sort Performance');
    const folderId = await findTestFolder();
    if (!folderId) {
      console.warn('No test folder. Run PerfTest.seed() first.');
      return;
    }

    // Ensure we're viewing the test folder
    const { navigateToFolder } = await getAppModule();
    navigateToFolder(folderId);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    const count = await getTestBookmarkCount();
    console.log(`Sorting ${count} bookmarks...`);

    const children = await chrome.bookmarks.getChildren(folderId);
    const bookmarks = children.filter(c => !!c.url).map(c => ({
      id: c.id, title: c.title, url: c.url,
      parentId: c.parentId || folderId, dateAdded: c.dateAdded || 0,
    }));

    const modes = ['manual', 'alpha', 'dateAdded', 'url'];
    const results = {};

    for (const mode of modes) {
      const r = time(`Sort: ${mode}`, () => {
        return sortBookmarks([...bookmarks], mode);
      });
      printResult(r);
      results[mode] = r;
    }

    return results;
  }

  async function measureScrollPerf() {
    printSection('Scroll / Paint Performance');
    const grid = document.getElementById('bookmark-grid');
    const nodeCount = grid.querySelectorAll('.bookmark-item').length;

    if (nodeCount === 0) {
      console.warn('No bookmarks rendered. Navigate to test folder first.');
      return;
    }

    console.log(`Scrolling through ${nodeCount} bookmark nodes...`);

    // Measure scroll-triggered layout/paint
    const scrollContainer = grid.closest('.main-content') || grid.parentElement;
    if (!scrollContainer) {
      console.warn('Could not find scroll container');
      return;
    }

    const frames = [];
    let frameCount = 0;
    let running = true;

    // Collect frame times during scroll
    function measureFrame(ts) {
      if (!running) return;
      frames.push(ts);
      frameCount++;
      requestAnimationFrame(measureFrame);
    }

    requestAnimationFrame(measureFrame);

    // Scroll down programmatically
    const scrollStart = performance.now();
    const totalHeight = scrollContainer.scrollHeight;
    const step = totalHeight / 20;

    for (let i = 0; i < 20; i++) {
      scrollContainer.scrollTop = step * (i + 1);
      await new Promise(r => setTimeout(r, 16)); // ~60fps pace
    }

    // Scroll back up
    for (let i = 20; i >= 0; i--) {
      scrollContainer.scrollTop = step * i;
      await new Promise(r => setTimeout(r, 16));
    }

    running = false;
    const scrollElapsed = performance.now() - scrollStart;

    // Calculate frame stats
    const intervals = [];
    for (let i = 1; i < frames.length; i++) {
      intervals.push(frames[i] - frames[i - 1]);
    }
    const avgFrame = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const maxFrame = Math.max(...intervals);
    const fps = 1000 / avgFrame;

    console.log(`  Total scroll time: ${formatMs(scrollElapsed)}`);
    console.log(`  Frames captured: ${frameCount}`);
    console.log(`  Avg frame time: ${formatMs(avgFrame)} (${fps.toFixed(1)} fps)`);
    console.log(`  Worst frame: ${formatMs(maxFrame)}`);

    const color = maxFrame < 16.67 ? 'green' : maxFrame < 33.33 ? 'orange' : 'red';
    console.log(`%c  Jank: ${maxFrame > 16.67 ? 'YES — dropped frames detected' : 'None'}`,
      `color: ${color}; font-weight: bold`);

    return { scrollElapsed, frameCount, avgFrame, maxFrame, fps };
  }

  async function measureMemory() {
    printSection('Memory Usage');

    if (!performance.memory) {
      console.warn('performance.memory not available (requires --enable-precise-memory-info flag)');
      console.log('  Launch Chrome with: --enable-precise-memory-info');
      return null;
    }

    const mem = performance.memory;
    console.log(`  JS Heap Used:  ${(mem.usedJSHeapSize / 1048576).toFixed(2)} MB`);
    console.log(`  JS Heap Total: ${(mem.totalJSHeapSize / 1048576).toFixed(2)} MB`);
    console.log(`  JS Heap Limit: ${(mem.jsHeapSizeLimit / 1048576).toFixed(2)} MB`);

    // Count DOM nodes
    const totalNodes = document.querySelectorAll('*').length;
    const bookmarkNodes = document.querySelectorAll('.bookmark-item').length;
    console.log(`  Total DOM nodes: ${totalNodes}`);
    console.log(`  Bookmark nodes:  ${bookmarkNodes}`);

    return { mem, totalNodes, bookmarkNodes };
  }

  // ─── Full benchmark suite ───

  async function runAll(count = 500) {
    console.clear();
    console.log('%c╔══════════════════════════════════════════╗', 'color: #7c3aed; font-weight: bold');
    console.log('%c║  Launchpad Performance Test Suite        ║', 'color: #7c3aed; font-weight: bold');
    console.log('%c╚══════════════════════════════════════════╝', 'color: #7c3aed; font-weight: bold');
    console.log(`  Bookmark count: ${count}`);
    console.log(`  Timestamp: ${new Date().toISOString()}`);

    // Seed
    const folderId = await seed(count);

    // Navigate to the test folder
    const { navigateToFolder } = await getAppModule();
    navigateToFolder(folderId);
    await new Promise(r => setTimeout(r, 300));

    // Run benchmarks
    const renderResults = await measureRender();
    const searchResults = await measureSearch('github');
    const sortResults = await measureSort();
    const scrollResults = await measureScrollPerf();
    const memResults = await measureMemory();

    // Summary
    printSection('SUMMARY');
    console.log(`  Bookmarks:      ${count}`);
    console.log(`  Navigate+Render: ${formatMs(renderResults?.nav?.elapsed || 0)}`);
    console.log(`  Re-render:       ${formatMs(renderResults?.rerender?.elapsed || 0)}`);
    console.log(`  Search:          ${formatMs(searchResults?.fetch?.elapsed || 0)} (fetch) + ${formatMs(searchResults?.filter?.elapsed || 0)} (filter)`);
    if (scrollResults) {
      console.log(`  Scroll FPS:      ${scrollResults.fps?.toFixed(1) || 'N/A'}`);
      console.log(`  Worst frame:     ${formatMs(scrollResults.maxFrame || 0)}`);
    }

    const verdict = (renderResults?.nav?.elapsed || 0) < 50 && (scrollResults?.maxFrame || 0) < 33
      ? '✓ PASS — Performance looks good'
      : '⚠ NEEDS ATTENTION — Some metrics exceeded thresholds';
    const verdictColor = verdict.startsWith('✓') ? 'green' : 'orange';
    console.log(`\n%c  ${verdict}`, `color: ${verdictColor}; font-weight: bold; font-size: 14px`);

    return { renderResults, searchResults, sortResults, scrollResults, memResults };
  }

  // ─── Multi-tier benchmark (test several counts) ───

  async function runTiered(counts = [100, 500, 1000, 2000]) {
    console.clear();
    console.log('%c╔══════════════════════════════════════════╗', 'color: #7c3aed; font-weight: bold');
    console.log('%c║  Tiered Performance Benchmark            ║', 'color: #7c3aed; font-weight: bold');
    console.log('%c╚══════════════════════════════════════════╝', 'color: #7c3aed; font-weight: bold');

    const results = [];

    for (const count of counts) {
      console.log(`\n%c━━━ ${count} bookmarks ━━━`, 'color: #ec4899; font-weight: bold; font-size: 14px');

      const folderId = await seed(count);
      const { navigateToFolder } = await getAppModule();
      navigateToFolder(folderId);
      await new Promise(r => setTimeout(r, 500));

      const renderResults = await measureRender();
      const sortResults = await measureSort();
      const scrollResults = await measureScrollPerf();

      results.push({
        count,
        renderMs: renderResults?.nav?.elapsed,
        rerenderMs: renderResults?.rerender?.elapsed,
        domNodes: renderResults?.nodeCount,
        scrollFps: scrollResults?.fps,
        worstFrame: scrollResults?.maxFrame,
      });
    }

    // Print comparison table
    printSection('COMPARISON TABLE');
    console.table(results.map(r => ({
      'Count': r.count,
      'Render': formatMs(r.renderMs || 0),
      'Re-render': formatMs(r.rerenderMs || 0),
      'DOM Nodes': r.domNodes,
      'Scroll FPS': r.scrollFps?.toFixed(1) || 'N/A',
      'Worst Frame': formatMs(r.worstFrame || 0),
    })));

    console.log('\n💡 If render time scales linearly, consider virtual scrolling for 1000+ bookmarks.');
    return results;
  }

  // ─── Helpers that reach into the app's modules ───

  async function getAppModule() {
    // The app exports are available on the global scope via esbuild IIFE
    // We need to trigger navigation through the store/bookmarks module.
    // Since the extension bundles as IIFE, we access the DOM and
    // dispatch events to trigger internal navigation.
    return {
      navigateToFolder: (folderId) => {
        // Use the sidebar's folder click mechanism
        const sidebarItem = document.querySelector(`[data-folder-id="${folderId}"]`);
        if (sidebarItem) {
          sidebarItem.click();
          return;
        }
        // Fallback: directly call chrome.bookmarks and trigger UI update
        // by dispatching a custom event or modifying the URL hash
        console.warn('Sidebar item not found for folder — expanding sidebar tree...');
        // Expand parent in sidebar first
        const expandBtns = document.querySelectorAll('.sidebar-folder-toggle');
        expandBtns.forEach(btn => btn.click());
        setTimeout(() => {
          const item = document.querySelector(`[data-folder-id="${folderId}"]`);
          if (item) item.click();
        }, 100);
      }
    };
  }

  // Inline sort for benchmarking (mirrors src/utils/sort.ts)
  function sortBookmarks(bookmarks, mode) {
    if (mode === 'manual') return bookmarks;
    const sorted = [...bookmarks];
    switch (mode) {
      case 'alpha':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'dateAdded':
        sorted.sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0));
        break;
      case 'url':
        sorted.sort((a, b) => {
          try {
            const hostA = new URL(a.url).hostname.replace(/^www\./, '');
            const hostB = new URL(b.url).hostname.replace(/^www\./, '');
            return hostA.localeCompare(hostB) || a.title.localeCompare(b.title);
          } catch { return 0; }
        });
        break;
    }
    return sorted;
  }

  // Recursive bookmark fetch (mirrors src/bookmarks.ts)
  async function getAllBookmarksRecursive(folderId) {
    const results = [];
    async function walk(id) {
      const children = await chrome.bookmarks.getChildren(id);
      for (const child of children) {
        if (child.url) {
          results.push({
            id: child.id, title: child.title, url: child.url,
            parentId: child.parentId || id, dateAdded: child.dateAdded || 0,
          });
        } else {
          await walk(child.id);
        }
      }
    }
    await walk(folderId);
    return results;
  }

  // ─── Public API ───
  return {
    seed,
    cleanup,
    measureRender,
    measureSearch,
    measureSort,
    measureScrollPerf,
    measureMemory,
    runAll,
    runTiered,
    getTestBookmarkCount,
  };
})();

console.log('%c✓ PerfTest loaded', 'color: green; font-weight: bold');
console.log('  Commands:');
console.log('    await PerfTest.seed(500)       — Create test bookmarks');
console.log('    await PerfTest.runAll(500)      — Full benchmark suite');
console.log('    await PerfTest.runTiered()      — Compare 100/500/1K/2K');
console.log('    await PerfTest.cleanup()        — Remove test data');
