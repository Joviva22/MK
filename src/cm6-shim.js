(function () {
'use strict';

// Capa de compatibilidad CodeMirror 5 → 6 (ver OBJETIVOS.md, "Migrar el
// editor a CodeMirror 6"). Expone un `window.CodeMirror` con la forma de la
// API de CM5 que usa el resto de la app (editor.js, tabs.js, statusbar.js,
// findreplace.js, foldclutter.js, spellcheck.js, typewriter.js, dragdrop.js,
// contextmenu.js, snippets.js, autocomplete.js, modes.js, y los que solo
// llaman refresh()/setOption()/getValue()), para no tener que reescribirlos.
// Live Preview se adapta mediante decoraciones y tokens derivados de Lezer;
// el autocompletado usa la extensión nativa de CM6 (Ctrl-Space y palabras
// del documento). No se cargan los addons ni el motor de CM5.
//
// Diseño: un solo EditorView (como el `cm` único de CM5), un EditorState
// propio por pestaña (como el `CodeMirror.Doc` de CM5) — `swapDoc` cambia
// cuál está montado. Cada estado se guarda solo (undo incluido) porque
// EditorState es inmutable: los cambios devuelven un estado nuevo, no
// mutan el viejo. `markText`/`addLineClass` se arman con dos StateField
// (decorations de texto y de línea) presentes en TODOS los estados, así
// sobreviven al cambiar de pestaña.

const M = window.mdCM6;
const {
  EditorState, EditorSelection, Compartment, StateEffect, StateField,
  EditorView, keymap, drawSelection, dropCursor, lineNumbers,
  Decoration, WidgetType,
  defaultKeymap, history, historyKeymap, indentWithTab, selectAll, undo, redo,
  SearchCursor,
  autocompletion, completionKeymap, completeAnyWord, startCompletion, closeCompletion, completionStatus,
  indentOnInput, syntaxHighlighting, defaultHighlightStyle, HighlightStyle, StreamLanguage, LanguageSupport, syntaxTree, ensureSyntaxTree,
  markdown, GFM, tags, python, javascript, html, php, legacyModes
} = M;

// ---------- posiciones: CM5 usa {line, ch} (0-based); CM6, un offset flat ----------
function toPos(state, off) {
  off = Math.max(0, Math.min(off, state.doc.length));
  const line = state.doc.lineAt(off);
  return { line: line.number - 1, ch: off - line.from };
}
function toOffset(state, pos) {
  if (pos == null) return state.selection.main.head;
  if (typeof pos === 'number') return Math.max(0, Math.min(pos, state.doc.length));
  const n = Math.max(1, Math.min((pos.line || 0) + 1, state.doc.lines));
  const line = state.doc.line(n);
  return line.from + Math.max(0, Math.min(pos.ch || 0, line.length));
}

// ---------- modos: nombre de CM5 -> Language de CM6 ----------
// Markdown, Python, JavaScript/TypeScript, HTML y PHP usan paquetes nativos;
// los demás lenguajes usan StreamLanguage de CM6 con parsers legacy.
const langCache = new Map();
function languageFor(modeSpec) {
  const name = typeof modeSpec === 'string' ? modeSpec : (modeSpec && modeSpec.name) || 'text/plain';
  if (langCache.has(name)) return langCache.get(name);
  let lang = null;
  if (name === 'markdown') lang = markdown({ extensions: GFM });
  else if (name === 'stex') lang = new LanguageSupport(StreamLanguage.define(legacyModes.stex));
  else if (name === 'text/x-csrc') lang = new LanguageSupport(StreamLanguage.define(legacyModes.clikeC));
  else if (name === 'text/x-c++src') lang = new LanguageSupport(StreamLanguage.define(legacyModes.clikeCpp));
  else if (name === 'text/x-java') lang = new LanguageSupport(StreamLanguage.define(legacyModes.clikeJava));
  else if (name === 'python') lang = python();
  else if (name === 'shell') lang = new LanguageSupport(StreamLanguage.define(legacyModes.shell));
  else if (name === 'javascript') lang = javascript();
  else if (name === 'text/typescript') lang = javascript({ typescript: true });
  else if (name === 'htmlmixed') lang = html();
  else if (name === 'application/x-httpd-php') lang = php();
  else {
    const aliases = { 'text/x-csharp': 'csharp', 'text/x-kotlin': 'kotlin', 'text/x-scala': 'scala', 'application/dart': 'dart', 'text/x-sql': 'sql', 'application/json': 'json', powershell: 'powerShell' };
    const parser = legacyModes[aliases[name] || name];
    if (parser) lang = new LanguageSupport(StreamLanguage.define(parser));
  }
  langCache.set(name, lang);
  return lang;
}

// ---------- colores de sintaxis del Markdown ----------
// CM6 no tiene clases CSS fijas como CM5 (.cm-header, .cm-strong...): genera
// clases propias por estilo e inyecta el color él mismo. En vez de "traducir"
// las reglas de styles.css a nombres de clase que no existen, se arma un
// HighlightStyle propio con las mismas variables de siempre (--accent,
// --text-muted...) — confirmado con una prueba real qué tag de Lezer
// corresponde a qué marca: la marca (#, **, `...) siempre lleva ADEMÁS
// `processingInstruction` junto con la del tipo (heading1, strong...); el
// contenido lleva solo la del tipo. Dos variantes: la normal (edición cruda,
// como el "cm-s-default" de CM5) y la de Live Preview (título grande,
// negrita/cursiva de verdad, marcas atenuadas — mismos valores que tenía
// styles.css para `.cm-live`).
const normalHighlight = HighlightStyle.define([
  { tag: tags.keyword, class: 'cm-keyword', color: 'var(--accent)' },
  { tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4, tags.heading5, tags.heading6], color: 'var(--accent)' },
  { tag: tags.link, color: 'var(--accent)' },
  { tag: tags.url, color: 'var(--accent)' },
  { tag: tags.quote, color: 'var(--text-muted)' },
  { tag: tags.contentSeparator, color: 'var(--text-muted)' }
]);
const liveHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '2em', fontWeight: '700', color: 'var(--text)', lineHeight: '1.3' },
  { tag: tags.heading2, fontSize: '1.6em', fontWeight: '700', color: 'var(--text)', lineHeight: '1.3' },
  { tag: tags.heading3, fontSize: '1.3em', fontWeight: '700', color: 'var(--text)', lineHeight: '1.3' },
  { tag: tags.heading4, fontSize: '1.15em', fontWeight: '700', color: 'var(--text)', lineHeight: '1.3' },
  { tag: [tags.heading5, tags.heading6], fontSize: '1em', fontWeight: '700', color: 'var(--text)', lineHeight: '1.3' },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--text-muted)' },
  { tag: tags.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.monospace, fontFamily: 'var(--editor-font-family, "JetBrains Mono", monospace)', fontSize: '0.9em', backgroundColor: 'var(--surface-2)', borderRadius: '4px', padding: '1px 3px' },
  // Al final: las marcas (#, **, `...) siempre llevan ADEMÁS esta tag junto
  // con la del tipo (heading1, strong...) — puesta última, gana el color y
  // el grosor (pero no el tamaño de fuente: un "#" de H1 sigue grande, solo
  // que atenuado, como en Obsidian/Typora) para toda marca de formato.
  { tag: tags.processingInstruction, color: 'var(--text-muted)', fontWeight: '400', fontStyle: 'normal', textDecoration: 'none' }
]);
function isLiveModeSpec(modeSpec) {
  return !!(modeSpec && typeof modeSpec === 'object' && modeSpec.highlightFormatting);
}
const codeHighlight = HighlightStyle.define([
  ...defaultHighlightStyle.specs,
  { tag: tags.keyword, class: 'cm-keyword', color: 'var(--accent)' }
]);
function highlightStyleFor(modeSpec) {
  const name = typeof modeSpec === 'string' ? modeSpec : (modeSpec && modeSpec.name) || 'text/plain';
  if (name !== 'markdown') return codeHighlight;
  return isLiveModeSpec(modeSpec) ? liveHighlight : normalHighlight;
}

