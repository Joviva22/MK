'use strict';
const fs = require('fs').promises;
const path = require('path');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const JSZip = require('jszip');
const cache = new Map();
let cacheBytes = 0;
function decode(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (all, entity) => {
    if (entity[0] !== '#') return ({ amp:'&', lt:'<', gt:'>', quot:'"', apos:"'" })[entity] || all;
    const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : all;
  });
}
function xmlTexts(xml) {
  return [...xml.matchAll(/<(?:[\w.-]+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)].map(m => decode(m[1])).join('');
}
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:.-]+)\s*=\s*(['"])(.*?)\2/g)].map(m => [m[1], decode(m[3])]));
}
async function extractOfficeEntries(bytes, kind) {
  if (bytes.length > 25 * 1024 * 1024) throw new Error('supera 25 MB');
  const zip = await JSZip.loadAsync(bytes);
  const files = Object.values(zip.files);
  if (files.length > 10000 || files.reduce((n, f) => n + (f._data?.uncompressedSize || 0), 0) > 100 * 1024 * 1024) throw new Error('paquete demasiado grande');
  const entries = [];
  if (kind === 'docx') {
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('falta el contenido Word');
    let paragraph = 0; const occurrences = new Map();
    for (const match of xml.matchAll(/<(?:[\w.-]+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?p>/g)) {
      const text = xmlTexts(match[1]);
      if (text.trim()) {
        const occurrence = (occurrences.get(text) || 0) + 1; occurrences.set(text, occurrence);
        entries.push({ text, location:{ paragraph:++paragraph, text:text.slice(0, 1000), occurrence }, label:`Párrafo ${paragraph}` });
      }
    }
  } else if (kind === 'xlsx') {
    const ExcelJS = require('exceljs');
    const book = new ExcelJS.Workbook(); await book.xlsx.load(bytes);
    book.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => {
      entries.push({ text:cell.text + (cell.formula ? ' =' + cell.formula : ''), location:{ sheet:sheet.name, address:cell.address }, label:`${sheet.name} · ${cell.address}` });
    })));
  } else if (kind === 'pptx') {
    const presentation = await zip.file('ppt/presentation.xml')?.async('string');
    const rels = await zip.file('ppt/_rels/presentation.xml.rels')?.async('string');
    if (!presentation || !rels) throw new Error('falta el contenido PowerPoint');
    const targets = new Map([...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => { const a = attributes(m[0]); return [a.Id, a.Target]; }));
    let index = 0;
    for (const match of presentation.matchAll(/<(?:[\w.-]+:)?sldId\b[^>]*>/g)) {
      const attrs = attributes(match[0]); const rid = Object.keys(attrs).find(k => k.endsWith(':id'));
      const target = targets.get(attrs[rid]); if (!target) continue;
      const part = target.startsWith('/') ? target.slice(1) : path.posix.normalize('ppt/' + target);
      const xml = await zip.file(part)?.async('string'); const slide = index++;
      if (!xml) continue;
      for (const p of xml.matchAll(/<(?:[\w.-]+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?p>/g)) {
        const text = xmlTexts(p[1]); if (text.trim()) entries.push({ text, location:{ slide }, label:`Diapositiva ${slide + 1}` });
      }
    }
  }
  if (entries.length > 100000 || JSON.stringify(entries).length > 10 * 1024 * 1024) throw new Error('demasiado contenido para buscar');
  return entries;
}
async function searchFolder(root, query, cancelled = () => false) {
  const results = [], skipped = [];
  let visited = 0, officeFiles = 0, truncated = false;
  const realRoot = await fs.realpath(root), q = query.trim().toLocaleLowerCase();
  async function walk(dir) {
    for (const item of await fs.readdir(dir, { withFileTypes:true })) {
      if (cancelled()) return;
      if (++visited > 10000 || officeFiles >= 500 || results.length >= 200) { truncated = true; return; }
      if (item.name.startsWith('.') || ['node_modules', 'dist'].includes(item.name) || item.isSymbolicLink()) continue;
      const filePath = path.join(dir, item.name);
      if (item.isDirectory()) { await walk(filePath); continue; }
      const kind = path.extname(item.name).slice(1).toLowerCase();
      if (!item.isFile() || !['docx','xlsx','pptx'].includes(kind)) continue;
      officeFiles++;
      try {
        const real = await fs.realpath(filePath), rel = path.relative(realRoot, real);
        if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) continue;
        const stat = await fs.stat(real); if (stat.size > 25 * 1024 * 1024) throw new Error('supera 25 MB');
        const signature = `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}:${stat.ino}`;
        let cached = cache.get(real);
        if (!cached || cached.signature !== signature) {
          const entries = await extractOfficeEntries(await fs.readFile(real), kind);
          if (cached) { cacheBytes -= cached.size; cache.delete(real); }
          cached = { signature, entries, size:JSON.stringify(entries).length };
          while (cache.size && (cache.size >= 64 || cacheBytes + cached.size > 20 * 1024 * 1024)) { const key = cache.keys().next().value; cacheBytes -= cache.get(key).size; cache.delete(key); }
          cache.set(real, cached); cacheBytes += cached.size;
        }
        for (const entry of cached.entries) {
          if (results.length >= 200) { truncated = true; break; }
          const offset = entry.text.toLocaleLowerCase().indexOf(q);
          if (offset >= 0) results.push({ kind, filePath, relPath:path.relative(root, filePath), location:entry.location, label:entry.label, snippet:entry.text.slice(Math.max(0, offset - 40), offset + q.length + 100) });
        }
      } catch (error) { skipped.push({ relPath:path.relative(root, filePath), reason:error.message }); }
    }
  }
  await walk(root);
  return { results, skipped, truncated };
}
if (!isMainThread) {
  let pending = null, running = false, latest = 0;
  parentPort.on('message', async message => {
    latest = message.id; pending = message;
    if (running) return;
    running = true;
    while (pending) {
      const job = pending; pending = null;
      try { const value = await searchFolder(job.root, job.query, () => latest !== job.id); parentPort.postMessage({ id:job.id, value }); }
      catch (error) { parentPort.postMessage({ id:job.id, error:error.message }); }
    }
    running = false;
  });
}
let worker = null, sequence = 0, outstanding = null;
function searchOffice(root, query) {
  if (outstanding) { clearTimeout(outstanding.timer); outstanding.resolve({ results:[], skipped:[], cancelled:true }); outstanding = null; }
  if (!worker) {
    const currentWorker = new Worker(__filename); worker = currentWorker;
    currentWorker.on('message', message => {
      if (currentWorker !== worker || message.id !== outstanding?.id) return;
      const job = outstanding; outstanding = null; clearTimeout(job.timer);
      if (message.error) job.reject(new Error(message.error)); else job.resolve(message.value);
    });
    const stop = error => { if (worker !== currentWorker) return; worker = null; if (outstanding) { clearTimeout(outstanding.timer); outstanding.reject(error); outstanding = null; } };
    currentWorker.on('error', stop);
    currentWorker.on('exit', () => stop(new Error('La búsqueda de documentos se interrumpió.')));
    currentWorker.unref();
  }
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { const old = worker; worker = null; outstanding = null; old.terminate(); reject(new Error('La búsqueda de documentos tardó demasiado. Prueba con una carpeta más pequeña.')); }, 30000);
    outstanding = { id, resolve, reject, timer }; worker.postMessage({ id, root, query });
  });
}
module.exports = { extractOfficeEntries, searchFolder, searchOffice };
