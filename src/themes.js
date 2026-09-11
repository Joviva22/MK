(function () {
'use strict';

// Temas de src/styles.css, todos definidos con los mismos 7 tokens
// (--bg, --surface, --surface-2, --text, --text-muted, --border, --accent),
// así que sumar un tema nuevo es solo un bloque de CSS + esta entrada.
const THEME_LIST = [
  { slug: 'light', label: 'Claro' },
  { slug: 'dark', label: 'Oscuro' },
  { slug: 'onedark', label: 'One Dark Pro' },
  { slug: 'dracula', label: 'Dracula' },
  { slug: 'monokai', label: 'Monokai' },
  { slug: 'gruvbox', label: 'Gruvbox' },
  { slug: 'solarized-dark', label: 'Solarized Dark' },
  { slug: 'solarized-light', label: 'Solarized Light' },
  { slug: 'nord', label: 'Nord' },
  { slug: 'ayu-dark', label: 'Ayu Dark' },
  { slug: 'ayu-mirage', label: 'Ayu Mirage' },
  { slug: 'ayu-light', label: 'Ayu Light' },
  { slug: 'palenight', label: 'Palenight' },
  { slug: 'cobalt2', label: 'Cobalt2' },
  { slug: 'tokyo-night', label: 'Tokyo Night' },
  { slug: 'catppuccin', label: 'Catppuccin' },
  { slug: 'night-owl', label: 'Night Owl' },
  { slug: 'shades-of-purple', label: 'Shades of Purple' },
  { slug: 'panda', label: 'Panda Theme' },
  { slug: 'winter-is-coming', label: 'Winter is Coming' },
  { slug: 'andromeda', label: 'Andromeda' },
  { slug: 'material', label: 'Material Theme' },
  { slug: 'horizon', label: 'Horizon' },
  { slug: 'rose-pine', label: 'Rosé Pine' },
  { slug: 'github-dark', label: 'GitHub Dark' },
  { slug: 'github-light', label: 'GitHub Light' }
];

const themeMenu = document.getElementById('theme-menu');

function applyTheme(slug) {
  if (slug === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', slug);
  }
}

THEME_LIST.forEach((theme) => {
  const btn = document.createElement('button');
  btn.textContent = theme.label;
  btn.dataset.theme = theme.slug;
  btn.addEventListener('click', async () => {
    themeMenu.hidden = true;
    applyTheme(theme.slug);
    if (window.renderPreview) window.renderPreview();
    await window.mdEditor.setConfig({ theme: theme.slug });
  });
  themeMenu.appendChild(btn);
});

window.initDropdown('btn-theme', 'theme-menu');

(async () => {
  const config = await window.mdEditor.getConfig();
  applyTheme(config.theme || 'light');
})();

})();
