'use strict';

// IPC de importar/exportar: CSV de bases de datos, herramientas de PDF,
// bytes de .docx/assets, y exportar a Word, HTML, PDF, EPUB y Anki.
// Se carga desde main.js (require) después de fijar userData; lo compartido
// con main.js (ventana, config, modo test) está en mainctx.js.

const { BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const os = require('os');
const crypto = require('crypto');
const JSZip = require('jszip');
const ctx = require('./mainctx');
const guard = require('./pathguard');

// Si exportar o leer falla (disco lleno, sin permiso, archivo dañado), el
// usuario lo ve (aviso + userData/logs/mk.log) en vez de que el botón no
// haga nada; el IPC devuelve null como si se hubiera cancelado.
const FAIL_MESSAGES = {
  'csv:save': 'No se pudo guardar el CSV.',
  'csv:open': 'No se pudo leer ese CSV.',
  'pdf:saveBytes': 'No se pudo guardar el PDF.',
  'export:docx': 'No se pudo exportar a Word.',
  'export:html': 'No se pudo exportar a HTML.',
  'export:pdf': 'No se pudo exportar a PDF.',
  'export:epub': 'No se pudo exportar a EPUB.',
  'export:anki': 'No se pudieron exportar las tarjetas.'
};

function handle(channel, fn) {
  ipcMain.handle(channel, async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      ctx.reportError(channel, e, FAIL_MESSAGES[channel] || 'No se pudo completar la operación.');
      return null;
    }
  });
}

