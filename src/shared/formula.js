// Fórmulas de las bases de datos: un subconjunto de expresiones JavaScript
// (prop("Col"), Math, operadores, ternario, plantillas, métodos de texto y
// listas, flechas para map/filter) evaluado por un intérprete propio. Antes
// se usaba new Function: una fórmula guardada en una base ajena podía usar
// window.mdEditor (terminal, archivos). Acá no hay globales salvo la lista
// blanca y no se pueden leer constructor/__proto__/prototype ni propiedades
// de funciones (.call, .bind…), que son las vías para llegar a Function.
// Ventana: window.mdFormula. Node: pruebas unitarias.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.mdFormula = api;
})(typeof self !== 'undefined' ? self : this, () => {
  'use strict';

  const PUNCT = ['===', '!==', '?.', '=>', '==', '!=', '<=', '>=', '&&', '||', '??', '**',
    '+', '-', '*', '/', '%', '<', '>', '!', '?', ':', '.', ',', '(', ')', '[', ']', '{', '}'];
  const ID_START = /[\p{L}_$]/u;
  const ID_PART = /[\p{L}\p{N}_$]/u;

  function fail(msg) { throw new SyntaxError(msg); }

  function readString(src, i, quote) {
    let out = '';
    i++;
    while (i < src.length && src[i] !== quote) {
      let ch = src[i];
      if (ch === '\\') {
        i++;
        const e = src[i];
        const map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', v: '\v', 0: '\0' };
        if (e === 'u' && src[i + 1] === '{') {
          const end = src.indexOf('}', i);
          if (end < 0) fail('Escape inválido');
          ch = String.fromCodePoint(parseInt(src.slice(i + 2, end), 16)); i = end;
        } else if (e === 'u') {
          ch = String.fromCharCode(parseInt(src.slice(i + 1, i + 5), 16)); i += 4;
        } else if (e === 'x') {
          ch = String.fromCharCode(parseInt(src.slice(i + 1, i + 3), 16)); i += 2;
        } else ch = e in map ? map[e] : e;
      }
      out += ch;
      i++;
    }
    if (i >= src.length) fail('Texto sin cerrar');
    return { value: out, end: i + 1 };
  }

  function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
      const ch = src[i];
      if (/\s/.test(ch)) { i++; continue; }
      if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        const m = /^(0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/.exec(src.slice(i));
        tokens.push({ t: 'num', v: Number(m[0]) }); i += m[0].length; continue;
      }
      if (ch === '"' || ch === "'") {
        const s = readString(src, i, ch);
        tokens.push({ t: 'str', v: s.value }); i = s.end; continue;
      }
      if (ch === '`') {
        const parts = [];
        const exprs = [];
        let buf = '';
        i++;
        while (i < src.length && src[i] !== '`') {
          if (src[i] === '\\') {
            const s = readString('"' + src[i] + src[i + 1] + '"', 0, '"');
            buf += s.value; i += 2;
          } else if (src[i] === '$' && src[i + 1] === '{') {
            let depth = 1;
            let j = i + 2;
            while (j < src.length && depth) {
              if (src[j] === '{') depth++;
              else if (src[j] === '}') depth--;
              else if (src[j] === '"' || src[j] === "'") { j = readString(src, j, src[j]).end; continue; }
              j++;
            }
            if (depth) fail('Plantilla sin cerrar');
            parts.push(buf); buf = '';
            exprs.push(parse(src.slice(i + 2, j - 1)));
            i = j;
          } else buf += src[i++];
        }
        if (i >= src.length) fail('Plantilla sin cerrar');
        parts.push(buf);
        tokens.push({ t: 'tpl', parts, exprs }); i++; continue;
      }
      if (ID_START.test(ch)) {
        let j = i + 1;
        while (j < src.length && ID_PART.test(src[j])) j++;
        tokens.push({ t: 'id', v: src.slice(i, j) }); i = j; continue;
      }
      let p = PUNCT.find((op) => src.startsWith(op, i));
      if (p === '?.' && /[0-9]/.test(src[i + 2] || '')) p = '?';
      if (!p) fail(`Carácter no permitido: ${ch}`);
      tokens.push({ t: 'p', v: p }); i += p.length;
    }
    tokens.push({ t: 'end' });
    return tokens;
  }

  const BINARY = {
    '??': 1, '||': 2, '&&': 3,
    '==': 4, '!=': 4, '===': 4, '!==': 4,
    '<': 5, '>': 5, '<=': 5, '>=': 5,
    '+': 6, '-': 6, '*': 7, '/': 7, '%': 7, '**': 8
  };

  function parse(src) {
    const tokens = tokenize(src);
    let pos = 0;
    const peek = (o = 0) => tokens[pos + o];
    const isP = (v, o = 0) => peek(o).t === 'p' && peek(o).v === v;
    const eat = (v) => { if (!isP(v)) fail(`Se esperaba "${v}"`); pos++; };

    function arrowAhead() {
      if (peek().t === 'id' && isP('=>', 1)) return true;
      if (!isP('(')) return false;
      let depth = 0;
      for (let k = pos; k < tokens.length; k++) {
        const tk = tokens[k];
        if (tk.t === 'p' && tk.v === '(') depth++;
        else if (tk.t === 'p' && tk.v === ')' && --depth === 0) {
          return tokens[k + 1].t === 'p' && tokens[k + 1].v === '=>';
        }
      }
      return false;
    }

    function expression() {
      if (arrowAhead()) {
        const params = [];
        if (peek().t === 'id') params.push(tokens[pos++].v);
        else {
          eat('(');
          while (!isP(')')) {
            if (peek().t !== 'id') fail('Parámetro inválido');
            params.push(tokens[pos++].v);
            if (!isP(')')) eat(',');
          }
          eat(')');
        }
        eat('=>');
        return { k: 'arrow', params, body: expression() };
      }
      const test = binary(1);
      if (!isP('?')) return test;
      pos++;
      const yes = expression();
      eat(':');
      return { k: 'cond', test, yes, no: expression() };
    }

    function binary(minPrec) {
      let left = unary();
      for (;;) {
        const tk = peek();
        const prec = tk.t === 'p' ? BINARY[tk.v] : undefined;
        if (!prec || prec < minPrec) break;
        pos++;
        const right = binary(tk.v === '**' ? prec : prec + 1);
        left = { k: 'bin', op: tk.v, left, right };
      }
      return left;
    }

    function unary() {
      const tk = peek();
      if (tk.t === 'p' && ['!', '-', '+'].includes(tk.v)) { pos++; return { k: 'un', op: tk.v, arg: unary() }; }
      if (tk.t === 'id' && tk.v === 'typeof') { pos++; return { k: 'un', op: 'typeof', arg: unary() }; }
      if (tk.t === 'id' && tk.v === 'new') {
        pos++;
        let callee = primary();
        while (isP('.')) { pos++; callee = { k: 'mem', obj: callee, prop: { k: 'lit', v: name() } }; }
        const args = isP('(') ? callArgs() : [];
        return postfix({ k: 'new', callee, args });
      }
      return postfix(primary());
    }

    function name() {
      const tk = tokens[pos++];
      if (tk.t !== 'id') fail('Se esperaba un nombre');
      return tk.v;
    }

    function callArgs() {
      eat('(');
      const args = [];
      while (!isP(')')) {
        args.push(expression());
        if (!isP(')')) eat(',');
      }
      eat(')');
      return args;
    }

    function postfix(node) {
      for (;;) {
        if (isP('.')) { pos++; node = { k: 'mem', obj: node, prop: { k: 'lit', v: name() } }; }
        else if (isP('?.')) {
          pos++;
          if (isP('(')) node = { k: 'call', callee: node, args: callArgs(), opt: true };
          else if (isP('[')) { pos++; const p = expression(); eat(']'); node = { k: 'mem', obj: node, prop: p, opt: true }; }
          else node = { k: 'mem', obj: node, prop: { k: 'lit', v: name() }, opt: true };
        } else if (isP('[')) { pos++; const p = expression(); eat(']'); node = { k: 'mem', obj: node, prop: p }; }
        else if (isP('(')) node = { k: 'call', callee: node, args: callArgs() };
        else return node;
      }
    }

    function primary() {
      const tk = tokens[pos++];
      if (tk.t === 'num' || tk.t === 'str') return { k: 'lit', v: tk.v };
      if (tk.t === 'tpl') return { k: 'tpl', parts: tk.parts, exprs: tk.exprs };
      if (tk.t === 'id') {
        if (tk.v === 'true') return { k: 'lit', v: true };
        if (tk.v === 'false') return { k: 'lit', v: false };
        if (tk.v === 'null') return { k: 'lit', v: null };
        if (tk.v === 'undefined') return { k: 'lit', v: undefined };
        return { k: 'id', v: tk.v };
      }
      if (tk.t === 'p' && tk.v === '(') { const e = expression(); eat(')'); return e; }
      if (tk.t === 'p' && tk.v === '[') {
        const items = [];
        while (!isP(']')) { items.push(expression()); if (!isP(']')) eat(','); }
        eat(']');
        return { k: 'arr', items };
      }
      if (tk.t === 'p' && tk.v === '{') {
        const entries = [];
        while (!isP('}')) {
          const key = tokens[pos++];
          if (key.t !== 'id' && key.t !== 'str' && key.t !== 'num') fail('Clave inválida');
          eat(':');
          entries.push([String(key.v), expression()]);
          if (!isP('}')) eat(',');
        }
        eat('}');
        return { k: 'obj', entries };
      }
      fail('Expresión incompleta');
    }

    const ast = expression();
    if (peek().t !== 'end') fail('Sobra texto al final de la fórmula');
    return ast;
  }

  const BLOCKED = new Set(['constructor', '__proto__', 'prototype', '__defineGetter__', '__defineSetter__',
    '__lookupGetter__', '__lookupSetter__', 'caller', 'callee', 'arguments']);
  const SAFE_DATE = function () { return new Date(...arguments); };
  const STATICS = new Map([
    [Math, Math], [JSON, JSON], [Number, Number], [String, String], [Boolean, Boolean], [Array, Array], [SAFE_DATE, Date]
  ]);
  const GLOBALS = {
    Math, JSON, Number, String, Boolean, Array, Date: SAFE_DATE,
    parseInt, parseFloat, isNaN, isFinite, NaN, Infinity
  };

  function getMember(obj, key) {
    if (obj == null) throw new TypeError(`No se puede leer "${key}" de ${obj}`);
    const k = typeof key === 'symbol' ? key : String(key);
    if (BLOCKED.has(k)) throw new TypeError(`Propiedad no permitida: ${k}`);
    if (typeof obj === 'function') {
      if (!STATICS.has(obj)) throw new TypeError('Las funciones no tienen propiedades en las fórmulas');
      obj = STATICS.get(obj);
    }
    return obj[k];
  }

  function evaluate(node, scope) {
    switch (node.k) {
      case 'lit': return node.v;
      case 'tpl': return node.parts.reduce((s, part, i) => s + part + (i < node.exprs.length ? String(evaluate(node.exprs[i], scope)) : ''), '');
      case 'id': {
        for (let s = scope; s; s = s.parent) if (Object.prototype.hasOwnProperty.call(s.vars, node.v)) return s.vars[node.v];
        throw new ReferenceError(`${node.v} no está definido`);
      }
      case 'arr': return node.items.map((n) => evaluate(n, scope));
      case 'obj': {
        const o = {};
        for (const [key, n] of node.entries) {
          if (BLOCKED.has(key)) throw new TypeError(`Clave no permitida: ${key}`);
          o[key] = evaluate(n, scope);
        }
        return o;
      }
      case 'un': {
        const v = evaluate(node.arg, scope);
        if (node.op === '!') return !v;
        if (node.op === '-') return -v;
        if (node.op === '+') return +v;
        return typeof v;
      }
      case 'bin': {
        const l = evaluate(node.left, scope);
        if (node.op === '&&') return l && evaluate(node.right, scope);
        if (node.op === '||') return l || evaluate(node.right, scope);
        if (node.op === '??') return l ?? evaluate(node.right, scope);
        const r = evaluate(node.right, scope);
        switch (node.op) {
          case '+': return l + r;
          case '-': return l - r;
          case '*': return l * r;
          case '/': return l / r;
          case '%': return l % r;
          case '**': return l ** r;
          case '==': return l == r;
          case '!=': return l != r;
          case '===': return l === r;
          case '!==': return l !== r;
          case '<': return l < r;
          case '>': return l > r;
          case '<=': return l <= r;
          default: return l >= r;
        }
      }
      case 'cond': return evaluate(node.test, scope) ? evaluate(node.yes, scope) : evaluate(node.no, scope);
      case 'mem': {
        const obj = evaluate(node.obj, scope);
        if (node.opt && obj == null) return undefined;
        return getMember(obj, node.prop.k === 'lit' ? node.prop.v : evaluate(node.prop, scope));
      }
      case 'call': {
        let self;
        let fn;
        if (node.callee.k === 'mem') {
          self = evaluate(node.callee.obj, scope);
          if (node.callee.opt && self == null) return undefined;
          fn = getMember(self, node.callee.prop.k === 'lit' ? node.callee.prop.v : evaluate(node.callee.prop, scope));
          if (typeof self === 'function') self = STATICS.get(self);
        } else fn = evaluate(node.callee, scope);
        if (node.opt && fn == null) return undefined;
        if (typeof fn !== 'function') throw new TypeError('No es una función');
        return fn.apply(self, node.args.map((a) => evaluate(a, scope)));
      }
      case 'new': {
        const C = evaluate(node.callee, scope);
        if (C !== SAFE_DATE) throw new TypeError('Solo se permite new Date()');
        return new Date(...node.args.map((a) => evaluate(a, scope)));
      }
      case 'arrow': return (...args) => {
        const vars = {};
        node.params.forEach((p, i) => { vars[p] = args[i]; });
        return evaluate(node.body, { vars, parent: scope });
      };
      default: throw new TypeError('Expresión no soportada');
    }
  }

  const cache = new Map();
  function compile(expr) {
    let ast = cache.get(expr);
    if (!ast) {
      ast = parse(expr);
      if (cache.size > 500) cache.clear();
      cache.set(expr, ast);
    }
    return ast;
  }

  // Lanza si la fórmula es inválida o falla; quien llama decide qué mostrar.
  function run(expr, prop) {
    return evaluate(compile(expr), { vars: { ...GLOBALS, prop }, parent: null });
  }

  return { run, parse };
});
