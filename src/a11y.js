(function () {
'use strict';

// Accesibilidad transversal (lectores de pantalla y teclado), para toda la
// ventana — también para lo que se crea después (MutationObserver):
//
// 1. Botones que solo muestran un símbolo (×, ‹, ◫, 🔍, un ícono...): toman
//    su "title" como nombre accesible (aria-label), si no tienen uno.
// 2. Diálogos (.modal-overlay visibles): role="dialog" + aria-modal, el foco
//    entra al abrirse, Tab/Shift+Tab no se escapan del diálogo, y al cerrarse
//    el foco vuelve a donde estaba.
// 3. Menús desplegables (.dropdown-menu): role="menu"/"menuitem",
//    aria-expanded en su botón, ↑/↓ recorren, Esc cierra y vuelve al botón.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// ---------- 1. nombres de los botones de símbolo ----------

function labelButton(b) {
  if (b.hasAttribute('aria-label')) return;
  const text = (b.textContent || '').trim();
  const hasWords = /[\p{L}\p{N}]{2,}/u.test(text);
  if (!hasWords && b.title) b.setAttribute('aria-label', b.title.split('\n')[0]);
}

function labelAll(root) {
  if (root.matches && root.matches('button, [role="button"]')) labelButton(root);
  if (root.querySelectorAll) root.querySelectorAll('button, [role="button"]').forEach(labelButton);
}

// ---------- 2. diálogos ----------

const openDialogs = []; // { overlay, returnTo }

function isVisible(el) {
  return !el.hidden && el.isConnected && getComputedStyle(el).display !== 'none';
}

function dialogBox(overlay) {
  return overlay.firstElementChild || overlay;
}

function onDialogShown(overlay) {
  if (openDialogs.some((d) => d.overlay === overlay)) return;
  const box = dialogBox(overlay);
  if (!box.hasAttribute('role')) box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  openDialogs.push({ overlay, returnTo: document.activeElement });
  // El foco entra al diálogo (si el propio diálogo no lo puso ya en un campo).
  requestAnimationFrame(() => {
    if (!overlay.contains(document.activeElement)) {
      const first = box.querySelector(FOCUSABLE);
      if (first) first.focus();
    }
  });
}

function onDialogHidden(overlay) {
  const i = openDialogs.findIndex((d) => d.overlay === overlay);
  if (i < 0) return;
  const { returnTo } = openDialogs.splice(i, 1)[0];
  if (returnTo && returnTo.isConnected && typeof returnTo.focus === 'function' && !openDialogs.length) {
    returnTo.focus();
  }
}

function scanDialogs() {
  document.querySelectorAll('.modal-overlay').forEach((o) => {
    if (isVisible(o)) onDialogShown(o); else onDialogHidden(o);
  });
  // Los que se quitaron del documento.
  openDialogs.slice().forEach((d) => { if (!d.overlay.isConnected) onDialogHidden(d.overlay); });
}

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab' || !openDialogs.length) return;
  const { overlay } = openDialogs[openDialogs.length - 1];
  const items = Array.from(dialogBox(overlay).querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (!overlay.contains(document.activeElement)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}, true);

// ---------- 3. menús desplegables ----------

function prepareMenu(menu) {
  if (menu.dataset.a11y) return;
  menu.dataset.a11y = '1';
  menu.setAttribute('role', 'menu');
  const btn = menu.parentElement && menu.parentElement.querySelector(':scope > button');
  if (btn) {
    btn.setAttribute('aria-haspopup', 'menu');
    btn.setAttribute('aria-expanded', 'false');
  }
  menu.addEventListener('keydown', (e) => {
    const items = Array.from(menu.querySelectorAll(':scope > button, :scope button[role="menuitem"]')).filter((b) => !b.disabled && b.offsetParent !== null);
    const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
    else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      menu.hidden = true;
      if (btn) btn.focus();
    }
  });
}

function syncMenu(menu) {
  prepareMenu(menu);
  menu.querySelectorAll(':scope > button').forEach((b) => b.setAttribute('role', 'menuitem'));
  const btn = menu.parentElement && menu.parentElement.querySelector(':scope > button');
  const open = !menu.hidden;
  if (btn) btn.setAttribute('aria-expanded', String(open));
  // Abierto con teclado: el foco pasa al primer elemento.
  if (open && btn && document.activeElement === btn && menu.dataset.kb === '1') {
    const first = menu.querySelector(':scope > button:not([disabled])');
    if (first) first.focus();
  }
  menu.dataset.kb = '';
}

// Enter/Espacio/↓ sobre el botón de un menú: se abre y el foco entra.
document.addEventListener('keydown', (e) => {
  if (!['Enter', ' ', 'ArrowDown'].includes(e.key)) return;
  const btn = e.target.closest && e.target.closest('[aria-haspopup="menu"]');
  if (!btn) return;
  const menu = btn.parentElement.querySelector(':scope > .dropdown-menu');
  if (!menu) return;
  menu.dataset.kb = '1';
  if (e.key === 'ArrowDown' && menu.hidden) {
    e.preventDefault();
    btn.click();
  }
}, true);

// ---------- observador ----------

let scheduled = false;
function scan() {
  scheduled = false;
  scanDialogs();
  document.querySelectorAll('.dropdown-menu').forEach(syncMenu);
}

// Lo que cambia dentro del editor o de la terminal (miles de veces por
// segundo al escribir) no es interfaz: se ignora.
const IGNORE = '.CodeMirror, .xterm';

new MutationObserver((mutations) => {
  let relevant = false;
  mutations.forEach((m) => {
    const t = m.target.nodeType === 1 ? m.target : m.target.parentElement;
    if (t && t.closest(IGNORE)) return;
    relevant = true;
    m.addedNodes.forEach((n) => { if (n.nodeType === 1) labelAll(n); });
  });
  if (relevant && !scheduled) {
    scheduled = true;
    requestAnimationFrame(scan);
    setTimeout(() => { if (scheduled) scan(); }, 120); // ventana oculta: rAF no corre
  }
}).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });

labelAll(document.body);
scan();

window.mdA11y = { labelAll, scan, openDialogs: () => openDialogs.length };

})();