// CSV de las bases de datos (ver database.js): el renderer arma/parsea el
// texto, acá solo los diálogos y el disco.
handle('csv:save', async (event, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(ctx.mainWindow, {
    defaultPath: (defaultName || 'base-de-datos').replace(/[\\/:*?"<>|]/g, '_') + '.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  });
  if (result.canceled || !result.filePath) return null;
  // BOM: sin él, Excel abre el UTF-8 como Latin-1 (tildes rotas).
  fs.writeFileSync(result.filePath, '\ufeff' + content, 'utf-8');
  return result.filePath;
});

handle('csv:open', async () => {
  const result = await dialog.showOpenDialog(ctx.mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'CSV', extensions: ['csv', 'tsv', 'txt'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8').replace(/^\ufeff/, '');
  return { name: path.basename(filePath, path.extname(filePath)), content };
});

// Herramientas de PDF (unir/separar/rotar/reordenar/marca de agua/firma y
// subrayado): la lógica de edición corre en el renderer con pdf-lib (no
// necesita Node), acá solo se resuelven diálogos nativos y lectura/escritura
// de bytes — igual separación que el resto de exportadores de este archivo.
ipcMain.handle('pdf:pickFiles', async (event, { multi }) => {
  const result = await dialog.showOpenDialog(ctx.mainWindow, {
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: multi ? ['openFile', 'multiSelections'] : ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  result.filePaths.forEach(guard.grantFile); // elegidos por el usuario
  return result.filePaths;
});

ipcMain.handle('pdf:readBytes', async (event, filePath) => {
  if (!guard.check(filePath, 'pdf:readBytes')) return null;
  try {
    return (await fsp.readFile(filePath)).toString('base64');
  } catch {
    return null;
  }
});

handle('pdf:saveBytes', async (event, { base64, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'documento.pdf', [{ name: 'PDF', extensions: ['pdf'] }]);
  if (!targetPath) return null;
  fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
  return targetPath;
});

// Abrir .docx (ver docximport.js): mammoth+turndown corren en el renderer,
// acá solo se leen los bytes crudos, igual separación que pdf:readBytes.
ipcMain.handle('docx:readBytes', async (event, filePath) => {
  if (!guard.check(filePath, 'docx:readBytes')) return null;
  try {
    return (await fsp.readFile(filePath)).toString('base64');
  } catch {
    return null;
  }
});

// Genérico, para leer los bytes de cualquier archivo local (usado por
// docxexport.js para embeber imágenes locales al exportar a .docx) — la
// restricción de ruta (no salir de la carpeta abierta) la valida el
// renderer antes de llamar esto, igual que con las imágenes normales.
ipcMain.handle('asset:readBytes', async (event, filePath) => {
  if (!guard.check(filePath, 'asset:readBytes')) return null;
  try {
    return (await fsp.readFile(filePath)).toString('base64');
  } catch {
    return null;
  }
});

handle('export:docx', async (event, { base64, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'documento.docx', [{ name: 'Word', extensions: ['docx'] }]);
  if (!targetPath) return null;
  fs.writeFileSync(targetPath, Buffer.from(base64, 'base64'));
  return targetPath;
});

// KaTeX real (CSS + fuentes) inlineado para exports standalone (HTML/PDF):
// sin esto el export usa una hoja de estilos aproximada y las fórmulas se ven
// distintas a como se ven en el preview. Se cachea en memoria porque el CSS y
// las fuentes de KaTeX no cambian en caliente. Solo se embeben las fuentes
// .woff2 (soportadas por el Chromium que embebe Electron) descartando los
// fallbacks .woff/.ttf del CSS original, para no triplicar el tamaño del
// export con formatos que nunca se van a usar acá.
let cachedKatexCss = null;
function getKatexCssInlined() {
  if (cachedKatexCss !== null) return cachedKatexCss;
  try {
    const katexDir = path.join(__dirname, '..', 'node_modules', 'katex', 'dist');
    const css = fs.readFileSync(path.join(katexDir, 'katex.min.css'), 'utf-8');
    // Cada @font-face trae 3 formatos (woff2, woff, ttf) como fallback; nos
    // quedamos solo con woff2 (lo soporta de sobra el Chromium de Electron)
    // para no triplicar el tamaño del export embebiendo formatos sin uso.
    cachedKatexCss = css.replace(
      /url\(fonts\/([^)]+)\.woff2\)\s*format\(["']woff2["']\)(?:,\s*url\(fonts\/[^)]+\)\s*format\(["'][^"']+["']\))*/g,
      (match, fontName) => {
        const fontPath = path.join(katexDir, 'fonts', `${fontName}.woff2`);
        if (!fs.existsSync(fontPath)) return match;
        const b64 = fs.readFileSync(fontPath).toString('base64');
        return `url(data:font/woff2;base64,${b64}) format('woff2')`;
      }
    );
  } catch {
    cachedKatexCss = '';
  }
  return cachedKatexCss;
}

ipcMain.handle('katex:getCss', () => getKatexCssInlined());

handle('export:html', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(ctx.mainWindow, {
    defaultPath: defaultName || 'documento.html',
    filters: [{ name: 'HTML', extensions: ['html'] }]
  });
  if (result.canceled || !result.filePath) return null;
  fs.writeFileSync(result.filePath, html, 'utf-8');
  return result.filePath;
});

handle('export:pdf', async (event, { html, defaultName }) => {
  const result = await dialog.showSaveDialog(ctx.mainWindow, {
    defaultPath: defaultName || 'documento.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled || !result.filePath) return null;

  const tmpPath = path.join(os.tmpdir(), `mk-export-${Date.now()}.html`);
  fs.writeFileSync(tmpPath, html, 'utf-8');
  // Ventana oculta que imprime TU documento: aislada y sin JavaScript (el
  // HTML exportado ya viene renderizado: fórmulas, diagramas y resaltado).
  const pdfWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false, contextIsolation: true, nodeIntegration: false } });
  try {
    await pdfWindow.loadFile(tmpPath);
    const buffer = await pdfWindow.webContents.printToPDF({ printBackground: true });
    fs.writeFileSync(result.filePath, buffer);
  } finally {
    pdfWindow.destroy();
    fs.rmSync(tmpPath, { force: true });
  }
  return result.filePath;
});

// data:image/... -> <img>/<br>/<hr>/<embed>/<link>/<meta>/<input> sin cerrar
// (marked/DOMPurify no producen XHTML estricto) se cierran solos para que
// el .xhtml del EPUB sea válido.
function toXhtmlVoidElements(html) {
  return html.replace(/<(img|br|hr|input|meta|link|embed)\b([^>]*?)\/?>/gi, (match, tag, attrs) => `<${tag}${attrs}/>`);
}

// En modo test evita el diálogo nativo (bloquearía la suite esperando un
// clic que nunca llega) y escribe directo a un archivo temporal.
async function resolveSavePath(defaultName, filters) {
  if (ctx.isTestMode) {
    return path.join(os.tmpdir(), `mk-test-export-${Date.now()}-${defaultName}`);
  }
  const result = await dialog.showSaveDialog(ctx.mainWindow, { defaultPath: defaultName, filters });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
}

const EPUB_CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const IMAGE_MEDIA_TYPES = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };

function imageMediaType(ext) {
  return IMAGE_MEDIA_TYPES[(ext || '').toLowerCase()] || 'application/octet-stream';
}

// Arma un .epub a partir de una lista de capítulos ya renderizados a HTML
// (uno solo para "Exportar a EPUB", varios para "Exportar carpeta a EPUB
// (libro)", ver exportdoc.js). Portada e imágenes son opcionales: sin ellas
// queda igual que el export de un capítulo de antes, solo que ahora también
// soporta más de uno.
handle('export:epub', async (event, { chapters, images, coverPath, title, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'documento.epub', [{ name: 'EPUB', extensions: ['epub'] }]);
  if (!targetPath) return null;

  const safeTitle = (title || 'Documento').replace(/[<>&]/g, '');
  const uid = 'urn:uuid:' + crypto.randomUUID();

  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.folder('META-INF').file('container.xml', EPUB_CONTAINER_XML);
  const oebps = zip.folder('OEBPS');
  const imagesFolder = oebps.folder('images');

  const manifestItems = [];
  const spineItems = [];
  const navPoints = [];
  let playOrder = 1;
  let coverId = null;

  if (coverPath && guard.check(coverPath, 'export:epub')) {
    try {
      const ext = (coverPath.split('.').pop() || 'jpg').toLowerCase().replace('jpeg', 'jpg');
      const coverFilename = `cover.${ext}`;
      imagesFolder.file(coverFilename, fs.readFileSync(coverPath));
      coverId = 'cover-image';
      manifestItems.push(`<item id="${coverId}" href="images/${coverFilename}" media-type="${imageMediaType(ext)}"/>`);
      oebps.file('cover.xhtml', `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/><title>Portada</title></head>
<body style="text-align:center;margin:0;padding:0;"><img src="images/${coverFilename}" style="max-width:100%;height:auto;"/></body></html>`);
      manifestItems.push('<item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>');
      spineItems.push('<itemref idref="cover-page"/>');
      navPoints.push(`<navPoint id="cover-page" playOrder="${playOrder++}"><navLabel><text>Portada</text></navLabel><content src="cover.xhtml"/></navPoint>`);
    } catch {
      // Portada ilegible: seguimos sin ella en vez de abortar todo el export.
    }
  }

  (images || []).forEach((img, i) => {
    if (!guard.check(img.path, 'export:epub')) return;
    try {
      imagesFolder.file(img.filename, fs.readFileSync(img.path));
      const ext = (img.filename.split('.').pop() || 'png').toLowerCase();
      manifestItems.push(`<item id="image-content-${i}" href="images/${img.filename}" media-type="${imageMediaType(ext)}"/>`);
    } catch {
      // Imagen puntual no encontrada/ilegible: ese capítulo queda con una
      // imagen rota, no aborta el resto del libro.
    }
  });

  (chapters || []).forEach((ch, i) => {
    const safeChTitle = (ch.title || `Capítulo ${i + 1}`).replace(/[<>&]/g, '');
    const id = `chapter${i + 1}`;
    const filename = `${id}.xhtml`;
    oebps.file(filename, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><meta charset="utf-8" /><title>${safeChTitle}</title></head>
<body>
${toXhtmlVoidElements(ch.html)}
</body>
</html>`);
    manifestItems.push(`<item id="${id}" href="${filename}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${id}"/>`);
    navPoints.push(`<navPoint id="${id}" playOrder="${playOrder++}"><navLabel><text>${safeChTitle}</text></navLabel><content src="${filename}"/></navPoint>`);
  });

  const metaCover = coverId ? `\n    <meta name="cover" content="${coverId}"/>` : '';
  oebps.file('content.opf', `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${safeTitle}</dc:title>
    <dc:language>es</dc:language>
    <dc:identifier id="BookId">${uid}</dc:identifier>${metaCover}
  </metadata>
  <manifest>
    ${manifestItems.join('\n    ')}
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
  </manifest>
  <spine toc="ncx">
    ${spineItems.join('\n    ')}
  </spine>
</package>`);

  oebps.file('toc.ncx', `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uid}"/></head>
  <docTitle><text>${safeTitle}</text></docTitle>
  <navMap>
    ${navPoints.join('\n    ')}
  </navMap>
</ncx>`);

  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  fs.writeFileSync(targetPath, buffer);
  return targetPath;
});

ipcMain.handle('epub:pickCover', async () => {
  if (ctx.isTestMode) return null;
  const result = await dialog.showOpenDialog(ctx.mainWindow, {
    title: 'Elegir portada (opcional)',
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return null;
  guard.grantFile(result.filePaths[0]);
  return result.filePaths[0];
});

handle('export:anki', async (event, { cards, defaultName }) => {
  const targetPath = await resolveSavePath(defaultName || 'tarjetas.txt', [{ name: 'Texto (importable en Anki)', extensions: ['txt'] }]);
  if (!targetPath) return null;
  // Formato de importación simple de Anki: una tarjeta por línea, campos
  // separados por tabulador (Frente\tDorso). Ver Archivo > Importar en Anki.
  const lines = cards.map(({ front, back }) =>
    `${front.replace(/\t/g, ' ')}\t${back.replace(/\t/g, ' ').replace(/\n/g, '<br>')}`
  );
  fs.writeFileSync(targetPath, lines.join('\n'), 'utf-8');
  return targetPath;
});

// Resaltado de bloques de código del preview (ver preview.js): antes lo hacía
// el preload, que con sandbox no puede cargar highlight.js. Se carga recién
// en el primer uso. Tope por lote para que un documento enorme no trabe.
let hljs = null;
const HIGHLIGHT_MAX_CHARS = 2 * 1024 * 1024;

ipcMain.handle('highlight:batch', (event, blocks) => {
  if (!Array.isArray(blocks)) return [];
  if (!hljs) hljs = require('highlight.js/lib/common');
  let budget = HIGHLIGHT_MAX_CHARS;
  return blocks.map((b) => {
    const code = b && typeof b.code === 'string' ? b.code : '';
    budget -= code.length;
    if (budget < 0) return null;
    try {
      const lang = b.lang && hljs.getLanguage(b.lang) ? b.lang : null;
      return (lang ? hljs.highlight(code, { language: lang }) : hljs.highlightAuto(code)).value;
    } catch {
      return null;
    }
  });
});
