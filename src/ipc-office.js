'use strict';

const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const ctx = require('./mainctx');
const guard = require('./pathguard');
const { writeTextAtomic } = require('./atomicwrite');
const JSZip = require('jszip');
const MAX_BYTES = 25 * 1024 * 1024;
const writes = new Map();
const digest = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
function validPath(filePath, kind) {
  return typeof filePath === 'string' && ['docx', 'xlsx', 'pptx'].includes(kind) && path.extname(filePath).toLowerCase() === '.' + kind;
}
ipcMain.handle('office:read', async (_event, filePath) => {
  try {
    const kind = typeof filePath === 'string' ? path.extname(filePath).slice(1).toLowerCase() : '';
    if (!validPath(filePath, kind) || !guard.check(filePath, 'office:read')) throw new Error('Elige un archivo .docx, .xlsx o .pptx autorizado.');
    if ((await fs.stat(filePath)).size > MAX_BYTES) throw new Error('El archivo supera 25 MB.');
    const bytes = await fs.readFile(filePath);
    return { base64: bytes.toString('base64'), version: digest(bytes) };
  } catch (error) { return { error: error.message }; }
});
ipcMain.handle('office:save', async (_event, payload) => {
  try {
    const { kind, base64, filePath, expected, forceDialog, blockedPaths } = payload || {};
    if (!['docx', 'xlsx', 'pptx'].includes(kind) || typeof base64 !== 'string' || base64.length > Math.ceil(MAX_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error('Contenido de Office inválido o demasiado grande.');
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length < 4 || bytes.length > MAX_BYTES || bytes.readUInt32LE(0) !== 0x04034b50) throw new Error('El documento no es un paquete Office válido.');
    const zip = await JSZip.loadAsync(bytes);
    const part = { docx:'word/document.xml', xlsx:'xl/workbook.xml', pptx:'ppt/presentation.xml' }[kind];
    if (!zip.file('[Content_Types].xml') || !zip.file(part)) throw new Error('El paquete no corresponde al formato elegido.');
    if (Object.values(zip.files).reduce((sum, file) => sum + (file._data?.uncompressedSize || 0), 0) > 100 * 1024 * 1024) throw new Error('El documento descomprimido supera 100 MB.');
    let target = filePath;
    const chosen = !target || forceDialog;
    if (chosen) {
      if (ctx.isTestMode) target = path.join(os.tmpdir(), `mk-test-export-${crypto.randomUUID()}.${kind}`);
      else {
        const result = await dialog.showSaveDialog(ctx.mainWindow, {
          defaultPath: filePath || path.join(ctx.getOpenFolder() || os.homedir(), kind === 'docx' ? 'Documento.docx' : kind === 'xlsx' ? 'Libro.xlsx' : 'Presentación.pptx'),
          filters: [{ name: kind === 'docx' ? 'Word' : kind === 'xlsx' ? 'Excel' : 'PowerPoint', extensions: [kind] }]
        });
        if (result.canceled || !result.filePath) return null;
        target = result.filePath;
        if (!path.extname(target)) target += '.' + kind;
      }
      guard.grantFile(target);
    }
    if (!validPath(target, kind) || !guard.check(target, 'office:save')) throw new Error('Elige una ruta con la extensión correcta.');
    if (Array.isArray(blockedPaths) && blockedPaths.includes(target)) throw new Error('Ese archivo ya está abierto en otra pestaña. Elige otro nombre.');
    const previous = writes.get(target) || Promise.resolve();
    const job = previous.catch(() => {}).then(async () => {
      if (!chosen || target === filePath) {
        const current = await fs.readFile(target);
        if (digest(current) !== expected) throw new Error('El archivo cambió fuera de MK. Usa Guardar como para conservar tus cambios.');
      }
      await writeTextAtomic(target, bytes);
      return { path: target, version: digest(bytes) };
    });
    writes.set(target, job);
    try { return await job; } finally { if (writes.get(target) === job) writes.delete(target); }
  } catch (error) { return { error: error.message }; }
});