// ---------- decorations de texto (markText) ----------
const addMarkFx = StateEffect.define();
const removeMarkFx = StateEffect.define();
let markSeq = 0;

class DomWidget extends WidgetType {
  // handleMouseEvents de CM5: false = "CodeMirror no toca los clics acá,
  // que los maneje el propio nodo" (imágenes, wikilinks, checkboxes con su
  // propio mousedown); sin especificar (undefined/true) = CM5 sí los maneja
  // (mueve el cursor ahí), como en foldclutter.js — sin handler propio, así
  // se puede "entrar" al pliegue con el mouse y clearOnEnter lo despliega.
  // ignoreEvent() de CM6 es al revés: true = CM6 no lo toca.
  constructor(dom, handleMouseEvents) { super(); this.dom = dom; this.ignoreOwn = handleMouseEvents === false; }
  eq(other) { return other.dom === this.dom; }
  toDOM() { return this.dom; }
  ignoreEvent() { return this.ignoreOwn; }
}

const marksField = StateField.define({
  create: () => Decoration.none,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    const additions = [];
    const removed = new Set();
    for (const e of tr.effects) {
      if (e.is(addMarkFx)) additions.push(e.value.deco.range(e.value.from, e.value.to));
      else if (e.is(removeMarkFx)) removed.add(e.value);
    }
    if (removed.size) marks = marks.update({ filter: (f, t, deco) => !removed.has(deco.spec.mkId) });
    if (additions.length) marks = marks.update({ add: additions.filter((range) => !removed.has(range.value.spec.mkId)), sort: true });
    if (tr.selection) {
      const head = tr.selection.main.head;
      marks = marks.update({ filterFrom: head, filterTo: head, filter: (f, t, deco) => !(deco.spec.mkClearOnEnter && head >= f && head <= t) });
    }
    return marks;
  },
  provide: (f) => EditorView.decorations.from(f)
});

