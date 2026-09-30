(function () {
'use strict';

// ⚙ Ajustes → Correo (ver ipc-mail.js). La contraseña se manda una vez al
// proceso principal, que la guarda cifrada con el llavero del sistema; el
// campo se vacía enseguida y nunca se vuelve a mostrar.

const enabledEl = document.getElementById('mail-enabled');
const addressEl = document.getElementById('mail-address');
const passwordEl = document.getElementById('mail-password');
const dailyEl = document.getElementById('mail-daily');
const dailyTimeEl = document.getElementById('mail-daily-time');
const statusEl = document.getElementById('mail-status');

let daily = { on: false, time: '08:00' };

const REASONS = {
  'no-address': 'Falta tu dirección de correo.',
  'bad-address': 'Esa dirección de correo no es válida.',
  'no-password': 'Falta la contraseña de aplicación.',
  'no-keyring': 'No hay llavero del sistema disponible (KWallet / GNOME Keyring): la contraseña no se guarda en texto plano.',
  auth: 'Gmail rechazó la contraseña de aplicación: creá una nueva.',
  'rate-limit': 'Demasiados correos en la última hora; se reanuda solo.',
  'send-failed': 'No se pudo mandar (¿sin internet?).',
  disabled: 'El envío está apagado.',
  empty: 'Escribí la contraseña de aplicación.',
  'write-failed': 'No se pudo guardar la contraseña.'
};

function showStatus(st, extra) {
  const parts = [];
  if (st) {
    parts.push(st.hasPassword ? '🔒 Contraseña guardada (cifrada)' : 'Sin contraseña guardada');
    if (!st.encryptionAvailable) parts.push('⚠ Sin llavero del sistema');
  }
  if (extra) parts.push(extra);
  statusEl.textContent = parts.join(' · ');
}

async function refresh() {
  const st = await window.mdEditor.mail.status();
  enabledEl.checked = st.enabled;
  addressEl.value = st.address;
  passwordEl.placeholder = st.hasPassword ? '•••• guardada — escribí otra para cambiarla' : 'Contraseña de aplicación (16 letras)';
  const config = await window.mdEditor.getConfig();
  daily = { on: !!(config.mailDaily && config.mailDaily.on), time: (config.mailDaily && config.mailDaily.time) || '08:00' };
  dailyEl.checked = daily.on;
  dailyTimeEl.value = daily.time;
  showStatus(st);
  return st;
}

async function save() {
  const res = await window.mdEditor.mail.setSettings({ enabled: enabledEl.checked, address: addressEl.value });
  if (!res.ok) return showStatus(null, REASONS[res.reason] || res.reason);
  let st = res.status;
  if (passwordEl.value) {
    const pw = await window.mdEditor.mail.setPassword(passwordEl.value);
    passwordEl.value = '';
    if (!pw.ok) return showStatus(st, REASONS[pw.reason] || pw.reason);
    st = pw.status;
  }
  daily = { on: dailyEl.checked, time: dailyTimeEl.value || '08:00' };
  await window.mdEditor.setConfig({ mailDaily: daily });
  passwordEl.placeholder = st.hasPassword ? '•••• guardada — escribí otra para cambiarla' : 'Contraseña de aplicación (16 letras)';
  showStatus(st, 'Guardado.');
}

document.getElementById('mail-save').addEventListener('click', save);
document.getElementById('mail-test').addEventListener('click', async () => {
  await save();
  showStatus(null, 'Enviando…');
  const res = await window.mdEditor.mail.test();
  showStatus(await window.mdEditor.mail.status(), res.ok ? '✔ Correo de prueba enviado: revisá tu bandeja.' : (REASONS[res.reason] || res.reason));
});
document.getElementById('mail-forget').addEventListener('click', async () => {
  showStatus(await window.mdEditor.mail.clearPassword(), 'Contraseña borrada.');
});
passwordEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') save();
});

refresh();

// Para home.js: mandar un aviso por correo (el proceso principal decide si
// está activado) y la configuración del resumen diario.
window.mdMail = {
  notify: (subject, text) => window.mdEditor.mail.send(subject, text).catch(() => null),
  getDaily: () => ({ ...daily }),
  refresh
};

})();
