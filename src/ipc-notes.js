'use strict';

// IPC de consultas sobre las notas de la carpeta (todas vía el índice de
// ipc-files.js): búsqueda global, etiquetas, wikilinks, backlinks, grafo y
// Kanban de carpeta.
// Se carga desde main.js (require) después de fijar userData; lo compartido
// con main.js (ventana, config, modo test) está en mainctx.js.

const { ipcMain } = require('electron');
const path = require('path');
const fsp = require('fs').promises;
const { folderIndex, makeBackup, indexTouch } = require('./ipc-files');
const guard = require('./pathguard');
const ctx = require('./mainctx');
const { buildMatcher, replaceIn } = require('./shared/replace');

const SEARCH_MAX_RESULTS = 200;
const { searchOffice } = require('./office-search');
ipcMain.handle('search:office', async (_event, { root, query } = {}) => {
  if (typeof root !== 'string' || typeof query !== 'string' || query.trim().length < 2 || query.length > 300 || !guard.check(root, 'search:office')) return { results:[], skipped:[] };
  return searchOffice(root, query);
});

// Recorre los archivos "de texto" (md/markdown/txt/tex) de una carpeta,
// saltando ocultos, y llama onFile(fullPath, content) para cada uno.
// Compartido por búsqueda global, etiquetas y backlinks para no repetir el
// recorrido del árbol tres veces.
//
// Va por el índice (folderindex.js): solo se relee lo que cambió.
function walkTextFiles(root, onFile) {
  return folderIndex.walk(root, onFile);
}

// Tablero Kanban en modo "carpeta completa" (ver kanban.js): junta el
// contenido crudo de todos los archivos de texto para que el renderer arme
// las columnas con el mismo parseColumns que ya usa en modo archivo activo
// — la lógica de "## Columna" + lista queda en un solo lugar.
ipcMain.handle('kanban:readFolderFiles', async (event, root) => {
  if (!root || !guard.check(root, 'kanban')) return [];
  const files = [];
  await walkTextFiles(root, (fullPath, content) => {
    files.push({ path: fullPath, content });
  });
  return files;
});

ipcMain.handle('search:inFolder', async (event, { root, query }) => {
  if (!root || !query || query.trim().length < 2 || !guard.check(root, 'search')) return [];
  const q = query.toLowerCase();
  const results = [];

  await walkTextFiles(root, (fullPath, content) => {
    if (results.length >= SEARCH_MAX_RESULTS) return false;
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (results.length >= SEARCH_MAX_RESULTS) break;
      if (lines[i].toLowerCase().includes(q)) {
        results.push({
          filePath: fullPath,
          relPath: path.relative(root, fullPath),
          line: i + 1,
          snippet: lines[i].trim().slice(0, 160)
        });
      }
    }
  });

  return results;
});

// ---- Buscar y reemplazar en la carpeta (replacefolder.js) ----
// preview: qué archivos cambian y cómo (no toca nada). apply: reemplaza en
// los archivos elegidos, cada uno con su copia en el historial local de
// versiones (igual que al guardar), y salta los que están en `skip`
// (pestañas con cambios sin guardar).
const REPLACE_MAX_FILES = 2000;

ipcMain.handle('replace:preview', async (event, { root, find, replacement, opts }) => {
  if (!root || !guard.check(root, 'replace')) return { error: 'Sin carpeta abierta.' };
  const m = buildMatcher(String(find || ''), opts);
  if (m.error) return { error: m.error };
  const files = [];
  let total = 0;
  await walkTextFiles(root, (fullPath, content) => {
    const r = replaceIn(content, m.re, String(replacement == null ? '' : replacement), opts);
    if (!r.count) return true;
    total += r.count;
    files.push({ filePath: fullPath, relPath: path.relative(root, fullPath), count: r.count, samples: r.samples });
    return files.length < REPLACE_MAX_FILES;
  });
  return { files, total, truncated: files.length >= REPLACE_MAX_FILES };
});

ipcMain.handle('replace:apply', async (event, { root, find, replacement, opts, files, skip }) => {
  if (!root || !guard.check(root, 'replace') || !Array.isArray(files)) return { error: 'Sin carpeta abierta.' };
  const m = buildMatcher(String(find || ''), opts);
  if (m.error) return { error: m.error };
  const skipSet = new Set(Array.isArray(skip) ? skip : []);
  const done = [];
  const skipped = [];
  const failed = [];
  let total = 0;
  for (const filePath of files) {
    if (typeof filePath !== 'string' || !guard.check(filePath, 'replace') || !path.resolve(filePath).startsWith(path.resolve(root) + path.sep)) {
      failed.push(filePath);
      continue;
    }
    if (skipSet.has(filePath)) {
      skipped.push(filePath);
      continue;
    }
    try {
      const content = await fsp.readFile(filePath, 'utf-8');
      const r = replaceIn(content, m.re, String(replacement == null ? '' : replacement), opts);
      if (!r.count) continue;
      await makeBackup(filePath);
      await fsp.writeFile(filePath, r.output, 'utf-8');
      indexTouch(filePath, false);
      done.push(filePath);
      total += r.count;
    } catch (e) {
      ctx.logError('replace:apply', e);
      failed.push(filePath);
    }
  }
  return { done, skipped, failed, total };
});