function markText(view, fromPos, toPos_, opts) {
  const owner = currentDoc;
  opts = opts || {};
  const from = toOffset(view.state, fromPos);
  const to = Math.max(from, toOffset(view.state, toPos_));
  const id = ++markSeq;
  const spec = { mkId: id, mkClearOnEnter: !!opts.clearOnEnter };
  const deco = opts.replacedWith
    ? Decoration.replace(Object.assign({ widget: new DomWidget(opts.replacedWith, opts.handleMouseEvents) }, spec))
    : opts.collapsed ? Decoration.replace(spec)
      : Decoration.mark(Object.assign({ class: opts.className || '' }, spec));
  dispatchEffects(addMarkFx.of({ deco, from, to }));
  return { clear: () => {
    const effect = removeMarkFx.of(id);
    dispatchEffects(effect, owner);
  } };
}

// ---------- decorations de línea (addLineClass / removeLineClass) ----------
const addLineFx = StateEffect.define();
const removeLineFx = StateEffect.define();

const lineMarksField = StateField.define({
  create: () => Decoration.none,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    const additions = [];
    const removed = new Set();
    for (const e of tr.effects) {
      if (e.is(addLineFx)) additions.push(e.value.deco.range(e.value.at));
      else if (e.is(removeLineFx)) removed.add(e.value);
    }
    if (removed.size) marks = marks.update({ filter: (f, t, deco) => !removed.has(deco.spec.mkId) });
    if (additions.length) marks = marks.update({ add: additions.filter((range) => !removed.has(range.value.spec.mkId)), sort: true });
    return marks;
  },
  provide: (f) => EditorView.decorations.from(f)
});

