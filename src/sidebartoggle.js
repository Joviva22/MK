(function () {
'use strict';

// Ocultar/mostrar el panel de archivos, eje independiente del modo
// enfoque/lectura y del panel secundario (ver styles.css, sección
// "--gt-*") — acá se pliega solo el sidebar, el resto queda como estaba.
// Se persiste en config.json para que no vuelva a aparecer solo al
// reabrir la app.

const containerEl = document.querySelector('.container');
const toggleBtn = document.getElementById('btn-toggle-sidebar');

function applyIcon(hidden) {
  const iconEl = document.createElement('i');
  iconEl.setAttribute('data-lucide', hidden ? 'panel-left-open' : 'panel-left-close');
  toggleBtn.replaceChildren(iconEl);
  const key = window.mdShortcuts ? window.mdShortcuts.getBindings().sidebar : 'Ctrl+B';
  toggleBtn.title = `${hidden ? 'Mostrar' : 'Ocultar'} el panel de archivos (${key || 'sin atajo'})`;
  if (window.lucide) window.lucide.createIcons({ attrs: { width: 16, height: 16, 'stroke-width': 2 }, root: toggleBtn });
}

function setHidden(hidden) {
  containerEl.classList.toggle('sidebar-hidden', hidden);
  applyIcon(hidden);
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
}

async function toggle() {
  const hidden = !containerEl.classList.contains('sidebar-hidden');
  setHidden(hidden);
  await window.mdEditor.setConfig({ sidebarHidden: hidden });
}

toggleBtn.addEventListener('click', toggle);

document.addEventListener('keydown', (e) => {
  if (window.mdShortcuts) return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
    e.preventDefault();
    toggle();
  }
});

(async () => {
  const config = await window.mdEditor.getConfig();
  if (config.sidebarHidden) setHidden(true);
})();

window.mdSidebarToggle = { toggle, setHidden };

})();
