(function () {
'use strict';

// Exportar / importar todo (Ajustes → Sistema y paleta). La lógica y qué
// entra en el respaldo: backupbundle.js / ipc-backup.js.

const desc = document.getElementById('backup-desc');
const exportBtn = document.getElementById('backup-export');
const importBtn = document.getElementById('backup-import');

function describe(s) {
  const parts = [`${s.tasks} tarea${s.tasks === 1 ? '' : 's'} del Home`, `${s.pets} mascota${s.pets === 1 ? '' : 's'}`, `${s.images} imagen${s.images === 1 ? '' : 'es'}`];
  return parts.join(', ');
}

function note(text) {
  if (desc) desc.textContent = text;
}

async function exportAll() {
  const r = await window.mdEditor.backupExport();
  if (r.canceled) return r;
  if (r.error) note(r.error);
  else note(`Respaldo guardado en ${r.file} (${describe(r.summary)}).`);
  return r;
}

async function importAll() {
  const picked = await window.mdEditor.backupPick();
  if (picked.canceled) return picked;
  if (picked.error) {
    note(picked.error);
    return picked;
  }
  const s = picked.summary;
  const when = s.created ? new Date(s.created).toLocaleString() : 'fecha desconocida';
  const ok = window.confirm(`Importar el respaldo del ${when}${s.appVersion ? ` (MK ${s.appVersion})` : ''}:\n${describe(s)}.\n\nReemplaza los ajustes, el Home y las mascotas de ahora (antes se guarda una copia automática en la carpeta de backups de MK). Tus notas no se tocan.\n\nMK se recarga al terminar.`);
  if (!ok) return { canceled: true };
  const r = await window.mdEditor.backupImport(picked.file);
  if (r.error) note(r.error);
  return r;
}

if (exportBtn) exportBtn.addEventListener('click', exportAll);
if (importBtn) importBtn.addEventListener('click', importAll);

window.mdBackup = { exportAll, importAll };

})();
