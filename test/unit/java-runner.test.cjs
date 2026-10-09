const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const test = require('node:test');
const assert = require('node:assert/strict');
const hasJdk = spawnSync('javac', ['-version']).status === 0 && spawnSync('javap', ['-version']).status === 0;
test('Java ejecuta main tras una clase auxiliar, con package y rutas especiales', {skip: !hasJdk}, () => {
const source = fs.readFileSync(path.join(__dirname, '../../src/terminal.js'), 'utf8');
const script = source.slice(source.indexOf('function shellQuote'), source.indexOf('// "▶ Ejecutar archivo"'));
const ctx = { window: { mdEditor: { dirName: path.dirname } } };
vm.createContext(ctx); vm.runInContext(script, ctx);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mk java ' test-"));
try {
for (const pkg of ['', 'package ejemplo;']) {
 const file = path.join(dir, 'EjemploCreacionThread.java');
 fs.writeFileSync(file, `${pkg}\nclass MiHebra extends Thread {}\npublic class EjemploCreacionThread { public static void main(String[] args) { System.out.println("correcto"); } }`);
 const cmd = ctx.commandForFile(file);
 assert.doesNotMatch(cmd, /[\r\n]/, 'El comando enviado al PTY debe ocupar una sola línea');
 for (const shell of ['bash', ...(spawnSync('fish', ['--version']).status === 0 ? ['fish'] : [])]) {
 const result = spawnSync(shell, ['-c', cmd], {encoding:'utf8'});
 if (result.status !== 0 || result.stdout.trim() !== 'correcto') throw new Error(JSON.stringify(result));
 }

}
} finally { fs.rmSync(dir, {recursive:true}); }
});
