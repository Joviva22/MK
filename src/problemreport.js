'use strict';

// Informe para "Reportar un problema" (Ajustes → Sistema, paleta): versión,
// sistema y las últimas líneas del registro de errores, SIN datos
// personales: la carpeta personal pasa a "~", el nombre de usuario a
// "<usuario>", y se tapan correos, rutas de montaje del AppImage y claves
// que parezcan contraseñas. Lógica pura: pruebas en test/unit.

const LOG_LINES = 60;

function redact(text, ctx) {
  let out = String(text || '');
  const home = ctx && ctx.home;
  const user = ctx && ctx.user;
  if (home) out = out.split(home).join('~');
  if (user && user.length >= 3) out = out.replace(new RegExp(`\\b${user.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), '<usuario>');
  return out
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '<correo>')
    .replace(/\/tmp\/\.mount_[^/\s]+/g, '<AppImage>')
    .replace(/\b(pass(word)?|contrase[ñn]a|token|secret|clave)\b(\s*[:=]\s*)\S+/gi, '$1$3<oculto>');
}

// info: { version, electron, chrome, node, platform, release, arch,
// desktop, session, modulesOff, log, home, user }
function buildReport(info) {
  const logLines = String(info.log || '').trimEnd().split('\n').slice(-LOG_LINES).join('\n');
  const body = [
    '## Qué pasó',
    '',
    '<!-- Contá qué hacías, qué esperabas y qué pasó. Si podés, los pasos para repetirlo. -->',
    '',
    '## Entorno',
    '',
    `- MK ${info.version} (Electron ${info.electron}, Chromium ${info.chrome}, Node ${info.node})`,
    `- ${info.platform} ${info.release} ${info.arch}${info.desktop ? ` · ${info.desktop}` : ''}${info.session ? ` · ${info.session}` : ''}`,
    `- Módulos apagados: ${info.modulesOff && info.modulesOff.length ? info.modulesOff.join(', ') : 'ninguno'}`,
    '',
    `## Últimas líneas del registro (${logLines ? 'mk.log' : 'vacío'})`,
    '',
    '```',
    logLines || '(sin errores registrados)',
    '```',
    ''
  ].join('\n');
  return redact(body, info);
}

module.exports = { buildReport, redact, LOG_LINES };
