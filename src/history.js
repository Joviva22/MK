(function () {
'use strict';

const overlay = document.getElementById('history-panel');
const list = document.getElementById('history-list');

function renderEmpty(text) {
  list.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'command-palette-empty';
  empty.textContent = text;
  list.appendChild(empty);
}

async function open() {
  overlay.hidden = false;
  const filePath = window.mdState.currentFilePath;
  if (!filePath) {
    renderEmpty('Guardá este archivo primero para tener versiones anteriores.');
    return;
  }
  renderEmpty('Cargando...');
  const backups = await window.mdEditor.listBackups(filePath);
  if (overlay.hidden) return; // se cerró mientras cargaba
  list.innerHTML = '';
  if (!backups.length) {
    renderEmpty('Sin versiones anteriores guardadas todavía (se crean automáticamente al guardar).');
    return;
  }
  backups.forEach((b) => {
    const item = document.createElement('div');
    item.className = 'command-palette-item';
    item.textContent = new Date(b.mtime).toLocaleString();
    item.addEventListener('mousedown', async (e) => {
      e.preventDefault();
      if (!confirm('¿Reemplazar el contenido actual del editor con esta versión? Podés deshacer con Ctrl+Z si te arrepentís.')) return;
      const content = await window.mdEditor.readBackup(b.path);
      if (content !== null) window.mdCodeMirror.setValue(content);
      close();
    });
    list.appendChild(item);
  });
}

function close() {
  overlay.hidden = true;
}

overlay.addEventListener('mousedown', (e) => {
  if (e.target === overlay) close();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !overlay.hidden) close();
});

window.mdHistory = { open, close };

})();
