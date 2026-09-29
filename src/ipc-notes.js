'use strict';

// IPC de consultas sobre las notas de la carpeta (todas vía el índice de
// ipc-files.js): búsqueda global, etiquetas, wikilinks, backlinks, grafo y
// Kanban de carpeta.
// Se carga desde main.js (require) después de fijar userData; lo compartido
// con main.js (ventana, config, modo test) está en mainctx.js.

const { ipcMain } = require('electron');
const path = require('path');
const { folderIndex } = require('./ipc-files');
const guard = require('./pathguard');

const SEARCH_MAX_RESULTS = 200;

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

  files.forEach((f) => {
    const scanText = stripCodeForScan(f.content);
    WIKILINK_RE.lastIndex = 0;
    let m;
    while ((m = WIKILINK_RE.exec(scanText))) {
      const target = byNameLower.get(m[1].trim().toLowerCase());
      if (!target || target.name === f.name) continue;
      const key = `${f.name}->${target.name}`;
      if (edgeKeys.has(key)) continue;
      edgeKeys.add(key);
      edges.push({ source: f.name, target: target.name });
    }
  });

  return {
    nodes: files.map((f) => ({ id: f.name, path: f.path })),
    edges
  };
});