// Deja afuera del escaneo de #tag / [[wikilink]] el contenido de bloques
// ```fence``` y `código inline` (blanquea los caracteres sin tocar los
// saltos de línea, así los números de línea de backlinks:list no se mueven).
function stripCodeForScan(text) {
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]+`/g, (m) => m.replace(/[^\n]/g, ' '));
}

// Debe coincidir con el regex de preview.js (embedTagSyntax): #tag no
// precedido por otro "#" (para no confundir con encabezados "## Título").
const TAG_RE = /(^|[\s(])#([a-zA-Z][\w-]*)/g;

ipcMain.handle('tags:list', async (event, root) => {
  if (!root || !guard.check(root, 'tags')) return [];
  const counts = new Map();
  await walkTextFiles(root, (fullPath, content) => {
    const scanText = stripCodeForScan(content);
    TAG_RE.lastIndex = 0;
    let m;
    while ((m = TAG_RE.exec(scanText))) {
      const tag = m[2].toLowerCase();
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  });
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
});

ipcMain.handle('wikilink:resolve', async (event, { root, target }) => {
  if (!root || !target || !guard.check(root, 'wikilink')) return null;
  const wanted = target.trim().toLowerCase();
  const list = await folderIndex.files(root);
  return list.find((f) => path.basename(f, path.extname(f)).toLowerCase() === wanted) || null;
});

const WIKILINK_RE = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
// [texto](destino.md) — el destino con extensión de texto (para el grafo).
const MDLINK_RE = /\]\(\s*<?([^)\s>]+\.(?:md|markdown|txt|tex)(?:#[^)\s>]*)?)>?(?:\s+"[^"]*")?\s*\)/gi;

ipcMain.handle('backlinks:list', async (event, { root, target }) => {
  if (!root || !target || !guard.check(root, 'backlinks')) return [];
  const wanted = target.trim().toLowerCase();
  const results = [];
  await walkTextFiles(root, (fullPath, content) => {
    const originalLines = content.split('\n');
    const scanLines = stripCodeForScan(content).split('\n');
    scanLines.forEach((line, i) => {
      WIKILINK_RE.lastIndex = 0;
      let m;
      while ((m = WIKILINK_RE.exec(line))) {
        if (m[1].trim().toLowerCase() === wanted) {
          results.push({
            filePath: fullPath,
            relPath: path.relative(root, fullPath),
            line: i + 1,
            snippet: (originalLines[i] || '').trim().slice(0, 160)
          });
        }
      }
    });
  });
  return results;
});

// Nodos = archivos de texto de la carpeta; aristas = wikilinks resueltos
// entre ellos (mismo criterio que wikilink:resolve, por nombre de archivo).
ipcMain.handle('graph:build', async (event, root) => {
  if (!root || !guard.check(root, 'graph')) return { nodes: [], edges: [] };

  const files = [];
  await walkTextFiles(root, (fullPath, content) => {
    files.push({ path: fullPath, name: path.basename(fullPath, path.extname(fullPath)), content });
  });

  const byNameLower = new Map(files.map((f) => [f.name.toLowerCase(), f]));
  const edgeKeys = new Set();
  const edges = [];

  const byPath = new Map(files.map((f) => [f.path, f]));
  const addEdge = (f, target) => {
    if (!target || target.name === f.name) return;
    const key = `${f.name}->${target.name}`;
    if (edgeKeys.has(key)) return;
    edgeKeys.add(key);
    edges.push({ source: f.name, target: target.name });
  };

  files.forEach((f) => {
    const scanText = stripCodeForScan(f.content);
    WIKILINK_RE.lastIndex = 0;
    let m;
    while ((m = WIKILINK_RE.exec(scanText))) addEdge(f, byNameLower.get(m[1].trim().toLowerCase()));
    // Links Markdown normales a otra nota: [texto](otra-nota.md) o (sub/x.md#sección).
    MDLINK_RE.lastIndex = 0;
    while ((m = MDLINK_RE.exec(scanText))) {
      let href = m[1].split('#')[0].trim();
      if (!href || /^[a-z]+:/i.test(href)) continue; // http:, mailto:…
      try { href = decodeURIComponent(href); } catch { /* se deja como está */ }
      addEdge(f, byPath.get(path.resolve(path.dirname(f.path), href)));
    }
  });

  // Etiquetas y carpeta de cada nota: para filtrar el grafo.
  const tagsOf = (content) => {
    const tags = new Set();
    const scan = stripCodeForScan(content);
    TAG_RE.lastIndex = 0;
    let t;
    while ((t = TAG_RE.exec(scan))) tags.add(t[2].toLowerCase());
    return Array.from(tags);
  };
  return {
    nodes: files.map((f) => ({ id: f.name, path: f.path, tags: tagsOf(f.content), folder: path.relative(root, path.dirname(f.path)) || '.' })),
    edges
  };
});
