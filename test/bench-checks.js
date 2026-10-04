// Mediciones de npm run bench (ver test/bench.js). Corre dentro de la
// ventana como la suite de tests y devuelve [{ name, pass, ms }]: cada
// medición es la mediana de varias repeticiones, en milisegundos.
(async () => {
  const results = [];
  const params = new URLSearchParams(window.location.search);
  const fixturesDir = params.get('mkTestFixtures') || '';
  const now = () => window.performance.now();
  const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  async function measure(name, fn, reps = 5) {
    const times = [];
    for (let i = 0; i < reps; i++) {
      const t0 = now();
      await fn(i);
      times.push(now() - t0);
    }
    results.push({ name, pass: true, ms: Math.round(median(times) * 10) / 10 });
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const sep = fixturesDir.includes('\\') ? '\\' : '/';
  const notes = `${fixturesDir}${sep}notas`;
  const big = `${notes}${sep}grande.md`;

  // Carpeta con ~3000 notas: árbol (la primera vez, en frío) y búsqueda.
  await measure('Abrir carpeta (árbol, 3000 notas)', () => window.mdEditor.readFolder(notes), 3);
  window.mdSidebar.renderFolder(await window.mdEditor.readFolder(notes));
  await new Promise((r) => setTimeout(r, 500));
  await measure('Buscar en la carpeta (primera vez)', (i) => window.mdEditor.searchInFolder(notes, `palabra${i}zz`), 1);
  await measure('Buscar en la carpeta (con índice)', (i) => window.mdEditor.searchInFolder(notes, `término${i}`), 5);
  await measure('Etiquetas de la carpeta', () => window.mdEditor.listTags ? window.mdEditor.listTags(notes) : null, 3);

  // Nota grande (~5000 líneas): abrir, preview completo, escribir.
  await measure('Abrir nota grande (5000 líneas)', async () => {
    await window.mdTabs.openTab(big);
    const info = window.mdTabs.getActiveTabInfo();
    if (info && info.filePath === big) document.querySelector('#tabbar .tab.active .tab-close').click();
    await tick();
  }, 3);
  await window.mdTabs.openTab(big);
  const originalSource = window.mdCodeMirror.getValue();
  const opening = window.mdTabs.timings?.();
  if (opening) {
    for (const key of ['read', 'createDoc', 'activate']) results.push({ name: `  abrir · ${key}`, pass: true, ms: Math.round(opening[key] * 10) / 10 });
    for (const [key, value] of Object.entries(opening.activation || {})) results.push({ name: `  activar · ${key}`, pass: true, ms: Math.round(value * 10) / 10 });
  }
  await measure('Preview completo de la nota grande', () => window.renderPreview(), 5);
  const pt = window.mdPreview.timings && window.mdPreview.timings();
  if (pt) Object.entries(pt).forEach(([k, v]) => { if (k !== 'total') results.push({ name: `  preview · ${k}`, pass: true, ms: Math.round(v * 10) / 10 }); });
  const cm = window.mdCodeMirror;
  await measure('Escribir 100 caracteres (editor)', () => {
    cm.setCursor({ line: 2500, ch: 0 });
    for (let i = 0; i < 100; i++) cm.replaceRange('x', cm.getCursor());
  }, 5);
  if (window.mdModes) {
    window.mdModes.toggleMode('live');
    await new Promise((r) => setTimeout(r, 300));
    cm.profile?.(true);
    await measure('Escribir 100 caracteres (Live Preview)', async () => {
      cm.setCursor({ line: 2500, ch: 0 });
      for (let i = 0; i < 100; i++) cm.replaceRange('y', cm.getCursor());
      await new Promise((r) => requestAnimationFrame(() => r()));
    }, 3);
    const profile = cm.profile?.(false);
    if (profile) for (const [key, value] of Object.entries(profile)) results.push({ name: `  live · ${key} (total 300 teclas)`, pass: true, ms: Math.round(value * 10) / 10 });
    await measure('Reconstruir Live Preview (5000 líneas)', () => window.mdLivePreview.rebuild(), 3);
    cm.focus();
    cm.setCursor({ line: 2500, ch: 0 });
    cm.scrollIntoView(cm.getCursor());
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await measure('Escribir 100 caracteres (Live visible y enfocado)', async () => {
      for (let i = 0; i < 100; i++) cm.replaceRange('v', cm.getCursor());
      await new Promise((r) => requestAnimationFrame(r));
    }, 3);
    const settled = () => new Promise((r) => setTimeout(r, 200));
    const inlineTimes = [];
    let inlineRebuilds = 0;
    for (let i = 0; i < 5; i++) {
      cm.setValue(originalSource);
      cm.setCursor({ line: 4, ch: 0 });
      cm.scrollIntoView(cm.getCursor());
      await settled();
      const before = window.mdLivePreview.metrics().rebuilds;
      const start = now();
      cm.replaceRange('nuevo', { line: 4, ch: cm.getLine(4).indexOf('negrita') + 3 });
      cm.setCursor({ line: 5, ch: 0 });
      inlineTimes.push(now() - start);
      inlineRebuilds += window.mdLivePreview.metrics().rebuilds - before;
    }
    results.push({ name: 'Editar palabra con formato + mover cursor (Live)', pass: true, ms: Math.round(median(inlineTimes) * 10) / 10, detail: `${inlineRebuilds} reconstrucciones completas en 5 ediciones` });
    // Entrada nativa del contenteditable, no 100 reemplazos programáticos
    // acumulados en una misma línea: esperar cada actualización de CM6.
    cm.setValue(originalSource);
    cm.setCursor({ line: 4, ch: cm.getLine(4).indexOf('negrita') + 3 });
    cm.scrollIntoView(cm.getCursor());
    cm.focus();
    await settled();
    const nativeTimes = [];
    for (let i = 0; i < 20; i++) {
      const start = now();
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cm.off('changes', changed); reject(new Error('Entrada nativa sin actualización del editor')); }, 1000);
        function changed() { cm.off('changes', changed); clearTimeout(timer); resolve(); }
        cm.on('changes', changed);
        document.execCommand('insertText', false, 'a');
      });
      nativeTimes.push(now() - start);
      await new Promise((r) => requestAnimationFrame(r));
    }
    results.push({ name: 'Entrada nativa por carácter (Live, mediana)', pass: true, ms: Math.round(median(nativeTimes) * 10) / 10 });
    results.push({ name: 'Entrada nativa por carácter (Live, máximo)', pass: true, ms: Math.round(Math.max(...nativeTimes) * 10) / 10 });
    window.mdModes.toggleMode('live');
  }
  return results;
})();
