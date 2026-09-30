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
  { slug: 'github-light', label: 'GitHub Light' },
  { slug: 'kingdom-hearts', label: 'Kingdom Hearts' }
];


// customColors solo importa cuando slug === 'custom' (ver customtheme.js):
// los 26 temas de acá arriba viven en bloques [data-theme="..."] de
// styles.css, el custom pisa esas mismas variables con estilos inline —
// por eso hay que limpiar el inline al volver a un preset, si no la
// especificidad del inline gana y el preset nuevo no se ve.
function applyTheme(slug, customColors) {
  if (window.mdCustomTheme) window.mdCustomTheme.clearInline();
  if (slug === 'custom') {
    document.documentElement.setAttribute('data-theme', 'custom');
    if (window.mdCustomTheme) window.mdCustomTheme.applyStored(customColors);
    return;
  }
  if (slug === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', slug);
  }
}

// Elegir un tema (galería de Ajustes → Apariencia, themegallery.js, y la
// paleta de comandos): aplicar, redibujar el preview y guardar.
async function chooseTheme(slug) {
  applyTheme(slug);
  if (window.renderPreview) window.renderPreview();
  // Guiño: Lucky Emblem al elegir el tema Kingdom Hearts (luckyemblem.js).
  if (slug === 'kingdom-hearts' && window.mdLuckyEmblem) window.mdLuckyEmblem.celebrate();
  document.dispatchEvent(new CustomEvent('mk:theme-changed', { detail: { slug } }));
  await window.mdEditor.setConfig({ theme: slug });
}

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

// La galería de temas vive en Ajustes → Apariencia (themegallery.js).
function openGallery() {
  if (window.mdSettingsPanel) window.mdSettingsPanel.open('appearance');
  const g = document.getElementById('theme-gallery');
  if (g) setTimeout(() => g.scrollIntoView({ block: 'nearest' }), 50);
}

window.mdThemes = { applyTheme, chooseTheme, currentTheme, openGallery, THEME_LIST };

(async () => {
  const config = await window.mdEditor.getConfig();
  applyTheme(config.theme || 'light', config.customTheme);
})();

})();
