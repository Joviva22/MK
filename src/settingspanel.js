(function () {
'use strict';

// Panel de ⚙ Ajustes: reemplaza al desplegable largo de antes. Secciones a
// la izquierda, buscador arriba (busca en nombre, descripción y palabras
// clave de cada fila y muestra las coincidencias de todas las secciones).
// Cada control conserva su id: la lógica sigue en settings.js,
// dailynote.js, terminal.js, mailsettings.js, toolbarstyle.js, etc.

const overlay = document.getElementById('settings-overlay');
const search = document.getElementById('settings-search');
const empty = document.getElementById('settings-empty');
const navButtons = Array.from(overlay.querySelectorAll('.set-nav-btn'));
const sections = Array.from(overlay.querySelectorAll('.set-section'));
let current = 'editor';
let lastFocus = null;

function showSection(id) {
  current = id;
  navButtons.forEach((b) => {
    const on = b.dataset.section === id;
    b.classList.toggle('set-nav-active', on);
    b.setAttribute('aria-current', on ? 'page' : 'false');
  });
  sections.forEach((s) => { s.hidden = s.dataset.section !== id; });
  overlay.querySelectorAll('.set-row').forEach((r) => { r.hidden = false; });
  empty.hidden = true;
}

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function applySearch() {
  const q = normalize(search.value.trim());
  if (!q) {
    overlay.classList.remove('set-searching');
    showSection(current);
    return;
  }
  overlay.classList.add('set-searching');
  let any = false;
  sections.forEach((s) => {
    let visible = 0;
    s.querySelectorAll('.set-row').forEach((r) => {
      const hay = normalize(`${s.dataset.title} ${r.querySelector('.set-text').textContent} ${r.dataset.keywords || ''}`);
      const match = q.split(/\s+/).every((w) => hay.includes(w));
      r.hidden = !match;
      if (match) visible++;
    });
    s.hidden = visible === 0;
    if (visible) any = true;
  });
  empty.hidden = any;
}

function open(sectionId) {
  lastFocus = document.activeElement;
  overlay.hidden = false;
  search.value = '';
  overlay.classList.remove('set-searching');
  showSection(sectionId || current);
  search.focus();
}

function close() {
  overlay.hidden = true;
  if (lastFocus && lastFocus.focus) lastFocus.focus();
}

navButtons.forEach((b) => b.addEventListener('click', () => {
  search.value = '';
  overlay.classList.remove('set-searching');
  showSection(b.dataset.section);
}));
search.addEventListener('input', applySearch);
document.getElementById('settings-close').addEventListener('click', close);
document.getElementById('btn-settings').addEventListener('click', (e) => {
  e.stopPropagation();
  if (overlay.hidden) open(); else close();
});
overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
// Los links de las descripciones abren en el navegador, no en la ventana.
overlay.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a) return;
  e.preventDefault();
  window.mdEditor.openExternal(a.href);
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) {
    e.preventDefault();
    close();
  } else if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === ',') {
    e.preventDefault();
    if (overlay.hidden) open(); else close();
  }
});
// Flechas ↑/↓ en la lista de secciones.
overlay.querySelector('.set-nav').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  e.preventDefault();
  const i = navButtons.indexOf(document.activeElement);
  const next = navButtons[(i + (e.key === 'ArrowDown' ? 1 : navButtons.length - 1)) % navButtons.length];
  next.focus();
  next.click();
});

window.mdSettingsPanel = { open, close, showSection, isOpen: () => !overlay.hidden };

})();
