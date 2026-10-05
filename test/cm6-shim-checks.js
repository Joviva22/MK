(async () => {
  const results = [];
  const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail || '' });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    const el = document.getElementById('editor-pane');
    const cm = CodeMirror(el, { mode: 'markdown', lineWrapping: true, lineNumbers: true, value: 'hola\nmundo\n' });

    check('constructor: getValue inicial', cm.getValue() === 'hola\nmundo\n', cm.getValue());
    check('getLine/lineCount', cm.getLine(0) === 'hola' && cm.lineCount() === 3, `${cm.getLine(0)}|${cm.lineCount()}`);

    cm.setCursor({ line: 1, ch: 2 });
    const c1 = cm.getCursor();
    check('setCursor/getCursor', c1.line === 1 && c1.ch === 2, JSON.stringify(c1));

    cm.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 4 });
    check('somethingSelected + getSelection', cm.somethingSelected() && cm.getSelection() === 'hola', cm.getSelection());
    cm.replaceSelection('CHAU');
    check('replaceSelection', cm.getValue().startsWith('CHAU'), cm.getValue());

    cm.replaceRange('X', { line: 1, ch: 0 }, { line: 1, ch: 1 });
    check('replaceRange', cm.getLine(1) === 'Xundo', cm.getLine(1));

    // ---- eventos ----
    let changeFired = 0;
    let cursorFired = 0;
    cm.on('change', () => { changeFired++; });
    cm.on('cursorActivity', () => { cursorFired++; });
    cm.replaceRange('!', { line: 0, ch: 0 });
    await wait(30);
    check('evento change', changeFired > 0, String(changeFired));
    cm.setCursor({ line: 0, ch: 0 });
    await wait(30);
    check('evento cursorActivity', cursorFired > 0, String(cursorFired));

    // ---- markText: className ----
    const m1 = cm.markText({ line: 0, ch: 0 }, { line: 0, ch: 1 }, { className: 'test-mark' });
    await wait(10);
    const hasMarkClass = !!el.querySelector('.test-mark');
    m1.clear();
    await wait(10);
    const markClassGone = !el.querySelector('.test-mark');
    check('markText className aparece y se limpia', hasMarkClass && markClassGone, `${hasMarkClass}/${markClassGone}`);

    // ---- markText: replacedWith + clearOnEnter ----
    cm.setValue('palabra secreta aqui\n');
    const widget = document.createElement('span');
    widget.className = 'my-widget';
    widget.textContent = '[oculto]';
    const from2 = { line: 0, ch: 0 };
    const to2 = { line: 0, ch: 7 };
    const m2 = cm.markText(from2, to2, { replacedWith: widget, clearOnEnter: true });
    await wait(10);
    const widgetShown = !!el.querySelector('.my-widget');
    cm.setCursor({ line: 0, ch: 2 }); // adentro del rango: clearOnEnter debería sacarlo
    await wait(10);
    const widgetGoneOnEnter = !el.querySelector('.my-widget');
    check('markText replacedWith se muestra y clearOnEnter lo saca al entrar el cursor', widgetShown && widgetGoneOnEnter, `${widgetShown}/${widgetGoneOnEnter}`);
    m2.clear();

    // ---- addLineClass / removeLineClass / getLineNumber ----
    cm.setValue('l0\nl1\nl2\nl3\n');
    const handle = cm.addLineClass(2, 'wrap', 'my-line-class');
    await wait(10);
    const lineHasClass = () => {
      const lines = Array.from(el.querySelectorAll('.cm-line'));
      return lines.findIndex((l) => l.classList.contains('my-line-class'));
    };
    const idxBefore = lineHasClass();
    // Insertar una línea ANTES: la clase debería seguir la línea de contenido (l2), no el número fijo 2.
    cm.replaceRange('nueva\n', { line: 0, ch: 0 });
    await wait(10);
    const idxAfter = lineHasClass();
    const lineNumAfter = cm.getLineNumber(handle);
    cm.removeLineClass(handle, 'wrap', 'my-line-class');
    await wait(10);
    const idxRemoved = lineHasClass();
    check('addLineClass sigue la línea tras insertar arriba (no el número fijo)', idxBefore === 2 && idxAfter === 3 && lineNumAfter === 3, `antes=${idxBefore} despues=${idxAfter} getLineNumber=${lineNumAfter}`);
    check('removeLineClass la saca', idxRemoved === -1, String(idxRemoved));

    // ---- swapDoc + historial propio por pestaña ----
    cm.setValue('doc-uno-original\n');
    const docA = cm.getDoc();
    cm.replaceRange('doc-uno-editado\n', { line: 0, ch: 0 }, { line: 1, ch: 0 });
    const docB = new CodeMirror.Doc('doc-dos\n', 'markdown');
    cm.swapDoc(docB);
    check('swapDoc cambia el contenido visible', cm.getValue() === 'doc-dos\n', cm.getValue());
    cm.replaceRange('doc-dos-editado\n', { line: 0, ch: 0 }, { line: 1, ch: 0 });
    cm.swapDoc(docA);
    check('swapDoc de vuelta conserva los cambios de la pestaña anterior', cm.getValue() === 'doc-uno-editado\n', cm.getValue());
    check('doc.getValue() de una pestaña inactiva funciona', docB.getValue() === 'doc-dos-editado\n', docB.getValue());

    // ---- ajustes globales sobreviven swapDoc ----
    cm.setOption('lineWrapping', false);
    cm.swapDoc(docB);
    await wait(10);
    const wrapClassOnB = el.querySelector('.cm-lineWrapping');
    check('lineWrapping=false se aplica también a una pestaña recién activada', !wrapClassOnB, String(!!wrapClassOnB));
    cm.setOption('lineWrapping', true);

    // ---- modo (mode) ----
    cm.setOption('mode', 'python');
    check('getOption(mode) refleja el cambio', cm.getOption('mode') === 'python', cm.getOption('mode'));

    // ---- execCommand selectAll ----
    cm.setValue('todo\nseleccionado\n');
    cm.execCommand('selectAll');
    check('execCommand selectAll', cm.getSelection() === 'todo\nseleccionado\n', JSON.stringify(cm.getSelection()));

    // ---- findWordAt ----
    cm.setValue('una palabra clave\n');
    const w = cm.findWordAt({ line: 0, ch: 6 });
    check('findWordAt', cm.getRange(w.anchor, w.head) === 'palabra', cm.getRange(w.anchor, w.head));

    // ---- getLineTokens (livepreview.js depende de esto: formatting-*/url) ----
    cm.setOption('mode', 'markdown');
    cm.setValue('# Titulo\n**negrita** y *cursiva* y `codigo` y [link](http://x.com) y ~~tachado~~\n- item ul\n1. item ol\n> cita\n');
    const tByLine = (n) => cm.getLineTokens(n, true);
    const t0 = tByLine(0);
    check('getLineTokens: header', t0.some((t) => /formatting-header/.test(t.type) && t.string === '#'), JSON.stringify(t0));
    const t1 = tByLine(1);
    check('getLineTokens: negrita/cursiva (formatting-em)', t1.filter((t) => /formatting-em/.test(t.type)).length === 4, JSON.stringify(t1.map((t) => t.type + ':' + t.string)));
    check('getLineTokens: código inline (formatting-code)', t1.some((t) => /formatting-code/.test(t.type) && t.string === '`'), JSON.stringify(t1));
    check('getLineTokens: link ([ ] ( url )) → 4 formatting-link-string + 1 url', t1.filter((t) => /formatting-link-string/.test(t.type)).length === 4 && t1.some((t) => t.type === 'url' && t.string === 'http://x.com'), JSON.stringify(t1.map((t) => t.type + ':' + t.string)));
    check('getLineTokens: tachado (formatting-strikethrough)', t1.filter((t) => /formatting-strikethrough/.test(t.type)).length === 2, JSON.stringify(t1));
    const t2 = tByLine(2);
    check('getLineTokens: lista sin orden (formatting-list-ul)', t2.some((t) => /formatting-list-ul/.test(t.type) && t.string === '-'), JSON.stringify(t2));
    const t3 = tByLine(3);
    check('getLineTokens: lista ordenada (formatting-list-ol, no -ul)', t3.some((t) => /formatting-list-ol/.test(t.type)) && !t3.some((t) => /formatting-list-ul/.test(t.type)), JSON.stringify(t3));
    const t4 = tByLine(4);
    check('getLineTokens: cita (formatting-quote)', t4.some((t) => /formatting-quote/.test(t.type) && t.string === '>'), JSON.stringify(t4));

    // ---- handleMouseEvents: false (widgets con su propio click, como
    // imágenes/wikilinks de livepreview.js) no dejan que CM6 mueva el
    // cursor ahí; sin esa opción (como foldclutter.js) sí lo deja entrar. ----
    cm.setValue('abcdefghij\n');
    const w1 = document.createElement('span');
    w1.textContent = 'W1';
    w1.className = 'w1';
    cm.markText({ line: 0, ch: 2 }, { line: 0, ch: 5 }, { replacedWith: w1, handleMouseEvents: false });
    await wait(10);
    cm.setCursor({ line: 0, ch: 0 });
    document.querySelector('.w1').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    await wait(10);
    const cursorAfterOwnClick = cm.getCursor();
    check('handleMouseEvents:false — CM6 no mueve el cursor solo (el nodo maneja su propio clic)', cursorAfterOwnClick.ch === 0, JSON.stringify(cursorAfterOwnClick));

    cm.setValue('abcdefghij\n');
    const w2 = document.createElement('span');
    w2.textContent = 'W2';
    w2.className = 'w2';
    cm.markText({ line: 0, ch: 2 }, { line: 0, ch: 5 }, { replacedWith: w2 });
    await wait(10);
    cm.setCursor({ line: 0, ch: 0 });
    document.querySelector('.w2').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    await wait(10);
    const cursorAfterDefaultClick = cm.getCursor();
    check('sin handleMouseEvents (foldclutter) — CM6 sí puede mover el cursor al clic', cursorAfterDefaultClick.line !== 0 || cursorAfterDefaultClick.ch !== 0, JSON.stringify(cursorAfterDefaultClick));

    // ---- resaltado propio de markdown (normal vs Live Preview) ----
    cm.setValue('# Titulo\ntexto comun\n');
    await wait(10);
    const spansNormal = Array.from(el.querySelectorAll('.cm-line span'));
    const headingSpanNormal = spansNormal.find((s) => s.textContent.includes('Titulo'));
    const plainLineNormal = el.querySelectorAll('.cm-line')[1];
    const normalHeadingSize = headingSpanNormal ? getComputedStyle(headingSpanNormal).fontSize : null;
    const normalPlainSize = plainLineNormal ? getComputedStyle(plainLineNormal).fontSize : null;
    check('modo normal: encabezado NO agranda el texto (mismo tamaño que una línea común)', normalHeadingSize === normalPlainSize, `${normalHeadingSize} vs ${normalPlainSize}`);
    check('modo normal: encabezado en color de acento', headingSpanNormal && getComputedStyle(headingSpanNormal).color === 'rgb(37, 99, 235)', headingSpanNormal && getComputedStyle(headingSpanNormal).color);

    cm.setOption('mode', { name: 'markdown', highlightFormatting: true, strikethrough: true });
    await wait(10);
    const spansLive = Array.from(el.querySelectorAll('.cm-line span'));
    const markSpanLive = spansLive.find((s) => s.textContent === '#');
    const contentSpanLive = spansLive.find((s) => s.textContent.includes('Titulo'));
    const liveMarkColor = markSpanLive ? getComputedStyle(markSpanLive).color : null;
    const liveContentColor = contentSpanLive ? getComputedStyle(contentSpanLive).color : null;
    const liveContentSize = contentSpanLive ? parseFloat(getComputedStyle(contentSpanLive).fontSize) : 0;
    check('Live Preview: encabezado se agranda', liveContentSize > 20, String(liveContentSize));
    check('Live Preview: la marca "#" se ve distinta del título (atenuada)', liveMarkColor !== liveContentColor, `${liveMarkColor} vs ${liveContentColor}`);
    cm.setOption('mode', 'markdown');

    // ---- getSearchCursor ----
    cm.setValue('gato perro Gato pajaro\n');
    const sc = cm.getSearchCursor('gato', { line: 0, ch: 0 }, { caseFold: true });
    let found = 0;
    while (sc.findNext()) found++;
    check('getSearchCursor caseFold encuentra 2 (gato + Gato)', found === 2, String(found));

    // ---- misceláneos que no deben tirar excepción ----
    cm.getScrollInfo();
    cm.charCoords(cm.getCursor(), 'local');
    cm.scrollIntoView(null, 50);
    cm.refresh();
    cm.focus();
    check('métodos misceláneos no rompen', true);

    // ---- CodeMirror.cmpPos ----
    check('cmpPos', CodeMirror.cmpPos({ line: 1, ch: 0 }, { line: 0, ch: 5 }) > 0);

    // ---- Doc directo (para typewriter.js: getLineHandle vía Doc) ----
    cm.setValue('a\nb\nc\n');
    const doc = cm.getDoc();
    check('doc.getLine/lineCount', doc.getLine(1) === 'b' && doc.lineCount() === 4, `${doc.getLine(1)}|${doc.lineCount()}`);
    const docHandle = doc.getLineHandle(1);
    check('Doc: identidad estable de los handles', docHandle === doc.getLineHandle(1));
    doc.addLineClass(docHandle, 'wrap', 'test-doc-line');
    cm.replaceRange('arriba\n', { line: 0, ch: 0 });
    check('Doc: handle sigue la línea al insertar', docHandle === doc.getLineHandle(2));
    const other = new CodeMirror.Doc('otra pestaña', 'markdown');
    cm.swapDoc(other);
    doc.removeLineClass(docHandle, 'wrap', 'test-doc-line');
    cm.swapDoc(doc);
    await wait(20);
    check('Doc: limpiar marcas de una pestaña inactiva', !el.querySelector('.test-doc-line'));
    const oldMark = cm.markText({ line: 0, ch: 0 }, { line: 0, ch: 2 }, { className: 'test-inactive-mark' });
    cm.swapDoc(other);
    oldMark.clear();
    cm.swapDoc(doc);
    await wait(20);
    check('markText: clear limpia el documento propietario inactivo', !el.querySelector('.test-inactive-mark'));
    const historyDoc = new CodeMirror.Doc('base', 'markdown');
    cm.swapDoc(historyDoc);
    cm.replaceRange(' editado', { line: 0, ch: 4 });
    cm.swapDoc(other);
    cm.replaceRange('!', { line: 0, ch: 0 });
    cm.swapDoc(historyDoc);
    cm.execCommand('undo');
    check('Historial: deshacer independiente por pestaña', cm.getValue() === 'base' && other.getValue().startsWith('!'));
    cm.execCommand('redo');
    check('Historial: rehacer tras cambiar de pestaña', cm.getValue() === 'base editado');
    cm.setValue('palabra palabraNueva\npala');
    cm.setCursor({ line: 1, ch: 4 });
    cm.showHint();
    await wait(100);
    check('Autocompletado nativo: sugerencias del documento', !!el.querySelector('.cm-tooltip-autocomplete'));
    cm.state.completionActive?.close();
    for (const [setting, key] of [['enter', 'Enter'], ['tab', 'Tab'], ['both', 'Tab']]) {
      cm.setOption('completionAcceptKey', setting);
      cm.setValue('palabraNueva\npala');
      cm.setCursor({ line: 1, ch: 4 });
      cm.showHint();
      await wait(150);
      el.querySelector('.cm-content').dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true, cancelable: true }));
      check(`Autocompletado: aceptar con ${key} (${setting})`, cm.getLine(1) === 'palabraNueva');
      cm.state.completionActive?.close();
    }
    cm.setOption('completionAcceptKey', 'enter');

    window.mdCodeMirror = cm;
    window.mdState = { currentFilePath: null, rootFolder: null };
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'livepreview.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    const liveSource = '# Título\n\nTexto **negrita**.\n\n- [ ] tarea\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nfin';
    cm.setValue(liveSource);
    cm.setCursor({ line: 10, ch: 0 });
    console.log('CM6_LIVE: enable');
    window.mdLivePreview.enable();
    console.log('CM6_LIVE: rebuild');
    window.mdLivePreview.rebuild();
    await wait(50);
    check('Live Preview real: reconstruye sin colgar y conserva el Markdown', cm.getValue() === liveSource && !!el.querySelector('.mk-live-task'));
    cm.setCursor({ line: 4, ch: 0 });
    await wait(50);
    check('Live Preview real: cursor revela la tarea para editar', !el.querySelector('.mk-live-task'));
    window.mdLivePreview.disable();

    cm.setValue('inicio\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\n> [!NOTE]\n> texto\n\n```js\nconst x = 1;\n```\n\nfin');
    cm.setCursor({ line: 13, ch: 0 });
    window.mdLivePreview.enable();
    const beforeBlocks = window.mdLivePreview.metrics();
    cm.replaceRange('9', { line: 4, ch: 2 }, { line: 4, ch: 3 });
    cm.replaceRange('nuevo', { line: 7, ch: 2 }, { line: 7, ch: 7 });
    cm.replaceRange('2', { line: 10, ch: 10 }, { line: 10, ch: 11 });
    await wait(180);
    check('Live Preview incremental: tabla, callout y cuerpo de código sin reconstrucción global', window.mdLivePreview.metrics().rebuilds === beforeBlocks.rebuilds && el.querySelector('.mk-live-table')?.textContent.includes('9') && el.querySelector('.mk-live-callout')?.textContent.includes('nuevo') && cm.getLine(10) === 'const x = 2;');
    cm.replaceRange('x', { line: 3, ch: 1 }, { line: 3, ch: 2 });
    await wait(180);
    check('Live Preview incremental: romper el separador de tabla exige reconstrucción', window.mdLivePreview.metrics().rebuilds > beforeBlocks.rebuilds && !el.querySelector('.mk-live-table'));
    window.mdLivePreview.disable();

    const largeSource = Array.from({ length: 600 }, (_, i) => i === 550 ? '**lejano**' : `Párrafo ${i}`).join('\n');
    cm.setValue(largeSource);
    cm.setCursor({ line: 150, ch: 4 });
    window.mdLivePreview.enable();
    const beforeLocal = window.mdLivePreview.metrics();
    cm.replaceRange('texto', { line: 150, ch: 4 });
    cm.setCursor({ line: 151, ch: 0 });
    await wait(180);
    const afterLocal = window.mdLivePreview.metrics();
    check('Live Preview incremental: prosa actualiza solo vecinas, sin reconstruir 600 líneas', afterLocal.rebuilds === beforeLocal.rebuilds && afterLocal.incrementalUpdates > beforeLocal.incrementalUpdates && afterLocal.decoratedUnits - beforeLocal.decoratedUnits <= 6, JSON.stringify({ beforeLocal, afterLocal }));
    check('Tokens Markdown: formato disponible lejos del inicio', cm.getLineTokens(550).filter((token) => /formatting-em/.test(token.type || '')).length === 2);
    const beforeInline = window.mdLivePreview.metrics();
    cm.replaceRange('nuevo', { line: 550, ch: 4 });
    await wait(180);
    const afterInline = window.mdLivePreview.metrics();
    check('Live Preview: escribir dentro de negrita no reconstruye la nota y conserva sus delimitadores', afterInline.rebuilds === beforeInline.rebuilds && afterInline.incrementalUpdates > beforeInline.incrementalUpdates && cm.getLineTokens(550).filter((token) => /formatting-em/.test(token.type || '')).length === 2);
    check('Live Preview CM6: ocultar marcadores no crea widgets vacíos', !el.querySelector('.mk-live-hidden'));
    cm.replaceRange(' ', { line: 550, ch: 5 });
    await wait(180);
    check('Live Preview: espacio dentro de texto con formato conserva actualización local', window.mdLivePreview.metrics().rebuilds === beforeInline.rebuilds && cm.getLineTokens(550).filter((token) => /formatting-em/.test(token.type || '')).length === 2);
    cm.replaceRange('```js\nconst x = 1;\n```\n', { line: 0, ch: 0 });
    await wait(180);
    check('Live Preview incremental: cambio estructural vuelve al camino completo', window.mdLivePreview.metrics().rebuilds > afterLocal.rebuilds && !!el.querySelector('.mk-live-fence'));
    window.mdLivePreview.disable();

    cm.setValue('12. elemento\n    continuación\n\nfin');
    cm.setCursor({ line: 3, ch: 0 });
    window.mdLivePreview.enable();
    const beforePrefix = window.mdLivePreview.metrics().rebuilds;
    cm.replaceRange('x', { line: 0, ch: 1 });
    await wait(180);
    check('Live Preview: editar el ordinal de una lista exige reconstruir su estructura', window.mdLivePreview.metrics().rebuilds > beforePrefix);
    window.mdLivePreview.disable();

    cm.setValue('**texto**\n\nfin');
    cm.setCursor({ line: 0, ch: 5 });
    window.mdLivePreview.enable();
    const beforeNative = window.mdLivePreview.metrics().rebuilds;
    cm.focus();
    document.execCommand('insertText', false, 'ñ');
    await wait(180);
    check('Live Preview: entrada nativa con acento conserva texto y actualización local', cm.getLine(0) === '**texñto**' && window.mdLivePreview.metrics().rebuilds === beforeNative);
    window.mdLivePreview.disable();

    cm.setValue('Texto **negrita** al final\n\nfin');
    cm.setCursor({ line: 0, ch: cm.getLine(0).length });
    window.mdLivePreview.enable();
    const beforeSpace = window.mdLivePreview.metrics().rebuilds;
    cm.replaceRange(' otra palabra', cm.getCursor());
    cm.setCursor({ line: 2, ch: 0 });
    await wait(180);
    check('Live Preview: escribir palabras y espacios tras formato cerrado sigue siendo local', window.mdLivePreview.metrics().rebuilds === beforeSpace && cm.getLineTokens(0).filter((token) => /formatting-em/.test(token.type || '')).length === 2);
    window.mdLivePreview.disable();

  } catch (e) {
    results.push({ name: 'EXCEPCION', pass: false, detail: String((e && e.stack) || e) });
  }
  return results;
})();
