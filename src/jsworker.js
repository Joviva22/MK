// Corre en un Web Worker: sin window, sin document, sin require, sin
// window.mdEditor — no tiene forma de tocar tus archivos ni el resto de la
// app. Es el sandbox real detrás de "Ejecutar" en los bloques ```js```.

// Estilo notebook: si la última línea no vacía es una expresión suelta (no
// una declaración/asignación/return/etc.), se le antepone "return" para
// mostrar su valor solo, sin que haga falta escribir "return" a mano.
function autoReturnLastExpression(code) {
  const lines = code.split('\n');
  let i = lines.length - 1;
  while (i >= 0 && lines[i].trim() === '') i--;
  if (i < 0) return code;
  const last = lines[i].trim();
  if (/^(return\b|const\b|let\b|var\b|if\b|for\b|while\b|function\b|class\b|\}|\/\/|console\.)/.test(last) || /[={]\s*$/.test(last) || last.includes('=')) {
    return code;
  }
  lines[i] = `return (${last.replace(/;\s*$/, '')});`;
  return lines.join('\n');
}

self.onmessage = (e) => {
  const code = e.data;
  const logs = [];
  const fakeConsole = {
    log: (...args) => logs.push(args.map(String).join(' ')),
    error: (...args) => logs.push('Error: ' + args.map(String).join(' ')),
    warn: (...args) => logs.push('Aviso: ' + args.map(String).join(' '))
  };
  try {
    const fn = new Function('console', autoReturnLastExpression(code));
    const result = fn(fakeConsole);
    if (result !== undefined) logs.push('=> ' + String(result));
    self.postMessage({ ok: true, output: logs.join('\n') });
  } catch (err) {
    self.postMessage({ ok: false, output: (err && err.message) || String(err) });
  }
};
