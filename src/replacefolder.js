(function () {
'use strict';

// Buscar y reemplazar en toda la carpeta abierta. Primero una vista previa
// (qué archivos y líneas cambian; se puede destildar archivos), después una
// confirmación. Cada archivo guarda antes su versión en el historial local
// (Historial de versiones), así que se puede deshacer por archivo. Las
// pestañas con cambios sin guardar se saltan para no pisarlas.
// La lógica: shared/replace.js; el disco: ipc-notes.js (replace:*).

const overlay = document.createElement('div');
overlay.className = 'modal-overlay replace-folder-overlay';
overlay.hidden = true;
overlay.innerHTML = `<div class="modal replace-folder" role="dialog" aria-modal="true" aria-labelledby="replace-folder-title">
  <h2 id="replace-folder-title">Reemplazar en la carpeta</h2>
  <div class="replace-folder-fields">
    <label>Buscar <input type="text" class="settings-text-input rf-find" autocomplete="off" spellcheck="false" /></label>
    <label>Reemplazar por <input type="text" class="settings-text-input rf-replace" autocomplete="off" spellcheck="false" /></label>
  </div>
  <div class="replace-folder-opts">
    <label><input type="checkbox" class="rf-case" /> Mayúsculas/minúsculas</label>
    <label><input type="checkbox" class="rf-word" /> Palabra completa</label>
    <label><input type="checkbox" class="rf-regex" /> Expresión regular <span class="rf-hint">($1, $2… en el reemplazo)</span></label>
  </div>
  <p class="rf-status" role="status"></p>
  <div class="rf-results"></div>
  <div class="modal-actions">
    <button type="button" class="toolbar-button rf-close">Cerrar</button>
    <button type="button" class="toolbar-button rf-preview">Vista previa</button>
    <button type="button" class="toolbar-button rf-apply welcome-primary" disabled>Reemplazar</button>
  </div>
</div>`;
document.body.appendChild(overlay);

const $ = (sel) => overlay.querySelector(sel);
const findEl = $('.rf-find');
const replEl = $('.rf-replace');
const statusEl = $('.rf-status');
const resultsEl = $('.rf-results');
const applyBtn = $('.rf-apply');
let preview = null; // { key, files }

function opts() {
  return { caseSensitive: $('.rf-case').checked, wholeWord: $('.rf-word').checked, regex: $('.rf-regex').checked };
}

function key() {
  return JSON.stringify([findEl.value, replEl.value, opts()]);
}

function invalidate() {
  if (preview && preview.key !== key()) {
    preview = null;
    resultsEl.innerHTML = '';
    statusEl.textContent = '';
  }
  updateApply();
}

function checkedFiles() {
  return Array.from(resultsEl.querySelectorAll('.rf-file input:checked')).map((i) => i.dataset.path);
}

function updateApply() {
  const n = preview ? checkedFiles().length : 0;
  applyBtn.disabled = !n;
  applyBtn.textContent = n ? `Reemplazar en ${n} archivo${n === 1 ? '' : 's'}` : 'Reemplazar';
}

async function runPreview() {
  const root = window.mdState.rootFolder;
  if (!root) {
    statusEl.textContent = 'Abrí una carpeta primero.';
    return null;
  }
  statusEl.textContent = 'Buscando…';
  const r = await window.mdEditor.replacePreview(root, findEl.value, replEl.value, opts());
  resultsEl.innerHTML = '';
  if (r.error) {
    statusEl.textContent = r.error;
    preview = null;
    updateApply();
    return r;
  }
  preview = { key: key(), files: r.files };
  const modified = new Set(window.mdTabs.getModifiedPaths());
  statusEl.textContent = r.files.length
    ? `${r.total} coincidencia${r.total === 1 ? '' : 's'} en ${r.files.length} archivo${r.files.length === 1 ? '' : 's'}${r.truncated ? ' (se muestran los primeros)' : ''}.`
    : 'Sin coincidencias.';
  for (const f of r.files) {
    const box = document.createElement('div');
    box.className = 'rf-file';
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.dataset.path = f.filePath;
    const unsaved = modified.has(f.filePath);
    cb.checked = !unsaved;
    cb.disabled = unsaved;
    cb.addEventListener('change', updateApply);
    const name = document.createElement('strong');
    name.textContent = f.relPath;
    const count = document.createElement('span');
    count.className = 'rf-count';
    count.textContent = unsaved ? `${f.count} · tiene cambios sin guardar: se salta` : String(f.count);
    label.append(cb, name, count);
    box.appendChild(label);
    f.samples.forEach((s) => {
      const line = document.createElement('div');
      line.className = 'rf-sample';
      const num = document.createElement('span');
      num.className = 'rf-line';
      num.textContent = `${s.line}`;
      const before = document.createElement('del');
      before.textContent = s.before;
      const after = document.createElement('ins');
      after.textContent = s.after;
      line.append(num, before, after);
      line.title = 'Abrir en esa línea';
      line.addEventListener('click', async () => {
        await window.openFileAtPath(f.filePath);
        window.mdCodeMirror.setCursor({ line: s.line - 1, ch: 0 });
        window.mdCodeMirror.scrollIntoView(null, 100);
      });
      box.appendChild(line);
    });
    resultsEl.appendChild(box);
  }
  updateApply();
  return r;
}

async function apply(skipConfirm) {
  if (!preview || preview.key !== key()) return null;
  const files = checkedFiles();
  if (!files.length) return null;
  const repl = replEl.value;
  if (!skipConfirm && !window.confirm(`¿Reemplazar «${findEl.value}» por «${repl}» en ${files.length} archivo${files.length === 1 ? '' : 's'}?\n\nCada archivo guarda antes su versión en el historial local, así que se puede volver atrás (Historial de versiones).`)) return null;
  const r = await window.mdEditor.replaceApply(window.mdState.rootFolder, findEl.value, repl, opts(), files, window.mdTabs.getModifiedPaths());
  if (r.error) {
    statusEl.textContent = r.error;
    return r;
  }
  window.mdTabs.syncPaths(r.done);
  const extra = [r.skipped.length ? `${r.skipped.length} saltado(s) por cambios sin guardar` : '', r.failed.length ? `${r.failed.length} con error` : ''].filter(Boolean).join(' · ');
  preview = null;
  resultsEl.innerHTML = '';
  statusEl.textContent = `Listo: ${r.total} reemplazo${r.total === 1 ? '' : 's'} en ${r.done.length} archivo${r.done.length === 1 ? '' : 's'}.${extra ? ` ${extra}.` : ''}`;
  updateApply();
  return r;
}

function open(initial) {
  overlay.hidden = false;
  if (typeof initial === 'string' && initial) findEl.value = initial;
  preview = null;
  resultsEl.innerHTML = '';
  statusEl.textContent = window.mdState.rootFolder ? '' : 'Abrí una carpeta primero.';
  updateApply();
  findEl.focus();
  findEl.select();
}

function close() {
  overlay.hidden = true;
}

[findEl, replEl, $('.rf-case'), $('.rf-word'), $('.rf-regex')].forEach((el) => el.addEventListener('input', invalidate));
[$('.rf-case'), $('.rf-word'), $('.rf-regex')].forEach((el) => el.addEventListener('change', invalidate));
$('.rf-preview').addEventListener('click', runPreview);
applyBtn.addEventListener('click', () => apply(false));
$('.rf-close').addEventListener('click', close);
[findEl, replEl].forEach((el) => el.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (preview && preview.key === key()) apply(false); else runPreview();
  }
}));
overlay.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.stopPropagation();
    close();
  }
});
overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

window.mdReplaceFolder = {
  open,
  close,
  runPreview,
  apply,
  setForTest: (find, repl, o) => {
    findEl.value = find;
    replEl.value = repl;
    $('.rf-case').checked = !!(o && o.caseSensitive);
    $('.rf-word').checked = !!(o && o.wholeWord);
    $('.rf-regex').checked = !!(o && o.regex);
  }
};

})();
