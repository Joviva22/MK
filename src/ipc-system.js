'use strict';

// IPC de programas del sistema: git (sincronizar al guardar, commits
// eligiendo archivos) y el reproductor multimedia vía playerctl.
// Se carga desde main.js (require) después de fijar userData; lo compartido
// con main.js (ventana, config, modo test) está en mainctx.js.

const { ipcMain, app, net } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { execFile } = require('child_process');
const guard = require('./pathguard');
const ctx = require('./mainctx');

// Sincronización con git al guardar (opt-in, ver settings.js): solo actúa
// si la carpeta ya es un repo git existente — nunca corre "git init" por
// cuenta propia. Nada bloqueante ni ruidoso: si no hay nada para commitear,
// no es un error.
function runGitOnce(args, cwd) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (error, stdout, stderr) => {
      resolve({ error, stdout, stderr });
    });
  });
}

// Dos comandos git a la vez (el panel refrescando `git status` mientras se
// hace `git add`) chocan en .git/index.lock y el segundo falla con "Unable
// to create ... index.lock: File exists". Es momentáneo: reintentar un poco.
async function runGit(args, cwd) {
  // Solo dentro de carpetas autorizadas (ver pathguard.js).
  if (!guard.check(cwd, 'git')) return { error: new Error('Carpeta no autorizada'), stdout: '', stderr: 'Carpeta no autorizada' };
  let result;
  for (let attempt = 0; attempt < 6; attempt++) {
    result = await runGitOnce(args, cwd);
    if (!result.error || !/index\.lock/.test(result.stderr || '')) return result;
    await new Promise((r) => setTimeout(r, 100 * (attempt + 1)));
  }
  return result;
}

// Rama actual (barra de estado). null si no es un repo.
ipcMain.handle('git:branch', async (event, root) => {
  const { error, stdout } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], root);
  if (error) return null;
  const branch = stdout.trim();
  if (branch !== 'HEAD') return branch;
  const sha = await runGit(['rev-parse', '--short', 'HEAD'], root);
  return sha.error ? null : `(${sha.stdout.trim()})`;
});

ipcMain.handle('git:isRepo', async (event, root) => {
  const { error } = await runGit(['rev-parse', '--is-inside-work-tree'], root);
  return !error;
});

ipcMain.handle('git:sync', async (event, root) => {
  const check = await runGit(['rev-parse', '--is-inside-work-tree'], root);
  if (check.error) return { ok: false, reason: 'not-a-repo' };
  await runGit(['add', '-A'], root);
  const commit = await runGit(['commit', '-m', 'MK: guardado automático'], root);
  if (commit.error) return { ok: false, reason: 'nothing-to-commit' };
  return { ok: true };
});

// Control fino aparte del sync automático de arriba: lista qué cambió
// (git status --porcelain) para elegir a mano qué archivos entran en el
// commit y escribir el mensaje — ver gitpanel.js.
ipcMain.handle('git:status', async (event, root) => {
  const result = await runGit(['status', '--porcelain'], root);
  if (result.error) return null;
  return result.stdout.split('\n').filter(Boolean).map((line) => ({
    status: line.slice(0, 2),
    file: line.slice(3)
  }));
});

// Staging granular (ver gitpanel.js): en vez de un solo "add -A + commit",
// cada archivo elegido se stagea completo (git:addFiles) o por hunks
// elegidos a mano (git:stageHunks, vía "git apply --cached" de un patch
// armado solo con esos hunks — misma idea que "git add -p", solo que la UI
// de selección vive en el panel en vez de un prompt de terminal), y
// git:commitStaged simplemente commitea lo que haya quedado en el índice.
ipcMain.handle('git:diffFile', async (event, { root, file }) => {
  const result = await runGit(['diff', '--no-color', '--', file], root);
  if (result.error) return null;
  return result.stdout;
});

ipcMain.handle('git:addFiles', async (event, { root, files }) => {
  if (!files || !files.length) return { ok: true };
  const result = await runGit(['add', '--', ...files], root);
  return result.error ? { ok: false, reason: 'add-failed', detail: (result.stderr || String(result.error.message || '')).trim() } : { ok: true };
});

ipcMain.handle('git:stageHunks', async (event, { root, patch }) => {
  const tmpPatch = path.join(os.tmpdir(), `mk-hunks-${Date.now()}-${crypto.randomBytes(4).toString('hex')}.patch`);
  fs.writeFileSync(tmpPatch, patch, 'utf-8');
  const result = await runGit(['apply', '--cached', '--whitespace=nowarn', tmpPatch], root);
  try { fs.unlinkSync(tmpPatch); } catch { /* best-effort, no bloquea el resultado */ }
  return result.error ? { ok: false, reason: 'apply-failed', detail: result.stderr } : { ok: true };
});

ipcMain.handle('git:commitStaged', async (event, { root, message }) => {
  if (!message || !message.trim()) return { ok: false, reason: 'no-message' };
  const staged = await runGit(['diff', '--cached', '--name-only'], root);
  if (!staged.error && !staged.stdout.trim()) return { ok: false, reason: 'nothing-staged' };
  const commit = await runGit(['commit', '-m', message], root);
  return commit.error ? { ok: false, reason: 'commit-failed' } : { ok: true };
});

// ---- versión y aviso de versión nueva ----
// Solo si el usuario lo activa (Ajustes → Sistema): consulta la última
// release pública del repositorio. Es la única llamada a internet de MK
// fuera del correo, y nunca descarga ni instala nada sola.
const RELEASES_API = 'https://api.github.com/repos/Joviva22/MK/releases/latest';

function newerThan(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

ipcMain.handle('app:version', () => app.getVersion());

ipcMain.handle('app:checkUpdate', async () => {
  const current = app.getVersion();
  if (ctx.isTestMode) return { current, latest: null, newer: false };
  try {
    const res = await net.fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'MK' } });
    if (!res.ok) return { current, error: res.status === 404 ? 'Todavía no hay versiones publicadas.' : `GitHub respondió ${res.status}.` };
    const data = await res.json();
    const latest = String(data.tag_name || '').replace(/^v/, '');
    return { current, latest, newer: newerThan(latest, current), url: data.html_url };
  } catch (e) {
    ctx.logError('app:checkUpdate', e);
    return { current, error: 'Sin conexión.' };
  }
});

// Control del reproductor multimedia del sistema vía playerctl (D-Bus/MPRIS,
// solo Linux) — mismo patrón execFile que git arriba. playerctl no viene
// con MK (hay que instalarlo aparte); si no está, o si no hay ningún player
// con soporte MPRIS corriendo, se devuelve un error legible en vez de
// romper — ver mediaplayer.js, que le muestra el motivo al usuario.
function runPlayerctl(args) {
  return new Promise((resolve) => {
    execFile('playerctl', args, (error, stdout) => {
      if (error) {
        resolve({ ok: false, reason: error.code === 'ENOENT' ? 'not-installed' : 'no-player', detail: error.message });
      } else {
        resolve({ ok: true, output: stdout.trim() });
      }
    });
  });
}

ipcMain.handle('media:playPause', () => runPlayerctl(['play-pause']));
ipcMain.handle('media:next', () => runPlayerctl(['next']));
ipcMain.handle('media:previous', () => runPlayerctl(['previous']));

ipcMain.handle('media:status', async () => {
  const status = await runPlayerctl(['status']);
  if (!status.ok) return status;
  const meta = await runPlayerctl(['metadata', '--format', '{{ artist }} - {{ title }}']);
  return { ok: true, status: status.output, title: meta.ok ? meta.output : '' };
});
