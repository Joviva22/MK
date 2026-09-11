(function () {
'use strict';

const EXPORT_CSS = `
body { font-family: Georgia, "Times New Roman", serif; line-height: 1.7; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; background: #fff; }
h1, h2, h3 { border-bottom: 1px solid #d8dee8; padding-bottom: 6px; }
h1 { font-size: 2.2rem; } h2 { font-size: 1.7rem; } h3 { font-size: 1.3rem; }
img, video { max-width: 100%; border-radius: 8px; }
pre { background: #eef1f5; padding: 16px; border-radius: 10px; overflow-x: auto; }
code { background: #eef1f5; padding: 2px 4px; border-radius: 3px; font-family: monospace; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #2563eb; margin-left: 0; padding-left: 12px; color: #555; }
table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
th, td { padding: 8px 12px; border: 1px solid #d8dee8; }
.callout { border-left: 4px solid #2563eb; background: #f5f7fa; border-radius: 8px; padding: 12px 16px; margin: 1rem 0; }
.callout-title { font-weight: 600; margin: 0 0 4px; }
`;

function exportBaseName() {
  const name = (window.mdState.currentFilePath || 'documento.md').split(/[\\/]/).pop();
  return name.replace(/\.[^.]+$/, '');
}

// El CSS de KaTeX (con sus fuentes embebidas) no cambia entre exports, así
// que se pide una sola vez al proceso principal y se reusa.
let katexCssPromise = null;
function getKatexCss() {
  if (!katexCssPromise) katexCssPromise = window.mdEditor.getKatexCss();
  return katexCssPromise;
}

async function buildStandaloneHtml() {
  const bodyHtml = document.getElementById('preview-pane').innerHTML;
  const hasMath = /class="katex/.test(bodyHtml);
  const katexCss = hasMath ? await getKatexCss() : '';
  return `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>${exportBaseName()}</title>\n<style>${EXPORT_CSS}${katexCss}</style>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`;
}

// Las imágenes locales del preview quedan como src="md-local://file..."
// (protocolo interno de la app, solo válido dentro de una ventana de MK) —
// un lector de EPUB real no las mostraría. Se extraen acá y se agregan como
// archivos de verdad dentro del .epub, referenciados por ruta relativa
// (ver export:epub en main.js). imageMap es compartido entre capítulos para
// no duplicar una misma imagen usada en más de uno.
function embedLocalImages(html, imageMap) {
  return html.replace(/\ssrc="md-local:\/\/file([^"]+)"/g, (match, encodedPath) => {
    const absolutePath = decodeURI(encodedPath);
    let info = imageMap.get(absolutePath);
    if (!info) {
      const ext = (absolutePath.split('.').pop() || 'png').toLowerCase().replace('jpeg', 'jpg');
      info = { filename: `img${imageMap.size}.${ext}` };
      imageMap.set(absolutePath, info);
    }
    return ` src="images/${info.filename}"`;
  });
}

function imageMapToList(imageMap) {
  return Array.from(imageMap, ([path, info]) => ({ path, filename: info.filename }));
}

function isPreviewExportable() {
  if (document.getElementById('preview-pane').classList.contains('pdf-mode')) {
    alert('No se puede exportar una vista de PDF, cambiá a un documento Markdown/LaTeX primero.');
    return false;
  }
  return true;
}

window.initDropdown('btn-export', 'export-menu');

document.getElementById('btn-export-html').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  if (!isPreviewExportable()) return;
  await window.mdEditor.exportHtml(await buildStandaloneHtml(), `${exportBaseName()}.html`);
});

document.getElementById('btn-export-pdf').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  if (!isPreviewExportable()) return;
  await window.mdEditor.exportPdf(await buildStandaloneHtml(), `${exportBaseName()}.pdf`);
});

document.getElementById('btn-export-epub').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  if (!isPreviewExportable()) return;
  const imageMap = new Map();
  const html = embedLocalImages(document.getElementById('preview-pane').innerHTML, imageMap);
  const payload = { chapters: [{ title: exportBaseName(), html }], images: imageMapToList(imageMap), title: exportBaseName() };
  await window.mdEditor.exportEpub(payload, `${exportBaseName()}.epub`);
});

// Un capítulo por cada archivo Markdown de la carpeta abierta, en orden
// alfabético de ruta. El título de cada capítulo es su primer "# Encabezado"
// si tiene uno, si no el nombre de archivo. Portada opcional vía diálogo
// nativo (Cancelar = sin portada, no es un error).
function chapterTitleFrom(markdownText, filePath) {
  const h1 = markdownText.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '');
}

document.getElementById('btn-export-epub-book').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  const root = window.mdState.rootFolder;
  if (!root) {
    alert('Abrí una carpeta primero: cada archivo Markdown de la carpeta se vuelve un capítulo del libro.');
    return;
  }
  const allFiles = await window.mdEditor.kanbanReadFolderFiles(root);
  const mdFiles = allFiles
    .filter((f) => /\.(md|markdown)$/i.test(f.path))
    .sort((a, b) => a.path.localeCompare(b.path));
  if (!mdFiles.length) {
    alert('No se encontraron archivos Markdown en la carpeta abierta.');
    return;
  }

  const imageMap = new Map();
  const chapters = mdFiles.map((f) => ({
    title: chapterTitleFrom(f.content, f.path),
    html: embedLocalImages(window.mdRenderMarkdownForExport(f.content, f.path, root), imageMap)
  }));

  const bookTitle = root.split(/[\\/]/).pop() || 'Libro';
  const coverPath = await window.mdEditor.pickEpubCover();
  const payload = { chapters, images: imageMapToList(imageMap), coverPath, title: bookTitle };
  const savedPath = await window.mdEditor.exportEpub(payload, `${bookTitle}.epub`);
  if (savedPath) alert(`Libro exportado (${chapters.length} capítulo(s)) a: ${savedPath}`);
});

// "## Encabezado" -> frente de la tarjeta; el texto hasta el próximo "##" -> dorso.
function parseAnkiCards(markdownText) {
  const lines = markdownText.split('\n');
  const cards = [];
  let current = null;
  lines.forEach((line) => {
    const match = line.match(/^##\s+(.*)/);
    if (match) {
      if (current && current.back.trim()) cards.push(current);
      current = { front: match[1].trim(), back: '' };
    } else if (current) {
      current.back += `${line}\n`;
    }
  });
  if (current && current.back.trim()) cards.push(current);
  return cards;
}

document.getElementById('btn-export-anki').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  const cards = parseAnkiCards(window.mdCodeMirror.getValue());
  if (!cards.length) {
    alert('No se encontraron tarjetas: usá encabezados "## Pregunta" seguidos del texto de la respuesta.');
    return;
  }
  const saved = await window.mdEditor.exportAnki(cards, `${exportBaseName()}.txt`);
  if (saved) {
    alert(`${cards.length} tarjeta(s) exportadas. En Anki: Archivo → Importar → elegí este .txt (separador: tabulador).`);
  }
});

})();
