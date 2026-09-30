(function () {
'use strict';

// Ajustes → Sistema: versión de MK, "Buscar versión nueva" y el aviso
// opcional al iniciar (config.updateCheck, apagado por defecto; una vez por
// día como mucho). Ver ipc-system.js (app:checkUpdate).

const desc = document.getElementById('app-version-desc');
const btn = document.getElementById('app-check-update');
const toggle = document.getElementById('app-update-toggle');
const RELEASES_PAGE = 'https://github.com/Joviva22/MK/releases';

function showResult(r) {
  if (!desc) return;
  if (r.error) desc.textContent = `MK ${r.current} · ${r.error}`;
  else if (r.newer) {
    desc.textContent = `MK ${r.current} · hay una versión nueva: ${r.latest} → `;
    const a = document.createElement('a');
    a.href = r.url || RELEASES_PAGE;
    a.textContent = 'ver novedades y descargar';
    a.addEventListener('click', (e) => { e.preventDefault(); window.mdEditor.openExternal(a.href); });
    desc.appendChild(a);
  } else desc.textContent = `MK ${r.current} · estás en la última versión.`;
}

async function check(manual) {
  if (btn) { btn.disabled = true; btn.textContent = 'Buscando…'; }
  const r = await window.mdEditor.checkUpdate();
  if (btn) { btn.disabled = false; btn.textContent = 'Buscar versión nueva'; }
  showResult(r);
  if (!manual && r.newer && window.mdErrorToast) {
    // Reusa el aviso de abajo a la izquierda, pero como novedad.
    window.mdErrorToast.show({ message: `Hay una versión nueva de MK: ${r.latest}`, detail: 'Ajustes → Sistema para verla.' });
  }
  return r;
}

if (btn) btn.addEventListener('click', () => check(true));
if (toggle) toggle.addEventListener('change', () => window.mdEditor.setConfig({ updateCheck: toggle.checked }));

(async () => {
  const version = await window.mdEditor.appVersion();
  if (desc) desc.textContent = `MK ${version}`;
  const config = await window.mdEditor.getConfig();
  if (toggle) toggle.checked = !!config.updateCheck;
  const today = new Date().toISOString().slice(0, 10);
  if (config.updateCheck && config.lastUpdateCheck !== today) {
    await window.mdEditor.setConfig({ lastUpdateCheck: today });
    check(false);
  }
})();

window.mdAppVersion = { check };

})();
