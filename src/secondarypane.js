(function () {
'use strict';

// Panel secundario de solo lectura: para tener un md/pdf/docx de referencia
// al lado mientras editás el principal, sin la complejidad de un segundo
// editor de verdad (MK tiene una sola instancia de CodeMirror — dos
// editores simultáneos habría que duplicar buena parte de tabs.js/
// preview.js, un proyecto aparte, ver OBJETIVOS.md).
//
// En vez de eso: clic en el contenido del panel secundario "promueve" ese
// archivo a principal (se abre normal — pestaña editable si es md/tex/txt,
// se convierte a Markdown si es .docx, o al preview si es PDF/imagen) y lo
// que estaba de principal pasa a mostrarse acá, de solo lectura. Un solo
// editor de verdad en todo momento, pero se "cambia" cuál es el activo con
// un clic.

const containerEl = document.querySelector('.container');
const paneEl = document.getElementById('secondary-pane');
const resizerEl = document.getElementById('resizer-secondary');
const titleEl = document.getElementById('secondary-pane-title');
const viewModeBtn = document.getElementById('secondary-pane-viewmode');
const bodyEl = document.getElementById('secondary-pane-body');
const closeBtn = document.getElementById('secondary-pane-close');

const MD_EXT = /\.(md|markdown|txt|tex)$/i;
const PDF_EXT = /\.pdf$/i;
const DOCX_EXT = /\.docx$/i;

let currentPath = null;
// 'read' (renderizado) | 'code' (fuente cruda, sin renderizar) — solo
// tiene sentido para archivos de texto (md/txt/tex), el botón se oculta
// para PDF/imagen/docx. Es el "modo" propio del panel secundario: el
// principal ya elige código/lectura con el botón de enfoque existente,
// esto le da el mismo eje al secundario.
let viewMode = 'read';

function updateViewModeBtn(filePath) {
  const isText = MD_EXT.test(filePath);
  viewModeBtn.hidden = !isText;
  if (!isText) return;
  viewModeBtn.textContent = viewMode === 'code' ? '👁 Vista' : '🔤 Código';
  viewModeBtn.title = viewMode === 'code' ? 'Ver renderizado' : 'Ver fuente sin renderizar';
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function renderContent(filePath) {
  bodyEl.innerHTML = '';
  updateViewModeBtn(filePath);

  if (PDF_EXT.test(filePath)) {
    const embed = document.createElement('embed');
    embed.src = window.mdEditor.toLocalUrl(filePath);
    embed.type = 'application/pdf';
    embed.className = 'secondary-pane-pdf';
    bodyEl.appendChild(embed);
    return;
  }

  if (window.mdMedia.kindOf(filePath)) {
    bodyEl.appendChild(window.mdMedia.createViewer(filePath, { compact: true }));
    return;
  }

  if (DOCX_EXT.test(filePath)) {
    const base64 = await window.mdEditor.docxReadBytes(filePath);
    if (!base64) {
      bodyEl.textContent = 'No se pudo leer el archivo.';
      return;
    }
    try {
      await window.mdLoadLib('mammoth');
      const result = await mammoth.convertToHtml({ arrayBuffer: base64ToArrayBuffer(base64) });
      bodyEl.innerHTML = DOMPurify.sanitize(result.value);
    } catch {
      bodyEl.textContent = 'Ese archivo no parece ser un .docx válido.';
    }
    return;
  }

  if (MD_EXT.test(filePath)) {
    const result = await window.mdEditor.readFile(filePath);
    if (!result || result.binary) {
      bodyEl.textContent = 'No se pudo leer el archivo.';
      return;
    }
    if (viewMode === 'code') {
      const pre = document.createElement('pre');
      pre.className = 'secondary-pane-code';
      pre.textContent = result.content;
      bodyEl.appendChild(pre);
    } else {
      bodyEl.innerHTML = DOMPurify.sanitize(marked.parse(result.content));
    }
    return;
  }

  bodyEl.textContent = 'No se puede previsualizar este tipo de archivo en el panel secundario.';
}

async function open(filePath) {
  if (window.mdStudyWorkspace?.isOpen() && !window.mdStudyWorkspace.close()) return false;
  currentPath = filePath;
  viewMode = 'read';
  titleEl.textContent = filePath.split(/[\\/]/).pop();
  containerEl.classList.add('has-secondary');
  paneEl.hidden = false;
  resizerEl.hidden = false;
  await renderContent(filePath);
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
}

function close() {
  if (window.mdStudyWorkspace?.isOpen()) return window.mdStudyWorkspace.close();
  currentPath = null;
  containerEl.classList.remove('has-secondary');
  paneEl.hidden = true;
  resizerEl.hidden = true;
  if (window.mdCodeMirror) window.mdCodeMirror.refresh();
}

// Un <embed> de PDF es en la práctica un documento aparte (plugin nativo):
// un clic ahí adentro no burbujea al DOM de la página, así que bodyEl solo
// alcanza para promover md/imagen/docx. El header (fuera del embed, texto
// "clic para editar acá") es el que garantiza que SIEMPRE se pueda
// promover sin importar el tipo de archivo.
async function promote() {
  if (window.mdStudyWorkspace?.isOpen()) return;
  if (!currentPath) return;
  const promoted = currentPath;
  const previousPrimary = window.mdState.currentFilePath;

  if (DOCX_EXT.test(promoted)) {
    await window.mdDocxImport.openAsMarkdown(promoted);
  } else if (PDF_EXT.test(promoted)) {
    window.showPdfPreview(promoted);
  } else if (window.mdMedia.kindOf(promoted)) {
    window.showMediaPreview(promoted);
  } else {
    await window.openFileAtPath(promoted);
  }

  // Lo que era principal pasa a mostrarse acá de solo lectura — salvo que
  // no tuviera ruta en disco (pestaña "Sin título" sin guardar todavía),
  // ahí no hay archivo real que mostrar y el panel se cierra solo.
  if (previousPrimary && previousPrimary !== promoted) {
    await open(previousPrimary);
  } else {
    close();
  }
}

bodyEl.addEventListener('click', promote);
titleEl.addEventListener('click', promote);
closeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  close();
});
viewModeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  viewMode = viewMode === 'code' ? 'read' : 'code';
  renderContent(currentPath);
});

window.mdSecondaryPane = { open, close };

})();
