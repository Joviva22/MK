'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const L = require('../../src/shared/shortcutlogic');
test('un guardado rechazado mantiene los atajos activos y permite reintentar el borrador', async () => {
  const nodes = new Map();
  class Node {
    constructor() { this.children = []; this.dataset = {}; this.events = {}; this.textContent = ''; }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    contains(node) { return this === node || this.children.some((child) => child.contains?.(node)); }
    setAttribute() {}
    removeAttribute() {}
    addEventListener(name, fn) { this.events[name] = fn; }
  }
  for (const id of ['shortcut-list', 'shortcut-status', 'shortcut-apply', 'shortcut-reset', 'shortcut-discard']) { const node = new Node(); node.id = id; }
  let config = {}, frozen = true;
  const window = { mdShortcutLogic: L, addEventListener: (_name, fn) => { window.keydown = fn; }, mdEditor: {
    getConfig: async () => JSON.parse(JSON.stringify(config)),
    setConfig: async (value) => { if (!frozen) config = { ...config, ...value }; return config; }
  } };
  const document = { createElement: () => new Node(), getElementById: (id) => nodes.get(id), querySelector: () => null,
    querySelectorAll: () => [...nodes.values()] };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/shortcuts.js'), 'utf8'), { window, document, alert: () => {} });
  await window.mdShortcuts.ready;
  const input = nodes.get('shortcut-quickOpen');
  window.keydown({ target: { closest: () => input }, key: 'j', ctrlKey: true, altKey: true, preventDefault() {}, stopImmediatePropagation() {} });
  await nodes.get('shortcut-apply').events.click();
  assert.equal(window.mdShortcuts.getBindings().quickOpen, 'Ctrl+P');
  assert.equal(input.value, 'Ctrl+Alt+J'); assert.match(nodes.get('shortcut-status').textContent, /No se confirmó/);
  frozen = false;
  await nodes.get('shortcut-apply').events.click();
  assert.equal(window.mdShortcuts.getBindings().quickOpen, 'Ctrl+Alt+J');
  assert.equal(config.shortcuts.quickOpen, 'Ctrl+Alt+J');
  assert.equal(nodes.get('shortcut-apply').disabled, false);
  const restarted = { ...window, addEventListener: (_name, fn) => { restarted.keydown = fn; } };
  delete restarted.mdShortcuts;
  vm.runInNewContext(fs.readFileSync(require.resolve('../../src/shortcuts.js'), 'utf8'), { window: restarted, document, alert: () => {} });
  await restarted.mdShortcuts.ready;
  assert.equal(restarted.mdShortcuts.getBindings().quickOpen, 'Ctrl+Alt+J');
});
