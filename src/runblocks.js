(function () {
'use strict';

// Botones de script en notas: un bloque ```run``` con uno o varios comandos
// se muestra como una tarjeta con ▶ Ejecutar, que los corre en la terminal
// integrada, en la carpeta de la nota.
//
//   ```run
//   título: Respaldo de mis notas     (opcional)
//   tar czf ~/respaldo.tgz .
//   ```
//
// Seguridad: un .md descargado podría traer un comando dañino. Antes de
// ejecutar se muestra el comando EXACTO y se pide confirmación; se deja de
// preguntar solo para ese mismo texto en esa misma nota (si cambia una letra,
// vuelve a preguntar). Lo confiado se guarda en config.runTrust.

function parse(text) {
  const lines = text.split('\n');
  let title = '';
  if (lines.length && /^\s*t[ií]tulo\s*:/i.test(lines[0])) title = lines.shift().replace(/^\s*t[ií]tulo\s*:\s*/i, '').trim();
  const commands = lines.map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() && !/^\s*#/.test(l));
  return { title, commands };
}

// Hash corto (FNV-1a) del texto: identifica "este comando exacto".
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

async function isTrusted(key) {
  const config = await window.mdEditor.getConfig();
  return !!(config.runTrust && config.runTrust[key]);
}

async function trust(key) {
  const config = await window.mdEditor.getConfig();
  const runTrust = { ...(config.runTrust || {}), [key]: true };
  // Tope: los más viejos se olvidan.
  const keys = Object.keys(runTrust);
  if (keys.length > 500) keys.slice(0, keys.length - 500).forEach((k) => delete runTrust[k]);
  await window.mdEditor.setConfig({ runTrust });
}

async function run(commands, notePath) {
  if (!window.mdTerminal) return;
  const dir = notePath ? window.mdEditor.dirName(notePath) : window.mdState.rootFolder;
  const script = commands.join('\n');
  const key = `${notePath || '(sin guardar)'}|${hash(script)}`;
  if (!(await isTrusted(key))) {
    const ok = confirm(`Esta nota quiere ejecutar en la terminal${dir ? ` (en ${dir})` : ''}:\n\n${script}\n\nEjecutalo solo si sabés qué hace (un comando puede borrar o modificar archivos).\n¿Ejecutar? No se volverá a preguntar por este mismo comando en esta nota.`);
    if (!ok) return;
    await trust(key);
  }
  const prefix = dir ? `cd ${window.mdTerminal.shellQuote(dir)} && ` : '';
  // Varias líneas: se ejecutan en orden, cortando si una falla.
  await window.mdTerminal.runCommand(prefix + commands.join(' && '));
}

function render(host, text) {
  const { title, commands } = parse(text || '');
  host.innerHTML = '';
  host.classList.add('md-run');
  host.addEventListener('mousedown', (e) => e.stopPropagation()); // Live Preview
  const head = document.createElement('div');
  head.className = 'md-run-head';
  const label = document.createElement('span');
  label.className = 'md-run-title';
  label.textContent = '⌨ ' + (title || 'Script');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'toolbar-button md-run-btn';
  btn.textContent = '▶ Ejecutar';
  head.append(label, btn);
  const pre = document.createElement('pre');
  pre.className = 'md-run-code';
  pre.textContent = commands.join('\n') || '(sin comandos)';
  host.append(head, pre);
  const off = window.mdModules && !window.mdModules.isOn('terminal');
  if (!commands.length || off || !window.mdTerminal) {
    btn.disabled = true;
    btn.title = off ? 'La terminal está apagada (Ajustes → Módulos)' : 'No hay comandos';
    return;
  }
  btn.title = 'Ejecutar en la terminal integrada, en la carpeta de esta nota';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    run(commands, window.mdState.currentFilePath);
  });
}

window.mdRunBlocks = { render, parse, run, hash };

})();
