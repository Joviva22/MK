(function () {
'use strict';

const diffPanel = document.getElementById('diff-panel');

// Myers diff real (paquete "diff", el mismo algoritmo que usa git) en vez
// del LCS O(n·m) escrito a mano de antes — escala mejor con archivos largos.
function diffLines(oldText, newText) {
  const parts = Diff.diffLines(oldText, newText);
  const result = [];
  parts.forEach((part) => {
    const type = part.added ? 'add' : part.removed ? 'del' : 'ctx';
    const lines = part.value.split('\n');
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    lines.forEach((text) => result.push({ type, text }));
  });
  return result;
}

function renderDiffPanel(diff) {
  diffPanel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'toc-title';
  header.textContent = 'CAMBIOS SIN GUARDAR';
  const closeBtn = document.createElement('span');
  closeBtn.className = 'tab-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => { diffPanel.hidden = true; });
  header.appendChild(closeBtn);
  diffPanel.appendChild(header);

  const body = document.createElement('div');
  diff.forEach((d) => {
    const line = document.createElement('div');
    line.className = `diff-line diff-${d.type}`;
    const prefix = d.type === 'add' ? '+ ' : d.type === 'del' ? '- ' : '  ';
    line.textContent = prefix + d.text;
    body.appendChild(line);
  });
  diffPanel.appendChild(body);
  diffPanel.hidden = false;
}

document.getElementById('btn-diff').addEventListener('click', async () => {
  const info = window.mdTabs.getActiveTabInfo();
  if (!info || !info.filePath) {
    alert('Este documento no tiene una versión guardada en disco con la que compararlo.');
    return;
  }
  const onDisk = await window.mdEditor.readFile(info.filePath);
  if (onDisk === null) {
    alert('No se pudo leer el archivo original.');
    return;
  }
  if (onDisk === info.content) {
    alert('No hay cambios sin guardar.');
    return;
  }
  renderDiffPanel(diffLines(onDisk, info.content));
});

})();
