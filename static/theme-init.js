chrome.storage.local.get('settings', (result) => {
  const s = result.settings;
  if (s && s.theme) {
    if (s.theme === 'system') {
      const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', s.theme);
    }
  }
  if (s && s.fontSize) {
    document.documentElement.style.setProperty('--font-size-base', s.fontSize + 'px');
  }
  if (s && s.widthRatio) {
    document.documentElement.style.setProperty('--content-width-ratio', s.widthRatio);
  }
});
