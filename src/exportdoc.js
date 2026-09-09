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
.katex-display { display: block; margin: 1em 0; text-align: center; }
`;

function exportBaseName() {
  const name = (window.mdState.currentFilePath || 'documento.md').split(/[\\/]/).pop();
  return name.replace(/\.[^.]+$/, '');
}

function buildStandaloneHtml() {
  const bodyHtml = document.getElementById('preview-pane').innerHTML;
  return `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>${exportBaseName()}</title>\n<style>${EXPORT_CSS}</style>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>\n`;
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
  await window.mdEditor.exportHtml(buildStandaloneHtml(), `${exportBaseName()}.html`);
});

document.getElementById('btn-export-pdf').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  if (!isPreviewExportable()) return;
  await window.mdEditor.exportPdf(buildStandaloneHtml(), `${exportBaseName()}.pdf`);
});

document.getElementById('btn-export-epub').addEventListener('click', async () => {
  document.getElementById('export-menu').hidden = true;
  if (!isPreviewExportable()) return;
  const bodyHtml = document.getElementById('preview-pane').innerHTML;
  await window.mdEditor.exportEpub(bodyHtml, exportBaseName(), `${exportBaseName()}.epub`);
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
