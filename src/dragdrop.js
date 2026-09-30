(function () {
'use strict';

const editorPaneEl = document.getElementById('editor-pane');

// Fotos → ![nombre](ruta); video, audio y PDF → ![[ruta]] (ver media.js).

// Igual que DRAG_MIME en sidebar.js: al soltar una fila del árbol (que ya
// está dentro del proyecto), se referencia in-situ en vez de copiarla a
// assets/ (eso solo tiene sentido para archivos que vienen de afuera).
const SIDEBAR_DRAG_MIME = 'application/x-mk-node';

function snippetFor(name, refPath) {
  const kind = window.mdMedia.kindOf(refPath);
  if (kind === 'image') return `![${name}](${refPath})`;
  if (kind === 'video' || kind === 'audio' || /\.pdf$/i.test(refPath)) return `![[${refPath}]]`;
  return `[${name}](${refPath})`;
}

// Imagen sin archivo de origen (pegada con Ctrl+V o arrastrada desde el
// navegador): se guardan los bytes en assets/ junto a la nota. Devuelve el
// fragmento Markdown o null.
const IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };

function pastedName() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `pegado-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function saveImageBlob(blob, name) {
  const ext = IMAGE_EXT[blob.type];
  const activeFilePath = window.mdState.currentFilePath;
  if (!ext) return null;
  if (!activeFilePath) {
    window.mdErrorToast.show({ message: 'Guardá la nota primero para pegar imágenes.', detail: 'La imagen se guarda en assets/, junto a la nota.' });
    return null;
  }
  const baseName = name && !/^image\.\w+$/i.test(name) ? name.replace(/\.[^.]+$/, '') : pastedName();
  const targetDir = window.mdEditor.joinPath(window.mdEditor.dirName(activeFilePath), 'assets');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const saved = await window.mdEditor.saveImageAsset(targetDir, baseName, ext, bytes);
  if (!saved) return null;
  const rel = window.mdEditor.relativePath(activeFilePath, saved);
  return `![${baseName}](${rel.includes(' ') ? `<${rel}>` : rel})`;
}

// Ctrl+V con una imagen (captura de pantalla, "Copiar imagen" del navegador).
// Si el portapapeles trae texto, se pega el texto como siempre.
window.mdCodeMirror.on('paste', async (cm, e) => {
  const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
  const image = items.find((it) => it.kind === 'file' && IMAGE_EXT[it.type]);
  if (!image || items.some((it) => it.type === 'text/plain')) return;
  e.preventDefault();
  const snippet = await saveImageBlob(image.getAsFile(), null);
  if (snippet) cm.replaceSelection(snippet);
});

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
      if (!srcPath) {
        // Imagen arrastrada desde el navegador: no hay archivo, solo bytes.
        const snippet = await saveImageBlob(file, file.name);
        if (snippet) snippets.push(snippet);
        continue;
      }

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

window.mdDragDrop = { saveImageBlob };

})();
