(function () {
'use strict';

// Abrir un .docx: no es texto plano (es un .zip con XML adentro), así que
// se convierte a Markdown antes de mostrarlo — mammoth.js lee el .docx y lo
// pasa a HTML semántico, turndown convierte ese HTML a Markdown. Conversión
// de un solo sentido: se abre como pestaña nueva sin ruta ("Guardar" pide
// "Guardar como", nunca pisa el .docx original) — ver MANUAL.md para el
// detalle de qué formato sobrevive la conversión y qué no.

const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.use(turndownPluginGfm.gfm); // tablas, listas de tareas y tachado -> sintaxis GFM real, no texto plano

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function openAsMarkdown(filePath) {
  const base64 = await window.mdEditor.docxReadBytes(filePath);
  if (!base64) {
    alert('No se pudo leer el archivo .docx.');
    return;
  }
  let html;
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer: base64ToArrayBuffer(base64) });
    html = result.value;
  } catch (e) {
    alert('Ese archivo no parece ser un .docx válido.');
    return;
  }
  const markdown = turndownService.turndown(html);
  window.mdTabs.newTab(markdown);
}

window.mdDocxImport = { openAsMarkdown };

})();
