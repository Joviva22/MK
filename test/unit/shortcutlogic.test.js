'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../../src/shared/shortcutlogic');
test('normaliza modificadores, letras, teclas especiales y rechaza escritura simple', () => {
  assert.equal(L.normalize('shift + ctrl + p'), 'Ctrl+Shift+P');
  assert.equal(L.normalize('Cmd+Alt+j'), 'Ctrl+Alt+J');
  assert.equal(L.normalize('F11'), 'F11'); assert.equal(L.normalize('Ctrl+,'), 'Ctrl+,');
  for (const value of ['a', 'Shift+A', 'Ctrl+Ctrl+P', 'Ctrl+P+Q', 'Ctrl+', 'Escape', 'Alt+ArrowLeft', 12]) assert.equal(L.normalize(value), null);
  assert.equal(L.fromEvent({ key: 'p', metaKey: true, shiftKey: true }), 'Ctrl+Shift+P');
  assert.equal(L.fromEvent({ key: 'j', ctrlKey: true, altKey: true, getModifierState: () => true }), null);
  assert.equal(L.fromEvent({ key: 'p', ctrlKey: true, isComposing: true }), null);
});
test('predeterminados únicos, conflictos, teclas reservadas y desactivación', () => {
  const bindings = L.defaults(); assert.equal(L.validate(bindings), '');
  bindings.quickOpen = bindings.palette; assert.match(L.validate(bindings), /conflicto/);
  bindings.quickOpen = 'Ctrl+Q'; assert.match(L.validate(bindings), /reservado/);
  bindings.quickOpen = 'Ctrl+Z'; assert.match(L.validate(bindings), /reservado/);
  bindings.quickOpen = 'Ctrl+Alt+F2'; assert.match(L.validate(bindings), /reservado/);
  bindings.quickOpen = ''; assert.equal(L.validate(bindings), '');
});
test('persistencia conserva cambios y desactivación; datos corruptos restauran configuración segura', () => {
  const result = L.resolve({ quickOpen: 'Ctrl+Alt+J', home: '', unknown: 'Ctrl+O' });
  assert.equal(result.error, ''); assert.equal(result.bindings.quickOpen, 'Ctrl+Alt+J'); assert.equal(result.bindings.home, '');
  assert.equal(result.bindings.save, 'Ctrl+S');
  assert.deepEqual(L.resolve({ quickOpen: 'Ctrl+S' }).bindings, L.defaults());
  assert.deepEqual(L.resolve({ save: null }).bindings, L.defaults());
  assert.equal(L.resolve(null).error, '');
});
