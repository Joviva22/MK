(function () {
'use strict';
const L = window.mdEmbedLogic;
const controllers = new Map();
const registrations = new Map(), tokens = new Map();
function register(target, base, root) {
  root = base && root && window.mdEditor.isPathAllowed(root, base) ? root : base ? window.mdEditor.dirName(base) : '';
  const key = JSON.stringify([target, base || '', root || '']);
  if (!registrations.has(key)) {
    const token = window.crypto.randomUUID();
    registrations.set(key, token); tokens.set(token, { target, base: base || '', root: root || '' });
    if (registrations.size > 1000) { const first = registrations.keys().next().value; tokens.delete(registrations.get(first)); registrations.delete(first); }
  }
  return registrations.get(key);
}
const jobs = []; let running = 0;
function queue(job) { jobs.push(job); drain(); }
function drain() {
  while (running < 2 && jobs.length) {
    const job = jobs.shift(); running++;
    Promise.resolve().then(job).catch(() => {}).finally(() => { running--; drain(); });
  }
}
function node(tag, text) { const n = document.createElement(tag); if (text != null) n.textContent = text; return n; }
function html(target, base = window.mdState.currentFilePath, root = window.mdState.rootFolder) {
  return `<span class="md-study-embed" data-embed-target="${L.escape(target)}" data-embed-token="${register(target, base, root)}"></span>`;
}
function create(target) {
  const host = node('span'); host.className = 'md-study-embed'; host.dataset.embedTarget = target;
  host.dataset.embedToken = register(target, window.mdState.currentFilePath, window.mdState.rootFolder);
  return host;
}
function dispose(ctx) {
  ctx.generation++; ctx.visible = false;
  ctx.renderTask?.cancel(); ctx.renderTask = null;
  ctx.loadingTask?.destroy().catch(() => {}); ctx.loadingTask = null; ctx.doc = null;
  ctx.body.replaceChildren(); ctx.previous.disabled = ctx.next.disabled = true;
}
async function paintPdf(ctx, generation) {
  const page = await ctx.doc.getPage(ctx.page);
  if (generation !== ctx.generation || !ctx.host.isConnected) return;
  const first = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: Math.min(1.5, 720 / first.width, 1600 / first.height) });
  const canvas = node('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${ctx.parsed.label} · página ${ctx.page}`);
  ctx.renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport });
  await ctx.renderTask.promise;
  if (generation !== ctx.generation || !ctx.host.isConnected) return;
  ctx.body.replaceChildren(canvas); ctx.status.textContent = `Página ${ctx.page} de ${ctx.doc.numPages}`;
  ctx.previous.disabled = ctx.page <= 1; ctx.next.disabled = ctx.page >= ctx.doc.numPages;
}
async function load(ctx) {
  if (!ctx.visible || !ctx.host.isConnected) return;
  const generation = ++ctx.generation; ctx.status.textContent = 'Cargando…';
  try {
    const parsed = ctx.parsed, base = ctx.base;
    if (!base) throw new Error('Guarda la nota para resolver el archivo incrustado.');
    const root = ctx.root || window.mdEditor.dirName(base);
    const resolved = window.mdEditor.resolveLocalPath(base, parsed.path);
    if (!window.mdEditor.isPathAllowed(root, resolved)) throw new Error('Ruta fuera de la carpeta de la nota.');
    ctx.path = resolved;
    if (parsed.kind === 'pdf') {
      if (!window.pdfjsLib) throw new Error('El visor PDF todavía está cargando. Pulsa Actualizar.');
      const base64 = await window.mdEditor.pdfReadBytes(ctx.path, 50 * 1024 * 1024);
      if (!base64) throw new Error('PDF no autorizado, ausente o mayor de 50 MB.');
      if (generation !== ctx.generation || !ctx.host.isConnected) return;
      const binary = atob(base64), bytes = new window.Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const task = window.pdfjsLib.getDocument({ data: bytes }); ctx.loadingTask = task;
      const doc = await task.promise;
      if (generation !== ctx.generation || !ctx.host.isConnected) { await task.destroy(); return; }
      ctx.doc = doc;
      if (ctx.page > ctx.doc.numPages) throw new Error(`El PDF tiene ${ctx.doc.numPages} páginas; no existe la página ${ctx.page}.`);
      await paintPdf(ctx, generation);
    } else {
      const result = await window.mdEditor.drawingRead(ctx.path);
      if (!result || result.error) throw new Error(result?.error || 'Pizarra no autorizada o ausente.');
      if (generation !== ctx.generation || !ctx.host.isConnected) return;
      window.EXCALIDRAW_ASSET_PATH = new window.URL('drawing-assets/', document.baseURI).href;
      await window.mdLoadLib('drawing');
      const scene = JSON.parse(result.content);
      if (scene.elements.length > 5000) throw new Error('Pizarra demasiado grande para la vista incrustada (máximo 5000 elementos). Puedes abrirla en el editor.');
      for (const file of Object.values(scene.files || {})) if (!/^data:image\/(?:png|jpeg|gif|webp|svg\+xml);base64,/i.test(file.dataURL || '')) throw new Error('La pizarra contiene una imagen externa o un formato no admitido.');
      const canvas = await window.mdDrawingEngine.thumbnail(scene);
      if (generation !== ctx.generation || !ctx.host.isConnected) return;
      canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', parsed.label);
      ctx.body.replaceChildren(canvas); ctx.status.textContent = 'Vista de la pizarra guardada';
    }
  } catch (error) {
    if (generation !== ctx.generation || !ctx.host.isConnected) return;
    ctx.status.textContent = error.message; ctx.body.replaceChildren();
    ctx.loadingTask?.destroy().catch(() => {}); ctx.loadingTask = null; ctx.doc = null;
  }
}
function mount(host) {
  if (controllers.has(host)) return;
  const registered = tokens.get(host.dataset.embedToken);
  if (!registered) { host.textContent = 'Inserción no válida. Usa ![[archivo.pdf]] o ![[archivo.excalidraw]].'; return; }
  const parsed = L.parse(registered.target); if (!parsed) return;
  const toolbar = node('span'), body = node('span'), status = node('span'); toolbar.className = 'study-embed-toolbar'; body.className = 'study-embed-body';
  status.setAttribute('role', 'status'); status.textContent = 'Se carga al entrar en pantalla.';
  const ctx = { host, parsed, base: registered.base, root: registered.root, toolbar, body, status, page: parsed.page, generation: 0, visible: false, previous: node('button', 'Anterior'), next: node('button', 'Siguiente') };
  function button(label, action) { const b = node('button', label); b.type = 'button'; b.addEventListener('click', () => Promise.resolve().then(action).catch((error) => { status.textContent = error.message; })); toolbar.append(b); return b; }
  toolbar.append(node('strong', parsed.label));
  button(parsed.kind === 'pdf' ? 'Abrir PDF' : 'Editar pizarra', async () => {
    if (!ctx.path) throw new Error('Autoriza el archivo y pulsa Actualizar primero.');
    if (parsed.kind === 'pdf') {
      if (window.mdModules && !window.mdModules.isOn('pdf')) throw new Error('Activa el módulo PDF para abrir sus herramientas.');
      await window.mdPdfHighlight.openLink(`${window.mdEditor.toLocalUrl(ctx.path)}#page=${ctx.page}`, ctx.base);
    }
    else await window.mdDrawing.open(ctx.path);
  });
  button('Actualizar', () => { dispose(ctx); ctx.visible = true; queue(() => load(ctx)); });
  if (parsed.kind === 'pdf') {
    for (const [b, change] of [[ctx.previous, -1], [ctx.next, 1]]) {
      b.type = 'button'; b.disabled = true;
      b.addEventListener('click', () => {
        if (!ctx.doc || !ctx.visible) return;
        const next = ctx.page + change; if (next < 1 || next > ctx.doc.numPages) return;
        ctx.page = next; ctx.previous.disabled = ctx.next.disabled = true;
        const generation = ctx.generation;
        queue(async () => { try { if (ctx.doc && ctx.visible && generation === ctx.generation) await paintPdf(ctx, generation); } catch (error) { if (generation === ctx.generation) ctx.status.textContent = error.message; } });
      }); toolbar.append(b);
    }
  }
  host.addEventListener('mousedown', (e) => e.stopPropagation());
  host.addEventListener('click', (e) => e.stopPropagation());
  host.append(toolbar, status, body); controllers.set(host, ctx); observer.observe(host);
}
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const ctx = controllers.get(entry.target); if (!ctx) continue;
    if (entry.isIntersecting && !ctx.visible) { ctx.visible = true; queue(() => load(ctx)); }
    else if (!entry.isIntersecting && ctx.visible) dispose(ctx);
  }
}, { rootMargin: '250px' });
function hydrate(container) { if (container.matches?.('.md-study-embed')) mount(container); container.querySelectorAll?.('.md-study-embed').forEach(mount); }
const mutations = new MutationObserver((records) => {
  for (const [host, ctx] of controllers) if (!host.isConnected) { dispose(ctx); observer.unobserve(host); controllers.delete(host); }
  for (const record of records) for (const added of record.addedNodes) if (added.nodeType === 1) hydrate(added);
});
for (const root of [document.getElementById('preview-pane'), window.mdCodeMirror.getWrapperElement()]) mutations.observe(root, { childList: true, subtree: true });
document.addEventListener('mk:drawing-saved', (event) => {
  for (const ctx of controllers.values()) if (ctx.path === event.detail?.path && ctx.visible) { dispose(ctx); ctx.visible = true; queue(() => load(ctx)); }
});
async function insert() {
  const cm = window.mdCodeMirror, base = window.mdState.currentFilePath, doc = cm.getDoc();
  if (!base || !/\.(md|markdown)$/i.test(base)) throw new Error('Guarda primero la nota Markdown.');
  const path = await window.mdEditor.openFile(); if (!path) return;
  if (cm.getDoc() !== doc || window.mdState.currentFilePath !== base) throw new Error('Cambió la nota mientras elegías el archivo. Reintenta la inserción.');
  const selectedRoot = window.mdState.rootFolder;
  const root = selectedRoot && window.mdEditor.isPathAllowed(selectedRoot, base) ? selectedRoot : window.mdEditor.dirName(base);
  if (!window.mdEditor.isPathAllowed(root, path)) throw new Error('Elige un PDF o pizarra dentro de la carpeta abierta o de la nota.');
  const relative = window.mdEditor.relativePath(base, path);
  if (!L.parse(relative) || /[\[\]]/.test(relative)) throw new Error('Elige un PDF o .excalidraw sin corchetes ni # en el nombre.');
  cm.replaceSelection(`\n![[${relative}]]\n`); cm.focus();
}
window.mdStudyEmbed = { html, create, hydrate, insert, activeCount: () => controllers.size };
})();