function addLineClass(view, line, cls) {
  const lineObj = view.state.doc.line(Math.max(1, Math.min(line + 1, view.state.doc.lines)));
  const id = ++markSeq;
  dispatchEffects(addLineFx.of({ deco: Decoration.line({ class: cls, mkId: id }), at: lineObj.from }));
  return { id, owner: currentDoc };
}
function removeLineClass(view, handle) {
  dispatchEffects(removeLineFx.of(handle.id), handle.owner || currentDoc);
}
const linePositionCache = new WeakMap();
function lineNumberOfHandle(view, handle) {
  let positions = linePositionCache.get(view.state);
  if (!positions) {
    positions = new Map();
    view.state.field(lineMarksField).between(0, view.state.doc.length, (f, t, deco) => positions.set(deco.spec.mkId, f));
    linePositionCache.set(view.state, positions);
  }
  const pos = positions.get(handle.id);
  return pos == null ? -1 : view.state.doc.lineAt(pos).number - 1;
}

// ---------- ajustes globales (persisten al cambiar de pestaña, como en CM5) ----------
const wrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const globalSettings = { lineWrapping: true, lineNumbers: true, tabSize: 4 };

function globalExtensions() {
  return [
    wrapCompartment.of(globalSettings.lineWrapping ? EditorView.lineWrapping : []),
    tabSizeCompartment.of(EditorState.tabSize.of(globalSettings.tabSize))
  ];
}

// ---------- getLineTokens: traduce el árbol Lezer del modo markdown a los
// mismos tipos "formatting[-x]"/"url" que devolvía el tokenizador de CM5,
// que es de lo que depende livepreview.js para saber qué ocultar. Ver
// OBJETIVOS.md — se creía que Live Preview necesitaba reescribirse entero;
// esto evita esa reescritura para la parte de "qué es un marcador".
function typeForNode(name, text) {
  if (name === 'HeaderMark') return 'formatting formatting-header';
  if (name === 'EmphasisMark') return 'formatting formatting-em formatting-strong';
  if (name === 'StrikethroughMark') return 'formatting formatting-strikethrough';
  if (name === 'CodeMark') return 'formatting formatting-code';
  if (name === 'QuoteMark') return 'formatting formatting-quote';
  if (name === 'LinkMark') return 'formatting formatting-link-string';
  if (name === 'URL') return 'url';
  if (name === 'ListMark') return /^[-*+]$/.test(text) ? 'formatting formatting-list formatting-list-ul' : 'formatting formatting-list formatting-list-ol';
  return null;
}
const tokenTreeCache = new WeakMap();
function tokenTree(state, upto) {
  const language = languageFor(currentDoc.modeSpec);
  let cached = tokenTreeCache.get(state.doc);
  if (!cached || cached.language !== language || cached.upto < upto) {
    const parsed = ensureSyntaxTree(state, upto, 50);
    const tree = parsed || syntaxTree(state);
    // Una reconstrucción grande tiene un solo presupuesto de parseo:
    // si se agota, no volver a gastarlo por cada línea del documento.
    cached = { tree, language, upto: parsed || upto === state.doc.length ? upto : 0 };
    tokenTreeCache.set(state.doc, cached);
  }
  return cached.tree;
}
function getLineTokens(state, lineNum) {
  if (lineNum < 0 || lineNum >= state.doc.lines) return [];
  const line = state.doc.line(lineNum + 1);
  if (line.length === 0) return [];
  const tree = tokenTree(state, line.to);
  const out = [];
  const cur = tree.cursorAt(line.from, 1);
  do {
    if (cur.to <= line.from || cur.from >= line.to) continue;
    const from = Math.max(cur.from, line.from);
    const to = Math.min(cur.to, line.to);
    const type = typeForNode(cur.name, state.sliceDoc(from, to));
    if (type) out.push({ start: from - line.from, end: to - line.from, string: state.sliceDoc(from, to), type });
  } while (cur.next() && cur.from < line.to);
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  return out;
}

