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

// mammoth envuelve SIEMPRE el texto de una celda de tabla en <p> (hasta la
// más simple: <td><p>1</p></td>) — y la regla de párrafo de turndown pone
// "\n\n" antes y después sin importar dónde esté. Adentro de una celda eso
// arma una fila de tabla que ocupa varias líneas físicas: sintaxis de
// tabla Markdown inválida (se ve "rara" — pipes sueltos, no se renderiza).
// Estas dos reglas ganan sobre las de por defecto (turndown prioriza la
// última regla agregada) SOLO adentro de una celda: sacan el "\n\n" del
// párrafo, y un párrafo detrás de otro en la misma celda queda separado
// por un <br> literal (HTML crudo válido adentro de una celda Markdown)
// en vez de perderse sin separador ni romper la fila.
function isInsideTableCell(node) {
  for (let n = node.parentNode; n; n = n.parentNode) {
    if (n.nodeName === 'TD' || n.nodeName === 'TH') return true;
  }
  return false;
}

turndownService.addRule('paragraphInTableCell', {
  filter: (node) => node.nodeName === 'P' && isInsideTableCell(node),
  replacement: (content, node) => {
    const afterAnotherParagraph = node.previousElementSibling && node.previousElementSibling.nodeName === 'P';
    return (afterAnotherParagraph ? '<br>' : '') + content;
  }
});

turndownService.addRule('lineBreakInTableCell', {
  filter: (node) => node.nodeName === 'BR' && isInsideTableCell(node),
  replacement: () => '<br>'
});

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function htmlToMarkdown(html) {
  return turndownService.turndown(html);
}

async function openAsMarkdown(filePath) {
  const base64 = await window.mdEditor.docxReadBytes(filePath);
  if (!base64) {
    alert('No se pudo leer el archivo .docx.');
    return;
  }
  let html;
  try {
    await window.mdLoadLib('mammoth'); // 620 KB: se carga recién al abrir un .docx
    const result = await mammoth.convertToHtml({ arrayBuffer: base64ToArrayBuffer(base64) });
    html = result.value;
  } catch (e) {
    window.mdEditor.logError('docx:abrir', (e && e.stack) || String(e));
    alert('Ese archivo no parece ser un .docx válido.');
    return;
  }
  const markdown = htmlToMarkdown(html);
  window.mdTabs.newTab(markdown);
}

window.mdDocxImport = { openAsMarkdown, htmlToMarkdown };

})();
