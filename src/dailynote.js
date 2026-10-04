(function () {
'use strict';

// Nota diaria (Ctrl+Shift+D). Configurable en Ajustes:
// - carpeta (por defecto "Diario"), relativa a la carpeta abierta;
// - formato del nombre (por defecto "AAAA-MM-DD"): AAAA/YYYY, AA/YY, MM, DD
//   y también "/" para repartir en subcarpetas ("AAAA/MM/AAAA-MM-DD");
// - plantilla opcional: una nota de la carpeta cuyo texto se copia al crear
//   la nota ({{fecha}} y {{titulo}} se reemplazan por la fecha larga).

const DEFAULTS = { folder: 'Diario', format: 'AAAA-MM-DD', template: '' };
let settings = { ...DEFAULTS };

const pad = (n) => String(n).padStart(2, '0');

function formatName(format, d) {
  return format.replace(/AAAA|YYYY|AA|YY|MM|DD/g, (tok) => {
    if (tok === 'AAAA' || tok === 'YYYY') return String(d.getFullYear());
    if (tok === 'AA' || tok === 'YY') return String(d.getFullYear()).slice(-2);
    if (tok === 'MM') return pad(d.getMonth() + 1);
    return pad(d.getDate());
  });
}

// "a/b/c" -> ['a','b','c'] o null si hay algo raro (.., vacíos, caracteres
// que no valen en un nombre de archivo en Windows).
function splitSafe(rel) {
  const parts = String(rel || '').split(/[\\/]+/).map((s) => s.trim()).filter(Boolean);
  if (parts.some((p) => p === '.' || p === '..' || /[<>:"|?*]/.test(p))) return null;
  return parts;
}

// Ruta relativa (segmentos) de la nota de la fecha d con la configuración
// actual. Devuelve { dirs, name } o { error }.
function pathFor(d, conf) {
  const c = conf || settings;
  const dirs = splitSafe(c.folder);
  const nameParts = splitSafe(formatName(c.format || DEFAULTS.format, d || new Date()));
  if (!dirs || !nameParts || !nameParts.length) return { error: 'La carpeta o el formato de la nota diaria no son válidos (revisá Ajustes).' };
  let name = nameParts.pop();
  if (!/\.(md|markdown)$/i.test(name)) name += '.md';
  return { dirs: dirs.concat(nameParts), name };
}

async function ensureDirs(root, dirs) {
  let dir = root;
  for (const seg of dirs) {
    await window.mdEditor.createFolder(dir, seg); // "ya existe" no importa
    dir = window.mdEditor.joinPath(dir, seg);
  }
  return dir;
}

async function initialContent(root, d) {
  const fecha = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const tplParts = splitSafe(settings.template);
  if (tplParts && tplParts.length) {
    const tpl = await window.mdEditor.readFile(window.mdEditor.joinPath(root, ...tplParts));
    if (tpl && !tpl.binary && typeof tpl.content === 'string') {
      return tpl.content.split('{{fecha}}').join(fecha).split('{{titulo}}').join(fecha);
    }
  }
  return `# ${fecha}\n\n`;
}

async function openDailyNote(date) {
  const root = window.mdState.rootFolder;
  if (!root) {
    alert('Abrí una carpeta primero para poder usar la nota diaria.');
    return;
  }
  const d = date instanceof Date ? date : new Date();
  const rel = pathFor(d);
  if (rel.error) {
    alert(rel.error);
    return;
  }

  const dir = await ensureDirs(root, rel.dirs);
  const target = window.mdEditor.joinPath(dir, rel.name);
  const existing = await window.mdEditor.readFile(target);

  if (existing === null) {
    const created = await window.mdEditor.createFile(dir, rel.name);
    if (created.error) {
      alert(created.error);
      return;
    }
    await window.mdEditor.saveFile(await initialContent(root, d), target, false);
  }

  if (window.mdSidebar) await window.mdSidebar.refreshTree();
  await window.openFileAtPath(target);
}

// ---- Ajustes ----

const folderInput = document.getElementById('dailynote-folder');
const formatInput = document.getElementById('dailynote-format');
const templateInput = document.getElementById('dailynote-template');
const exampleEl = document.getElementById('dailynote-example');

function showExample() {
  if (!exampleEl) return;
  const rel = pathFor(new Date(), {
    folder: folderInput.value,
    format: formatInput.value.trim() || DEFAULTS.format
  });
  exampleEl.textContent = rel.error ? '⚠ ' + rel.error : 'Hoy: ' + rel.dirs.concat(rel.name).join('/');
  exampleEl.classList.toggle('dailynote-example-error', !!rel.error);
}

async function saveSettings() {
  settings = {
    folder: folderInput.value.trim(),
    format: formatInput.value.trim() || DEFAULTS.format,
    template: templateInput.value.trim()
  };
  showExample();
  await window.mdEditor.setConfig({ dailyNoteFolder: settings.folder, dailyNoteFormat: settings.format, dailyNoteTemplate: settings.template });
}

if (folderInput) {
  [folderInput, formatInput, templateInput].forEach((input) => {
    input.addEventListener('input', showExample);
    input.addEventListener('change', saveSettings);
  });
  (async () => {
    const config = await window.mdEditor.getConfig();
    settings = {
      folder: config.dailyNoteFolder != null ? config.dailyNoteFolder : DEFAULTS.folder,
      format: config.dailyNoteFormat || DEFAULTS.format,
      template: config.dailyNoteTemplate || ''
    };
    folderInput.value = settings.folder;
    formatInput.value = settings.format;
    templateInput.value = settings.template;
    showExample();
  })();
}

document.addEventListener('keydown', (e) => {
  if (window.mdShortcuts) return;
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
    e.preventDefault();
    openDailyNote();
  }
});

window.mdDailyNote = {
  open: openDailyNote,
  pathFor,
  formatName,
  getSettings: () => ({ ...settings }),
  setSettings: (s) => { settings = { ...DEFAULTS, ...s }; }
};

})();