// ---------- eventos (cm.on/off) ----------
const listeners = Object.create(null);
let profile = null;
function profileTime(name, started) {
  if (profile) profile[name] = (profile[name] || 0) + performance.now() - started;
}
function fire(event, ...args) {
  const started = profile ? performance.now() : 0;
  (listeners[event] || []).slice().forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } });
  profileTime(event, started);
}

let view = null;
let currentDoc = null;
let cmInstance = null;
let operationDepth = 0;
let pendingEffects = new Map();

function dispatchEffects(effects, owner = currentDoc) {
  if (operationDepth) {
    const pending = pendingEffects.get(owner) || [];
    pending.push(...(Array.isArray(effects) ? effects : [effects]));
    pendingEffects.set(owner, pending);
  } else if (owner._active()) view.dispatch({ effects });
  else owner.state = owner.state.update({ effects }).state;
}

function operation(fn) {
  operationDepth++;
  try { return fn(); }
  finally {
    if (--operationDepth === 0 && pendingEffects.size) {
      const effects = pendingEffects;
      pendingEffects = new Map();
      effects.forEach((pending, owner) => dispatchEffects(pending, owner));
    }
  }
}

// Idioma + su resaltado van juntos en el mismo compartment: cambiar de modo
// (tabs.js, livepreview.js) reconfigura los dos a la vez.
function langAndHighlight(modeSpec) {
  const lang = languageFor(modeSpec);
  const ext = [syntaxHighlighting(highlightStyleFor(modeSpec), { fallback: true })];
  if (lang) ext.unshift(lang);
  return ext;
}

function baseExtensions(compartment, lineNumCompartment, modeSpec) {
  return [
    lineNumCompartment.of(globalSettings.lineNumbers ? [lineNumbers()] : []),
    history(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    autocompletion({ override: [completeAnyWord] }),
    EditorView.contentAttributes.of({ spellcheck: 'false', autocorrect: 'off', autocapitalize: 'off' }),
    marksField,
    lineMarksField,
    ...globalExtensions(),
    compartment.of(langAndHighlight(modeSpec)),
    keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
    EditorView.updateListener.of((update) => {
      if (currentDoc && update.state === view.state) currentDoc.state = update.state;
    }),
    EditorView.domEventHandlers({
      paste(event) { fire('paste', cmInstance, event); return event.defaultPrevented; },
      keydown(event) { fire('keydown', cmInstance, event); return event.defaultPrevented; }
    })
  ];
}

// ---------- Doc (CodeMirror.Doc de CM5): un EditorState propio, con su
// propio historial de deshacer — swapDoc solo cambia cuál está montado. ----
class Doc {
  constructor(content, mode) {
    this.lineHandles = [];
    this.modeSpec = mode || 'markdown';
    this.langCompartment = new Compartment();
    this.lineNumCompartment = new Compartment();
    this.state = EditorState.create({
      doc: content || '',
      extensions: baseExtensions(this.langCompartment, this.lineNumCompartment, this.modeSpec)
    });
  }
  _active() { return this === currentDoc; }
  getValue() {
    if (this.textDoc !== this.state.doc) { this.textDoc = this.state.doc; this.textValue = this.state.doc.toString(); }
    return this.textValue;
  }
  setValue(text) {
    if (this._active()) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text }, selection: { anchor: 0 } });
    else this.state = this.state.update({ changes: { from: 0, to: this.state.doc.length, insert: text }, selection: { anchor: 0 } }).state;
  }
  getCursor(which) {
    const sel = this.state.selection.main;
    const off = which === 'from' ? sel.from : which === 'to' ? sel.to : sel.head;
    return toPos(this.state, off);
  }
  setCursor(pos, ch) {
    const p = ch !== undefined ? { line: pos, ch } : pos;
    const off = toOffset(this.state, p);
    if (this._active()) view.dispatch({ selection: { anchor: off }, scrollIntoView: false });
    else this.state = this.state.update({ selection: { anchor: off } }).state;
  }
  getLine(n) { return n >= 0 && n < this.state.doc.lines ? this.state.doc.line(n + 1).text : ''; }
  lineCount() { return this.state.doc.lines; }
  getLineHandle(n) {
    if (n < 0 || n >= this.state.doc.lines) return null;
    const at = this.state.doc.line(n + 1).from;
    let handle = this.lineHandles.find((h) => h.at === at);
    if (!handle) { handle = { at, classes: new Map() }; this.lineHandles.push(handle); }
    return handle;
  }
  addLineClass(handle, _where, cls) {
    if (typeof handle === 'number') handle = this.getLineHandle(handle);
    if (!handle || handle.classes.has(cls)) return handle;
    const id = ++markSeq;
    handle.classes.set(cls, id);
    const effect = addLineFx.of({ deco: Decoration.line({ class: cls, mkId: id }), at: handle.at });
    dispatchEffects(effect, this);
    return handle;
  }
  removeLineClass(handle, _where, cls) {
    if (!handle) return;
    const ids = cls ? [handle.classes.get(cls)] : [...handle.classes.values()];
    const effects = ids.filter((id) => id != null).map((id) => removeLineFx.of(id));
    if (cls) handle.classes.delete(cls); else handle.classes.clear();
    dispatchEffects(effects, this);
  }
}

