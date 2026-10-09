'use strict';
const { spawn } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..');
async function run(profile, fixtures, phase) {
  return new Promise((resolve, reject) => {
    const child = spawn(require('electron'), [root, `--user-data-dir=${profile}`], { env:{ ...process.env, MK_TEST:'1', MK_TEST_FIXTURES:fixtures, MK_TEST_SCRIPT:phase }, stdio:['ignore','pipe','pipe'] });
    let output = '', killed = false;
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('Tiempo agotado: ' + phase + '\n' + output)); }, 60000);
    child.stdout.on('data', data => {
      output += data;
      const line = output.split('\n').find(line => line.startsWith('MK_TEST_RESULTS_JSON:'));
      if (phase === 'office-recovery-write' && line && output.includes(line + '\n') && !killed) {
        const results = JSON.parse(line.slice('MK_TEST_RESULTS_JSON:'.length));
        if (results.every(result => result.pass)) { killed = true; child.kill('SIGKILL'); }
      }
    });
    child.stderr.on('data', data => { output += data; });
    child.on('error', error => { clearTimeout(timer); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      try {
        const line = output.split('\n').find(line => line.startsWith('MK_TEST_RESULTS_JSON:'));
        if (!line) throw new Error(output);
        const results = JSON.parse(line.slice('MK_TEST_RESULTS_JSON:'.length));
        if (results.some(result => !result.pass) || (phase === 'office-recovery-write' ? !killed || signal !== 'SIGKILL' : code !== 0)) throw new Error(JSON.stringify(results) + '\n' + output);
        for (const result of results) console.log('✓ ' + result.name);
        resolve();
      } catch (error) { reject(error); }
    });
  });
}
(async () => {
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-office-recovery-'));
  const profile = path.join(scratch, 'profile'), fixtures = path.join(scratch, 'fixtures');
  await fs.mkdir(fixtures);
  try {
    await run(profile, fixtures, 'office-recovery-write');
    await run(profile, fixtures, 'office-recovery-read');
    console.log('Recuperación Office tras cierre inesperado: OK');
  } finally { await fs.rm(scratch, { recursive:true, force:true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
