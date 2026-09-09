(function () {
'use strict';

const editorPaneEl = document.getElementById('editor-pane');

const DND_IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const DND_VIDEO_PDF_EXT = /\.(mp4|webm|ogv|ogg|pdf)$/i;

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

  const files = [...e.dataTransfer.files];
  if (!files.length) return;

  const activeFilePath = window.mdState.currentFilePath;
  const snippets = [];

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

    if (DND_IMAGE_EXT.test(refPath)) {
      snippets.push(`![${file.name}](${displayPath})`);
    } else if (DND_VIDEO_PDF_EXT.test(refPath)) {
      snippets.push(`![[${displayPath}]]`);
    } else {
      snippets.push(`[${file.name}](${displayPath})`);
    }
  }

  if (snippets.length) {
    window.mdCodeMirror.replaceSelection(snippets.join('\n') + '\n');
    window.mdCodeMirror.focus();
  }
});

})();
