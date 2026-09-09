(function () {
'use strict';

function todayFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.md`;
}

async function openDailyNote() {
  const root = window.mdState.rootFolder;
  if (!root) {
    alert('Abrí una carpeta primero para poder usar la nota diaria.');
    return;
  }

  const dir = window.mdEditor.joinPath(root, 'Diario');
  await window.mdEditor.createFolder(root, 'Diario'); // no-op si ya existe

  const name = todayFileName();
  const target = window.mdEditor.joinPath(dir, name);
  const existing = await window.mdEditor.readFile(target);

  if (existing === null) {
    const created = await window.mdEditor.createFile(dir, name);
    if (created.error) {
      alert(created.error);
      return;
    }
    const fecha = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    await window.mdEditor.saveFile(`# ${fecha}\n\n`, target, false);
  }

  if (window.mdSidebar) await window.mdSidebar.refreshTree();
  await window.openFileAtPath(target);
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    openDailyNote();
  }
});

window.mdDailyNote = { open: openDailyNote };

})();
