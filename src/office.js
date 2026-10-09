(function () {
'use strict';
const states = new Map();
const cancelled = new Set();
const labels = { docx: 'Word', xlsx: 'Excel', pptx: 'PowerPoint' };
let active = null, panel = null, renderToken = 0, opening = false;
function toBase64(buffer) {
  const data = new Uint8Array(buffer); let text = '';
  for (let i = 0; i < data.length; i += 8192) text += String.fromCharCode(...data.subarray(i, i + 8192));
  return btoa(text);
}
function safeHtml(html) {
  const box = document.createElement('div');
  box.innerHTML = DOMPurify.sanitize(html, { FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'input', 'form', 'style'] });
  for (const font of box.querySelectorAll('font')) {
    const span = document.createElement('span');
    if (font.getAttribute('color')) span.style.color = font.getAttribute('color');
    if (font.getAttribute('face')) span.style.fontFamily = font.getAttribute('face');
    const size = ({ 1:8, 2:10, 3:12, 4:14, 5:18, 6:24, 7:36 })[font.getAttribute('size')];
    if (size) span.style.fontSize = size + 'pt';
    span.append(...font.childNodes); font.replaceWith(span);
  }
  return box.innerHTML;
}
function current(state) {
  if (state.kind === 'docx') return { html: state.html };
  if (state.kind === 'xlsx') return { ops: state.ops };
  return state.deck.snapshot();
}
function dirty(state) { return JSON.stringify(current(state)) !== state.clean; }
function serialized(state) {
  const history = state.history.join('').length < 2 * 1024 * 1024 ? state.history : [JSON.stringify(current(state))];
  return JSON.stringify({ schema: 1, compatibilityReviewed:!!state.compatibilityReviewed, kind: state.kind, source: state.source, version: state.version, history, historyIndex: history === state.history ? state.index : 0, value: current(state), clean: state.clean, filePath: state.filePath });
}
function sync(state, activateTab = false) {
  window.mdTabs.trackOffice({ key: state.key, kind: state.kind, filePath: state.filePath, content: serialized(state), modified: dirty(state) }, activateTab);
  if (active === state.key) status();
}
function commit(state, group = '') {
  const snapshot = JSON.stringify(current(state));
  if (state.history[state.index] === snapshot) return;
  state.history = state.history.slice(0, state.index + 1);
  if (group && group === state.group && Date.now() - state.lastEdit < 500 && state.index > 0) state.history[state.index] = snapshot;
  else { state.history.push(snapshot); if (state.history.length > 50) state.history.shift(); state.index = state.history.length - 1; }
  while (state.history.length > 2 && state.history.join('').length > 10 * 1024 * 1024) { state.history.shift(); state.index--; }
  state.group = group; state.lastEdit = Date.now();
  sync(state);
}
function status(message) {
  const state = states.get(active); if (!state || !panel) return;
  if (message !== undefined) state.message = message;
  const name = panel.querySelector('.office-name');
  name.textContent = state.filePath ? state.filePath.split(/[\\/]/).pop() : `${labels[state.kind]} nuevo`;
  const info = panel.querySelector('.office-status');
  info.textContent = state.saving ? 'Guardando…' : [state.message, dirty(state) ? 'Cambios sin guardar' : state.filePath ? 'Guardado' : 'Sin guardar'].filter(Boolean).join(' · ');
  document.querySelectorAll('#export-menu button').forEach(button => { button.hidden = button.id !== 'btn-export-' + state.kind; });
  panel.setAttribute('aria-busy', String(!!state.saving));
  panel.querySelector('.office-content').inert = !!state.saving;
  panel.querySelectorAll('[data-office-action]').forEach(button => { button.disabled = !!state.saving || (button.dataset.officeAction === 'undo' && state.index === 0) || (button.dataset.officeAction === 'redo' && state.index >= state.history.length - 1); });
}
function fail(error) { status(error.message); window.mdErrorToast.show({ message: 'No se pudo completar la operación de Office', detail: error.message }); }
function button(host, text, action, id) {
  const node = document.createElement('button'); node.type = 'button'; node.className = 'toolbar-button'; node.textContent = text; node.title = window.mdOfficeTools.describe(text);
  if (id) node.dataset.officeAction = id;
  node.addEventListener('click', () => Promise.resolve().then(action).catch(fail)); host.append(node); return node;
}
function input(host, label, type = 'text') {
  const wrapper = document.createElement('label'); wrapper.className = 'office-control';
  const text = document.createElement('span'); text.textContent = label;
  const field = document.createElement('input'); field.type = type; field.setAttribute('aria-label', label); wrapper.append(text, field); host.append(wrapper); return field;
}
function select(host, label, options, action) {
  const wrapper = document.createElement('label'); wrapper.className = 'office-control';
  const text = document.createElement('span'); text.textContent = label;
  const node = document.createElement('select'); node.setAttribute('aria-label', label);
  for (const [value, caption] of options) { const option = document.createElement('option'); option.value = value; option.textContent = caption; node.append(option); }
  node.addEventListener('change', () => Promise.resolve(action(node.value)).catch(fail)); wrapper.append(text, node); host.append(wrapper); return node;
}
async function wordHtml(source) {
  await window.mdLoadLib('mammoth'); await window.mdLoadLib('zip');
  const zip = await window.JSZip.loadAsync(source, { base64: true });
  let total = 0; for (const file of Object.values(zip.files)) { total += file._data?.uncompressedSize || 0; if (total > 100 * 1024 * 1024) throw new Error('El documento descomprimido supera 100 MB.'); }
  const result = await window.mdOfficeTools.task('word', { source, options:window.mdDocxImport.conversionOptions });
  const container = document.createElement('div'); container.innerHTML = safeHtml(result.value);
  const sourceXml = await zip.file('word/document.xml')?.async('string');
  const warnings = [];
  if (sourceXml) {
    const doc = new window.DOMParser().parseFromString(sourceXml, 'application/xml');
    const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    const nodes = (node, tag) => Array.from(node.getElementsByTagNameNS(ns, tag));
    const attr = (node, name = 'val') => node?.getAttributeNS(ns, name);
    const paragraphs = new Map();
    for (const paragraph of nodes(doc, 'p')) {
      const key = nodes(paragraph, 't').map(t => t.textContent).join('');
      if (!key) continue;
      if (!paragraphs.has(key)) paragraphs.set(key, []);
      paragraphs.get(key).push(paragraph);
    }
    let processed = 0;
    for (const el of container.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li')) {
      if (++processed % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0));
      if (el.querySelector('ul,ol')) continue;
      const original = paragraphs.get(el.textContent)?.shift(); if (!original) continue;
      const alignment = attr(nodes(original, 'jc')[0]);
      if (['left', 'right', 'center', 'both'].includes(alignment)) el.style.textAlign = alignment === 'both' ? 'justify' : alignment;
      if (el.querySelector('img,a') || nodes(original, 'br').length) continue;
      const runs = nodes(original, 'r');
      if (runs.map(r => nodes(r, 't').map(t => t.textContent).join('')).join('') !== el.textContent) continue;
      const fragment = document.createDocumentFragment();
      for (const run of runs) {
        const text = nodes(run, 't').map(t => t.textContent).join(''); if (!text) continue;
        let span = document.createElement('span'); span.textContent = text;
        const color = attr(nodes(run, 'color')[0]); if (/^[a-f0-9]{6}$/i.test(color || '')) span.style.color = '#' + color;
        const size = Number(attr(nodes(run, 'sz')[0])); if (size > 0 && size <= 400) span.style.fontSize = size / 2 + 'pt';
        const font = attr(nodes(run, 'rFonts')[0], 'ascii'); if (font) span.style.fontFamily = font;
        for (const [tag, html] of [['b', 'strong'], ['i', 'em'], ['u', 'u'], ['strike', 's']]) { const node = nodes(run, tag)[0]; if (node && !['0','false','none'].includes(attr(node))) { const parent = document.createElement(html); parent.append(span); span = parent; } }
        const vertical = attr(nodes(run, 'vertAlign')[0]); if (['superscript', 'subscript'].includes(vertical)) { const parent = document.createElement(vertical === 'superscript' ? 'sup' : 'sub'); parent.append(span); span = parent; }
        if (nodes(run, 'highlight').length) { const parent = document.createElement('mark'); parent.append(span); span = parent; }
        fragment.append(span);
      }
      el.replaceChildren(fragment);
    }
    if (nodes(doc, 'sectPr').length > 1 || nodes(doc, 'cols').some(n => Number(attr(n, 'num')) > 1)) warnings.push('secciones o columnas');
    if (nodes(doc, 'ins').length || nodes(doc, 'del').length) warnings.push('control de cambios');
    if (nodes(doc, 'commentRangeStart').length) warnings.push('comentarios');
    if (nodes(doc, 'oMath').length || doc.getElementsByTagName('m:oMath').length) warnings.push('ecuaciones');
    if (nodes(doc, 'drawing').some(n => !n.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/picture', 'pic').length)) warnings.push('dibujos o gráficos');
  }
  if (Object.keys(zip.files).some(path => /^word\/(header|footer)\d+\.xml$/.test(path))) warnings.push('encabezados o pies de página');
  if (zip.file('word/footnotes.xml') || zip.file('word/endnotes.xml')) warnings.push('notas al pie');
  warnings.push(...window.mdOfficeCompat.inspect('docx', Object.keys(zip.files), sourceXml || ''));
  if (result.messages?.some(message => message.type === 'warning')) warnings.push('elementos no convertidos por el importador');
  return { html: container.innerHTML || '<p><br></p>', warnings:[...new Set(warnings)] };
}
function applyExcel(state, op) {
  const workbook = state.workbook;
  if (op.type === 'addSheet') { workbook.addWorksheet(op.name); return; }
  const sheet = workbook.getWorksheet(op.sheet); if (!sheet) throw new Error('La hoja ya no existe.');
  if (op.type === 'renameSheet') sheet.name = op.name;
  else if (op.type === 'removeSheet') { if (workbook.worksheets.length <= 1) throw new Error('El libro necesita una hoja.'); workbook.removeWorksheet(sheet.id); }
  else if (op.type === 'cell') { const cell = sheet.getCell(op.address); if (cell.isMerged && cell.master.address !== cell.address) throw new Error('Edita la celda principal del rango combinado.'); cell.value = window.mdSpreadsheet.parseInput(op.text); }
  else if (op.type === 'style') { const cell = sheet.getCell(op.address); if (op.font) cell.font = { ...cell.font, ...op.font }; if (op.numFmt !== undefined) cell.numFmt = op.numFmt; if (op.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + op.fill } }; }
  else if (op.type === 'paste') { for (const [r, row] of op.rows.entries()) for (const [c, value] of row.entries()) { const cell = sheet.getCell(op.row + r, op.col + c); if (!cell.isMerged || cell.master.address === cell.address) cell.value = window.mdSpreadsheet.parseInput(value); } }
  else throw new Error('Operación de hoja no admitida.');
}
async function rebuild(state, snapshot) {
  if (state.kind === 'docx') state.html = safeHtml(snapshot.html);
  else if (state.kind === 'xlsx') {
    const loaded = await window.mdOfficeTools.task('excel', { source:state.source });
    const workbook = window.mdSpreadsheet.restoreModel(new window.ExcelJS.Workbook(), loaded.model);
    state.workbook = workbook; state.ops = [];
    for (const op of snapshot.ops || []) { applyExcel(state, op); state.ops.push(op); }
    state.errors = state.ops.length ? window.mdSpreadsheet.recalculate(workbook) : new Map(loaded.errors);
    if (!workbook.getWorksheet(state.sheet)) state.sheet = workbook.worksheets[0].id;
  } else state.deck = await window.mdPresentation.load(state.source, snapshot);
}
async function fromSource(kind, source, filePath, version, key = crypto.randomUUID(), snapshot = null, clean = null, register = true) {
  if (!labels[kind] || typeof source !== 'string' || source.length > 36 * 1024 * 1024) throw new Error('Documento de recuperación inválido.');
  const state = { key, kind, source, filePath, version, ops: [], rowPage: 0, colPage: 0, selected: 'A1', slide: 0, selectedItem: null, history: [], index: 0, message: '', warnings: [] };
  if (kind === 'docx') { const word = await wordHtml(source); state.html = word.html; state.warnings = word.warnings; }
  else if (kind === 'xlsx') {
    await window.mdLoadLib('excel'); await window.mdLoadLib('zip');
    const zip = await window.JSZip.loadAsync(source, { base64:true });
    let total = 0;
    for (const file of Object.values(zip.files)) { total += file._data?.uncompressedSize || 0; if (total > 100 * 1024 * 1024) throw new Error('El libro descomprimido supera 100 MB.'); }
    state.warnings = window.mdOfficeCompat.inspect(kind, Object.keys(zip.files));
    await rebuild(state, { ops: [] });
  }
  else {
    state.deck = await window.mdPresentation.load(source);
    const zip = await window.JSZip.loadAsync(source, { base64:true });
    const xml = (await Promise.all(Object.values(zip.files).filter(file => /^ppt\/slides\/slide\d+\.xml$/.test(file.name)).map(file => file.async('string')))).join('\n');
    state.warnings = window.mdOfficeCompat.inspect(kind, Object.keys(zip.files), xml);
  }
  state.clean = clean || JSON.stringify(current(state));
  if (snapshot) await rebuild(state, snapshot);
  state.history = [JSON.stringify(current(state))];
  if (register) states.set(key, state); return state;
}
async function checkDisk(key) {
  const state = states.get(key);
  if (!state?.filePath || state.saving || state.checkingDisk) return;
  state.checkingDisk = true;
  const version = state.version;
  try {
    const disk = await window.mdEditor.officeRead(state.filePath);
    if (states.get(key) !== state || state.saving) return;
    if (disk?.error) { state.message = 'No se pudo comprobar el archivo: ' + disk.error; if (active === key) status(); return; }
    if (!disk || disk.version === state.version) return;
    if (dirty(state)) { state.message = 'El archivo cambió fuera de MK. Usa Guardar como para conservar tus cambios.'; if (active === key) status(); return; }
    const updated = await fromSource(state.kind, disk.base64, state.filePath, disk.version, key, null, null, false);
    if (states.get(key) !== state || state.saving || state.version !== version || dirty(state)) return;
    updated.message = 'Actualizado desde el archivo'; states.set(key, updated); sync(updated);
    if (active === key) await render();
  } catch (error) { state.message = 'No se pudo actualizar el archivo: ' + error.message; if (active === key) status(); }
  finally { state.checkingDisk = false; }
}
async function open(filePath) {
  if (opening) return false;
  const existing = [...states.values()].find(state => state.filePath === filePath);
  if (existing) return activate(existing.key);
  opening = true;
  window.mdOfficeTools.progress('Leyendo archivo…');
  try {
    const kind = filePath.split('.').pop().toLowerCase(); const result = await window.mdEditor.officeRead(filePath);
    if (!result || result.error) throw new Error(result?.error || 'No se pudo leer el archivo.');
    window.mdOfficeTools.progress('Preparando el documento…');
    await new Promise(resolve => setTimeout(resolve, 0));
    const state = await fromSource(kind, result.base64, filePath, result.version); await activate(state.key); window.mdNoteAccess?.record(filePath); return true;
  } catch (error) { fail(error); return false; }
  finally { opening = false; window.mdOfficeTools.progress(null); }
}
async function create(kind, templateSource = null) {
  if (opening) return;
  opening = true;
  try {
    let source;
    if (templateSource) source = templateSource;
    else if (kind === 'docx') source = await window.mdDocxExport.buildHtmlBase64('<h1>Documento nuevo</h1><p>Escribe aquí tu documento.</p>');
    else if (kind === 'xlsx') { await window.mdLoadLib('excel'); const workbook = new window.ExcelJS.Workbook(); workbook.addWorksheet('Hoja 1'); source = toBase64(await workbook.xlsx.writeBuffer()); }
    else source = await window.mdPresentation.create();
    const state = await fromSource(kind, source, null, null); state.compatibilityReviewed = true; await activate(state.key);
  } finally { opening = false; window.mdOfficeTools.progress(null); }
}
async function restore(content, filePath, key = crypto.randomUUID()) {
  const saved = JSON.parse(content);
  if (saved.schema !== 1 || !labels[saved.kind]) throw new Error('Recuperación de Office no válida.');
  if (filePath && JSON.stringify(saved.value) === saved.clean) {
    const disk = await window.mdEditor.officeRead(filePath);
    if (disk && !disk.error && disk.version !== saved.version) {
      const state = await fromSource(saved.kind, disk.base64, filePath, disk.version, key); if (cancelled.has(key)) { states.delete(key); return null; } await activate(state.key); return state;
    }
  }
  const state = await fromSource(saved.kind, saved.source, filePath, saved.version, key, saved.value, saved.clean);
  state.compatibilityReviewed = saved.compatibilityReviewed === true;
  if (Array.isArray(saved.history) && saved.history.length && saved.history.every(item => typeof item === 'string') && saved.history.join('').length <= 2 * 1024 * 1024 && saved.history[saved.historyIndex] === JSON.stringify(current(state))) { state.history = saved.history; state.index = saved.historyIndex; }
  if (cancelled.has(key)) { states.delete(key); return null; }
  await activate(state.key); return state;
}
async function activate(key, filePath, content) {
  let state = states.get(key);
  if (!state) {
    if (content) { await restore(content, filePath, key); return; }
    await open(filePath); return;
  }
  const drawing = window.mdDrawing?.getState();
  if (drawing?.ready && !drawing.docked && !window.mdDrawing.close()) return false;
  window.mdPdfHighlight?.suspendTab();
  active = state.key;
  document.querySelector('.container').classList.add('office-active');
  sync(state, true); await render(); return true;
}
function hide() { document.querySelectorAll('#export-menu button').forEach(button => { button.hidden = ['btn-export-xlsx', 'btn-export-pptx'].includes(button.id); }); active = null; renderToken++; panel?.remove(); panel = null; document.querySelector('.container').classList.remove('office-active'); }
function forget(key) { cancelled.add(key); if (active === key) hide(); states.delete(key); }
async function save(as = false) {
  const state = states.get(active); if (!state || state.saving) return;
  const previousFocus = document.activeElement;
  state.saving = true; status();
  try {
    const choice = state.compatibilityReviewed ? 'save' : await window.mdOfficeTools.confirmSave(state.kind, state.warnings, !!state.filePath && !as);
    if (choice === 'cancel') { state.message = 'Guardado cancelado'; return; }
    if (choice === 'copy') as = true;
    const snapshot = JSON.stringify(current(state));
    const base64 = state.kind === 'docx' ? await window.mdDocxExport.buildHtmlBase64(state.html) : state.kind === 'xlsx' ? toBase64(await state.workbook.xlsx.writeBuffer()) : await state.deck.exportBase64();
    const result = await window.mdEditor.officeSave({ kind: state.kind, base64, filePath: state.filePath, expected: state.version, forceDialog: as, blockedPaths: [...states.values()].filter(s => s !== state).map(s => s.filePath).filter(Boolean) });
    if (result?.error) throw new Error(result.error);
    if (!result) { state.message = 'Guardado cancelado'; return; }
    state.compatibilityReviewed = true; state.filePath = result.path; state.version = result.version; state.clean = snapshot; state.message = 'Guardado';
    // La base de recuperación permanece estable, por lo que deshacer sigue
    // funcionando después de guardar y compara con el último estado guardado.
    sync(state, active === state.key); window.mdNotify.saved(result.path); window.mdNoteAccess?.record(result.path);
  } catch (error) { fail(error); }
  finally {
    state.saving = false; status();
    if (active === state.key && previousFocus?.isConnected && document.activeElement === document.body) previousFocus.focus();
  }
}
async function undo(delta = -1) {
  const state = states.get(active); if (!state || state.saving) return;
  const next = state.index + delta; if (next < 0 || next >= state.history.length) return;
  state.saving = true; status();
  try { await rebuild(state, JSON.parse(state.history[next])); state.index = next; state.group = ''; sync(state); await render(); }
  finally { state.saving = false; status(); }
}
function excelOp(state, op) {
  if (state.saving) return;
  applyExcel(state, op); state.ops = [...state.ops, op]; state.errors = window.mdSpreadsheet.recalculate(state.workbook); commit(state);
  if (['cell','style','paste'].includes(op.type) && state.key === active && panel?.querySelector('.office-grid')) {
    const sheet = state.workbook.getWorksheet(state.sheet);
    for (const td of panel.querySelectorAll('.office-grid td[data-address]')) {
      const cell = sheet.getCell(td.dataset.address);
      if (!td.querySelector('.office-cell-edit') || !td.contains(document.activeElement)) td.textContent = displayCell(state, sheet, cell);
      td.title = window.mdSpreadsheet.editText(cell);
      td.style.fontWeight = cell.font?.bold ? 'bold' : 'normal'; td.style.fontStyle = cell.font?.italic ? 'italic' : 'normal';
      const fill = cell.fill?.fgColor?.argb; td.style.backgroundColor = /^[a-f0-9]{8}$/i.test(fill || '') ? '#' + fill.slice(-6) : '';
    }
    const field = panel.querySelector('.office-cell-formula');
    if (field && field !== document.activeElement) field.value = window.mdSpreadsheet.editText(sheet.getCell(state.selected).master);
    state.message = state.errors.size ? `${state.errors.size} fórmula(s) pendientes o con error; Excel recalculará al abrir` : ''; status();
    return Promise.resolve();
  }
  return render();
}
async function slideOp(state, action) {
  if (state.saving) return;
  await action(); commit(state); await render();
}
function warning(state) {
  if (state.kind === 'docx') return state.warnings.length ? `Este documento contiene ${state.warnings.join(', ')}. Esos elementos no se conservarán al guardar con el editor visual; usa Guardar como para mantener el original.` : 'Editor visual de Word: texto, estilos, imágenes y tablas. La distribución exacta de páginas puede cambiar al guardar.';
  if (state.kind === 'xlsx') return state.warnings.length ? `Este libro contiene ${state.warnings.join(', ')}. Esos elementos no se editan y pueden perderse al guardar; usa Guardar como para mantener el original.` : 'Edita celdas, hojas y estilos. Fórmulas: SUM/SUMA, AVERAGE/PROMEDIO, MIN, MAX, COUNT/CONTAR, IF/SI y ROUND/REDONDEAR. Las fórmulas no admitidas se conservan para recalcular en Excel.';
  return 'Vista simplificada: edita textos e imágenes. Los gráficos, grupos, animaciones y diseños avanzados se conservan en el archivo, aunque la vista previa puede no representarlos.';
}
async function render() {
  const state = states.get(active); if (!state) return;
  const token = ++renderToken;
  await window.mdOfficeTools.ready;
  if (token !== renderToken || active !== state.key) return;
  panel?.remove(); panel = document.createElement('section'); panel.id = 'office-panel'; panel.dataset.kind = state.kind; panel.setAttribute('aria-label', `Editor de ${labels[state.kind]}`);
  const top = document.createElement('div'); top.className = 'office-toolbar';
  const name = document.createElement('strong'); name.className = 'office-name';
  const info = document.createElement('span'); info.className = 'office-status'; info.setAttribute('role', 'status'); info.setAttribute('aria-live', 'polite'); top.append(name, info);
  button(top, 'Guardar', () => save(), 'save'); button(top, 'Guardar como…', () => save(true), 'saveAs');
  if (state.kind === 'docx') button(top, 'Convertir a nota', () => window.mdTabs.newTab(window.mdDocxImport.htmlToMarkdown(state.html)));
  button(top, 'Ayuda', () => window.mdOfficeTools.help(state.kind));
  const toggle = button(top, 'Herramientas', async () => {
    const collapsed = !window.mdOfficeTools.isCollapsed(state.kind);
    await window.mdOfficeTools.setCollapsed(state.kind, collapsed);
    toggle.setAttribute('aria-expanded', String(!collapsed));
    panel.querySelector('.office-formatbar').hidden = collapsed;
  });
  toggle.setAttribute('aria-controls', 'office-format-tools');
  button(top, 'Deshacer', () => undo(-1), 'undo'); button(top, 'Rehacer', () => undo(1), 'redo');
  const find = document.createElement('input'); find.type = 'search'; find.className = 'office-search'; find.placeholder = 'Buscar en el documento…'; find.setAttribute('aria-label', 'Buscar en el documento'); find.value = state.query || ''; top.append(find);
  const count = document.createElement('span'); count.className = 'office-find-count'; count.setAttribute('role', 'status'); count.textContent = state.findInfo || ''; top.append(count);
  find.addEventListener('input', () => { state.query = find.value; state.findIndex = -1; });
  find.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); search(state, event.shiftKey ? -1 : 1).catch(fail); }
    else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); panel.querySelector('.office-word-page,.office-grid-scroll,.office-slide-list button')?.focus(); }
  });
  button(top, 'Anterior', () => search(state, -1)); button(top, 'Siguiente', () => search(state, 1));
  const note = document.createElement('p'); note.className = 'office-compatibility'; note.textContent = warning(state);
  const body = document.createElement('div'); body.className = 'office-content'; panel.append(top, note, body);
  document.querySelector('.primary-pane').append(panel);
  if (state.kind === 'docx') renderWord(state, body);
  else if (state.kind === 'xlsx') renderExcel(state, body);
  else await renderSlides(state, body, token);
  const tools = panel?.querySelector('.office-formatbar');
  if (tools && token === renderToken) { tools.id = 'office-format-tools'; tools.hidden = window.mdOfficeTools.isCollapsed(state.kind); toggle.setAttribute('aria-expanded', String(!tools.hidden)); }
  if (token === renderToken) status();
}
function renderWord(state, host) {
  const tools = document.createElement('div'); tools.className = 'office-formatbar'; host.append(tools);
  const page = document.createElement('article'); page.className = 'office-word-page'; page.contentEditable = 'true'; page.setAttribute('role', 'textbox'); page.setAttribute('aria-multiline', 'true'); page.setAttribute('aria-label', 'Contenido del documento Word'); page.spellcheck = true; page.innerHTML = state.html;
  const scroll = document.createElement('div'); scroll.className = 'office-word-scroll'; scroll.append(page); host.append(scroll);
  let selection = null, selectedImage = null, selectedTable = null;
  page.addEventListener('keyup', remember); page.addEventListener('mouseup', remember);
  function remember() { const value = window.getSelection(); if (value.rangeCount && page.contains(value.anchorNode)) selection = value.getRangeAt(0).cloneRange(); }
  function restoreSelection() { page.focus(); if (selection) { const value = window.getSelection(); value.removeAllRanges(); value.addRange(selection); } }
  function changed() { state.html = safeHtml(page.innerHTML); commit(state, 'word-input'); }
  function command(name, value) { state.group = ''; restoreSelection(); document.execCommand(name, false, value); remember(); changed(); }
  for (const [label, name] of [['Negrita','bold'],['Cursiva','italic'],['Subrayado','underline'],['Tachado','strikeThrough'],['Lista','insertUnorderedList'],['Numeración','insertOrderedList']]) { const node = button(tools, label, () => command(name)); node.addEventListener('mousedown', e => e.preventDefault()); }
  select(tools, 'Estilo', [['p','Párrafo'],['h1','Título 1'],['h2','Título 2'],['h3','Título 3'],['blockquote','Cita']], value => command('formatBlock', value));
  select(tools, 'Fuente', [['Calibri','Calibri'],['Arial','Arial'],['Georgia','Georgia'],['Consolas','Consolas']], value => command('fontName', value));
  select(tools, 'Tamaño', [['2','Pequeño'],['3','Normal'],['4','Grande'],['5','Muy grande'],['6','Título']], value => command('fontSize', value));
  const color = input(tools, 'Color', 'color'); color.value = '#234e70'; color.addEventListener('input', () => command('foreColor', color.value));
  for (const [label, name] of [['Izquierda','justifyLeft'],['Centro','justifyCenter'],['Derecha','justifyRight'],['Justificar','justifyFull']]) button(tools, label, () => command(name)).addEventListener('mousedown', e => e.preventDefault());
  button(tools, 'Tabla', async () => {
    const rows = await window.mdAsk('Filas de la tabla (1–30)', '3'); if (rows == null) return;
    const cols = await window.mdAsk('Columnas de la tabla (1–12)', '3'); if (cols == null) return;
    if (!/^\d+$/.test(rows) || !/^\d+$/.test(cols) || Number(rows) < 1 || Number(rows) > 30 || Number(cols) < 1 || Number(cols) > 12) throw new Error('Elige de 1 a 30 filas y de 1 a 12 columnas.');
    const table = document.createElement('table'); const tbody = document.createElement('tbody');
    for (let r = 0; r < Number(rows); r++) { const tr = document.createElement('tr'); for (let c = 0; c < Number(cols); c++) { const td = document.createElement(r === 0 ? 'th' : 'td'); td.textContent = r === 0 ? 'Columna ' + (c + 1) : 'Contenido'; tr.append(td); } tbody.append(tr); }
    table.append(tbody); command('insertHTML', table.outerHTML + '<p><br></p>');
  });
  button(tools, 'Imagen', async () => { const path = await window.mdEditor.pickFileReference(); if (!path) return; const ext = path.split('.').pop().toLowerCase(); if (!['png','jpg','jpeg','gif'].includes(ext)) throw new Error('Elige una imagen PNG, JPEG o GIF.'); const source = await window.mdEditor.assetReadBytes(path); if (!source || source.length > 10 * 1024 * 1024) throw new Error('Imagen demasiado grande o no legible.'); const image = document.createElement('img'); image.src = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${source}`; image.alt = path.split(/[\\/]/).pop(); image.width = 400; command('insertHTML', image.outerHTML); });
  button(tools, 'Enlace', async () => { const link = await window.mdAsk('Dirección del enlace', 'https://'); if (!link) return; if (!/^https?:\/\//i.test(link)) throw new Error('Escribe una dirección http o https.'); command('createLink', link); });
  page.addEventListener('input', changed);
  page.addEventListener('paste', event => { event.preventDefault(); const html = event.clipboardData.getData('text/html'); if (html) command('insertHTML', safeHtml(html)); else command('insertText', event.clipboardData.getData('text/plain')); });
  const imageTools = document.createElement('div'); imageTools.className = 'office-format-context'; imageTools.hidden = true; tools.append(imageTools);
  const tableTools = document.createElement('div'); tableTools.className = 'office-format-context'; tableTools.hidden = true; tools.append(tableTools);
  const imageWidth = input(imageTools, 'Ancho imagen (px)', 'number'); imageWidth.min = '30'; imageWidth.max = '500'; imageWidth.value = '400';
  imageWidth.addEventListener('change', () => { if (!selectedImage?.isConnected) { status('Selecciona primero una imagen'); return; } const width = Number(imageWidth.value); if (width < 30 || width > 500) return; selectedImage.width = width; selectedImage.style.width = width + 'px'; state.group = ''; changed(); });
  button(imageTools, 'Quitar imagen', () => { if (!selectedImage?.isConnected) { status('Selecciona primero una imagen'); return; } selectedImage.remove(); selectedImage = null; state.group = ''; changed(); });
  button(tableTools, '+ Fila', () => { if (!selectedTable?.isConnected) { status('Selecciona primero una celda de tabla'); return; } const last = selectedTable.rows[selectedTable.rows.length - 1]; const row = selectedTable.insertRow(); for (let i=0;i<Array.from(last.cells).reduce((n,c)=>n+c.colSpan,0);i++) row.insertCell().textContent = 'Contenido'; state.group = ''; changed(); });
  button(tableTools, '+ Columna', () => { if (!selectedTable?.isConnected) { status('Selecciona primero una celda de tabla'); return; } if (selectedTable.querySelector('[rowspan],[colspan]')) { status('Añade columnas en una tabla sin celdas combinadas'); return; } for (const row of selectedTable.rows) row.insertCell().textContent = 'Contenido'; state.group = ''; changed(); });
  page.addEventListener('click', event => { if (event.target.closest('a')) event.preventDefault(); selectedImage = event.target.closest('img'); if (selectedImage) imageWidth.value = selectedImage.width; selectedTable = event.target.closest('table'); imageTools.hidden = !selectedImage; tableTools.hidden = !selectedTable; });
}
function renderExcel(state, host) {
  const workbook = state.workbook, sheet = workbook.getWorksheet(state.sheet) || workbook.worksheets[0];
  state.sheet = sheet.id;
  const tools = document.createElement('div'); tools.className = 'office-formatbar'; host.append(tools);
  select(tools, 'Hoja', workbook.worksheets.map(s => [String(s.id), s.name]), value => { state.sheet = Number(value); state.rowPage = state.colPage = 0; state.selected = 'A1'; render(); }).value = String(sheet.id);
  button(tools, '+ Hoja', async () => { const name = await window.mdAsk('Nombre de la hoja', `Hoja ${workbook.worksheets.length + 1}`); if (!name) return; validateSheetName(workbook, name); await excelOp(state, { type: 'addSheet', name }); state.sheet = workbook.worksheets.at(-1).id; state.rowPage = state.colPage = 0; await render(); });
  button(tools, 'Renombrar hoja', async () => { const name = await window.mdAsk('Nombre de la hoja', sheet.name); if (!name || name === sheet.name) return; validateSheetName(workbook, name); await excelOp(state, { type: 'renameSheet', sheet: sheet.id, name }); });
  button(tools, 'Eliminar hoja', async () => { if (workbook.worksheets.length <= 1) throw new Error('El libro necesita al menos una hoja.'); if (!confirm(`¿Eliminar la hoja «${sheet.name}»? Puedes recuperarla con Deshacer.`)) return; await excelOp(state, { type: 'removeSheet', sheet: sheet.id }); });
  const selected = () => sheet.getCell(state.selected).master;
  button(tools, 'Negrita', () => excelOp(state, { type: 'style', sheet: sheet.id, address: selected().address, font: { bold: !selected().font?.bold } }));
  button(tools, 'Cursiva', () => excelOp(state, { type: 'style', sheet: sheet.id, address: selected().address, font: { italic: !selected().font?.italic } }));
  const fill = input(tools, 'Fondo', 'color'); fill.value = '#' + (selected().fill?.fgColor?.argb?.slice(-6) || 'ffffff');
  fill.addEventListener('change', () => excelOp(state, { type: 'style', sheet: sheet.id, address: selected().address, fill: fill.value.slice(1) }).catch(fail));
  select(tools, 'Formato', [['General','General'],['0','Entero'],['0.00','Decimal'],['0.00%','Porcentaje'],['#,##0.00 "€"','Euros']], value => excelOp(state, { type: 'style', sheet: sheet.id, address: selected().address, numFmt: value }));
  const bar = document.createElement('div'); bar.className = 'office-formula-bar';
  const address = input(bar, 'Celda'); address.value = state.selected; address.className = 'office-cell-address';
  const formula = input(bar, 'Valor / fórmula'); formula.value = window.mdSpreadsheet.editText(selected()); formula.className = 'office-cell-formula'; bar.append(formula.parentElement); host.append(bar);
  address.addEventListener('keydown', event => { if (event.key !== 'Enter') return; event.preventDefault(); const value = address.value.toUpperCase().replace(/\$/g, ''); if (!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(value)) { status('Escribe una referencia como B12'); return; } const cell = sheet.getCell(value); if (cell.col > 16384 || cell.row > 1048576) { status('Referencia fuera de la hoja'); return; } state.selected = value; state.rowPage = Math.floor((cell.row - 1) / 50); state.colPage = Math.floor((cell.col - 1) / 12); render(); });
  formula.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); excelOp(state, { type: 'cell', sheet: sheet.id, address: selected().address, text: formula.value }).catch(fail); } });
  const pages = document.createElement('div'); pages.className = 'office-grid-pages'; host.append(pages);
  button(pages, '← Columnas', () => { state.colPage = Math.max(0, state.colPage - 1); render(); });
  button(pages, 'Columnas →', () => { state.colPage = Math.min(1365, state.colPage + 1); render(); });
  button(pages, '↑ Filas', () => { state.rowPage = Math.max(0, state.rowPage - 1); render(); });
  button(pages, 'Filas ↓', () => { state.rowPage = Math.min(20971, state.rowPage + 1); render(); });
  const startRow = state.rowPage * 50 + 1, endRow = Math.min(startRow + 49, 1048576);
  const startCol = state.colPage * 12 + 1, endCol = Math.min(startCol + 11, 16384);
  const caption = document.createElement('span'); caption.textContent = `Filas ${startRow}–${endRow} · Columnas ${window.mdSpreadsheet.columnName(startCol)}–${window.mdSpreadsheet.columnName(endCol)} · Doble clic para editar; pega tablas con Ctrl+V`; pages.append(caption);
  const scroll = document.createElement('div'); scroll.className = 'office-grid-scroll'; scroll.tabIndex = 0; scroll.setAttribute('aria-label', 'Hoja de cálculo'); host.append(scroll);
  const table = document.createElement('table'); table.className = 'office-grid'; table.setAttribute('role', 'grid');
  const head = document.createElement('thead'), row = document.createElement('tr'); const corner = document.createElement('th'); corner.textContent = '№'; row.append(corner);
  for (let c = startCol; c <= endCol; c++) { const th = document.createElement('th'); th.scope = 'col'; th.textContent = window.mdSpreadsheet.columnName(c); row.append(th); }
  head.append(row); table.append(head); const body = document.createElement('tbody');
  const merged = [];
  for (const range of sheet.model.merges || []) { const [from, to] = range.split(':'); const a = sheet.getCell(from), b = sheet.getCell(to || from); if (a.row <= endRow && b.row >= startRow && a.col <= endCol && b.col >= startCol) merged.push({ r1:a.row, r2:b.row, c1:a.col, c2:b.col, master:a }); }
  function choose(cell, td) {
    state.selected = cell.master.address; address.value = state.selected; formula.value = window.mdSpreadsheet.editText(cell.master);
    table.querySelector('.office-cell-selected')?.classList.remove('office-cell-selected'); td.classList.add('office-cell-selected');
  }
  function edit(cell, td) {
    if (state.saving || td.querySelector('input')) return;
    choose(cell, td); const field = document.createElement('input'); field.className = 'office-cell-edit'; field.value = window.mdSpreadsheet.editText(cell.master); field.setAttribute('aria-label', 'Editar ' + cell.master.address);
    td.replaceChildren(field); field.focus(); field.select(); let done = false;
    const finish = async (cancel = false) => { if (done) return; done = true; if (!cancel && field.value !== window.mdSpreadsheet.editText(cell.master)) await excelOp(state, { type:'cell', sheet:sheet.id, address:cell.master.address, text:field.value }); else if (td.isConnected) td.textContent = displayCell(state, sheet, cell.master); if (td.isConnected && td.contains(field)) { td.textContent = displayCell(state, sheet, cell.master); td.focus(); } };
    field.addEventListener('blur', () => finish().catch(fail));
    field.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); finish(true).catch(fail); } else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); finish().catch(fail); } });
  }
  for (let r = startRow; r <= endRow; r++) {
    const tr = document.createElement('tr'); const label = document.createElement('th'); label.scope = 'row'; label.textContent = r; tr.append(label);
    for (let c = startCol; c <= endCol; c++) {
      const merge = merged.find(m => r >= m.r1 && r <= m.r2 && c >= m.c1 && c <= m.c2);
      if (merge && (r !== Math.max(merge.r1, startRow) || c !== Math.max(merge.c1, startCol))) continue;
      const cell = merge?.master || sheet.getCell(r, c); const td = document.createElement('td'); td.dataset.address = cell.address; td.tabIndex = cell.address === state.selected ? 0 : -1;
      if (merge) { td.rowSpan = Math.min(merge.r2, endRow) - Math.max(merge.r1, startRow) + 1; td.colSpan = Math.min(merge.c2, endCol) - Math.max(merge.c1, startCol) + 1; }
      td.textContent = displayCell(state, sheet, cell); td.title = window.mdSpreadsheet.editText(cell);
      const argb = cell.font?.color?.argb; if (/^[a-f0-9]{8}$/i.test(argb || '')) td.style.color = '#' + argb.slice(-6);
      const fill = cell.fill?.fgColor?.argb; if (/^[a-f0-9]{8}$/i.test(fill || '')) td.style.backgroundColor = '#' + fill.slice(-6);
      if (cell.font?.bold) td.style.fontWeight = 'bold'; if (cell.font?.italic) td.style.fontStyle = 'italic';
      if (cell.alignment?.horizontal) td.style.textAlign = cell.alignment.horizontal;
      if (cell.address === state.selected) td.classList.add('office-cell-selected');
      td.addEventListener('click', () => { choose(cell, td); td.focus(); }); td.addEventListener('dblclick', () => edit(cell, td));
      td.addEventListener('keydown', event => {
        if (event.target !== td) return;
        if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); excelOp(state, { type:'cell', sheet:sheet.id, address:cell.master.address, text:'' }).catch(fail); }
        else if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); edit(cell, td); }
        else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); edit(cell, td); const field = td.querySelector('input'); if (field) field.value = event.key; }
        else if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab'].includes(event.key)) {
          event.preventDefault(); let rr = cell.row, cc = cell.col;
          if (event.key === 'ArrowUp') rr--; if (event.key === 'ArrowDown') rr++; if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) cc--; if (event.key === 'ArrowRight' || (event.key === 'Tab' && !event.shiftKey)) cc++;
          rr = Math.max(1, Math.min(1048576, rr)); cc = Math.max(1, Math.min(16384, cc)); state.selected = window.mdSpreadsheet.columnName(cc) + rr; state.rowPage = Math.floor((rr - 1) / 50); state.colPage = Math.floor((cc - 1) / 12);
          render().then(() => panel?.querySelector(`[data-address="${state.selected}"]`)?.focus()).catch(fail);
        }
      }); tr.append(td);
    }
    body.append(tr);
  }
  table.append(body); scroll.append(table);
  scroll.addEventListener('copy', event => { if (event.target.closest('.office-cell-edit')) return; event.preventDefault(); event.clipboardData.setData('text/plain', displayCell(state, sheet, selected())); });
  scroll.addEventListener('paste', event => {
    if (state.saving) return; event.preventDefault(); const raw = event.clipboardData.getData('text/plain');
    const rows = raw.replace(/\r\n?/g, '\n').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
    const cell = selected();
    if (rows.length > 1000 || rows.some(row => row.length > 100) || cell.row + rows.length - 1 > 1048576 || rows.some(row => cell.col + row.length - 1 > 16384)) { status('La tabla pegada excede el tamaño admitido'); return; }
    excelOp(state, { type:'paste', sheet:sheet.id, row:cell.row, col:cell.col, rows }).catch(fail);
  });
  state.message = state.errors.size ? `${state.errors.size} fórmula(s) pendientes o con error; Excel recalculará al abrir` : ''; 
}
function validateSheetName(workbook, name) {
  if (name.length > 31 || /[\\/*?:[\]]/.test(name) || name.startsWith("'") || name.endsWith("'") || !name.trim()) throw new Error('Nombre de hoja inválido (máximo 31 caracteres).');
  if (workbook.worksheets.some(sheet => sheet.name.toLowerCase() === name.toLowerCase())) throw new Error('Ya existe una hoja con ese nombre.');
}
function displayCell(state, sheet, cell) {
  const error = state.errors.get(sheet.id + '!' + cell.address); if (error) return error;
  const value = cell.value; const actual = cell.formula ? cell.result : value;
  if (actual instanceof Date) return actual.toLocaleDateString('es-ES');
  if (typeof actual === 'number') {
    const fmt = cell.numFmt || 'General';
    if (fmt.includes('%')) return new Intl.NumberFormat('es-ES', { style:'percent', maximumFractionDigits:fmt.includes('.00') ? 2 : 0 }).format(actual);
    if (fmt.includes('€')) return new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR' }).format(actual);
    if (/0\.00/.test(fmt)) return actual.toLocaleString('es-ES', { minimumFractionDigits:2, maximumFractionDigits:2 });
  }
  return actual == null ? '' : typeof actual === 'object' ? actual.text || actual.richText?.map(r => r.text).join('') || actual.error || '' : String(actual);
}
async function renderSlides(state, host, token) {
  const deck = state.deck; state.slide = Math.min(Math.max(state.slide, 0), deck.slides.length - 1);
  const tools = document.createElement('div'); tools.className = 'office-formatbar'; host.append(tools);
  button(tools, '+ Diapositiva', () => slideOp(state, () => { state.slide = deck.addSlide(state.slide); state.selectedItem = null; }));
  button(tools, 'Duplicar', () => slideOp(state, () => { state.slide = deck.addSlide(state.slide, true); state.selectedItem = null; }));
  button(tools, 'Eliminar diapositiva', () => slideOp(state, () => { if (!confirm('¿Eliminar esta diapositiva? Puedes recuperarla con Deshacer.')) return; deck.removeSlide(state.slide); state.slide = Math.min(state.slide, deck.slides.length - 1); state.selectedItem = null; }));
  button(tools, '← Mover', () => slideOp(state, () => { state.slide = deck.reorder(state.slide, -1); }));
  button(tools, 'Mover →', () => slideOp(state, () => { state.slide = deck.reorder(state.slide, 1); }));
  button(tools, '+ Texto', () => slideOp(state, () => { state.selectedItem = deck.addText(state.slide); }));
  button(tools, '+ Imagen', () => slideOp(state, async () => { const path = await window.mdEditor.pickFileReference(); if (!path) return; const ext = path.split('.').pop().toLowerCase(); const source = await window.mdEditor.assetReadBytes(path); if (!source || source.length > 10 * 1024 * 1024) throw new Error('Imagen demasiado grande o no legible.'); state.selectedItem = await deck.addImage(state.slide, source, ext); }));
  const background = input(tools, 'Fondo', 'color'); background.value = '#' + deck.backgroundColor(state.slide); background.addEventListener('change', () => slideOp(state, () => deck.background(state.slide, background.value)).catch(fail));
  button(tools, 'Presentar', () => present(state));
  const layout = document.createElement('div'); layout.className = 'office-slides-layout'; host.append(layout);
  const list = document.createElement('nav'); list.className = 'office-slide-list'; list.setAttribute('aria-label', 'Diapositivas'); layout.append(list);
  for (const [index, slide] of deck.slides.entries()) {
    const text = deck.textOf(slide.doc).split('\n').find(s => s.trim()) || 'Diapositiva';
    const node = button(list, `${index + 1}. ${text.slice(0, 65)}`, () => { state.slide = index; state.selectedItem = null; render(); }); node.classList.toggle('office-slide-active', index === state.slide); node.setAttribute('aria-current', String(index === state.slide));
  }
  const work = document.createElement('div'); work.className = 'office-slide-work'; layout.append(work);
  const canvas = document.createElement('div'); canvas.className = 'office-slide-canvas'; canvas.style.aspectRatio = `${deck.width} / ${deck.height}`; canvas.style.backgroundColor = '#' + deck.backgroundColor(state.slide); work.append(canvas);
  const items = await deck.items(state.slide); if (token !== renderToken) return;
  for (const item of items) drawSlideItem(canvas, item, deck, state);
  const properties = document.createElement('aside'); properties.className = 'office-slide-properties'; properties.setAttribute('aria-label', 'Propiedades del objeto'); layout.append(properties);
  const item = items.find(item => item.id === state.selectedItem && !item.readOnly);
  if (!item) { const hint = document.createElement('p'); hint.textContent = 'Selecciona un texto o una imagen para editarlo. Los cuadros se pueden arrastrar por la diapositiva.'; properties.append(hint); return; }
  if (item.kind === 'sp') {
    const label = document.createElement('label'); label.textContent = 'Texto'; const text = document.createElement('textarea'); text.className = 'office-slide-text'; text.setAttribute('aria-label', 'Texto del objeto'); text.value = item.text; label.append(text); properties.append(label);
    text.addEventListener('input', () => { deck.setText(state.slide, item.id, text.value); commit(state, 'slide-text-' + item.id); const view = canvas.querySelector(`[data-item="${item.id}"]`); if (view) view.textContent = text.value; });
    select(properties, 'Tamaño', [16,20,24,28,32,36,44,54].map(n => [String(n), n + ' pt']), value => slideOp(state, () => deck.setStyle(state.slide, item.id, { size:Number(value) }))).value = String(item.size);
    const color = input(properties, 'Color', 'color'); color.value = /^([a-f0-9]{6})$/i.test(item.color) ? '#' + item.color : '#334155'; color.addEventListener('change', () => slideOp(state, () => deck.setStyle(state.slide, item.id, { color:color.value })).catch(fail));
    button(properties, 'Negrita', () => slideOp(state, () => deck.setStyle(state.slide, item.id, { bold:!item.bold })));
    button(properties, 'Cursiva', () => slideOp(state, () => deck.setStyle(state.slide, item.id, { italic:!item.italic })));
    select(properties, 'Alineación', [['left','Izquierda'],['center','Centro'],['right','Derecha']], value => slideOp(state, () => deck.setStyle(state.slide, item.id, { align:value }))).value = item.align;
  }
  for (const [key, label] of [['x','Posición X (pulgadas)'],['y','Posición Y (pulgadas)'],['w','Ancho (pulgadas)'],['h','Alto (pulgadas)']]) {
    const field = input(properties, label, 'number'); field.step = '0.1'; field.value = item[key].toFixed(2); if (key === 'w' || key === 'h') field.min = '0.1';
    field.addEventListener('change', () => slideOp(state, () => deck.move(state.slide, item.id, { [key]:Number(field.value) })).catch(fail));
  }
  button(properties, 'Eliminar objeto', () => slideOp(state, () => { deck.removeItem(state.slide, item.id); state.selectedItem = null; }));
}
function drawSlideItem(canvas, item, deck, state = null) {
  const node = document.createElement(item.kind === 'pic' && item.src ? 'img' : 'div'); node.className = 'office-slide-item'; node.dataset.item = item.id;
  if (node.tagName === 'IMG') { node.src = item.src; node.alt = 'Imagen de diapositiva'; node.draggable = false; }
  else node.textContent = item.text || (item.kind === 'pic' ? 'Imagen no disponible' : '');
  for (const [key, value] of Object.entries({ left:item.x / deck.width * 100 + '%', top:item.y / deck.height * 100 + '%', width:item.w / deck.width * 100 + '%', height:item.h / deck.height * 100 + '%', fontSize:item.size / (deck.width * 72) * 100 + 'cqw', fontWeight:item.bold ? 'bold' : 'normal', fontStyle:item.italic ? 'italic' : 'normal', color:'#' + item.color, textAlign:item.align })) node.style[key] = value;
  if (item.fill) node.style.backgroundColor = '#' + item.fill;
  if (state && !item.readOnly) {
    node.tabIndex = 0; node.setAttribute('role', 'button'); node.setAttribute('aria-label', item.kind === 'pic' ? 'Seleccionar imagen' : 'Seleccionar texto: ' + item.text.slice(0, 60));
    node.classList.toggle('office-object-selected', item.id === state.selectedItem);
    node.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.selectedItem = item.id; render(); } });
    node.addEventListener('pointerdown', event => {
      if (state.saving || event.button !== 0) return; event.preventDefault();
      const rect = canvas.getBoundingClientRect(); const startX = event.clientX, startY = event.clientY; let moved = false, x = item.x, y = item.y;
      node.setPointerCapture(event.pointerId);
      const move = event => { const dx = event.clientX - startX, dy = event.clientY - startY; if (Math.abs(dx) + Math.abs(dy) < 4) return; moved = true; x = item.x + dx / rect.width * deck.width; y = item.y + dy / rect.height * deck.height; node.style.left = x / deck.width * 100 + '%'; node.style.top = y / deck.height * 100 + '%'; };
      const stop = () => { node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', stop); node.removeEventListener('pointercancel', stop); state.selectedItem = item.id; if (moved) { deck.move(state.slide, item.id, { x, y }); commit(state); } render().catch(fail); };
      node.addEventListener('pointermove', move); node.addEventListener('pointerup', stop); node.addEventListener('pointercancel', stop);
    });
  }
  canvas.append(node); return node;
}
async function present(state) {
  const previous = document.activeElement;
  const overlay = document.createElement('dialog'); overlay.className = 'office-present-overlay'; overlay.tabIndex = 0; overlay.setAttribute('aria-label', 'Presentación de diapositivas'); document.body.append(overlay);
  let index = state.slide, generation = 0;
  overlay.addEventListener('close', () => { generation++; overlay.remove(); if (previous?.isConnected) previous.focus(); });
  const toolbar = document.createElement('div'); toolbar.className = 'office-present-toolbar'; overlay.append(toolbar);
  button(toolbar, 'Anterior', () => show(index - 1)); const count = document.createElement('span'); count.setAttribute('role', 'status'); toolbar.append(count); button(toolbar, 'Siguiente', () => show(index + 1)); button(toolbar, 'Cerrar (Esc)', () => overlay.close());
  const stage = document.createElement('div'); stage.className = 'office-slide-canvas office-present-canvas'; stage.style.aspectRatio = `${state.deck.width} / ${state.deck.height}`; overlay.append(stage);
  async function show(next) { index = Math.max(0, Math.min(state.deck.slides.length - 1, next)); const token = ++generation; const items = await state.deck.items(index); if (generation !== token || !overlay.isConnected) return; stage.replaceChildren(); stage.style.backgroundColor = '#' + state.deck.backgroundColor(index); items.forEach(item => drawSlideItem(stage, item, state.deck)); count.textContent = `${index + 1} / ${state.deck.slides.length}`; }
  overlay.addEventListener('keydown', event => { if (['ArrowRight','PageDown'].includes(event.key) || (event.key === ' ' && event.target === overlay)) { event.preventDefault(); show(index + 1); } else if (['ArrowLeft','PageUp'].includes(event.key)) { event.preventDefault(); show(index - 1); } });
  overlay.showModal(); overlay.focus(); await show(index);
}
async function search(state, direction, location = null) {
  const query = (state.query || '').toLocaleLowerCase(); if (!query) { status('Escribe el texto que quieres buscar'); return; }
  const matches = [];
  if (state.kind === 'xlsx') {
    state.workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => { if (matches.length < 5000 && (window.mdSpreadsheet.editText(cell) + ' ' + cell.text).toLocaleLowerCase().includes(query)) matches.push({ sheet:sheet.id, row:cell.row, col:cell.col, address:cell.address }); })));
  } else if (state.kind === 'pptx') {
    for (let index = 0; index < state.deck.slides.length; index++) { const items = await state.deck.items(index); for (const item of items) if (item.text.toLocaleLowerCase().includes(query)) matches.push({ slide:index, id:item.id }); }
  } else {
    const page = panel?.querySelector('.office-word-page'); if (!page) return;
    const walker = document.createTreeWalker(page, window.NodeFilter.SHOW_TEXT); let node, text = ''; const spans = [];
    while ((node = walker.nextNode())) { spans.push({ node, start:text.length, end:text.length + node.textContent.length }); text += node.textContent; }
    const lower = text.toLocaleLowerCase(); let from = 0, offset;
    while (matches.length < 5000 && (offset = lower.indexOf(query, from)) !== -1) {
      const start = spans.find(span => offset >= span.start && offset < span.end);
      const end = spans.find(span => offset + query.length > span.start && offset + query.length <= span.end);
      if (start && end) matches.push({ node:start.node, offset:offset - start.start, endNode:end.node, endOffset:offset + query.length - end.start });
      from = offset + query.length;
    }
  }
  if (!matches.length) { state.findInfo = '0 coincidencias'; panel?.querySelector('.office-find-count')?.replaceChildren(document.createTextNode(state.findInfo)); return; }
  const previous = state.findIndex ?? -1; state.findIndex = previous < 0 ? (direction < 0 ? matches.length - 1 : 0) : (previous + direction + matches.length) % matches.length;
  if (location?.text) {
    const paragraphs = new Set(); let occurrence = 0;
    const index = matches.findIndex(match => {
      const block = match.node?.parentElement.closest('p,h1,h2,h3,h4,h5,h6,li');
      if (!block?.textContent.startsWith(location.text) || paragraphs.has(block)) return false;
      paragraphs.add(block); return ++occurrence === (location.occurrence || 1);
    });
    if (index >= 0) state.findIndex = index;
  }
  const found = matches[state.findIndex];
  state.findInfo = `${state.findIndex + 1} / ${matches.length}`;
  if (state.kind === 'xlsx') { state.sheet = found.sheet; state.selected = found.address; state.rowPage = Math.floor((found.row - 1) / 50); state.colPage = Math.floor((found.col - 1) / 12); await render(); panel?.querySelector(`[data-address="${found.address}"]`)?.scrollIntoView({ block:'nearest' }); }
  else if (state.kind === 'pptx') { state.slide = found.slide; state.selectedItem = found.id; await render(); }
  else { const range = document.createRange(); range.setStart(found.node, found.offset); range.setEnd(found.endNode, found.endOffset); const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); found.node.parentElement.scrollIntoView({ block:'center' }); panel.querySelector('.office-find-count').textContent = state.findInfo; }
}
async function reveal(result, query) {
  if (!await open(result.filePath)) return;
  const state = states.get(active); if (!state) return;
  state.query = query.trim(); state.findIndex = -1;
  if (state.kind === 'xlsx') {
    const sheet = state.workbook.getWorksheet(result.location.sheet);
    if (!sheet) { status('La hoja del resultado ya no existe'); return; }
    const cell = sheet.getCell(result.location.address);
    state.sheet = sheet.id; state.selected = cell.address;
    state.rowPage = Math.floor((cell.row - 1) / 50); state.colPage = Math.floor((cell.col - 1) / 12);
    await render(); const grid = panel.querySelector('.office-grid-scroll'); grid.focus();
    panel.querySelector(`[data-address="${cell.address}"]`)?.scrollIntoView({ block:'center' });
  } else if (state.kind === 'pptx') {
    state.slide = Math.min(result.location.slide, state.deck.slides.length - 1);
    const items = await state.deck.items(state.slide);
    state.selectedItem = items.find(item => item.text.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()))?.id || null;
    await render(); panel.querySelector('.office-object-selected,.office-slide-list button.office-slide-active')?.focus();
  } else { panel.querySelector('.office-search').value = state.query; await search(state, 1, result.location); }
}
document.addEventListener('keydown', event => {
  const state = states.get(active); if (!state || event.target.closest('.ask-overlay, .office-present-overlay, dialog[open], .modal-overlay, .palette-overlay')) return;
  const ctrl = event.ctrlKey || event.metaKey; if (!ctrl) return;
  const key = event.key.toLowerCase();
  if (['z','y'].includes(key) && event.target.closest('.office-cell-edit,.office-cell-formula,.office-search')) return;
  if (key === 's') { event.preventDefault(); event.stopImmediatePropagation(); save(event.shiftKey).catch(fail); }
  else if (key === 'z' || key === 'y') { event.preventDefault(); event.stopImmediatePropagation(); undo(key === 'y' || event.shiftKey ? 1 : -1).catch(fail); }
  else if (key === 'f' && !event.shiftKey) { event.preventDefault(); event.stopImmediatePropagation(); panel.querySelector('.office-search').focus(); }
}, true);
window.addEventListener('beforeunload', event => { if ([...states.values()].some(state => dirty(state) || state.saving)) { event.preventDefault(); event.returnValue = false; } });
for (const id of ['btn-export-xlsx','btn-export-pptx']) document.getElementById(id).addEventListener('click', () => { document.getElementById('export-menu').hidden = true; save(true).catch(fail); });
for (const node of document.querySelectorAll('[data-office]')) node.addEventListener('click', () => { document.getElementById('new-menu').hidden = true; create(node.dataset.office).catch(fail); });
window.mdOffice = {
  create, open, activate, hide, save, undo, restore, reveal, search: (direction = 1) => search(states.get(active), direction),
  forget, checkDisk, isSaving: key => !!states.get(key)?.saving,
  rename: (key, path) => { const state = states.get(key); if (state) { state.filePath = path; sync(state); } },
  getState: (key = active) => { const state = states.get(key); return state ? { key:state.key, kind:state.kind, filePath:state.filePath, modified:dirty(state), content:serialized(state), historyIndex:state.index, warnings:state.warnings, saving:!!state.saving } : null; },
  // API semántica usada también por las pruebas de integración.
  setWordHtml: html => { const state = states.get(active); if (state?.kind !== 'docx') throw new Error('Abre un documento Word.'); state.html = safeHtml(html); commit(state); return render(); },
  setCell: (sheet, address, text) => { const state = states.get(active); if (state?.kind !== 'xlsx') throw new Error('Abre un libro Excel.'); return excelOp(state, { type:'cell', sheet, address, text }); },
  getCell: (sheet, address) => states.get(active)?.workbook?.getWorksheet(sheet)?.getCell(address)?.value,
  editSlide: (index, id, text) => { const state = states.get(active); if (state?.kind !== 'pptx') throw new Error('Abre una presentación.'); return slideOp(state, () => state.deck.setText(index, id, text)); },
  getSlideItems: index => states.get(active)?.deck?.items(index),
  setQuery: query => { const state = states.get(active); if (state) { state.query = query; state.findIndex = -1; } },
  exportBase64: async () => { const state = states.get(active); return state.kind === 'docx' ? window.mdDocxExport.buildHtmlBase64(state.html) : state.kind === 'xlsx' ? toBase64(await state.workbook.xlsx.writeBuffer()) : state.deck.exportBase64(); }
};
})();
