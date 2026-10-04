'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('Roxas: sin emblemas se une una vez; un personaje existente conserva su progreso', async () => {
  const pets = [{ kind: 'kh', species: 'roxas', xp: 250, id: 'existing-roxas' }];
  let additions = 0;
  const window = {
    mdEditor: { getConfig: async () => ({}), khChars: async () => [{ id: 'roxas', name: 'Roxas', portraits: {} }] },
    mdLuckyEmblem: { found: () => 0 },
    mdPet: { getState: () => ({ pets }), addKhPet(species) { additions++; pets.push({ kind: 'kh', species, xp: 0 }); } }
  };
  const document = {
    getElementById: () => null, addEventListener() {}, querySelectorAll: () => [],
    createElement: () => ({ append() {}, setAttribute() {}, classList: { add() {} } }), body: { appendChild() {} }
  };
  vm.runInNewContext(fs.readFileSync('src/khchars.js', 'utf8'), { window, document, setTimeout() {} });
  await window.mdKhChars.load();
  window.mdKhChars.syncPets();
  assert.equal(additions, 0);
  assert.equal(pets[0].xp, 250);
  pets.length = 0;
  window.mdKhChars.syncPets();
  window.mdKhChars.syncPets();
  assert.equal(additions, 1);
  assert.equal(pets[0].species, 'roxas');
});
