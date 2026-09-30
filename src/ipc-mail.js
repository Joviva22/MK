'use strict';

// Recordatorios por correo (Gmail): los avisos del Home y el resumen diario
// también llegan por mail. Proceso principal, con nodemailer por SMTP de
// Gmail (smtp.gmail.com:465) y una contraseña de aplicación de Google.
//
// Seguridad:
// - La contraseña se guarda CIFRADA con el llavero del sistema (safeStorage:
//   KWallet / GNOME Keyring), en userData/mail-secret.bin; nunca vuelve al
//   renderer. Sin llavero disponible, no se guarda (no en texto plano).
// - Solo se manda a la propia dirección configurada: la ventana no elige
//   destinatarios, así no se puede usar MK para mandar correo a terceros.
// - Tope de envíos por hora, por si un bug disparara avisos en bucle.
// - En modo test no se conecta a nada: jsonTransport (el mensaje se arma y
//   se guarda en memoria para que la suite lo revise).

const { app, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const ctx = require('./mainctx');

const SECRET_FILE = path.join(app.getPath('userData'), 'mail-secret.bin');
const MAX_PER_HOUR = 30;
const ADDRESS_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

let nodemailer = null;
let lastTestMessage = null;
const sentAt = [];

function settings() {
  const c = ctx.loadConfig();
  return {
    enabled: !!c.mailEnabled,
    address: typeof c.mailAddress === 'string' ? c.mailAddress : ''
  };
}

function encryptionAvailable() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    // En Linux sin llavero, Electron usa 'basic_text' (clave fija en el
    // código): eso no es cifrar de verdad, así que no cuenta.
    if (process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function') {
      return safeStorage.getSelectedStorageBackend() !== 'basic_text';
    }
    return true;
  } catch {
    return false;
  }
}

function hasPassword() {
  return fs.existsSync(SECRET_FILE);
}

function readPassword() {
  try {
    return safeStorage.decryptString(fs.readFileSync(SECRET_FILE));
  } catch (e) {
    ctx.logError('mail:password', e);
    return null;
  }
}

function status() {
  const s = settings();
  return { ...s, hasPassword: hasPassword(), encryptionAvailable: encryptionAvailable() || ctx.isTestMode };
}

function transport(address, password) {
  if (!nodemailer) nodemailer = require('nodemailer');
  if (ctx.isTestMode) return nodemailer.createTransport({ jsonTransport: true });
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: address, pass: password },
    // Sin leer archivos ni URLs desde el contenido del mensaje.
    disableFileAccess: true,
    disableUrlAccess: true
  });
}

function withinRate() {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  while (sentAt.length && sentAt[0] < hourAgo) sentAt.shift();
  return sentAt.length < MAX_PER_HOUR;
}

// Manda a la propia dirección. force: el botón de prueba (aunque el envío
// automático esté apagado).
async function send(subject, text, force) {
  const s = settings();
  if (!force && !s.enabled) return { ok: false, reason: 'disabled' };
  if (!ADDRESS_RE.test(s.address)) return { ok: false, reason: 'no-address' };
  if (!hasPassword()) return { ok: false, reason: 'no-password' };
  if (!withinRate()) return { ok: false, reason: 'rate-limit' };
  const password = ctx.isTestMode ? 'test' : readPassword();
  if (!password) return { ok: false, reason: 'no-password' };
  try {
    const info = await transport(s.address, password).sendMail({
      from: `MK <${s.address}>`,
      to: s.address,
      subject: String(subject || 'MK').slice(0, 200),
      text: String(text || '').slice(0, 20000)
    });
    sentAt.push(Date.now());
    if (ctx.isTestMode) lastTestMessage = JSON.parse(info.message);
    return { ok: true };
  } catch (e) {
    // Error de Gmail (contraseña revocada, sin internet): visible + log.
    const auth = /Invalid login|535|Username and Password not accepted/i.test(String(e && e.message));
    ctx.reportError('mail:send', e, auth
      ? 'Gmail rechazó la contraseña de aplicación: creá una nueva y guardala en ⚙ Ajustes → Correo.'
      : 'No se pudo mandar el recordatorio por correo.');
    return { ok: false, reason: auth ? 'auth' : 'send-failed', detail: String(e && e.message) };
  }
}

ipcMain.handle('mail:status', () => status());

ipcMain.handle('mail:setSettings', (event, { enabled, address }) => {
  const next = { ...ctx.loadConfig() };
  if (typeof enabled === 'boolean') next.mailEnabled = enabled;
  if (typeof address === 'string') {
    const a = address.trim();
    if (a && !ADDRESS_RE.test(a)) return { ok: false, reason: 'bad-address' };
    next.mailAddress = a;
  }
  ctx.saveConfig(next);
  return { ok: true, status: status() };
});

ipcMain.handle('mail:setPassword', (event, password) => {
  const pw = typeof password === 'string' ? password.replace(/\s+/g, '') : '';
  if (!pw) return { ok: false, reason: 'empty' };
  if (ctx.isTestMode) {
    fs.writeFileSync(SECRET_FILE, 'test');
    return { ok: true, status: status() };
  }
  if (!encryptionAvailable()) return { ok: false, reason: 'no-keyring' };
  try {
    fs.writeFileSync(SECRET_FILE, safeStorage.encryptString(pw), { mode: 0o600 });
    return { ok: true, status: status() };
  } catch (e) {
    ctx.reportError('mail:setPassword', e, 'No se pudo guardar la contraseña del correo.');
    return { ok: false, reason: 'write-failed' };
  }
});

ipcMain.handle('mail:clearPassword', () => {
  try {
    fs.rmSync(SECRET_FILE, { force: true });
  } catch (e) {
    ctx.logError('mail:clearPassword', e);
  }
  return status();
});

ipcMain.handle('mail:send', (event, { subject, text }) => send(subject, text, false));
ipcMain.handle('mail:test', () => send('MK: correo de prueba', 'Si leés esto, los recordatorios de MK ya te llegan por correo. ✔', true));
ipcMain.handle('mail:lastTestMessage', () => (ctx.isTestMode ? lastTestMessage : null));

module.exports = { send };
