(function () {
'use strict';

// Lucky Emblem (guiño a Kingdom Hearts, con el tema "Kingdom Hearts"):
// - al elegir el tema aparece uno dorado en el centro, con destellos;
// - con el tema puesto hay uno chiquito escondido en la interfaz (cambia de
//   lugar cada vez que abrís MK); si lo encontrás, suma a tu cuenta
//   (config.khLuckyFound; aparte de config.kh, que es de keyblades.js).
// Es solo la silueta de tres círculos dibujada acá (SVG), sin imágenes.

const THEME = 'kingdom-hearts';
const SVG = '<svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="22" cy="26" r="17"/><circle cx="78" cy="26" r="17"/><circle cx="50" cy="60" r="31"/></svg>';
let hidden = null;
let found = 0;

function isKhTheme() {
  return document.documentElement.getAttribute('data-theme') === THEME;
}

function emblem(className) {
  const el = document.createElement('div');
  el.className = `lucky-emblem ${className}`;
  el.innerHTML = SVG;
  return el;
}

// Al elegir el tema.
function celebrate() {
  const wrap = document.createElement('div');
  wrap.className = 'lucky-celebrate';
  wrap.setAttribute('role', 'status');
  const e = emblem('lucky-big');
  const label = document.createElement('div');
  label.className = 'lucky-label';
  label.textContent = 'Kingdom Hearts';
  wrap.append(e, label);
  for (let i = 0; i < 8; i++) {
    const s = document.createElement('span');
    s.className = 'lucky-spark';
    s.textContent = '✦';
    s.style.setProperty('--a', `${i * 45}deg`);
    wrap.appendChild(s);
  }
  document.body.appendChild(wrap);
  setTimeout(() => wrap.remove(), 1900);
}

// ---- el escondido ----
const SPOTS = [
  () => document.querySelector('.statusbar'),
  () => document.getElementById('sidebar-pane'),
  () => document.querySelector('.toolbar'),
  () => document.querySelector('.preview-wrapper')
];

function removeHidden() {
  if (hidden) hidden.remove();
  hidden = null;
}

function placeHidden() {
  removeHidden();
  if (!isKhTheme()) return;
  const spot = SPOTS[Math.floor(Math.random() * SPOTS.length)]();
  if (!spot) return;
  hidden = emblem('lucky-hidden');
  hidden.setAttribute('role', 'button');
  hidden.tabIndex = -1; // no molesta al navegar con Tab: se encuentra mirando
  hidden.title = '¿Qué es esto?';
  hidden.style.setProperty('--lx', `${10 + Math.floor(Math.random() * 70)}%`);
  hidden.addEventListener('click', async (ev) => {
    ev.stopPropagation();
    found++;
    await window.mdEditor.setConfig({ khLuckyFound: found });
    document.dispatchEvent(new CustomEvent('mk:lucky-found', { detail: { found } })); // Roxas (khchars.js)
    const r = hidden.getBoundingClientRect();
    removeHidden();
    const pop = document.createElement('div');
    pop.className = 'lucky-found';
    pop.style.left = `${r.left + r.width / 2}px`;
    pop.style.top = `${r.top}px`;
    pop.textContent = `✦ ¡Lucky Emblem! (${found})`;
    document.body.appendChild(pop);
    setTimeout(() => pop.remove(), 1800);
  });
  spot.appendChild(hidden);
}

// El tema cambia por themes.js (menú, Ajustes, al iniciar): se sigue el
// atributo en vez de tocar cada lugar.
let wasKh = false;
new MutationObserver(() => {
  const now = isKhTheme();
  if (now === wasKh) return;
  wasKh = now;
  if (now) placeHidden(); else removeHidden();
}).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

(async () => {
  const config = await window.mdEditor.getConfig();
  found = config.khLuckyFound || 0;
  wasKh = isKhTheme();
  if (wasKh) placeHidden();
})();

window.mdLuckyEmblem = { celebrate, placeHidden, found: () => found, hiddenEl: () => hidden, SVG };

})();
