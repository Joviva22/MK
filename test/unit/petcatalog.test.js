'use strict';

// Personajes de un juego de RPG Maker: líneas evolutivas y legendarios.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../../src/petcatalog');

const game = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-unit-game-'));
const chars = path.join(game, 'Graphics', 'Characters');
test.after(() => fs.rmSync(game, { recursive: true, force: true }));

test('charCatalog: líneas con ramas, sin sprite se saltea, legendarios marcados', () => {
  fs.mkdirSync(chars, { recursive: true });
  fs.mkdirSync(path.join(game, 'PBS'));
  ['CHAR1', 'CHAR2', 'CHAR3', 'EEV', 'VAP', 'JOL', 'LEGEN', 'SOLO'].forEach((id) => fs.writeFileSync(path.join(chars, `${id}.png`), 'x'));
  fs.writeFileSync(path.join(game, 'PBS', 'pokemon.txt'), [
    '[CHAR1]', 'Name = Llamita', 'Evolution = CHAR2,Level,16',
    '[CHAR2]', 'Name = Llamón', 'Evolution = CHAR3,Level,36',
    '[CHAR3]', 'Name = Llamarón',
    '[EEV]', 'Name = Evi', 'Evolutions = VAP,Item,WATERSTONE,JOL,Item,THUNDERSTONE',
    '[VAP]', 'Name = Vapi', '[JOL]', 'Name = Joli',
    '[LEGEN]', 'Name = Legendo', 'Flags = Legendary',
    '[NOSPRITE]', 'Name = Fantasma',
    '[SOLO]', 'Name = Solito'
  ].join('\n'));
  const cat = P.charCatalog(chars);
  const names = cat.lines.filter((l) => !l.single).map((l) => l.names.join('>'));
  assert.deepEqual(names.sort(), ['Evi>Joli', 'Evi>Vapi', 'Llamita>Llamón>Llamarón'].sort());
  assert.equal(cat.lines.filter((l) => l.single).length, 8);
  assert.ok(cat.lines.some((l) => l.single && l.ids[0] === 'CHAR3'));
  assert.equal(cat.lines.find((l) => l.ids[0] === 'LEGEN').legendary, true);
  assert.equal(cat.lines.find((l) => l.ids[0] === 'CHAR1').legendary, false);
  assert.equal(cat.total, 8);
  assert.equal(cat.legendaries, 1);
});

test('findCharDirs encuentra <Descargas>/<juego>/Graphics/Characters', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-unit-home-'));
  fs.mkdirSync(path.join(home, 'Descargas', 'Mi Juego', 'Graphics', 'Characters'), { recursive: true });
  assert.deepEqual(P.findCharDirs(home), [path.join(home, 'Descargas', 'Mi Juego', 'Graphics', 'Characters')]);
  fs.rmSync(home, { recursive: true, force: true });
});

test('sin PBS: cada sprite es un personaje suelto', () => {
  const only = fs.mkdtempSync(path.join(os.tmpdir(), 'mk-unit-only-'));
  fs.writeFileSync(path.join(only, 'HERO.png'), 'x');
  fs.writeFileSync(path.join(only, 'notas.txt'), 'x');
  const cat = P.charCatalog(only);
  assert.deepEqual(cat.lines.map((l) => l.ids), [['HERO']]);
  assert.equal(cat.withEvolutions, false);
  fs.rmSync(only, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(game, 'forms-'));
  const dir = path.join(root, 'Graphics', 'Characters');
  const pbs = path.join(root, 'PBS');
  fs.mkdirSync(dir, { recursive: true }); fs.mkdirSync(pbs);
  return { dir, pbs };
}

test('formas regionales: PBS adicionales, nombres y evolución sin volver a la forma normal', () => {
  const { dir, pbs } = fixture();
  for (const id of ['VULPIX', 'NINETALES', 'VULPIX_1', 'NINETALES_2', 'FUTURE-MON']) fs.writeFileSync(path.join(dir, `${id}.png`), 'x');
  fs.writeFileSync(path.join(pbs, 'pokemon.txt'), '\uFEFF[VULPIX]\nName = Vulpix\nEvolution = NINETALES,Item,FIRESTONE\n[NINETALES]\nName = Ninetales\n');
  fs.writeFileSync(path.join(pbs, 'pokemon_forms_extra.txt'), '[VULPIX,1]\nFormName = Alolan\nEvolution = NINETALES,Item,ICESTONE\n[NINETALES,2]\nFormName = Alolan\n');
  const cat = P.charCatalog(dir);
  assert.ok(cat.lines.some((l) => l.ids.join('>') === 'VULPIX_1>NINETALES_2' && l.names[0] === 'Vulpix (Alolan)'));
  assert.ok(!cat.lines.some((l) => l.ids.join('>') === 'VULPIX_1>NINETALES'));
  assert.ok(cat.lines.some((l) => l.single && l.ids[0] === 'FUTURE-MON'));
  assert.ok(cat.lines.some((l) => l.single && l.ids[0] === 'NINETALES_2'));
});

test('evolución regional sin imagen no se sustituye por el sprite normal', () => {
  const { dir, pbs } = fixture();
  for (const id of ['VULPIX', 'NINETALES', 'VULPIX_1']) fs.writeFileSync(path.join(dir, `${id}.png`), 'x');
  fs.writeFileSync(path.join(pbs, 'pokemon.txt'), '[VULPIX]\nName = Vulpix\nEvolution = NINETALES,Item,FIRESTONE\n[NINETALES]\nName = Ninetales\n');
  fs.writeFileSync(path.join(pbs, 'pokemon_forms.txt'), '[VULPIX,1]\nFormName = Alolan\n[NINETALES,1]\nFormName = Alolan\n');
  const cat = P.charCatalog(dir);
  assert.ok(cat.lines.some((l) => l.single && l.ids[0] === 'VULPIX_1'));
  assert.ok(!cat.lines.some((l) => l.ids.join('>') === 'VULPIX_1>NINETALES'));
});

test('mayúsculas de archivos, PBS antiguo y sprites fuera del PBS siguen disponibles', () => {
  const { dir, pbs } = fixture();
  fs.writeFileSync(path.join(dir, 'vulpix.PNG'), 'x');
  fs.writeFileSync(path.join(dir, 'future_99.png'), 'x');
  fs.writeFileSync(path.join(pbs, 'pokemon.txt'), '[37]\nName = Vulpix\nInternalName = VULPIX\n');
  const cat = P.charCatalog(dir);
  assert.ok(cat.lines.some((l) => l.ids[0] === 'vulpix' && l.names[0] === 'Vulpix'));
  assert.ok(cat.lines.some((l) => l.ids[0] === 'future_99'));
  assert.equal(P.charSpritePath(dir, 'VULPIX'), path.join(dir, 'vulpix.PNG'));
  assert.equal(P.charSpritePath(dir, '../escape'), null);
});
