'use strict';

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

// El original no se toca hasta completar y sincronizar el temporal.
// Resolver enlaces conserva el enlace y reemplaza su destino, como writeFile.
async function writeTextAtomic(filePath, content, io = fs.promises) {
  let target = filePath;
  let mode;
  try {
    target = await io.realpath(filePath);
    mode = (await io.stat(target)).mode & 0o777;
    await io.access(target, fs.constants.W_OK);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
    // Un enlace roto no debe convertirse silenciosamente en un archivo.
    const entry = await io.lstat(filePath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
      return null;
    });
    if (entry) throw e;
  }
  const tmp = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);
  let handle;
  let created = false;
  try {
    handle = await io.open(tmp, 'wx', mode ?? 0o666);
    created = true;
    await handle.writeFile(content, 'utf8');
    if (mode !== undefined) await handle.chmod(mode);
    await handle.sync();
    await handle.close();
    handle = null;
    await io.rename(tmp, target);
  } finally {
    if (handle) await handle.close().catch(() => {});
    if (created) await io.unlink(tmp).catch(() => {});
  }
}

module.exports = { writeTextAtomic };
