'use strict';

// Corrector ortográfico (src/spellchecker.js): diccionario chico sintético
// en vez del real de dictionary-es (pesado, ~2 s en cargar) para que la
// suite siga rápida — el diccionario en sí es de terceros (Hunspell).
const test = require('node:test');
const assert = require('node:assert/strict');
const nspell = require('nspell');
const sp = require('../../src/spellchecker');

const dict = nspell({
  aff: Buffer.from('SET UTF-8\n'),
  dic: Buffer.from('3\nhola\nperro\ngato\n')
});
sp.loadSpeller(dict);

test('checkWords: separa lo que no está en el diccionario, sin repetidos', () => {
  assert.deepEqual(sp.checkWords(['hola', 'holaaa', 'perro', 'gatoo', 'gatoo']), ['holaaa', 'gatoo']);
});

test('checkWords: capitalizada al inicio de oración no es un error si la de minúscula es válida', () => {
  assert.deepEqual(sp.checkWords(['Hola']), []);
});

test('addWords: una palabra agregada deja de marcarse (memoria del usuario)', () => {
  assert.deepEqual(sp.checkWords(['mkeditor']), ['mkeditor']);
  sp.addWords(['mkeditor']);
  assert.deepEqual(sp.checkWords(['mkeditor']), []);
});

test('suggest: hasta 6 sugerencias, ninguna con una palabra vacía', () => {
  assert.equal(sp.suggest('').length, 0);
  assert.ok(sp.suggest('gatoo').length <= 6);
  assert.ok(sp.suggest('gatoo').includes('gato'));
});
