(function () {
'use strict';

// Galería de temas en Ajustes → Apariencia (el botón 🎨 de la barra abre
// acá): una tarjeta con la muestra de cada tema y una vista previa grande
// —barra, archivos, editor y vista— que cambia al pasar el mouse o el foco
// por una tarjeta. Clic (o Enter) la usa. Cada muestra lleva data-theme, así
// que toma los colores de ese tema de styles.css sin repetirlos acá.

const gallery = document.getElementById('theme-gallery');
if (!gallery) return;

const LUCKY = '<span class="lucky-mini" aria-hidden="true"><svg viewBox="0 0 100 100"><circle cx="22" cy="26" r="17"/><circle cx="78" cy="26" r="17"/><circle cx="50" cy="60" r="31"/></svg></span>';

const preview = document.createElement('div');
preview.className = 'tg-preview';
preview.setAttribute('aria-hidden', 'true');
preview.innerHTML = `<div class="tg-preview-bar"><span>📁 Carpeta</span><span>🏠 Home</span><span>🎨 Tema</span><b class="tg-preview-name"></b></div>
  <div class="tg-preview-body">
    <div class="tg-preview-side"><span>📁 notas</span><span class="on">📄 ideas.md</span><span>📄 diario.md</span><span>📄 tareas.md</span></div>
    <div class="tg-preview-edit"><span class="h"># Ideas</span><span>Una nota con **negrita**</span><span>- [ ] llamar a Kairi</span><span class="m">&gt; una cita</span><span>[[diario]]</span></div>
    <div class="tg-preview-view"><h4>Ideas</h4><p>Una nota con <b>negrita</b> y <code>código</code>.</p><p class="muted">Texto secundario, fechas y notas.</p><a>un enlace</a><span class="btn">Botón</span></div>
  </div>`;
const grid = document.createElement('div');
grid.className = 'tg-grid';
grid.setAttribute('role', 'group');
grid.setAttribute('aria-label', 'Temas');
gallery.append(preview, grid);

function showInPreview(slug, label) {
  if (slug === 'custom') preview.removeAttribute('data-theme');
  else preview.setAttribute('data-theme', slug);
  preview.querySelector('.tg-preview-name').textContent = label;
}

function labelOf(slug) {
  if (slug === 'custom') return 'Personalizado';
  const t = window.mdThemes.THEME_LIST.find((x) => x.slug === slug);
  return t ? t.label : slug;
}

function mark() {
  const cur = window.mdThemes.currentTheme();
  grid.querySelectorAll('.tg-card').forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.theme === cur)));
  showInPreview(cur, labelOf(cur));
}

function card(slug, label) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'tg-card' + (slug === 'custom' ? ' tg-custom' : '');
  b.dataset.theme = slug;
  const mini = document.createElement('div');
  mini.className = 'tg-mini';
  if (slug !== 'custom') mini.setAttribute('data-theme', slug);
  mini.innerHTML = '<i></i><div><b></b><s></s><s></s></div>';
  const name = document.createElement('span');
  name.className = 'tg-name';
  name.textContent = label;
  if (slug === 'kingdom-hearts') name.insertAdjacentHTML('beforeend', LUCKY);
  b.append(mini, name);
  b.addEventListener('mouseenter', () => { if (slug !== 'custom') showInPreview(slug, label); });
  b.addEventListener('focus', () => { if (slug !== 'custom') showInPreview(slug, label); });
  b.addEventListener('click', async () => {
    if (slug === 'custom') {
      if (window.mdSettingsPanel) window.mdSettingsPanel.close();
      if (window.mdCustomTheme) window.mdCustomTheme.open();
      return;
    }
    await window.mdThemes.chooseTheme(slug);
    mark();
  });
  return b;
}

window.mdThemes.THEME_LIST.forEach((t) => grid.appendChild(card(t.slug, t.label)));
grid.appendChild(card('custom', 'Personalizado…'));
grid.addEventListener('mouseleave', mark);
document.addEventListener('mk:theme-changed', mark);
// Al cargar, applyTheme ya puso el tema guardado: marcarlo.
setTimeout(mark, 300);

window.mdThemeGallery = { mark, showInPreview };

})();
