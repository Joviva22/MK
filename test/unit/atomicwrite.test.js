'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeTextAtomic } = require('../../src/atomicwrite');
const io = fs.promises;

async function fixture(t) {
  const dir = await io.mkdtemp(path.join(os.tmpdir(), 'mk-atomicwrite-'));
  t.after(() => io.rm(dir, { recursive: true, force: true }));
  return { dir, file: path.join(dir, 'nota.md') };
}

test('guardar crea notas y conserva contenido UTF-8 y permisos al reemplazar', async (t) => {
  const { dir, file } = await fixture(t);
  await writeTextAtomic(file, 'Primera nota');
  await io.chmod(file, 0o640);
  await writeTextAtomic(file, '# Español: ñ y á\n');
  assert.equal(await io.readFile(file, 'utf8'), '# Español: ñ y á\n');
  assert.equal((await io.stat(file)).mode & 0o777, 0o640);
  assert.deepEqual(await io.readdir(dir), ['nota.md']);
});

test('fallar antes del reemplazo conserva el original y elimina el temporal', async (t) => {
  const { dir, file } = await fixture(t);
  await io.writeFile(file, 'original');
  const failingIO = { ...io, rename: async (tmp, target) => {
    assert.equal(target, file);
    assert.equal(await io.readFile(file, 'utf8'), 'original');
    assert.equal(await io.readFile(tmp, 'utf8'), 'nuevo');
    throw Object.assign(new Error('Disco no disponible'), { code: 'EIO' });
  } };
  await assert.rejects(writeTextAtomic(file, 'nuevo', failingIO), { code: 'EIO' });
  assert.equal(await io.readFile(file, 'utf8'), 'original');
  assert.deepEqual(await io.readdir(dir), ['nota.md']);
});

test('guardar mediante enlace simbólico conserva el enlace y actualiza el destino', async (t) => {
  const { dir, file } = await fixture(t);
  const link = path.join(dir, 'enlace.md');
  await io.writeFile(file, 'original');
  await io.symlink('nota.md', link);
  await writeTextAtomic(link, 'nuevo');
  assert.ok((await io.lstat(link)).isSymbolicLink());
  assert.equal(await io.readFile(file, 'utf8'), 'nuevo');
});

test('fallo de escritura o sincronización no trunca el original', async (t) => {
  const { dir, file } = await fixture(t);
  await io.writeFile(file, 'original');
  for (const failingStep of ['writeFile', 'sync']) {
    const failingIO = { ...io, open: async (...args) => {
      const handle = await io.open(...args);
      return {
        writeFile: async (...values) => {
          if (failingStep === 'writeFile') {
            await handle.writeFile('parcial');
            throw Object.assign(new Error('Disco lleno'), { code: 'ENOSPC' });
          }
          return handle.writeFile(...values);
        },
        chmod: (...values) => handle.chmod(...values),
        sync: async () => {
          throw Object.assign(new Error('No se pudo sincronizar'), { code: 'EIO' });
        },
        close: () => handle.close()
      };
    } };
    await assert.rejects(writeTextAtomic(file, 'nuevo', failingIO), {
      code: failingStep === 'writeFile' ? 'ENOSPC' : 'EIO'
    });
    assert.equal(await io.readFile(file, 'utf8'), 'original');
    assert.deepEqual(await io.readdir(dir), ['nota.md']);
  }
});

test('un enlace roto no se reemplaza por una nota', async (t) => {
  const { dir, file } = await fixture(t);
  await io.symlink('ausente.md', file);
  await assert.rejects(writeTextAtomic(file, 'nuevo'), { code: 'ENOENT' });
  assert.ok((await io.lstat(file)).isSymbolicLink());
  assert.deepEqual(await io.readdir(dir), ['nota.md']);
});
