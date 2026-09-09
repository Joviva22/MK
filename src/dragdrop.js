(function () {
'use strict';

const editorPaneEl = document.getElementById('editor-pane');

const DND_IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const DND_VIDEO_PDF_EXT = /\.(mp4|webm|ogv|ogg|pdf)$/i;

// Igual que DRAG_MIME en sidebar.js: al soltar una fila del árbol (que ya
// está dentro del proyecto), se referencia in-situ en vez de copiarla a
// assets/ (eso solo tiene sentido para archivos que vienen de afuera).
const SIDEBAR_DRAG_MIME = 'application/x-mk-node';

function snippetFor(name, refPath) {
  if (DND_IMAGE_EXT.test(refPath)) return `![${name}](${refPath})`;
  if (DND_VIDEO_PDF_EXT.test(refPath)) return `![[${refPath}]]`;
  return `[${name}](${refPath})`;
}

editorPaneEl.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  editorPaneEl.classList.add('drag-over');
});

editorPaneEl.addEventListener('dragleave', () => {
  editorPaneEl.classList.remove('drag-over');
});

editorPaneEl.addEventListener('drop', async (e) => {
  e.preventDefault();
  editorPaneEl.classList.remove('drag-over');

  const activeFilePath = window.mdState.currentFilePath;
  const snippets = [];

  // Fila arrastrada desde el árbol de la izquierda: ya está dentro del
  // proyecto, se referencia donde está en vez de copiarla a assets/.
  const nodeRaw = e.dataTransfer.getData(SIDEBAR_DRAG_MIME);
  if (nodeRaw) {
    const node = JSON.parse(nodeRaw);
    if (!node.esCarpeta) {
      const refPath = activeFilePath ? window.mdEditor.relativePath(activeFilePath, node.ruta) : node.ruta;
      snippets.push(snippetFor(node.nombre, refPath));
    }
  } else {
    // Archivo(s) arrastrados desde fuera de la app (explorador del sistema):
    // se copian a assets/ junto al archivo actual antes de referenciarlos.
    const files = [...e.dataTransfer.files];
    for (const file of files) {
      const srcPath = window.mdEditor.getPathForFile(file);
      if (!srcPath) continue;

      let refPath = srcPath;
      if (activeFilePath) {
        const targetDir = window.mdEditor.joinPath(window.mdEditor.dirName(activeFilePath), 'assets');
        const copied = await window.mdEditor.copyAsset(srcPath, targetDir);
        if (copied) refPath = copied;
      }

      const displayPath = activeFilePath ? window.mdEditor.relativePath(activeFilePath, refPath) : refPath;
      snippets.push(snippetFor(file.name, displayPath));
    }
  }

  if (snippets.length) {
    window.mdCodeMirror.replaceSelection(snippets.join('\n') + '\n');
    window.mdCodeMirror.focus();
  }
});

})();
