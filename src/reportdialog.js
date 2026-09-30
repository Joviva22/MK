(function () {
'use strict';

// "Reportar un problema" (Ajustes → Sistema, paleta): muestra el informe
// (ya sin datos personales, ver problemreport.js) en un cuadro editable
// para revisarlo, y lo copia o abre un issue nuevo en GitHub con él. Nada
// se manda solo.

const ISSUES_URL = 'https://github.com/Joviva22/MK/issues/new';
const MAX_URL_BODY = 6000; // los navegadores cortan URLs muy largas

const overlay = document.createElement('div');
overlay.className = 'modal-overlay report-overlay';
overlay.hidden = true;
overlay.innerHTML = `<div class="modal report-dialog" role="dialog" aria-modal="true" aria-labelledby="report-title">
  <h2 id="report-title">Reportar un problema</h2>
  <p class="welcome-lead">Revisá el informe (podés editarlo) y contá qué pasó arriba. Tu carpeta personal, usuario y correos ya están tapados.</p>
  <label class="report-title-label">Título <input type="text" class="settings-text-input report-title-input" placeholder="Ej.: al borrar una vista de una base aparece un error" /></label>
  <textarea class="report-body" rows="16" spellcheck="false" aria-label="Informe"></textarea>
  <p class="report-status" role="status"></p>
  <div class="modal-actions">
    <button type="button" class="toolbar-button report-close">Cerrar</button>
    <button type="button" class="toolbar-button report-copy">Copiar</button>
    <button type="button" class="toolbar-button welcome-primary report-github">Abrir en GitHub…</button>
  </div>
</div>`;
document.body.appendChild(overlay);

const titleEl = overlay.querySelector('.report-title-input');
const bodyEl = overlay.querySelector('.report-body');
const statusEl = overlay.querySelector('.report-status');

async function open() {
  statusEl.textContent = '';
  bodyEl.value = 'Armando el informe…';
  overlay.hidden = false;
  bodyEl.value = await window.mdEditor.problemReport();
  titleEl.focus();
}

function close() {
  overlay.hidden = true;
}

async function copy() {
  await window.mdEditor.clipboardWriteText(`${titleEl.value ? `# ${titleEl.value}\n\n` : ''}${bodyEl.value}`);
  statusEl.textContent = 'Copiado. Pegalo donde quieras (un issue de GitHub, un mail…).';
}

function issueUrl() {
  let body = bodyEl.value;
  if (body.length > MAX_URL_BODY) body = `${body.slice(0, MAX_URL_BODY)}\n\n(recortado: el informe completo se copió al portapapeles)`;
  return `${ISSUES_URL}?title=${encodeURIComponent(titleEl.value || 'Problema en MK')}&body=${encodeURIComponent(body)}`;
}

async function openGithub() {
  if (bodyEl.value.length > MAX_URL_BODY) await copy();
  window.mdEditor.openExternal(issueUrl());
  statusEl.textContent = 'Se abrió GitHub en el navegador: revisalo y enviá desde ahí.';
}

overlay.querySelector('.report-close').addEventListener('click', close);
overlay.querySelector('.report-copy').addEventListener('click', copy);
overlay.querySelector('.report-github').addEventListener('click', openGithub);
overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    close();
  }
});
overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
const btn = document.getElementById('report-problem');
if (btn) btn.addEventListener('click', open);

window.mdReportDialog = { open, close, issueUrl, getBody: () => bodyEl.value };

})();
