(function () {
'use strict';

// Módulos que se pueden apagar (⚙ Ajustes → Módulos) para una interfaz más
// limpia: sus botones desaparecen, salen de la paleta de comandos y de los
// menús, y sus atajos no hacen nada. No se borra ningún dato: al volver a
// prenderlo está todo como estaba. (Las mascotas tienen su propio interruptor
// en Ajustes → Mascota.)

const MODULES = [
  { id: 'home', name: 'Home y planificador', desc: 'Calendario semanal y mensual, tareas y estadísticas (los recordatorios ya programados siguen avisando).', buttons: ['btn-home'], palette: /^Home:/, keys: [{ ctrl: true, shift: true, key: 'h' }] },
  { id: 'databases', name: 'Bases de datos', desc: 'Bases tipo Notion (las notas con bloques database se siguen viendo).', buttons: [], palette: /^Bases de datos$/ },
  { id: 'kanban', name: 'Tablero Kanban', desc: 'Tablero a partir de encabezados y listas.', buttons: [], palette: /Kanban/ },
  { id: 'graph', name: 'Grafo de notas', desc: 'Mapa de las notas enlazadas con [[wikilinks]].', buttons: [], palette: /grafo/i },
  { id: 'links', name: 'Etiquetas y backlinks', desc: 'Paneles de #etiquetas y de qué enlaza a la nota actual.', buttons: ['btn-tags', 'btn-backlinks'], palette: /etiquetas|^Backlinks/, keys: [{ ctrl: true, shift: true, key: 't' }, { ctrl: true, shift: true, key: 'b' }] },
  { id: 'terminal', name: 'Terminal e IA', desc: 'Terminal integrada, F5 para ejecutar y abrir Claude Code / Gemini / Codex.', buttons: ['btn-terminal', 'btn-run-file', 'btn-ai'], palette: /^(Terminal:|IA:|Ejecutar archivo)/, keys: [{ ctrl: true, code: 'Backquote' }, { ctrl: true, key: 'ñ' }, { key: 'F5' }, { ctrl: true, shift: true, code: 'Digit5' }] },
  { id: 'pdf', name: 'Herramientas de PDF', desc: 'Unir, separar, rotar, firmar, subrayar y escribir en PDFs (ver PDFs sigue funcionando).', buttons: ['btn-pdfpages', 'btn-pdfhighlight'], palette: /PDF:|páginas PDF/ },
  { id: 'pomodoro', name: 'Pomodoro', desc: 'Temporizador de foco y descanso.', buttons: ['btn-pomodoro'], palette: /^Pomodoro/ },
  { id: 'media', name: 'Reproductor multimedia', desc: 'Controles de play/pausa del reproductor del sistema (playerctl).', buttons: ['btn-media-prev', 'btn-media-playpause', 'btn-media-next'], palette: /^Reproductor/ }
];

let off = new Set();

function isOn(id) {
  return !off.has(id);
}

function allowsCommand(label) {
  return !MODULES.some((m) => off.has(m.id) && m.palette && m.palette.test(label));
}

function apply() {
  MODULES.forEach((m) => {
    const hidden = off.has(m.id);
    const sw = document.getElementById(`module-${m.id}`);
    if (sw) sw.checked = !hidden;
    m.buttons.forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      const target = b.closest('.dropdown') || b;
      target.toggleAttribute('data-module-off', hidden);
      // Y su fila en "Qué botones mostrar".
      const row = document.getElementById(`toolbar-vis-${id}`);
      if (row && row.parentElement) row.parentElement.toggleAttribute('data-module-off', hidden);
    });
  });
  document.body.dataset.modulesOff = Array.from(off).join(' ');
}

// Atajos de un módulo apagado: se frenan antes que nadie (captura en window).
window.addEventListener('keydown', (e) => {
  if (!off.size) return;
  const ctrl = e.ctrlKey || e.metaKey;
  const blocked = MODULES.some((m) => off.has(m.id) && (m.keys || []).some((k) =>
    !!k.ctrl === ctrl && (k.shift === undefined || !!k.shift === e.shiftKey) &&
    (k.code ? e.code === k.code : e.key.toLowerCase() === k.key.toLowerCase())));
  if (blocked) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, true);

// ---- Ajustes → Módulos ----

const list = document.getElementById('modules-list');

function renderSettings() {
  if (!list) return;
  list.innerHTML = '';
  MODULES.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'set-row';
    row.dataset.keywords = `modulo ocultar ${m.name}`;
    const text = document.createElement('div');
    text.className = 'set-text';
    const title = document.createElement('label');
    title.className = 'set-title';
    title.htmlFor = `module-${m.id}`;
    title.textContent = m.name;
    const desc = document.createElement('div');
    desc.className = 'set-desc';
    desc.textContent = m.desc;
    text.append(title, desc);
    const control = document.createElement('div');
    control.className = 'set-control';
    const sw = document.createElement('input');
    sw.type = 'checkbox';
    sw.id = `module-${m.id}`;
    sw.className = 'set-switch';
    sw.setAttribute('role', 'switch');
    sw.checked = isOn(m.id);
    sw.addEventListener('change', () => setModule(m.id, sw.checked));
    control.appendChild(sw);
    row.append(text, control);
    list.appendChild(row);
  });
}

async function setModule(id, on) {
  if (on) off.delete(id); else off.add(id);
  apply();
  await window.mdEditor.setConfig({ disabledModules: Array.from(off) });
}

renderSettings();
(async () => {
  const config = await window.mdEditor.getConfig();
  off = new Set((Array.isArray(config.disabledModules) ? config.disabledModules : []).filter((id) => MODULES.some((m) => m.id === id)));
  apply();
  renderSettings();
  // Los botones de "Qué botones mostrar" se arman después: reaplicar.
  setTimeout(apply, 300);
})();

// Varios de una vez (perfiles de la bienvenida, welcome.js).
async function setOff(ids) {
  off = new Set(ids.filter((id) => MODULES.some((m) => m.id === id)));
  apply();
  renderSettings();
  await window.mdEditor.setConfig({ disabledModules: Array.from(off) });
}

window.mdModules = { MODULES, isOn, allowsCommand, setModule, setOff };

})();