// ---------- constructor CodeMirror(el, options) ----------
function CodeMirrorCtor(el, options) {
  options = options || {};
  if (options.lineWrapping !== undefined) globalSettings.lineWrapping = !!options.lineWrapping;
  if (options.lineNumbers !== undefined) globalSettings.lineNumbers = !!options.lineNumbers;
  const doc0 = new Doc(options.value, options.mode);
  currentDoc = doc0;
  view = new EditorView({ state: doc0.state, parent: el, dispatchTransactions(transactions, editor) {
    let started = profile ? performance.now() : 0;
    for (const tr of transactions) {
      if (tr.docChanged) currentDoc.lineHandles.forEach((handle) => { handle.at = tr.changes.mapPos(handle.at, 1); });
    }
    profileTime('mapHandles', started);
    started = profile ? performance.now() : 0;
    editor.update(transactions);
    profileTime('viewUpdate', started);
    currentDoc.state = editor.state;
    // Los callbacks de CM5 pueden añadir decoraciones: emitirlos DESPUÉS
    // de update evita despachar cambios dentro de una actualización de CM6.
    if (transactions.some((tr) => tr.docChanged)) {
      const changes = [];
      for (const tr of transactions) tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
        changes.push({ from: toPos(tr.startState, fromA), to: toPos(tr.startState, toA), text: inserted.toString().split('\n'), removed: tr.startState.sliceDoc(fromA, toA).split('\n'), lineBefore: tr.startState.doc.lineAt(fromA).text, lineAfter: tr.state.doc.lineAt(fromB).text });
      });
      fire('change', cmInstance, changes[0]);
      fire('changes', cmInstance, changes);
    }
    if (transactions.some((tr) => tr.selection || tr.docChanged)) fire('cursorActivity', cmInstance);
  } });

  cmInstance = {
    profile: (on) => { if (on === true) profile = {}; const result = profile && { ...profile }; if (on === false) profile = null; return result; },
    // `cm.state.completionActive.close()` es la forma documentada en CM5
    // (addon show-hint) de cerrar el popup de autocompletado a mano.
    get state() {
      return { completionActive: completionStatus(view.state) ? { close: () => closeCompletion(view) } : null };
    },
    on(event, handler) { (listeners[event] || (listeners[event] = [])).push(handler); },
    off(event, handler) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter((h) => h !== handler);
    },
    getValue: () => currentDoc.getValue(),
    setValue: (text) => currentDoc.setValue(text),
    getLine: (n) => currentDoc.getLine(n),
    lineCount: () => view.state.doc.lines,
    getCursor: (which) => currentDoc.getCursor(which),
    setCursor: (pos, ch) => currentDoc.setCursor(pos, ch),
    setSelection: (anchor, head) => {
      view.dispatch({ selection: { anchor: toOffset(view.state, anchor), head: toOffset(view.state, head != null ? head : anchor) } });
    },
    listSelections: () => view.state.selection.ranges.map((r) => ({ anchor: toPos(view.state, r.anchor), head: toPos(view.state, r.head) })),
    somethingSelected: () => !view.state.selection.main.empty,
    getSelection: () => { const s = view.state.selection.main; return view.state.sliceDoc(s.from, s.to); },
    replaceSelection: (text) => view.dispatch(view.state.replaceSelection(text)),
    getRange: (from, to) => view.state.sliceDoc(toOffset(view.state, from), toOffset(view.state, to)),
    replaceRange: (text, from, to) => {
      const f = toOffset(view.state, from);
      const t = to != null ? toOffset(view.state, to) : f;
      view.dispatch({ changes: { from: f, to: t, insert: text } });
    },
    markText: (from, to, opts) => markText(view, from, to, opts),
    addLineClass: (line, where, cls) => addLineClass(view, typeof line === 'number' ? line : line.line, cls),
    removeLineClass: (handle, _where, _cls) => removeLineClass(view, handle),
    getLineNumber: (handle) => lineNumberOfHandle(view, handle),
    getDoc: () => currentDoc,
    swapDoc(doc) {
      const old = currentDoc;
      currentDoc = doc;
      view.setState(doc.state);
      // `wrapCompartment`/`tabSizeCompartment` son los mismos objetos en el
      // estado de TODAS las pestañas, pero reconfigurarlos con una pestaña
      // activa no toca el estado guardado de las demás (son inmutables e
      // independientes) — así que cada pestaña puede haber quedado con un
      // ajuste viejo. Se sincroniza acá, en cuanto se vuelve a mostrar.
      view.dispatch({
        effects: [
          wrapCompartment.reconfigure(globalSettings.lineWrapping ? EditorView.lineWrapping : []),
          tabSizeCompartment.reconfigure(EditorState.tabSize.of(globalSettings.tabSize)),
          doc.lineNumCompartment.reconfigure(globalSettings.lineNumbers ? [lineNumbers()] : [])
        ]
      });
      fire('swapDoc', cmInstance, old);
      return old;
    },
    getOption(name) {
      if (name === 'mode') return currentDoc.modeSpec;
      if (name === 'lineNumbers') return globalSettings.lineNumbers;
      if (name === 'lineWrapping') return globalSettings.lineWrapping;
      if (name === 'tabSize' || name === 'indentUnit') return globalSettings.tabSize;
      return undefined;
    },
    setOption(name, value) {
      if (name === 'mode') {
        if (currentDoc.modeSpec === value) return;
        currentDoc.modeSpec = value;
        const effect = currentDoc.langCompartment.reconfigure(langAndHighlight(value));
        if (currentDoc._active()) view.dispatch({ effects: effect });
        else currentDoc.state = currentDoc.state.update({ effects: effect }).state;
        fire('optionChange', cmInstance, name);
      } else if (name === 'lineNumbers') {
        globalSettings.lineNumbers = !!value;
        if (currentDoc._active()) view.dispatch({ effects: currentDoc.lineNumCompartment.reconfigure(value ? [lineNumbers()] : []) });
      } else if (name === 'lineWrapping') {
        globalSettings.lineWrapping = !!value;
        if (view) view.dispatch({ effects: wrapCompartment.reconfigure(value ? EditorView.lineWrapping : []) });
      } else if (name === 'tabSize' || name === 'indentUnit') {
        globalSettings.tabSize = Number(value) || 4;
        if (view) view.dispatch({ effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(globalSettings.tabSize)) });
      }
      // 'extraKeys' y otras opciones no usadas por ningún archivo migrado
      // todavía (ver autocomplete.js) se ignoran a propósito: no rompen nada,
      // Ctrl-Space ya funciona vía completionKeymap.
    },
    execCommand(name) {
      if (name === 'selectAll') selectAll(view);
      else if (name === 'undo') undo(view);
      else if (name === 'redo') redo(view);
    },
    getSearchCursor(query, startPos, opts) {
      const normalize = (opts && opts.caseFold) ? (s) => s.toLowerCase() : undefined;
      const from = toOffset(view.state, startPos);
      const sc = new SearchCursor(view.state.doc, query, from, view.state.doc.length, normalize);
      return {
        findNext: () => { sc.next(); return !sc.done; },
        from: () => toPos(view.state, sc.value.from),
        to: () => toPos(view.state, sc.value.to)
      };
    },
    showHint() { startCompletion(view); },
    getLineTokens: (lineNum) => getLineTokens(view.state, lineNum),
    prepareLineTokens: () => tokenTree(view.state, view.state.doc.length),
    coordsChar(coords) {
      const off = view.posAtCoords({ x: coords.left, y: coords.top });
      return toPos(view.state, off == null ? view.state.doc.length : off);
    },
    findWordAt(pos) {
      const line = currentDoc.getLine(pos.line);
      const isWord = (c) => c && /[\p{L}\p{N}_]/u.test(c);
      let a = pos.ch;
      let b = pos.ch;
      if (isWord(line[a]) || isWord(line[a - 1])) {
        while (a > 0 && isWord(line[a - 1])) a--;
        while (b < line.length && isWord(line[b])) b++;
      }
      return { anchor: { line: pos.line, ch: a }, head: { line: pos.line, ch: b } };
    },
    posFromIndex: (index) => toPos(view.state, index),
    indexFromPos: (pos) => toOffset(view.state, pos),
    getScrollInfo: () => ({
      top: view.scrollDOM.scrollTop, left: view.scrollDOM.scrollLeft,
      clientHeight: view.scrollDOM.clientHeight, clientWidth: view.scrollDOM.clientWidth,
      height: view.scrollDOM.scrollHeight, width: view.scrollDOM.scrollWidth
    }),
    charCoords(pos, mode) {
      const off = toOffset(view.state, pos);
      const c = view.coordsAtPos(off) || { left: 0, right: 0, top: 0, bottom: 0 };
      if (mode !== 'local') return c;
      const r = view.scrollDOM.getBoundingClientRect();
      const dx = r.left - view.scrollDOM.scrollLeft;
      const dy = r.top - view.scrollDOM.scrollTop;
      return { left: c.left - dx, right: c.right - dx, top: c.top - dy, bottom: c.bottom - dy };
    },
    scrollTo(x, y) {
      if (x != null) view.scrollDOM.scrollLeft = x;
      if (y != null) view.scrollDOM.scrollTop = y;
    },
    scrollIntoView(pos, margin) {
      if (pos == null) {
        view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head, { yMargin: margin || 0 }) });
        return;
      }
      const from = toOffset(view.state, pos.from !== undefined ? pos.from : pos);
      const to = toOffset(view.state, pos.to !== undefined ? pos.to : pos);
      const range = to === from ? from : EditorSelection.range(from, to);
      view.dispatch({ effects: EditorView.scrollIntoView(range, { yMargin: margin || 0 }) });
    },
    refresh: () => view.requestMeasure(),
    focus: () => view.focus(),
    getWrapperElement: () => view.dom,
    getInputField: () => view.contentDOM,
    operation
  };

  return cmInstance;
}

CodeMirrorCtor.Doc = Doc;
CodeMirrorCtor.cmpPos = (a, b) => a.line - b.line || a.ch - b.ch;
CodeMirrorCtor.hint = { anyword: null }; // ver showHint(): ya usa completeAnyWord nativo de CM6

window.CodeMirror = CodeMirrorCtor;

})();
