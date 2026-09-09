(function () {
'use strict';

const diffPanel = document.getElementById('diff-panel');

// LCS clásico. O(n*m) en líneas — de sobra para notas de tamaño normal.
function diffLines(oldLines, newLines) {
  const m = oldLines.length;
  const n = newLines.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = oldLines[i] === newLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const result = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (oldLines[i] === newLines[j]) {
      result.push({ type: 'ctx', text: oldLines[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'del', text: oldLines[i] });
      i++;
    } else {
      result.push({ type: 'add', text: newLines[j] });
      j++;
    }
  }
  while (i < m) result.push({ type: 'del', text: oldLines[i++] });
  while (j < n) result.push({ type: 'add', text: newLines[j++] });
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
  renderDiffPanel(diffLines(onDisk.split('\n'), info.content.split('\n')));
});

})();
