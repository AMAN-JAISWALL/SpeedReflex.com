// Theme controls (header toggle, footer switch). The inline script in BaseLayout owns the actual
// resolution and exposes it as window.__srApplyTheme; this module stores the choice and keeps
// every control in sync by watching the attributes that script writes on <html>.

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'sr-theme';
const root = document.documentElement;

export const themePref = (): ThemePref => (root.dataset.themePref as ThemePref | undefined) ?? 'system';
export const isDark = (): boolean => root.dataset.theme === 'dark';

export const setThemePref = (pref: ThemePref): void => {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    /* storage blocked — the theme still applies for this page view */
  }
  // Swap every colour in one frame instead of letting 150ms button/link transitions trail behind.
  const freeze = document.createElement('style');
  freeze.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.append(freeze);
  (window as unknown as { __srApplyTheme?: (p?: ThemePref) => void }).__srApplyTheme?.(pref);
  void document.body.offsetHeight; // force a full style recalc while transitions are off
  freeze.remove();
};

export const onThemeChange = (sync: () => void): void => {
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-theme-pref'] });
  sync();
};
