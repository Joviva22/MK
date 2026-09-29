// Suite de humo que corre DENTRO de la ventana de MK (vía executeJavaScript,
// disparada por test/run.js con MK_TEST=1). No usa ningún framework: solo
// necesita devolver un array [{name, pass, detail}] como valor de resolución
// de la IIFE async de abajo (executeJavaScript espera promesas automáticamente).
//
// Cada check aquí corresponde a un bug real ya encontrado y arreglado en este
// proyecto (guardado multi-pestaña, CSS [hidden], restricción de rutas, etc.)
// o a una ruta central de la app (abrir/editar/guardar, preview, temas).
// Antes de tocar algo que estos checks cubren, correr `npm test` primero.

(async () => {
  const results = [];
  function check(name, pass, detail) {
    results.push({ name, pass: !!pass, detail: detail || '' });
  }
  async function waitFor(fn, timeoutMs = 3000, stepMs = 50) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const v = await fn();
      if (v) return v;
      await new Promise((r) => setTimeout(r, stepMs));
    }
    return null;
  }

  // Responder el diálogo propio (window.mdAsk) como lo haría una persona:
  // esperar a que aparezca, escribir y Enter.
  async function answerAsk(value) {
    const input = await waitFor(() => document.querySelector('.ask-dialog .ask-input'));
    if (!input) return false;
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await waitFor(() => !document.querySelector('.ask-dialog'));
    return true;
  }

  const params = new URLSearchParams(window.location.search);
  const fixturesDir = params.get('mkTestFixtures') || '';
  const fixtureMdPath = fixturesDir ? window.mdEditor.joinPath(fixturesDir, 'note.md') : null;
  const fixtureOtherPath = fixturesDir ? window.mdEditor.joinPath(fixturesDir, 'other.md') : null;
  const fixturePdfPath = fixturesDir ? window.mdEditor.joinPath(fixturesDir, 'prueba.pdf') : null;
  const fixturePdf2Path = fixturesDir ? window.mdEditor.joinPath(fixturesDir, 'otro.pdf') : null;

  // 0. Esperar a que tabs.js termine su arranque (restaurar sesión / pestaña inicial)
  await waitFor(() => document.querySelectorAll('#tabbar .tab').length > 0);

  // 1. El puente de preload existe con los métodos clave
  check(
    'mdEditor expone el puente de preload completo',
    window.mdEditor &&
      typeof window.mdEditor.readFile === 'function' &&
      typeof window.mdEditor.saveFile === 'function' &&
      typeof window.mdEditor.isPathAllowed === 'function'
  );

  // 2. Dropdown respeta [hidden] (regresión: bug de CSS que dejaba los
  //    dropdowns/modal siempre visibles por un `display` sin `:not([hidden])`)
  const newMenu = document.getElementById('new-menu');
  const hiddenBefore = newMenu.hidden && getComputedStyle(newMenu).display === 'none';
  document.getElementById('btn-new').click();
  const visibleAfterClick = !newMenu.hidden && getComputedStyle(newMenu).display !== 'none';
  document.getElementById('btn-new').click();
  check(
    'Dropdown "Nuevo": oculto por defecto y visible al hacer click',
    hiddenBefore && visibleAfterClick,
    `hiddenBefore=${hiddenBefore} visibleAfterClick=${visibleAfterClick}`
  );

  // 3. Nueva pestaña se agrega a la tabbar
  const tabsBefore = document.querySelectorAll('#tabbar .tab').length;
  window.mdTabs.newTab('');
  await waitFor(() => document.querySelectorAll('#tabbar .tab').length > tabsBefore);
  const tabsAfter = document.querySelectorAll('#tabbar .tab').length;
  check('Nueva pestaña se agrega a la tabbar', tabsAfter === tabsBefore + 1, `antes=${tabsBefore} despues=${tabsAfter}`);

  // 4. Abrir un archivo fixture carga su contenido exacto en el editor
  let contentMatches = false;
  if (fixtureMdPath) {
    await window.openFileAtPath(fixtureMdPath);
    await waitFor(() => window.mdCodeMirror.getValue().includes('Hola MK'));
    const value = window.mdCodeMirror.getValue();
    contentMatches = value.includes('Hola MK') && value.includes('x^2');
  }
  check('Abrir archivo fixture carga su contenido exacto', contentMatches, `fixture=${fixtureMdPath}`);

  // 5. Editar + guardar hace round-trip correcto a disco
  //    (regresión: bug de guardado multi-pestaña que podía escribir en el
  //    archivo equivocado por usar una ruta "actual" global en vez de por-tab)
  let roundTrip = false;
  if (fixtureMdPath) {
    const marker = `MARCA-TEST-${Date.now()}`;
    window.mdCodeMirror.setValue(window.mdCodeMirror.getValue() + '\n\n' + marker);
    await window.mdTabs.saveActive(false);
    const onDisk = await window.mdEditor.readFile(fixtureMdPath);
    roundTrip = !!onDisk && !onDisk.binary && onDisk.content.includes(marker);
  }
  check('Guardar escribe el contenido editado en el archivo correcto (fixture)', roundTrip);

  // 6. Preview renderiza Markdown básico
  // A partir de acá (6-7) el contenido es solo para probar edición/render,
  // sin importar qué archivo esté abierto — se arranca una pestaña nueva
  // sin ruta (en vez de seguir escribiendo en la pestaña de fixtureMdPath)
  // para no dejar el autoguardado (scheduleAutosave, por-tab con debounce)
  // esperando escribir contenido de prueba encima del fixture real si el
  // timing de tests más adelante lo deja disparar.
  window.mdTabs.newTab('# Titulo de prueba\n\nTexto en **negrita**.');
  window.renderPreview();
  await waitFor(() => document.querySelector('#preview-pane h1'));
  const previewPane = document.getElementById('preview-pane');
  const headingOk = !!previewPane.querySelector('h1') && previewPane.querySelector('h1').textContent.includes('Titulo de prueba');
  const boldOk = !!previewPane.querySelector('strong');
  check('Preview renderiza encabezados y negrita', headingOk && boldOk, `h1=${headingOk} strong=${boldOk}`);

  // 6b. Subrayar/resaltar texto en Markdown: sintaxis ==texto== -> <mark>,
  // y el menú contextual también lo puede insertar sobre una selección.
  window.mdCodeMirror.setValue('Esto es ==importante== en el texto.');
  window.renderPreview();
  await waitFor(() => previewPane.querySelector('mark'));
  const markEl = previewPane.querySelector('mark');
  const highlightSyntaxOk = !!markEl && markEl.textContent === 'importante';

  window.mdCodeMirror.setValue('Palabra clave acá.');
  window.mdCodeMirror.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 7 });
  document.getElementById('editor-pane').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  const highlightBtn = Array.from(document.querySelectorAll('#context-menu button')).find((b) => b.textContent === 'Subrayar / resaltar texto');
  if (highlightBtn) highlightBtn.click();
  const highlightInsertOk = window.mdCodeMirror.getValue() === '==Palabra== clave acá.';
  check(
    'Subrayar/resaltar texto en Markdown: ==texto== se renderiza como <mark> y el menú contextual lo inserta',
    highlightSyntaxOk && highlightInsertOk,
    `sintaxis=${highlightSyntaxOk} menuContextual=${highlightInsertOk} contenido="${window.mdCodeMirror.getValue()}"`
  );

  // 6c. Menú contextual: "Insertar tabla" pregunta filas/columnas (antes
  // insertaba siempre una tabla fija de 2 columnas x 1 fila) y arma la
  // tabla completa de una sola vez, encabezados incluidos.
  window.mdCodeMirror.setValue('');
  document.getElementById('editor-pane').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  const insertTableBtn = Array.from(document.querySelectorAll('#context-menu button')).find((b) => b.textContent === 'Insertar tabla');
  if (insertTableBtn) {
    insertTableBtn.click();
    await answerAsk('3'); // columnas
    await answerAsk('2'); // filas
    await waitFor(() => window.mdCodeMirror.getValue().includes('Columna 3'));
  }
  const tableLines = window.mdCodeMirror.getValue().split('\n');
  const threeColsOk = tableLines[0] === '| Columna 1 | Columna 2 | Columna 3 |';
  const sepRowOk = tableLines[1] === '| --- | --- | --- |';
  const twoDataRowsOk = tableLines.length === 4;
  check(
    'Menú contextual: "Insertar tabla" pregunta el tamaño y arma la tabla completa',
    !!insertTableBtn && threeColsOk && sepRowOk && twoDataRowsOk,
    `boton=${!!insertTableBtn} encabezado=${threeColsOk} separador=${sepRowOk} filas=${twoDataRowsOk} contenido="${window.mdCodeMirror.getValue().replace(/\n/g, '\\n')}"`
  );

  // 6d. Editar tablas Markdown ya escritas (no solo crearlas): "Agregar
  // columna/fila acá" y "Alinear tabla" en el menú contextual, solo cuando
  // el clic derecho cae dentro de un bloque de tabla.
  window.mdCodeMirror.setValue('Texto libre\n\n| a | bb |\n| --- | --- |\n| 1 | 2 |\n\nMas texto');
  const cmForTable = window.mdCodeMirror;
  const rightClickAt = (line, ch) => {
    const coords = cmForTable.charCoords({ line, ch }, 'window');
    document.getElementById('editor-pane').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: coords.left + 2, clientY: coords.top + 5 })
    );
  };
  const menuLabels = () => Array.from(document.querySelectorAll('#context-menu button')).map((b) => b.textContent);

  rightClickAt(0, 2); // fuera de la tabla
  const noTableItemsOutsideOk = !menuLabels().includes('Agregar columna acá');

  rightClickAt(2, 2); // adentro de la celda "a"
  const tableItemsInsideOk = menuLabels().includes('Agregar columna acá') &&
    menuLabels().includes('Agregar fila acá') && menuLabels().includes('Alinear tabla');
  const addColBtn = Array.from(document.querySelectorAll('#context-menu button')).find((b) => b.textContent === 'Agregar columna acá');
  if (addColBtn) addColBtn.click();
  const afterAddCol = window.mdCodeMirror.getValue().split('\n');
  const addColOk = afterAddCol[2] === '| a |  | bb |' && afterAddCol[3] === '| --- | --- | --- |' && afterAddCol[4] === '| 1 |  | 2 |';

  rightClickAt(4, 2); // última fila de datos
  const addRowBtn = Array.from(document.querySelectorAll('#context-menu button')).find((b) => b.textContent === 'Agregar fila acá');
  if (addRowBtn) addRowBtn.click();
  const afterAddRow = window.mdCodeMirror.getValue().split('\n');
  const addRowOk = afterAddRow[5] === '|  |  |  |' && afterAddRow[6] === '' && afterAddRow[7] === 'Mas texto';

  rightClickAt(2, 2);
  const alignBtn = Array.from(document.querySelectorAll('#context-menu button')).find((b) => b.textContent === 'Alinear tabla');
  if (alignBtn) alignBtn.click();
  const afterAlign = window.mdCodeMirror.getValue().split('\n');
  const alignOk = afterAlign[2] === '| a   |     | bb  |' && afterAlign[3] === '| --- | --- | --- |';

  check(
    'Editar tablas existentes: agregar columna/fila y alinear (menú contextual, solo dentro de una tabla)',
    noTableItemsOutsideOk && tableItemsInsideOk && addColOk && addRowOk && alignOk,
    `sinItemsAfueraOk=${noTableItemsOutsideOk} itemsAdentroOk=${tableItemsInsideOk} agregarColOk=${addColOk} agregarFilaOk=${addRowOk} alinearOk=${alignOk} contenido="${window.mdCodeMirror.getValue().replace(/\n/g, '\\n')}"`
  );

  // 7. KaTeX renderiza fórmulas inline
  window.mdCodeMirror.setValue('Formula: $x^2 + y^2 = z^2$');
  window.renderPreview();
  await waitFor(() => document.querySelector('#preview-pane .katex'));
  check('KaTeX renderiza fórmulas inline', !!document.querySelector('#preview-pane .katex'));

  // 8. Restricción de rutas del resolver de assets (isPathAllowed)
  if (fixturesDir) {
    const insidePath = window.mdEditor.joinPath(fixturesDir, 'img.png');
    const outsidePath = window.mdEditor.joinPath(fixturesDir, '..', 'fuera-de-la-raiz.png');
    const insideOk = window.mdEditor.isPathAllowed(fixturesDir, insidePath) === true;
    const outsideBlocked = window.mdEditor.isPathAllowed(fixturesDir, outsidePath) === false;
    check(
      'isPathAllowed permite rutas dentro de la raíz y bloquea fuera',
      insideOk && outsideBlocked,
      `insideOk=${insideOk} outsideBlocked=${outsideBlocked}`
    );
  } else {
    check('isPathAllowed permite rutas dentro de la raíz y bloquea fuera', false, 'sin fixturesDir');
  }

  // 9. Cambiar de tema actualiza data-theme en <html>
  const themeBtn = document.querySelector('#theme-menu button[data-theme="dracula"]');
  if (themeBtn) themeBtn.click();
  await waitFor(() => document.documentElement.getAttribute('data-theme') === 'dracula');
  check('Cambiar de tema actualiza data-theme en <html>', document.documentElement.getAttribute('data-theme') === 'dracula');
  const lightBtn = document.querySelector('#theme-menu button[data-theme="light"]');
  if (lightBtn) lightBtn.click();

  // 9b. Tema personalizado: color pickers aplican en vivo (--accent inline),
  // avisa si el contraste texto/fondo queda bajo, y "Guardar" persiste en
  // config.json bajo customTheme.
  window.mdCustomTheme.open();
  await waitFor(() => !document.getElementById('custom-theme-panel').hidden);
  const customPanelOpenOk = !document.getElementById('custom-theme-panel').hidden;

  const ctColorInputs = Array.from(document.querySelectorAll('#custom-theme-fields input[type="color"]'));
  const [ctBgInput, , , ctTextInput, , , ctAccentInput] = ctColorInputs; // orden: bg,surface,surface2,text,textMuted,border,accent

  ctAccentInput.value = '#ff00ff';
  ctAccentInput.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() === '#ff00ff');
  const liveApplyOk = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() === '#ff00ff';
  const dataThemeCustomOk = document.documentElement.getAttribute('data-theme') === 'custom';

  ctTextInput.value = '#ffffff';
  ctTextInput.dispatchEvent(new Event('input', { bubbles: true }));
  ctBgInput.value = '#fefefe';
  ctBgInput.dispatchEvent(new Event('input', { bubbles: true }));
  await waitFor(() => !document.getElementById('custom-theme-warning').hidden);
  const lowContrastWarnsOk = !document.getElementById('custom-theme-warning').hidden;

  document.getElementById('custom-theme-apply').click();
  await waitFor(() => document.getElementById('custom-theme-panel').hidden);
  const ctSavedConfig = await window.mdEditor.getConfig();
  const customThemePersistedOk = ctSavedConfig.theme === 'custom' && !!ctSavedConfig.customTheme && ctSavedConfig.customTheme.accent === '#ff00ff';

  check(
    'Tema personalizado: aplica en vivo, avisa contraste bajo y persiste',
    customPanelOpenOk && liveApplyOk && dataThemeCustomOk && lowContrastWarnsOk && customThemePersistedOk,
    `panel=${customPanelOpenOk} liveOk=${liveApplyOk} dataTheme=${dataThemeCustomOk} avisoOk=${lowContrastWarnsOk} persistido=${customThemePersistedOk}`
  );

  // Volver a "light" para no afectar el resto de la suite (varios checks de
  // abajo asumen los colores por defecto).
  await window.mdEditor.setConfig({ theme: 'light' });
  window.mdThemes.applyTheme('light');

  // 10. Menú contextual respeta [hidden] (misma familia del bug del punto 2,
  //     pero es el archivo donde el usuario lo reportó en vivo)
  const menu = document.getElementById('context-menu');
  const menuHiddenBefore = menu.hidden;
  document.getElementById('editor-pane').dispatchEvent(
    new MouseEvent('contextmenu', { bubbles: true, clientX: 50, clientY: 50 })
  );
  const menuVisibleAfterClick = !menu.hidden && getComputedStyle(menu).display !== 'none';
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  const menuHiddenAfterEscape = menu.hidden;
  check(
    'Menú contextual aparece en click derecho y se oculta con Escape',
    menuHiddenBefore && menuVisibleAfterClick && menuHiddenAfterEscape,
    `antes=${menuHiddenBefore} visible=${menuVisibleAfterClick} trasEscape=${menuHiddenAfterEscape}`
  );

  // 11. Paleta de comandos: Ctrl+Shift+P la abre, lista comandos, Escape la cierra
  const paletteOverlay = document.getElementById('command-palette');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'P', ctrlKey: true, shiftKey: true }));
  const paletteOpenedOk = !paletteOverlay.hidden;
  const paletteInput = document.getElementById('command-palette-input');
  const hasItems = document.querySelectorAll('#command-palette-list .command-palette-item').length > 0;
  paletteInput.value = 'guardar';
  paletteInput.dispatchEvent(new Event('input'));
  const filteredOk = document.querySelectorAll('#command-palette-list .command-palette-item').length > 0 &&
    Array.from(document.querySelectorAll('#command-palette-list .command-palette-item')).every((el) => /guardar/i.test(el.textContent));
  paletteInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  const paletteClosedOk = paletteOverlay.hidden;
  check(
    'Paleta de comandos: abre con Ctrl+Shift+P, filtra y cierra con Escape',
    paletteOpenedOk && hasItems && filteredOk && paletteClosedOk,
    `abierta=${paletteOpenedOk} items=${hasItems} filtro=${filteredOk} cerrada=${paletteClosedOk}`
  );

  // 12. Búsqueda global: sin carpeta abierta pide abrir una; con carpeta y fixture, encuentra la línea
  const searchOverlay = document.getElementById('search-panel');
  const searchInput = document.getElementById('search-input');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true }));
  const searchOpenedOk = !searchOverlay.hidden;
  const noFolderMsgOk = document.querySelector('#search-results .command-palette-empty') !== null;
  searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

  let searchFindsFixture = false;
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F', ctrlKey: true, shiftKey: true }));
    searchInput.value = 'Hola MK';
    searchInput.dispatchEvent(new Event('input'));
    const found = await waitFor(() => document.querySelector('#search-results .search-result-item'), 6000);
    searchFindsFixture = !!found && found.textContent.includes('note.md');
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }
  check(
    'Búsqueda global: pide carpeta si no hay una abierta, y encuentra texto en fixtures',
    searchOpenedOk && noFolderMsgOk && searchFindsFixture,
    `abierta=${searchOpenedOk} avisoSinCarpeta=${noFolderMsgOk} encontroFixture=${searchFindsFixture}`
  );

  // 12c. Abrir archivo rápido por nombre (Ctrl+P): a diferencia de Ctrl+Shift+F
  // (busca CONTENIDO), esto filtra por NOMBRE de archivo y abre directo.
  window.mdState.rootFolder = null;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }));
  const fileOpenOverlay = document.getElementById('file-open-panel');
  const fileOpenInput = document.getElementById('file-open-input');
  const fileOpenNoFolderMsgOk = await waitFor(() => document.querySelector('#file-open-results .command-palette-empty') !== null);
  fileOpenInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await waitFor(() => fileOpenOverlay.hidden);

  let fileOpenFindsAndOpensOk = false;
  let fileOpenDetail = 'sin fixturesDir';
  if (fixturesDir && fixtureOtherPath) {
    window.mdState.rootFolder = fixturesDir;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ctrlKey: true }));
    await waitFor(() => !fileOpenOverlay.hidden && document.querySelectorAll('#file-open-results .command-palette-item').length > 0);
    fileOpenInput.value = 'other';
    fileOpenInput.dispatchEvent(new Event('input'));
    const found = await waitFor(() => document.querySelector('#file-open-results .command-palette-item'));
    const showsCorrectFileOk = !!found && found.textContent.includes('other.md');

    fileOpenInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(() => window.mdState.currentFilePath === fixtureOtherPath);
    const openedCorrectFileOk = window.mdState.currentFilePath === fixtureOtherPath;
    const closedAfterOpenOk = fileOpenOverlay.hidden;

    fileOpenFindsAndOpensOk = showsCorrectFileOk && openedCorrectFileOk && closedAfterOpenOk;
    fileOpenDetail = `muestraArchivoOk=${showsCorrectFileOk} abrioArchivoOk=${openedCorrectFileOk} cerroOk=${closedAfterOpenOk}`;
  }
  check(
    'Abrir archivo rápido (Ctrl+P): pide carpeta si no hay una, filtra por nombre y abre con Enter',
    fileOpenNoFolderMsgOk && fileOpenFindsAndOpensOk,
    `avisoSinCarpetaOk=${fileOpenNoFolderMsgOk} ${fileOpenDetail}`
  );

  // 12b. Buscar/reemplazar dentro del archivo actual (Ctrl+F, findreplace.js)
  window.mdTabs.newTab('gato perro gato pajaro gato');
  const findWidget = document.getElementById('find-widget');
  const findInputEl = document.getElementById('find-input');
  const findCountEl = document.getElementById('find-count');
  const findReplaceRow = document.getElementById('find-replace-row');
  const replaceInputEl = document.getElementById('replace-input');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }));
  const findOpensOk = !findWidget.hidden && getComputedStyle(findWidget).display !== 'none';
  const replaceRowHiddenByDefaultOk = findReplaceRow.hidden && getComputedStyle(findReplaceRow).display === 'none';

  findInputEl.value = 'gato';
  findInputEl.dispatchEvent(new Event('input'));
  await waitFor(() => findCountEl.textContent === '1/3');
  const findsThreeMatchesOk = findCountEl.textContent === '1/3';
  const highlightsAllMatchesOk = document.querySelectorAll('.cm-find-match, .cm-find-match-current').length === 3;

  document.getElementById('find-next').click();
  const nextAdvancesOk = findCountEl.textContent === '2/3';

  document.getElementById('find-toggle-replace').click();
  const replaceRowVisibleOk = !findReplaceRow.hidden && getComputedStyle(findReplaceRow).display !== 'none';
  replaceInputEl.value = 'gallina';
  document.getElementById('replace-all').click();
  const replaceAllOk = window.mdCodeMirror.getValue() === 'gallina perro gallina pajaro gallina';

  window.mdFindReplace.close();
  const closesOk = findWidget.hidden && getComputedStyle(findWidget).display === 'none';

  check(
    'Buscar/reemplazar en el archivo actual (Ctrl+F): encuentra, resalta, navega y reemplaza todo',
    findOpensOk && replaceRowHiddenByDefaultOk && findsThreeMatchesOk && highlightsAllMatchesOk &&
      nextAdvancesOk && replaceRowVisibleOk && replaceAllOk && closesOk,
    `abreOk=${findOpensOk} reemplazoOcultoPorDefectoOk=${replaceRowHiddenByDefaultOk} encuentraTresOk=${findsThreeMatchesOk} resaltaTodosOk=${highlightsAllMatchesOk} siguienteAvanzaOk=${nextAdvancesOk} filaReemplazoVisibleOk=${replaceRowVisibleOk} reemplazaTodoOk=${replaceAllOk} cierraOk=${closesOk}`
  );

  // 12c. Regresión: el find-widget vivía dentro de .editor-column, así que
  // .container.mode-read (que oculta .editor-column entero) lo dejaba
  // invisible aunque open() corriera bien. Ahora es hijo directo de
  // .primary-pane, fuera de esa subárbol oculta.
  window.mdModes.setLayoutMode('read');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true }));
  const findVisibleInReadModeOk = !findWidget.hidden && getComputedStyle(findWidget).display !== 'none';
  findInputEl.value = 'gallina';
  findInputEl.dispatchEvent(new Event('input'));
  await waitFor(() => findCountEl.textContent.endsWith('/3'));
  const findWorksInReadModeOk = findCountEl.textContent.endsWith('/3');
  window.mdFindReplace.close();
  window.mdModes.setLayoutMode('normal');

  check(
    'Ctrl+F también funciona en modo lectura (find-widget visible y busca aunque el editor esté oculto)',
    findVisibleInReadModeOk && findWorksInReadModeOk,
    `visibleEnLecturaOk=${findVisibleInReadModeOk} buscaEnLecturaOk=${findWorksInReadModeOk}`
  );

  // 13. Autocompletado: Ctrl-Space muestra sugerencias basadas en palabras del documento
  window.mdCodeMirror.setValue('palabraunica\n');
  window.mdCodeMirror.setCursor({ line: 1, ch: 0 });
  window.mdCodeMirror.replaceSelection('palabrau');
  window.mdAutocomplete.show();
  const hintsShown = await waitFor(() => document.querySelector('.CodeMirror-hints'));
  const hintMatchesOk = !!hintsShown && /palabraunica/.test(hintsShown.textContent);
  if (window.mdCodeMirror.state.completionActive) window.mdCodeMirror.state.completionActive.close();
  check('Autocompletado (Ctrl+Space) sugiere palabras ya usadas en el documento', hintMatchesOk);

  // 14. Icono personalizado por archivo: click derecho en la fila -> "Cambiar
  // icono..." -> el picker filtra -> elegir uno lo aplica en el árbol y lo
  // persiste en config.json (fileIcons)
  let customIconOk = false;
  if (fixturesDir && fixtureMdPath) {
    window.mdSidebar.renderFolder({
      rootPath: fixturesDir,
      tree: [{ nombre: 'note.md', esCarpeta: false, ruta: fixtureMdPath, hijos: null }]
    });
    const fileRow = document.querySelector('.tree-file');
    fileRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
    const changeBtn = await waitFor(() =>
      Array.from(document.querySelectorAll('.context-menu button')).find((b) => /Cambiar icono/.test(b.textContent))
    );
    changeBtn.click();
    const pickerOpenedOk = !document.getElementById('icon-picker').hidden;

    const pickerInput = document.getElementById('icon-picker-input');
    pickerInput.value = 'star';
    pickerInput.dispatchEvent(new Event('input'));
    const starItem = await waitFor(() => document.querySelector('.icon-picker-item[title="star"]'));
    starItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    // Los archivos ya muestran un svg lucide por defecto (según extensión),
    // así que hay que verificar el icono elegido específicamente por clase
    // (lucide agrega "lucide-<nombre>" al svg generado), no solo "hay un svg".
    await waitFor(() => document.querySelector('.tree-file .tree-icon svg.lucide-star'));
    const treeShowsCustomIcon = !!document.querySelector('.tree-file .tree-icon svg.lucide-star');
    const config = await window.mdEditor.getConfig();
    const persistedOk = config.fileIcons && config.fileIcons['note.md'] === 'star';
    const pickerClosedOk = document.getElementById('icon-picker').hidden;

    customIconOk = pickerOpenedOk && treeShowsCustomIcon && persistedOk && pickerClosedOk;

    check(
      'Icono personalizado: menú contextual del árbol -> picker -> se aplica y persiste',
      customIconOk,
      `pickerAbierto=${pickerOpenedOk} arbolMuestraSvg=${treeShowsCustomIcon} persistido=${persistedOk} pickerCerrado=${pickerClosedOk}`
    );
  } else {
    check('Icono personalizado: menú contextual del árbol -> picker -> se aplica y persiste', false, 'sin fixturesDir');
  }

  // 15. Etiquetas: #tag se renderiza como pill en el preview y aparece en el
  // panel de etiquetas (Ctrl+Shift+T) de toda la carpeta
  let tagsOk = false;
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    window.mdCodeMirror.setValue('Nota con #proyecto y más texto.');
    window.renderPreview();
    await waitFor(() => document.querySelector('#preview-pane .md-tag'));
    const tagRenderedOk = document.querySelector('#preview-pane .md-tag')?.textContent === '#proyecto';

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'T', ctrlKey: true, shiftKey: true }));
    const tagItem = await waitFor(() =>
      Array.from(document.querySelectorAll('#tags-list .command-palette-item')).find((el) => /#proyecto/.test(el.textContent))
    );
    const panelListsTagOk = !!tagItem;
    tagItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    const opensSearchOk = await waitFor(() => !document.getElementById('search-panel').hidden && document.getElementById('search-input').value === '#proyecto');
    document.getElementById('search-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    tagsOk = tagRenderedOk && panelListsTagOk && !!opensSearchOk;
    check(
      'Etiquetas: #tag se renderiza como pill y aparece en el panel (Ctrl+Shift+T)',
      tagsOk,
      `renderPill=${tagRenderedOk} panelLista=${panelListsTagOk} abreSearch=${!!opensSearchOk}`
    );
  } else {
    check('Etiquetas: #tag se renderiza como pill y aparece en el panel (Ctrl+Shift+T)', false, 'sin fixturesDir');
  }

  // 15b. #tag y [[wikilink]] dentro de código (inline y fenced) NO se
  // transforman (regresión: antes se activaban también dentro de código)
  window.mdCodeMirror.setValue('Texto `#no-es-tag` y `[[no-es-link]]`.\n\n```\n#tampoco-en-fence\n[[ni-esto]]\n```\n');
  window.renderPreview();
  await waitFor(() => document.querySelector('#preview-pane code'));
  const codeProtectedOk =
    !document.querySelector('#preview-pane .md-tag') &&
    !document.querySelector('#preview-pane .md-wikilink') &&
    document.querySelector('#preview-pane code')?.textContent.includes('#no-es-tag');
  check('#tag y [[wikilink]] dentro de código no se transforman', codeProtectedOk);

  // 16. Wikilinks [[nota]]: se renderizan como link clicable y navegan al
  // archivo resuelto contra la carpeta abierta. Se abre other.md (que en
  // disco tiene "[[note]]") para probar una navegación real entre archivos,
  // no un click sobre el archivo ya activo.
  let wikilinkOk = false;
  if (fixturesDir && fixtureOtherPath) {
    await window.openFileAtPath(fixtureOtherPath);
    window.renderPreview();
    const link = await waitFor(() => document.querySelector('#preview-pane .md-wikilink'));
    const linkRenderedOk = !!link && link.textContent === 'note';
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // Verificamos por currentFilePath (no por contenido del editor): note.md
    // ya se abrió antes en checks anteriores y su buffer en memoria fue
    // sobreescrito por ellos, así que "activó la pestaña correcta" es la
    // señal fiable de que la navegación ocurrió.
    await waitFor(() => window.mdState.currentFilePath === fixtureMdPath);
    const navigatedOk = window.mdState.currentFilePath === fixtureMdPath;
    wikilinkOk = linkRenderedOk && navigatedOk;
    check(
      'Wikilinks [[nota]]: se renderizan y navegan al archivo resuelto',
      wikilinkOk,
      `renderLink=${linkRenderedOk} navego=${navigatedOk}`
    );
  } else {
    check('Wikilinks [[nota]]: se renderizan y navegan al archivo resuelto', false, 'sin fixturesDir');
  }

  // 17. Backlinks: con note.md activo, el panel (Ctrl+Shift+B) lista los
  // archivos que lo enlazan con [[note]] (other.md)
  let backlinksOk = false;
  if (fixturesDir && fixtureMdPath) {
    await window.openFileAtPath(fixtureMdPath);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', ctrlKey: true, shiftKey: true }));
    const backlinkItem = await waitFor(() =>
      Array.from(document.querySelectorAll('#backlinks-list .search-result-item')).find((el) => /other\.md/.test(el.textContent))
    );
    backlinksOk = !!backlinkItem;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    check('Backlinks: panel (Ctrl+Shift+B) lista los archivos que enlazan al activo', backlinksOk);
  } else {
    check('Backlinks: panel (Ctrl+Shift+B) lista los archivos que enlazan al activo', false, 'sin fixturesDir');
  }

  // 18. Gestión de archivos desde el sidebar: crear, renombrar, eliminar
  // (usa prompt/confirm nativos -> se sobreescriben temporalmente para el test)
  let fileMgmtOk = false;
  if (fixturesDir) {
    window.mdSidebar.renderFolder({ rootPath: fixturesDir, tree: [] });
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;
    let alerted = false;
    window.alert = () => { alerted = true; };
    try {
      const newName = `mgmt-test-${Date.now()}.md`;
      const creating = window.mdSidebar.createEntry(fixturesDir, false);
      await answerAsk(newName);
      await creating;
      const createdPath = window.mdEditor.joinPath(fixturesDir, newName);
      const createdOnDisk = await window.mdEditor.readFile(createdPath);
      const createdInTree = await waitFor(() =>
        Array.from(document.querySelectorAll('.tree-row span:not(.tree-icon)')).find((el) => el.textContent === newName)
      );

      const renamedName = `mgmt-renamed-${Date.now()}.md`;
      const renaming = window.mdSidebar.renameEntry({ nombre: newName, ruta: createdPath, esCarpeta: false });
      await answerAsk(renamedName);
      await renaming;
      const renamedPath = window.mdEditor.joinPath(fixturesDir, renamedName);
      const renamedOnDisk = await window.mdEditor.readFile(renamedPath);
      const oldGone = await window.mdEditor.readFile(createdPath);

      window.confirm = () => true;
      await window.mdSidebar.deleteEntry({ nombre: renamedName, ruta: renamedPath, esCarpeta: false });
      const deletedGone = await window.mdEditor.readFile(renamedPath);

      fileMgmtOk = createdOnDisk !== null && !!createdInTree && renamedOnDisk !== null &&
        oldGone === null && deletedGone === null && !alerted;

      check(
        'Gestión de archivos: crear/renombrar/eliminar desde el sidebar',
        fileMgmtOk,
        `creado=${createdOnDisk !== null} enArbol=${!!createdInTree} renombrado=${renamedOnDisk !== null} viejoBorrado=${oldGone === null} eliminado=${deletedGone === null} sinErrores=${!alerted}`
      );
    } finally {
      window.confirm = originalConfirm;
      window.alert = originalAlert;
    }
  } else {
    check('Gestión de archivos: crear/renombrar/eliminar desde el sidebar', false, 'sin fixturesDir');
  }

  // 19. F11: sin menú nativo, el atajo pasa por
  // window.mdEditor.toggleFullscreen() y alterna body.fullscreen-write
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11' }));
  const enteredFullscreen = await waitFor(() => document.body.classList.contains('fullscreen-write'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'F11' }));
  await waitFor(() => !document.body.classList.contains('fullscreen-write'));
  const exitedFullscreen = !document.body.classList.contains('fullscreen-write');
  check(
    'F11 alterna el modo pantalla completa / escritura sin distracciones',
    !!enteredFullscreen && exitedFullscreen,
    `entro=${!!enteredFullscreen} salio=${exitedFullscreen}`
  );

  // 19b. Ctrl+B pliega/muestra el sidebar (independiente del modo enfoque)
  // y lo persiste en config.json.
  const sidebarContainerEl = document.querySelector('.container');
  const sidebarVisibleBefore = !sidebarContainerEl.classList.contains('sidebar-hidden');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
  await waitFor(() => sidebarContainerEl.classList.contains('sidebar-hidden'));
  const sidebarHiddenAfterToggle = sidebarContainerEl.classList.contains('sidebar-hidden');
  const sidebarPersistedOk = (await window.mdEditor.getConfig()).sidebarHidden === true;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', ctrlKey: true }));
  await waitFor(() => !sidebarContainerEl.classList.contains('sidebar-hidden'));
  const sidebarShownAgain = !sidebarContainerEl.classList.contains('sidebar-hidden');
  check(
    'Ctrl+B pliega/muestra el sidebar y lo persiste en config.json',
    sidebarVisibleBefore && sidebarHiddenAfterToggle && sidebarPersistedOk && sidebarShownAgain,
    `visibleAntes=${sidebarVisibleBefore} plegadoTrasCtrlB=${sidebarHiddenAfterToggle} persistidoOk=${sidebarPersistedOk} vuelveAMostrarOk=${sidebarShownAgain}`
  );

  // 20. Subir a la carpeta superior + mover archivos entre carpetas
  // (arrastrar y soltar en el sidebar)
  let navAndMoveOk = false;
  if (fixturesDir) {
    const childRoot = window.mdEditor.joinPath(fixturesDir, 'nested', 'child-root');
    const childResult = await window.mdEditor.readFolder(childRoot);
    window.mdSidebar.renderFolder(childResult);
    await window.mdSidebar.goToParent();
    const parentOk = window.mdState.rootFolder === window.mdEditor.joinPath(fixturesDir, 'nested');

    const moveADir = window.mdEditor.joinPath(fixturesDir, 'moveA');
    const moveBDir = window.mdEditor.joinPath(fixturesDir, 'moveB');
    const moveASrc = window.mdEditor.joinPath(moveADir, 'move-me.md');
    window.mdSidebar.renderFolder({ rootPath: fixturesDir, tree: [] });
    await window.mdSidebar.moveEntry({ ruta: moveASrc, esCarpeta: false, nombre: 'move-me.md' }, moveBDir);
    const movedDest = window.mdEditor.joinPath(moveBDir, 'move-me.md');
    const movedOnDisk = await window.mdEditor.readFile(movedDest);
    const oldGoneOnDisk = await window.mdEditor.readFile(moveASrc);

    navAndMoveOk = parentOk && movedOnDisk !== null && oldGoneOnDisk === null;
    check(
      'Subir a la carpeta superior y mover archivos entre carpetas (drag & drop)',
      navAndMoveOk,
      `subioAlPadre=${parentOk} movidoADestino=${movedOnDisk !== null} salioDeOrigen=${oldGoneOnDisk === null}`
    );
  } else {
    check('Subir a la carpeta superior y mover archivos entre carpetas (drag & drop)', false, 'sin fixturesDir');
  }

  // 19c. Botón "Refrescar archivos": vuelve a leer la carpeta actual del
  // disco — si se creó un archivo desde afuera de MK (terminal, otro
  // programa) mientras la carpeta ya estaba abierta, aparece en el árbol
  // sin tener que cerrar y reabrir la carpeta.
  let refreshOk = false;
  let refreshDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(fixturesDir));
    const rowExists = (name) => Array.from(document.querySelectorAll('.tree-row')).some((r) => r.textContent.trim() === name);
    const notThereBeforeOk = !rowExists('creado-desde-afuera.md');

    await window.mdEditor.saveFile('# afuera\n', window.mdEditor.joinPath(fixturesDir, 'creado-desde-afuera.md'), false);
    document.getElementById('btn-refresh-tree').click();
    await waitFor(() => rowExists('creado-desde-afuera.md'));
    const appearsAfterRefreshOk = rowExists('creado-desde-afuera.md');

    refreshOk = notThereBeforeOk && appearsAfterRefreshOk;
    refreshDetail = `noEstabaAntesOk=${notThereBeforeOk} apareceTrasRefrescarOk=${appearsAfterRefreshOk}`;
  }
  check('Botón "Refrescar archivos" muestra archivos creados desde afuera de MK', refreshOk, refreshDetail);

  // 20b. Selección múltiple con Ctrl+clic en el sidebar: Ctrl+clic en dos
  // filas las suma a la selección (en vez de abrirlas), y "Eliminar N
  // elementos seleccionados" del menú contextual las borra a las dos.
  let multiSelectOk = false;
  let multiSelectDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const multiAPath = window.mdEditor.joinPath(fixturesDir, 'multi-a.md');
    const multiBPath = window.mdEditor.joinPath(fixturesDir, 'multi-b.md');
    await window.mdEditor.saveFile('# A', multiAPath, false);
    await window.mdEditor.saveFile('# B', multiBPath, false);
    const treeResult = await window.mdEditor.readFolder(fixturesDir);
    window.mdSidebar.renderFolder(treeResult);

    const findRow = (name) => Array.from(document.querySelectorAll('.tree-row')).find((r) => r.textContent.trim() === name);
    const rowA = findRow('multi-a.md');
    const rowB = findRow('multi-b.md');
    rowA.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    rowB.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
    const bothSelectedOk = rowA.classList.contains('tree-row-selected') && rowB.classList.contains('tree-row-selected');
    const selectedCountOk = window.mdSidebar.getSelectedForTest().length === 2;

    const originalConfirmMulti = window.confirm;
    window.confirm = () => true;
    rowA.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
    // El menú del sidebar es un .context-menu propio, sin id (distinto del
    // #context-menu del editor, ver contextmenu.js) — se ubica por
    // descarte: el .context-menu visible que no es el del editor.
    const sidebarMenuVisible = Array.from(document.querySelectorAll('.context-menu')).find((el) => el.id !== 'context-menu' && !el.hidden);
    const bulkDeleteBtn = sidebarMenuVisible && Array.from(sidebarMenuVisible.querySelectorAll('button')).find((b) => b.textContent === 'Eliminar 2 elementos seleccionados');
    if (bulkDeleteBtn) bulkDeleteBtn.click();
    await waitFor(async () => (await window.mdEditor.readFile(multiAPath)) === null && (await window.mdEditor.readFile(multiBPath)) === null);
    window.confirm = originalConfirmMulti;

    const aGoneOk = (await window.mdEditor.readFile(multiAPath)) === null;
    const bGoneOk = (await window.mdEditor.readFile(multiBPath)) === null;
    multiSelectOk = bothSelectedOk && selectedCountOk && !!bulkDeleteBtn && aGoneOk && bGoneOk;
    multiSelectDetail = `filasSeleccionadasOk=${bothSelectedOk} cuentaOk=${selectedCountOk} botonBulkEncontrado=${!!bulkDeleteBtn} aBorradoOk=${aGoneOk} bBorradoOk=${bGoneOk}`;
  }
  check('Sidebar: Ctrl+clic selecciona varios archivos y el menú contextual los elimina en bloque', multiSelectOk, multiSelectDetail);

  // 20bb. Arrastrar un archivo del sidebar: el arrastre normal NO lanza el
  // drag nativo del SO (en Electron 44 reemplazaba al interno y mover un
  // archivo a otra carpeta dejaba de funcionar); lleva text/uri-list para
  // soltarlo afuera. Alt+arrastrar sí lanza el nativo. Y soltarlo sobre una
  // carpeta del árbol lo mueve de verdad.
  let nativeDragOk = false;
  let nativeDragDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const moveSrc = window.mdEditor.joinPath(fixturesDir, 'mover-yo.md');
    await window.mdEditor.saveFile('# muevanme\n', moveSrc, false);
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(fixturesDir));
    let dragCalls = [];
    window.mdSidebar.setStartFileDragForTest((p) => dragCalls.push(p));

    const findRow = (name) => Array.from(document.querySelectorAll('.tree-row')).find((r) => r.textContent.trim() === name);
    const fileRow = findRow('mover-yo.md');
    const folderRow = findRow('moveB');

    const dt = new DataTransfer();
    fileRow.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const plainNoNative = dragCalls.length === 0;
    const uriOk = dt.getData('text/uri-list') === 'file://' + encodeURI(moveSrc);
    folderRow.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    folderRow.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const movedPath = window.mdEditor.joinPath(fixturesDir, 'moveB', 'mover-yo.md');
    const moved = await waitFor(async () => (await window.mdEditor.readFile(movedPath)) !== null && (await window.mdEditor.readFile(moveSrc)) === null);

    const noteRow = findRow('note.md') || (await waitFor(() => findRow('note.md')));
    noteRow.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, altKey: true, dataTransfer: new DataTransfer() }));
    const altNative = dragCalls.length === 1 && dragCalls[0] === window.mdEditor.joinPath(fixturesDir, 'note.md');

    window.mdSidebar.setStartFileDragForTest((p) => window.mdEditor.startFileDrag(p));
    nativeDragOk = plainNoNative && uriOk && !!moved && altNative;
    nativeDragDetail = `normalSinNativo=${plainNoNative} uriList=${uriOk} moverACarpeta=${!!moved} altNativo=${altNative}`;
  }
  check('Sidebar: arrastrar un archivo a una carpeta lo mueve; text/uri-list para soltarlo afuera; Alt+arrastrar usa el drag nativo', nativeDragOk, nativeDragDetail);

  // 20c. Panel secundario: "Abrir en panel secundario" (menú del sidebar)
  // muestra un archivo de referencia de solo lectura, y clic en el header
  // lo "promueve" a principal (pestaña editable) mientras el que era
  // principal pasa a mostrarse ahí, también de solo lectura.
  // Regresión: "hidden" tiene que ganarle a cualquier "display" fijo en CSS
  // (mismo bug real que ya pasó con .modal-overlay/.dropdown-menu) — antes
  // de abrir nada, el panel secundario debe estar realmente invisible
  // (display:none calculado), no solo con el atributo puesto.
  const hiddenByDefaultOk = document.getElementById('secondary-pane').hidden &&
    getComputedStyle(document.getElementById('secondary-pane')).display === 'none';

  let secondaryPaneOk = false;
  let secondaryPaneDetail = 'sin fixturesDir';
  if (fixtureMdPath && fixtureOtherPath) {
    await window.openFileAtPath(fixtureMdPath); // principal: note.md
    await window.mdSecondaryPane.open(fixtureOtherPath); // secundario: other.md
    await waitFor(() => !document.getElementById('secondary-pane').hidden);
    const paneVisibleOk = !document.getElementById('secondary-pane').hidden;
    const showsSecondaryContentOk = document.getElementById('secondary-pane-body').textContent.includes('Ver');

    document.getElementById('secondary-pane-title').click();
    await waitFor(() => window.mdState.currentFilePath === fixtureOtherPath);
    const promotedOk = window.mdState.currentFilePath === fixtureOtherPath;
    await waitFor(() => document.getElementById('secondary-pane-body').textContent.includes('Hola MK'));
    const oldPrimaryNowSecondaryOk = document.getElementById('secondary-pane-body').textContent.includes('Hola MK');

    window.mdSecondaryPane.close();
    const closedOk = document.getElementById('secondary-pane').hidden;

    secondaryPaneOk = hiddenByDefaultOk && paneVisibleOk && showsSecondaryContentOk && promotedOk && oldPrimaryNowSecondaryOk && closedOk;
    secondaryPaneDetail = `ocultoPorDefectoOk=${hiddenByDefaultOk} panelVisibleOk=${paneVisibleOk} muestraContenidoOk=${showsSecondaryContentOk} promovioOk=${promotedOk} viejoPrincipalAhoraSecundarioOk=${oldPrimaryNowSecondaryOk} cerroOk=${closedOk}`;
  }
  check('Panel secundario: abre de solo lectura y "promueve" al principal con un clic', secondaryPaneOk, secondaryPaneDetail);

  // 20cc. Regresión real: PDF de principal + un .md de secundario -> clic
  // para promover el .md. Antes, showPdfPreview nunca actualizaba
  // mdState.currentFilePath (quedaba con lo último abierto de antes, o
  // null), así que el panel secundario perdía de vista que el PDF era "lo
  // que era principal" y lo tiraba en vez de mandarlo al secundario. Y el
  // modo lectura que fuerza un PDF (ver preview.js) se quedaba pegado en
  // el .md recién promovido, dejándolo con el editor oculto sin querer.
  let pdfPromoteOk = false;
  let pdfPromoteDetail = 'sin fixturesDir';
  if (fixturesDir && fixturePdfPath && fixtureOtherPath) {
    window.showPdfPreview(fixturePdfPath);
    await waitFor(() => window.mdState.currentFilePath === fixturePdfPath);
    const pdfTrackedAsCurrentOk = window.mdState.currentFilePath === fixturePdfPath;

    await window.mdSecondaryPane.open(fixtureOtherPath);
    await waitFor(() => !document.getElementById('secondary-pane').hidden);

    document.getElementById('secondary-pane-title').click();
    await waitFor(() => window.mdState.currentFilePath === fixtureOtherPath);
    const mdPromotedOk = window.mdState.currentFilePath === fixtureOtherPath;
    const mdInNormalModeOk = !document.querySelector('.container').classList.contains('mode-read') &&
      getComputedStyle(document.querySelector('.editor-column')).display !== 'none';

    await waitFor(() => document.querySelector('#secondary-pane-body embed'));
    const pdfMovedToSecondaryOk = !!document.querySelector('#secondary-pane-body embed');

    window.mdSecondaryPane.close();

    pdfPromoteOk = pdfTrackedAsCurrentOk && mdPromotedOk && mdInNormalModeOk && pdfMovedToSecondaryOk;
    pdfPromoteDetail = `pdfTrackeadoComoActualOk=${pdfTrackedAsCurrentOk} mdPromovidoOk=${mdPromotedOk} mdEnModoNormalOk=${mdInNormalModeOk} pdfPasoASecundarioOk=${pdfMovedToSecondaryOk}`;
  }
  check('PDF principal + .md secundario: promover no pierde el PDF ni deja el .md en modo lectura pegado', pdfPromoteOk, pdfPromoteDetail);

  // 20d. Panel secundario: botón "Código" muestra la fuente cruda (sin
  // renderizar) de un archivo de texto, "Vista" vuelve al renderizado.
  // Solo tiene sentido para md/txt/tex — para PDF/imagen/docx el botón
  // queda oculto (no hay "fuente" que mostrar).
  let secondaryViewModeOk = false;
  let secondaryViewModeDetail = 'sin fixturesDir';
  if (fixturesDir && fixturePdfPath) {
    // Archivo propio de este check (no comparte note.md/other.md con otros
    // tests, que los van mutando a lo largo de la suite): contenido fijo y
    // conocido, así "# Encabezado" solo puede aparecer en modo código.
    const viewModeFixturePath = window.mdEditor.joinPath(fixturesDir, 'secondary-viewmode-test.md');
    await window.mdEditor.saveFile('# Encabezado\n\nTexto plano.\n', viewModeFixturePath, false);

    await window.mdSecondaryPane.open(viewModeFixturePath);
    await waitFor(() => !document.getElementById('secondary-pane').hidden);
    const viewModeBtn = document.getElementById('secondary-pane-viewmode');
    const btnVisibleForTextOk = !viewModeBtn.hidden;
    const renderedFirstOk = !document.getElementById('secondary-pane-body').textContent.includes('# Encabezado');

    viewModeBtn.click();
    await waitFor(() => document.getElementById('secondary-pane-body').textContent.includes('# Encabezado'));
    const showsRawSourceOk = document.getElementById('secondary-pane-body').textContent.includes('# Encabezado');

    viewModeBtn.click();
    await waitFor(() => !document.getElementById('secondary-pane-body').textContent.includes('# Encabezado'));
    const backToRenderedOk = !document.getElementById('secondary-pane-body').textContent.includes('# Encabezado');

    await window.mdSecondaryPane.open(fixturePdfPath);
    await waitFor(() => !document.getElementById('secondary-pane').hidden);
    const btnHiddenForPdfOk = viewModeBtn.hidden;

    window.mdSecondaryPane.close();

    secondaryViewModeOk = btnVisibleForTextOk && renderedFirstOk && showsRawSourceOk && backToRenderedOk && btnHiddenForPdfOk;
    secondaryViewModeDetail = `botonVisibleEnTextoOk=${btnVisibleForTextOk} primeroRenderizadoOk=${renderedFirstOk} muestraFuenteOk=${showsRawSourceOk} vuelveARenderizadoOk=${backToRenderedOk} botonOcultoEnPdfOk=${btnHiddenForPdfOk}`;
  }
  check('Panel secundario: botón Código/Vista alterna fuente cruda y renderizado', secondaryViewModeOk, secondaryViewModeDetail);

  // 20e. El modo enfoque/lectura del principal (Ctrl+Shift+E / Ctrl+Shift+R)
  // es un eje independiente del sidebar y del panel secundario: los tres
  // se pueden combinar (ej: sidebar visible + panel secundario abierto +
  // principal en modo código). Regresión: antes, mode-focus/mode-read
  // ocultaban el sidebar Y el panel secundario a la fuerza.
  let modeAxesIndependentOk = false;
  let modeAxesDetail = 'sin fixturesDir';
  if (fixturesDir && fixtureMdPath && fixtureOtherPath) {
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(fixturesDir));
    await window.openFileAtPath(fixtureMdPath);
    await window.mdSecondaryPane.open(fixtureOtherPath);
    await waitFor(() => !document.getElementById('secondary-pane').hidden);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true }));
    await waitFor(() => sidebarContainerEl.classList.contains('mode-focus'));
    const sidebarVisibleInFocusOk = getComputedStyle(document.getElementById('sidebar-pane')).display !== 'none';
    const secondaryVisibleInFocusOk = getComputedStyle(document.getElementById('secondary-pane')).display !== 'none';

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true })); // vuelve a normal
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', ctrlKey: true, shiftKey: true }));
    await waitFor(() => sidebarContainerEl.classList.contains('mode-read'));
    const sidebarVisibleInReadOk = getComputedStyle(document.getElementById('sidebar-pane')).display !== 'none';
    const secondaryVisibleInReadOk = getComputedStyle(document.getElementById('secondary-pane')).display !== 'none';

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', ctrlKey: true, shiftKey: true })); // vuelve a normal
    window.mdSecondaryPane.close();

    modeAxesIndependentOk = sidebarVisibleInFocusOk && secondaryVisibleInFocusOk && sidebarVisibleInReadOk && secondaryVisibleInReadOk;
    modeAxesDetail = `sidebarVisibleEnFocoOk=${sidebarVisibleInFocusOk} secundarioVisibleEnFocoOk=${secondaryVisibleInFocusOk} sidebarVisibleEnLecturaOk=${sidebarVisibleInReadOk} secundarioVisibleEnLecturaOk=${secondaryVisibleInReadOk}`;
  }
  check('Modo enfoque/lectura no oculta el sidebar ni el panel secundario (ejes independientes)', modeAxesIndependentOk, modeAxesDetail);

  // 20f. Panel secundario: mismo ancho que el principal por defecto (los
  // dos "pantalla" quedan 1fr/1fr en el grid, ver styles.css), y el propio
  // divisor (#resizer-secondary) permite repartir el ancho entre los dos
  // arrastrando, igual que el resto de los resizers de la app.
  let splitWidthOk = false;
  let splitWidthDetail = 'sin fixturesDir';
  if (fixtureMdPath && fixtureOtherPath) {
    await window.openFileAtPath(fixtureMdPath);
    await window.mdSecondaryPane.open(fixtureOtherPath);
    await waitFor(() => !document.getElementById('secondary-pane').hidden);
    await new Promise((r) => setTimeout(r, 100));

    const primaryEl = document.querySelector('.primary-pane');
    const secondaryEl = document.getElementById('secondary-pane');
    const primaryWidthBefore = primaryEl.getBoundingClientRect().width;
    const secondaryWidthBefore = secondaryEl.getBoundingClientRect().width;
    const equalByDefaultOk = Math.abs(primaryWidthBefore - secondaryWidthBefore) < 2;

    const handle = document.getElementById('resizer-secondary');
    const r = handle.getBoundingClientRect();
    handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.x + 3, clientY: r.y + 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.x - 100, clientY: r.y + 10 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: r.x - 100, clientY: r.y + 10 }));
    await waitFor(() => secondaryEl.getBoundingClientRect().width < secondaryWidthBefore - 50);
    const secondaryWidthAfter = secondaryEl.getBoundingClientRect().width;
    const primaryWidthAfter = primaryEl.getBoundingClientRect().width;
    const draggedOk = secondaryWidthAfter < secondaryWidthBefore - 50 && primaryWidthAfter > primaryWidthBefore + 50;

    window.mdSecondaryPane.close();

    splitWidthOk = equalByDefaultOk && draggedOk;
    splitWidthDetail = `parejoPorDefectoOk=${equalByDefaultOk} (principal=${primaryWidthBefore.toFixed(0)} secundario=${secondaryWidthBefore.toFixed(0)}) arrastreOk=${draggedOk} (principal=${primaryWidthAfter.toFixed(0)} secundario=${secondaryWidthAfter.toFixed(0)})`;
  }
  check('Panel secundario: mismo ancho que el principal por defecto, divisor lo reparte al arrastrar', splitWidthOk, splitWidthDetail);

  // 20g. Cada panel scrollea por su cuenta (preview y panel secundario),
  // sin que el contenido largo empuje la altura de .container ni haga
  // scrollear la página entera. Regresión real: un grid anidado (ver
  // .primary-pane) sin min-height:0 en cada nivel deja que los hijos
  // crezcan al alto de su contenido en vez de recortarse a la altura
  // disponible — cada panel "crecía" en vez de tener su propia barra.
  let independentScrollOk = false;
  let independentScrollDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const longContent = '# Largo\n\n' + Array.from({ length: 200 }, (_, i) => `Linea ${i} de contenido bien largo para forzar overflow vertical y probar el scroll interno de cada panel.`).join('\n\n');
    const scrollFixtureA = window.mdEditor.joinPath(fixturesDir, 'scroll-test-a.md');
    const scrollFixtureB = window.mdEditor.joinPath(fixturesDir, 'scroll-test-b.md');
    await window.mdEditor.saveFile(longContent, scrollFixtureA, false);
    await window.mdEditor.saveFile(longContent, scrollFixtureB, false);

    await window.openFileAtPath(scrollFixtureA);
    await window.mdSecondaryPane.open(scrollFixtureB);
    await waitFor(() => !document.getElementById('secondary-pane').hidden);
    await new Promise((r) => setTimeout(r, 150));

    const containerEl2 = document.querySelector('.container');
    const previewScrollEl = document.getElementById('preview-scroll');
    const secondaryBodyEl = document.getElementById('secondary-pane-body');

    const containerNotOverflowingOk = containerEl2.scrollHeight <= containerEl2.clientHeight + 2;
    const bodyNotScrollingOk = document.body.scrollHeight <= document.body.clientHeight + 20;
    const previewHasOwnScrollOk = previewScrollEl.scrollHeight > previewScrollEl.clientHeight + 50;
    const secondaryHasOwnScrollOk = secondaryBodyEl.scrollHeight > secondaryBodyEl.clientHeight + 50;

    previewScrollEl.scrollTop = 300;
    secondaryBodyEl.scrollTop = 150;
    await new Promise((r) => setTimeout(r, 50));
    const scrollIndependentOk = previewScrollEl.scrollTop === 300 && secondaryBodyEl.scrollTop === 150;

    window.mdSecondaryPane.close();

    independentScrollOk = containerNotOverflowingOk && bodyNotScrollingOk && previewHasOwnScrollOk && secondaryHasOwnScrollOk && scrollIndependentOk;
    independentScrollDetail = `containerNoDesbordaOk=${containerNotOverflowingOk} paginaNoScrolleaOk=${bodyNotScrollingOk} previewScrollPropioOk=${previewHasOwnScrollOk} secundarioScrollPropioOk=${secondaryHasOwnScrollOk} scrollIndependienteOk=${scrollIndependentOk}`;
  }
  check('Cada panel (editor/preview/secundario) scrollea por su cuenta, sin empujar la altura de la ventana', independentScrollOk, independentScrollDetail);

  // 21. Vista de cambios (diff.js) con el paquete "diff" (Myers) en vez del
  // LCS a mano — regresión: que siga marcando agregados/borrados bien
  let diffOk = false;
  if (fixtureMdPath) {
    await window.openFileAtPath(fixtureMdPath);
    const onDisk = await window.mdEditor.readFile(fixtureMdPath);
    window.mdCodeMirror.setValue(onDisk.content + '\nLinea agregada para el diff.\n');
    document.getElementById('btn-diff').click();
    await waitFor(() => !document.getElementById('diff-panel').hidden);
    const hasAdd = !!document.querySelector('#diff-panel .diff-add');
    diffOk = hasAdd;
    document.getElementById('diff-panel').hidden = true;
    check('Vista de cambios (diff con Myers) marca líneas agregadas', diffOk);
  } else {
    check('Vista de cambios (diff con Myers) marca líneas agregadas', false, 'sin fixturesDir');
  }

  // 22. Ajustes de editor: tamaño de fuente, tipografía, tabulación y ajuste
  // de línea se aplican a CodeMirror y persisten en config.json
  const fontSizeSelect = document.getElementById('fontsize-select');
  fontSizeSelect.value = '18';
  fontSizeSelect.dispatchEvent(new Event('change'));
  const fontSizeVarOk = await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '18px');

  const tabSizeSelect = document.getElementById('tabsize-select');
  tabSizeSelect.value = '8';
  tabSizeSelect.dispatchEvent(new Event('change'));
  const tabSizeOk = window.mdCodeMirror.getOption('tabSize') === 8;

  const wordWrapToggle = document.getElementById('wordwrap-toggle');
  wordWrapToggle.checked = false;
  wordWrapToggle.dispatchEvent(new Event('change'));
  const wordWrapOk = window.mdCodeMirror.getOption('lineWrapping') === false;

  await new Promise((r) => setTimeout(r, 100));
  const persistedConfig = await window.mdEditor.getConfig();
  const persistedOk = persistedConfig.editorFontSize === '18' && persistedConfig.editorTabSize === 8 && persistedConfig.editorWordWrap === false;

  check(
    'Ajustes de editor (fuente/tabulación/ajuste de línea) se aplican y persisten',
    !!fontSizeVarOk && tabSizeOk && wordWrapOk && persistedOk,
    `fontSize=${!!fontSizeVarOk} tabSize=${tabSizeOk} wordWrap=${wordWrapOk} persistido=${persistedOk}`
  );
  // Revertir para no afectar otros checks (ninguno depende de esto, pero prolijo)
  wordWrapToggle.checked = true;
  wordWrapToggle.dispatchEvent(new Event('change'));

  // 22b. Ajuste rápido de tamaño de fuente: Ctrl+=/Ctrl+-, Ctrl+scroll sobre
  // el editor, Ctrl+0 para volver al tamaño por defecto (14px) — todo
  // sincronizado con el mismo config.json que usa el select de Ajustes.
  fontSizeSelect.value = '14';
  fontSizeSelect.dispatchEvent(new Event('change'));
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '14px');

  document.dispatchEvent(new KeyboardEvent('keydown', { key: '=', ctrlKey: true }));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: '=', ctrlKey: true }));
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '16px');
  const zoomInOk = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '16px';

  document.getElementById('editor-pane').dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 })
  );
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '17px');
  const wheelZoomOk = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '17px';

  document.dispatchEvent(new KeyboardEvent('keydown', { key: '-', ctrlKey: true }));
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '16px');
  const zoomOutOk = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '16px';

  document.dispatchEvent(new KeyboardEvent('keydown', { key: '0', ctrlKey: true }));
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '14px');
  const zoomResetOk = getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '14px';

  await new Promise((r) => setTimeout(r, 100));
  const zoomPersistedOk = (await window.mdEditor.getConfig()).editorFontSize === '14';

  check(
    'Ctrl+=/Ctrl+-/Ctrl+scroll/Ctrl+0 ajustan el tamaño de fuente y persisten en config.json',
    zoomInOk && wheelZoomOk && zoomOutOk && zoomResetOk && zoomPersistedOk,
    `zoomInOk=${zoomInOk} zoomRuedaOk=${wheelZoomOk} zoomOutOk=${zoomOutOk} reseteoOk=${zoomResetOk} persistidoOk=${zoomPersistedOk}`
  );

  // 22bb. El mismo zoom mueve el preview a la par (--preview-font-size), y
  // Ctrl+scroll también funciona sobre el preview (antes solo el editor
  // tenía el listener — en modo lectura el editor está oculto, quedaba sin
  // forma de hacer zoom ahí).
  fontSizeSelect.value = '14';
  fontSizeSelect.dispatchEvent(new Event('change'));
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--preview-font-size').trim() === '15px');
  const previewFollowsSelectOk = getComputedStyle(document.documentElement).getPropertyValue('--preview-font-size').trim() === '15px';

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', ctrlKey: true, shiftKey: true })); // modo lectura
  document.getElementById('preview-scroll').dispatchEvent(
    new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100 })
  );
  await waitFor(() => getComputedStyle(document.documentElement).getPropertyValue('--preview-font-size').trim() === '16px');
  const previewWheelInReadModeOk = getComputedStyle(document.documentElement).getPropertyValue('--preview-font-size').trim() === '16px' &&
    getComputedStyle(document.documentElement).getPropertyValue('--editor-font-size').trim() === '15px';
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', ctrlKey: true, shiftKey: true })); // vuelve a normal

  check(
    'El zoom también mueve el tamaño del preview, y Ctrl+scroll funciona ahí (incluido en modo lectura)',
    previewFollowsSelectOk && previewWheelInReadModeOk,
    `previewSigueSelectOk=${previewFollowsSelectOk} zoomPreviewEnLecturaOk=${previewWheelInReadModeOk}`
  );

  // 22c. Un PDF/imagen siempre se muestra en modo lectura (antes podía
  // quedar oculto atrás de "modo enfoque", o compartir pantalla con un
  // editor mostrando un archivo sin relación) — y si el tab activo era un
  // archivo de código ("code-file" fuerza ocultar el preview), esa clase
  // se saca para no taparlo.
  window.mdCodeMirror.setValue('cualquier cosa');
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', ctrlKey: true, shiftKey: true })); // modo enfoque
  await waitFor(() => document.querySelector('.container').classList.contains('mode-focus'));
  document.querySelector('.container').classList.add('code-file'); // simula tab de código activo

  window.showPdfPreview('/no/existe/prueba.pdf'); // no hace falta que el PDF exista, solo mirar el modo
  await waitFor(() => document.querySelector('.container').classList.contains('mode-read'));
  const containerCls = document.querySelector('.container').className;
  const pdfForcesReadOk = containerCls.includes('mode-read') && !containerCls.includes('mode-focus') && !containerCls.includes('code-file');
  const previewVisibleForPdfOk = getComputedStyle(document.querySelector('.preview-wrapper')).display !== 'none';

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'R', ctrlKey: true, shiftKey: true })); // limpiar, volver a normal
  window.renderPreview();

  check(
    'Mostrar un PDF/imagen fuerza modo lectura (y saca "code-file" si estaba puesto)',
    pdfForcesReadOk && previewVisibleForPdfOk,
    `forzoLecturaOk=${pdfForcesReadOk} previewVisibleOk=${previewVisibleForPdfOk} clases="${containerCls}"`
  );

  // 22c. Resaltado de sintaxis por extensión (no solo Markdown/LaTeX): antes
  // modeForPath solo distinguía .tex, cualquier otro archivo (aunque fuera
  // texto plano editable, como .py/.c) se resaltaba como si fuera Markdown.
  let langModesOk = false;
  let langModesDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const langFiles = {
      py: { path: window.mdEditor.joinPath(fixturesDir, 'script.py'), mode: 'python', label: 'Python' },
      c: { path: window.mdEditor.joinPath(fixturesDir, 'main.c'), mode: 'text/x-csrc', label: 'C' },
      cpp: { path: window.mdEditor.joinPath(fixturesDir, 'main.cpp'), mode: 'text/x-c++src', label: 'C++' },
      java: { path: window.mdEditor.joinPath(fixturesDir, 'Main.java'), mode: 'text/x-java', label: 'Java' },
      sh: { path: window.mdEditor.joinPath(fixturesDir, 'run.sh'), mode: 'shell', label: 'Shell' }
    };
    const results = {};
    for (const [key, info] of Object.entries(langFiles)) {
      await window.mdEditor.saveFile('contenido de prueba\n', info.path, false);
      await window.openFileAtPath(info.path);
      await waitFor(() => window.mdCodeMirror.getOption('mode') === info.mode);
      results[key] = window.mdCodeMirror.getOption('mode') === info.mode &&
        document.getElementById('status-mode').textContent === info.label;
    }
    langModesOk = Object.values(results).every(Boolean);
    langModesDetail = Object.entries(results).map(([k, v]) => `${k}=${v}`).join(' ');
  }
  check('Resaltado de sintaxis: .py/.c/.cpp/.java/.sh usan el modo de CodeMirror correcto (no Markdown)', langModesOk, langModesDetail);

  // 22d. En un archivo de código no tiene sentido el preview (renderiza
  // Markdown, y "# comentario" se leía como encabezado) — se oculta y el
  // editor pasa a ocupar todo el ancho del principal. Al volver a un .md
  // normal, el preview tiene que reaparecer.
  let codeFileNoPreviewOk = false;
  let codeFileNoPreviewDetail = 'sin fixturesDir';
  if (fixturesDir && fixtureMdPath) {
    const pyPath = window.mdEditor.joinPath(fixturesDir, 'script.py');
    await window.openFileAtPath(pyPath);
    await waitFor(() => document.querySelector('.container').classList.contains('code-file'));
    const containerEl2 = document.querySelector('.container');
    const previewWrapperEl = document.querySelector('.preview-wrapper');
    const codeFileClassOk = containerEl2.classList.contains('code-file');
    const previewHiddenOk = getComputedStyle(previewWrapperEl).display === 'none';
    const previewEmptyOk = document.getElementById('preview-pane').innerHTML.trim() === '';

    await window.openFileAtPath(fixtureMdPath);
    await waitFor(() => !document.querySelector('.container').classList.contains('code-file'));
    const backToMdClassOk = !containerEl2.classList.contains('code-file');
    const previewVisibleAgainOk = getComputedStyle(previewWrapperEl).display !== 'none' &&
      document.getElementById('preview-pane').innerHTML.trim() !== '';

    codeFileNoPreviewOk = codeFileClassOk && previewHiddenOk && previewEmptyOk && backToMdClassOk && previewVisibleAgainOk;
    codeFileNoPreviewDetail = `claseEnCodigoOk=${codeFileClassOk} previewOcultoOk=${previewHiddenOk} previewVacioOk=${previewEmptyOk} claseSacadaOk=${backToMdClassOk} previewVuelveOk=${previewVisibleAgainOk}`;
  }
  check('Archivo de código: sin preview (Markdown no aplica), y vuelve al abrir un .md', codeFileNoPreviewOk, codeFileNoPreviewDetail);

  // 22h. Temporizador Pomodoro: arranca en foco, transiciona solo a descanso
  // al llegar a 0, y "cancelar" vuelve a estado inicial. Minutos configurados
  // bien cortos (config directa, sin pasar por el select) para no esperar
  // 25 minutos de verdad en un test.
  await window.mdEditor.setConfig({ pomodoroFocusMinutes: 0.02, pomodoroBreakMinutes: 0.02 }); // ~1.2s cada fase
  const pomodoroStatusEl = document.getElementById('status-pomodoro');
  window.mdPomodoro.toggle();
  await waitFor(() => !pomodoroStatusEl.hidden && window.mdPomodoro.getState().phase === 'focus');
  const pomodoroStartsFocusOk = window.mdPomodoro.getState().phase === 'focus' && window.mdPomodoro.getState().running;
  const pomodoroShowsInStatusbarOk = !pomodoroStatusEl.hidden && pomodoroStatusEl.textContent.includes('Foco');

  await waitFor(() => window.mdPomodoro.getState().phase === 'break', 5000);
  const pomodoroSwitchesToBreakOk = window.mdPomodoro.getState().phase === 'break';

  window.mdPomodoro.reset();
  const pomodoroResetOk = pomodoroStatusEl.hidden && window.mdPomodoro.getState().phase === 'idle';

  check(
    'Pomodoro: arranca en foco, pasa solo a descanso, "cancelar" vuelve a inicial',
    pomodoroStartsFocusOk && pomodoroShowsInStatusbarOk && pomodoroSwitchesToBreakOk && pomodoroResetOk,
    `arrancaFocoOk=${pomodoroStartsFocusOk} muestraEnStatusbarOk=${pomodoroShowsInStatusbarOk} pasaADescansoOk=${pomodoroSwitchesToBreakOk} cancelarOk=${pomodoroResetOk}`
  );

  // 22i. Control del reproductor multimedia (playerctl, solo Linux): el IPC
  // siempre devuelve {ok:boolean,...} sin tirar excepción, esté o no
  // instalado playerctl en la máquina que corre el test — eso es justo lo
  // que hay que blindar (no reventar si falta el binario).
  const mediaPlayPauseResult = await window.mdEditor.mediaPlayPause();
  const mediaResultShapeOk = typeof mediaPlayPauseResult === 'object' && typeof mediaPlayPauseResult.ok === 'boolean';

  const originalAlertMedia = window.alert;
  let mediaAlertShown = false;
  window.alert = () => { mediaAlertShown = true; };
  await window.mdMediaPlayer.playPause();
  window.alert = originalAlertMedia;
  // Si playerctl no está instalado/no hay player, tiene que avisar con alert
  // (no fallar en silencio); si sí funcionó, no hace falta ningún aviso.
  const mediaAlertConsistentOk = mediaPlayPauseResult.ok ? !mediaAlertShown : mediaAlertShown;

  check(
    'Reproductor multimedia (playerctl): IPC no revienta esté o no instalado, y avisa si falla',
    mediaResultShapeOk && mediaAlertConsistentOk,
    `formaRespuestaOk=${mediaResultShapeOk} ok=${mediaPlayPauseResult.ok} avisoConsistenteOk=${mediaAlertConsistentOk}`
  );

  // 22j. Ocultar botones de la toolbar desde Ajustes (toolbarcustomize.js):
  // destildar esconde el botón real (regresión [hidden] — .toolbar-button
  // tenía "display: inline-flex" sin guardar, mismo bug de siempre), y
  // "Ejecutar" corre la acción igual sin importar si está escondido o no.
  const pluginsBtn = document.getElementById('btn-plugins');
  const pluginsCheckbox = document.getElementById('toolbar-vis-btn-plugins');
  const visibleByDefaultOk = pluginsCheckbox.checked && !pluginsBtn.hidden &&
    getComputedStyle(pluginsBtn).display !== 'none';

  pluginsCheckbox.checked = false;
  pluginsCheckbox.dispatchEvent(new Event('change'));
  await waitFor(() => pluginsBtn.hidden);
  const hidesRealButtonOk = pluginsBtn.hidden && getComputedStyle(pluginsBtn).display === 'none';
  await new Promise((r) => setTimeout(r, 100));
  const persistedHiddenOk = (await window.mdEditor.getConfig()).hiddenToolbarButtons.includes('btn-plugins');

  const pluginsPanelBefore = document.getElementById('plugins-panel').hidden;
  const pluginsRunBtn = Array.from(document.querySelectorAll('.toolbar-buttons-settings-row'))
    .find((row) => row.querySelector('label').textContent === 'Plugins y comunidad')
    .querySelector('.toolbar-buttons-settings-run');
  pluginsRunBtn.click();
  await waitFor(() => !document.getElementById('plugins-panel').hidden);
  const runsEvenWhenHiddenOk = pluginsPanelBefore && !document.getElementById('plugins-panel').hidden;
  document.getElementById('plugins-panel').hidden = true;

  // Revertir para no afectar otros checks / dejar la app como estaba
  pluginsCheckbox.checked = true;
  pluginsCheckbox.dispatchEvent(new Event('change'));
  await waitFor(() => !pluginsBtn.hidden);

  check(
    'Ajustes: ocultar botones de la toolbar (destildar) y "Ejecutar" igual aunque esté oculto',
    visibleByDefaultOk && hidesRealButtonOk && persistedHiddenOk && runsEvenWhenHiddenOk,
    `visibleParDefectoOk=${visibleByDefaultOk} ocultaBotonRealOk=${hidesRealButtonOk} persistidoOk=${persistedHiddenOk} corrioAunOcultoOk=${runsEvenWhenHiddenOk}`
  );

  // 23. Restricción de rutas SIN carpeta abierta: antes no restringía nada;
  // ahora restringe al directorio propio del archivo suelto
  let looseFileRestrictionOk = false;
  if (fixtureMdPath) {
    window.mdState.rootFolder = null;
    await window.openFileAtPath(fixtureMdPath);
    window.mdCodeMirror.setValue('![fuera](../../../../etc/passwd.png)');
    window.renderPreview();
    await new Promise((r) => setTimeout(r, 150));
    looseFileRestrictionOk = !!document.querySelector('#preview-pane [data-blocked-src], #preview-pane .asset-missing');
    check('Restricción de rutas aplica también sin carpeta abierta (archivo suelto)', looseFileRestrictionOk);
  } else {
    check('Restricción de rutas aplica también sin carpeta abierta (archivo suelto)', false, 'sin fixturesDir');
  }

  // 24. Historial de versiones: guardar crea un backup, listBackups lo ve,
  // y el panel (paleta de comandos -> "Ver versiones anteriores...") lo lista
  let historyOk = false;
  if (fixtureMdPath) {
    window.mdState.rootFolder = fixturesDir || null;
    await window.openFileAtPath(fixtureMdPath);
    const before = await window.mdEditor.listBackups(fixtureMdPath);
    window.mdCodeMirror.setValue('Version A ' + Date.now());
    await window.mdEditor.saveFile(window.mdCodeMirror.getValue(), fixtureMdPath, false);
    const after = await window.mdEditor.listBackups(fixtureMdPath);
    const backupCreatedOk = after.length > before.length;

    window.mdHistory.open();
    const panelItem = await waitFor(() => document.querySelector('#history-list .command-palette-item'));
    const panelShowsOk = !!panelItem;
    window.mdHistory.close();

    historyOk = backupCreatedOk && panelShowsOk;
    check(
      'Historial de versiones: guardar crea un backup y aparece en el panel',
      historyOk,
      `backupCreado=${backupCreatedOk} panelLoMuestra=${panelShowsOk}`
    );
  } else {
    check('Historial de versiones: guardar crea un backup y aparece en el panel', false, 'sin fixturesDir');
  }

  // 24b. Historial de versiones: "Ver diff" compara la versión guardada
  // contra el contenido actual del editor (mismo motor que "Ver cambios
  // sin guardar"), sin necesidad de restaurar primero para poder comparar.
  let historyDiffOk = false;
  let historyDiffDetail = 'sin fixturesDir';
  if (fixtureMdPath) {
    await window.openFileAtPath(fixtureMdPath);
    const marker = `LINEA-EXTRA-${Date.now()}`;
    window.mdCodeMirror.setValue('Contenido base para diff.');
    await window.mdEditor.saveFile(window.mdCodeMirror.getValue(), fixtureMdPath, false);
    window.mdCodeMirror.setValue('Contenido base para diff.\n' + marker);

    document.getElementById('diff-panel').hidden = true;
    window.mdHistory.open();
    const diffBtn = await waitFor(() => document.querySelector('#history-list .history-item button'));
    const diffPanelBefore = document.getElementById('diff-panel').hidden;
    if (diffBtn) diffBtn.click();
    await waitFor(() => !document.getElementById('diff-panel').hidden);
    const diffPanelAfter = document.getElementById('diff-panel').hidden;
    const diffShowsMarker = document.getElementById('diff-panel').textContent.includes(marker);
    document.getElementById('diff-panel').hidden = true;
    historyDiffOk = !!diffBtn && diffPanelBefore === true && diffPanelAfter === false && diffShowsMarker;
    historyDiffDetail = `botonEncontrado=${!!diffBtn} panelAbrio=${diffPanelBefore === true && diffPanelAfter === false} muestraLineaNueva=${diffShowsMarker}`;
  }
  check('Historial de versiones: "Ver diff" compara la versión guardada contra el editor actual', historyDiffOk, historyDiffDetail);

  // 25. Links del preview. Regresión: antes ningún <a> normal tenía
  // manejador y el clic dejaba la ventana de la app en blanco (navegaba la
  // propia ventana fuera de index.html).
  // - Un link externo (http) tiene que quedar interceptado (preventDefault)
  //   en vez de dejarse navegar; no se hace click real para no disparar un
  //   shell.openExternal de verdad (abriría un navegador real en cada test run).
  // - Un link relativo a otro archivo local sí tiene que abrirlo como pestaña.
  let linksOk = false;
  if (fixturesDir && fixtureOtherPath) {
    await window.openFileAtPath(fixtureMdPath);
    window.mdCodeMirror.setValue('[externo](https://example.com/pagina) y [interno](other.md)');
    window.renderPreview();

    const externalLink = await waitFor(() => Array.from(document.querySelectorAll('#preview-pane a')).find((a) => /example\.com/.test(a.getAttribute('href') || '')));
    const notCancelled = externalLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const externalOk = notCancelled === false; // false = alguien llamó preventDefault()

    const internalLink = document.querySelector('#preview-pane a[href="other.md"]');
    internalLink.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await waitFor(() => window.mdState.currentFilePath === fixtureOtherPath);
    const internalOk = window.mdState.currentFilePath === fixtureOtherPath;

    linksOk = externalOk && internalOk;
    check(
      'Links del preview: externo se intercepta (no navega la ventana), interno abre el archivo',
      linksOk,
      `externoInterceptado=${externalOk} internoAbrio=${internalOk}`
    );
  } else {
    check('Links del preview: externo se intercepta (no navega la ventana), interno abre el archivo', false, 'sin fixturesDir');
  }

  // 26. Abrir un archivo binario/de extensión desconocida no cuelga la app:
  // muestra un aviso en el editor en vez de decodificar basura como texto
  let binaryOk = false;
  if (fixturesDir) {
    const binaryPath = window.mdEditor.joinPath(fixturesDir, 'binary.dat');
    await window.openFileAtPath(binaryPath);
    await waitFor(() => window.mdCodeMirror.getValue().includes('binario'));
    const showsWarningOk = window.mdCodeMirror.getValue().includes('binario');
    const noRealPathOk = window.mdState.currentFilePath !== binaryPath; // no quedó "abierto" de verdad
    binaryOk = showsWarningOk && noRealPathOk;
    check(
      'Archivo binario/desconocido: no cuelga, avisa en el editor en vez de abrirlo',
      binaryOk,
      `avisoEnEditor=${showsWarningOk} noQuedoComoArchivoReal=${noRealPathOk}`
    );
  } else {
    check('Archivo binario/desconocido: no cuelga, avisa en el editor en vez de abrirlo', false, 'sin fixturesDir');
  }

  // 26b. Abrir un .docx lo convierte a Markdown (mammoth + turndown, ver
  // docximport.js) en una pestaña nueva SIN ruta — nunca pisa el .docx
  // original, "Guardar" pediría "Guardar como".
  let docxOk = false;
  let docxDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const docxPath = window.mdEditor.joinPath(fixturesDir, 'prueba.docx');
    const tabsBefore = document.querySelectorAll('#tabbar .tab').length;
    await window.openFileAtPath(docxPath);
    await waitFor(() => document.querySelectorAll('#tabbar .tab').length > tabsBefore);
    await waitFor(() => window.mdCodeMirror.getValue().includes('Walking on imported air'));
    const contentOk = window.mdCodeMirror.getValue().includes('Walking on imported air');
    const noRealPathOk = window.mdState.currentFilePath !== docxPath;
    docxOk = contentOk && noRealPathOk;
    docxDetail = `convirtioTextoOk=${contentOk} noPisaOriginalOk=${noRealPathOk} contenido="${window.mdCodeMirror.getValue().slice(0, 60)}"`;
  }
  check('Abrir .docx lo convierte a Markdown en una pestaña nueva sin ruta', docxOk, docxDetail);

  // 26d. Plegado visual de imágenes incrustadas (data: URI base64) en el
  // editor (ver foldimages.js): no toca el contenido real, solo lo pliega
  // en un widget para no llenar la pantalla de base64 ilegible.
  let foldOk = false;
  let foldDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const docxImgPath = window.mdEditor.joinPath(fixturesDir, 'prueba-imagen.docx');
    await window.openFileAtPath(docxImgPath);
    await waitFor(() => window.mdCodeMirror.getValue().includes('data:image'));
    await waitFor(() => document.querySelector('.folded-image-data'));
    const foldedWidgetOk = !!document.querySelector('.folded-image-data');
    const rawValueIntactOk = window.mdCodeMirror.getValue().includes('data:image/png;base64,');
    foldOk = foldedWidgetOk && rawValueIntactOk;
    foldDetail = `widgetPlegadoOk=${foldedWidgetOk} contenidoRealIntactoOk=${rawValueIntactOk}`;
  }
  check('Imágenes data: URI se pliegan visualmente en el editor sin tocar el contenido real', foldOk, foldDetail);

  // 26e. Tablas HTML crudas (sin fila de encabezado, ver MANUAL.md) también
  // se pliegan, mismo mecanismo que las imágenes — no se superponen si una
  // tabla tiene una imagen adentro (la tabla entera se pliega como una unidad).
  let foldTableOk = false;
  let foldTableDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const docxTablePath = window.mdEditor.joinPath(fixturesDir, 'prueba-tabla.docx');
    await window.openFileAtPath(docxTablePath);
    await waitFor(() => window.mdCodeMirror.getValue().includes('<table'));
    await waitFor(() => document.querySelector('.folded-html-table'));
    const foldedTableWidgetOk = !!document.querySelector('.folded-html-table');
    const rawTableIntactOk = window.mdCodeMirror.getValue().includes('<table>') && window.mdCodeMirror.getValue().includes('Top left');
    foldTableOk = foldedTableWidgetOk && rawTableIntactOk;
    foldTableDetail = `widgetPlegadoOk=${foldedTableWidgetOk} contenidoRealIntactoOk=${rawTableIntactOk}`;
  }
  check('Tablas HTML crudas (sin fila de encabezado) se pliegan visualmente en el editor', foldTableOk, foldTableDetail);

  // 26bb. Regresión real: mammoth envuelve SIEMPRE el texto de una celda de
  // tabla en <p> (hasta "<td><p>1</p></td>"), y la regla de párrafo de
  // turndown-plugin-gfm arma la fila de tabla igual sin sacar el "\n\n" —
  // una tabla CON encabezado (por eso no cae en el pliegue de arriba, que
  // es para las que quedan crudas) terminaba con filas que ocupan varias
  // líneas físicas: sintaxis de tabla Markdown inválida. Ver docximport.js.
  const simpleCellHtml = '<table><thead><tr><th><p>Col A</p></th><th><p>Col B</p></th></tr></thead><tbody><tr><td><p>1</p></td><td><p>2</p></td></tr></tbody></table>';
  const simpleCellMd = window.mdDocxImport.htmlToMarkdown(simpleCellHtml);
  const cleanSingleLineRowsOk = simpleCellMd === '| Col A | Col B |\n| --- | --- |\n| 1 | 2 |';

  const multiParagraphCellHtml = '<table><thead><tr><th><p>linea1</p><p>linea2</p><p>linea3</p></th></tr></thead></table>';
  const multiParagraphCellMd = window.mdDocxImport.htmlToMarkdown(multiParagraphCellHtml);
  const joinedWithBrOk = multiParagraphCellMd === '| linea1<br>linea2<br>linea3 |\n| --- |';

  check(
    'Abrir .docx: celdas de tabla con <p> (mammoth las envuelve siempre) no rompen la fila Markdown',
    cleanSingleLineRowsOk && joinedWithBrOk,
    `filaLimpiaOk=${cleanSingleLineRowsOk} (${JSON.stringify(simpleCellMd)}) parrafosUnidosOk=${joinedWithBrOk} (${JSON.stringify(multiParagraphCellMd)})`
  );

  // 26c. Exportar a Word (.docx): arma un .docx real (librería "docx") a
  // partir del Markdown del editor — se relee con mammoth (mismo motor de
  // la importación) para confirmar que es un .docx válido de verdad, no
  // solo que el diálogo "funcionó".
  let docxExportOk = false;
  let docxExportDetail = '';
  {
    window.mdCodeMirror.setValue([
      '# Titulo de prueba',
      '',
      'Texto con **negrita** y una [link](https://example.com).',
      '',
      '- Item uno',
      '- Item dos',
      '',
      '| Col A | Col B |',
      '| --- | --- |',
      '| uno | dos |'
    ].join('\n'));
    const savedPath = await window.mdDocxExport.exportToDocx();
    let roundtripOk = false;
    let roundtripText = '';
    if (savedPath) {
      const base64 = await window.mdEditor.docxReadBytes(savedPath);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const reopened = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
      roundtripText = reopened.value;
      roundtripOk = /Titulo de prueba/.test(roundtripText) &&
        /negrita/.test(roundtripText) &&
        /example\.com/.test(roundtripText) &&
        /Item uno/.test(roundtripText) &&
        /<table/.test(roundtripText);
    }
    docxExportOk = !!savedPath && roundtripOk;
    docxExportDetail = `guardado=${!!savedPath} releidoOk=${roundtripOk} html="${roundtripText.slice(0, 80)}"`;
  }
  check('Exportar a Word (.docx): genera un .docx real, releído con mammoth', docxExportOk, docxExportDetail);

  // 27. Clic en una imagen del árbol la muestra en el preview (antes
  // intentaba "editarla" como texto)
  let imagePreviewOk = false;
  if (fixturesDir) {
    const imgPath = window.mdEditor.joinPath(fixturesDir, 'photo.png');
    window.showImagePreview(imgPath);
    await waitFor(() => document.querySelector('#preview-pane .image-preview img'));
    const img = document.querySelector('#preview-pane .image-preview img');
    imagePreviewOk = !!img && img.getAttribute('src') === window.mdEditor.toLocalUrl(imgPath);
    check('Clic en una imagen del árbol la muestra en el preview', imagePreviewOk);
  } else {
    check('Clic en una imagen del árbol la muestra en el preview', false, 'sin fixturesDir');
  }

  // 28. Panel de plugins/comunidad: abre y cierra
  document.getElementById('btn-plugins').click();
  const pluginsOpenedOk = !document.getElementById('plugins-panel').hidden;
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  const pluginsClosedOk = document.getElementById('plugins-panel').hidden;
  check(
    'Panel de plugins y comunidad abre y cierra',
    pluginsOpenedOk && pluginsClosedOk,
    `abierto=${pluginsOpenedOk} cerrado=${pluginsClosedOk}`
  );

  // 29. Arrastrar una imagen (u otro archivo) desde el árbol hasta el editor
  // inserta directamente el link/embed de Markdown, sin copiarla a assets/
  // (ya está dentro del proyecto) — a diferencia de arrastrar un archivo
  // nuevo desde fuera de la app, que sí se copia.
  let sidebarDragOk = false;
  if (fixturesDir && fixtureMdPath) {
    await window.openFileAtPath(fixtureMdPath);
    window.mdCodeMirror.setValue('Texto previo.\n');
    window.mdCodeMirror.setCursor({ line: 1, ch: 0 });

    const imgPath = window.mdEditor.joinPath(fixturesDir, 'photo.png');
    const dt = new DataTransfer();
    dt.setData('application/x-mk-node', JSON.stringify({ ruta: imgPath, esCarpeta: false, nombre: 'photo.png' }));
    const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    document.getElementById('editor-pane').dispatchEvent(dropEvent);
    await waitFor(() => window.mdCodeMirror.getValue().includes('photo.png'));

    sidebarDragOk = window.mdCodeMirror.getValue().includes('![photo.png](photo.png)');
    check(
      'Arrastrar una imagen del árbol al editor inserta el link Markdown directamente',
      sidebarDragOk,
      `contenido="${window.mdCodeMirror.getValue().replace(/\n/g, '\\n')}"`
    );
  } else {
    check('Arrastrar una imagen del árbol al editor inserta el link Markdown directamente', false, 'sin fixturesDir');
  }

  // 30. Plantillas con variables: {{titulo}} pide el título (prompt) y
  // {{fecha}} se completa solo, ambas al crear desde "Nuevo ▾"
  let templateOk = false;
  try {
    const apuntesBtn = document.querySelector('#new-menu button[data-template="apuntes"]');
    apuntesBtn.click();
    await answerAsk('Mi Título De Prueba');
    await waitFor(() => window.mdCodeMirror.getValue().includes('Mi Título De Prueba'));
    const content = window.mdCodeMirror.getValue();
    const hoy = new Date().toLocaleDateString();
    templateOk = content.includes('# Mi Título De Prueba') && content.includes(hoy) && !content.includes('{{');
    check(
      'Plantillas con variables: {{titulo}} y {{fecha}} se completan al crear',
      templateOk,
      `contieneTitulo=${content.includes('Mi Título De Prueba')} contieneFecha=${content.includes(hoy)} sinLlaves=${!content.includes('{{')}`
    );
  } finally {
    // (nada que restaurar: el diálogo es propio, no se reemplaza nada)
  }

  // 31. Snippets de texto: "/fecha" seguido de espacio se expande sola
  window.mdCodeMirror.setValue('Hoy es /fecha');
  window.mdCodeMirror.setCursor({ line: 0, ch: window.mdCodeMirror.getValue().length });
  window.mdCodeMirror.getInputField().dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  await waitFor(() => !window.mdCodeMirror.getValue().includes('/fecha'));
  const snippetOk = !window.mdCodeMirror.getValue().includes('/fecha') && window.mdCodeMirror.getValue().includes(new Date().toLocaleDateString());
  check('Snippets de texto: "/fecha" se expande a la fecha de hoy', snippetOk, `contenido="${window.mdCodeMirror.getValue()}"`);

  // 32. Nota diaria: crea (o abre) Diario/YYYY-MM-DD.md dentro de la carpeta
  let dailyNoteOk = false;
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    await window.mdDailyNote.open();
    const pad = (n) => String(n).padStart(2, '0');
    const d = new Date();
    const expectedPath = window.mdEditor.joinPath(fixturesDir, 'Diario', `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.md`);
    await waitFor(() => window.mdState.currentFilePath === expectedPath);
    const createdOk = window.mdState.currentFilePath === expectedPath;
    const onDisk = await window.mdEditor.readFile(expectedPath);
    const hasContentOk = !!onDisk && !onDisk.binary && onDisk.content.trim().length > 0;
    dailyNoteOk = createdOk && hasContentOk;
    check('Nota diaria: crea y abre Diario/AAAA-MM-DD.md con un encabezado', dailyNoteOk, `rutaCorrecta=${createdOk} tieneContenido=${hasContentOk}`);
  } else {
    check('Nota diaria: crea y abre Diario/AAAA-MM-DD.md con un encabezado', false, 'sin fixturesDir');
  }

  // 32b. Nota diaria configurable: carpeta, formato con subcarpetas y
  // plantilla; rutas raras se rechazan.
  if (fixturesDir) {
    const prev = window.mdDailyNote.getSettings();
    const d = new Date(2026, 0, 5);
    const fmtOk = window.mdDailyNote.formatName('AAAA/MM/DD-MM-AA', d) === '2026/01/05-01-26';
    const badOk = !!window.mdDailyNote.pathFor(d, { folder: '../fuera', format: 'AAAA' }).error;
    await window.mdEditor.saveFile('# Día {{fecha}}\n\n## Plan\n', window.mdEditor.joinPath(fixturesDir, 'plantilla-diaria.md'), false);
    window.mdDailyNote.setSettings({ folder: 'Bitácora', format: 'AAAA/MM/DD', template: 'plantilla-diaria.md' });
    await window.mdDailyNote.open(d);
    const expected = window.mdEditor.joinPath(fixturesDir, 'Bitácora', '2026', '01', '05.md');
    await waitFor(() => window.mdState.currentFilePath === expected);
    const onDisk = await window.mdEditor.readFile(expected);
    const tplOk = !!onDisk && onDisk.content.startsWith('# Día ') && onDisk.content.includes('## Plan') && !onDisk.content.includes('{{fecha}}');
    window.mdDailyNote.setSettings(prev);
    check('Nota diaria configurable: carpeta, AAAA/MM/DD en subcarpetas, plantilla y rutas inválidas rechazadas',
      fmtOk && badOk && window.mdState.currentFilePath === expected && tplOk,
      `formato=${fmtOk} rechaza=${badOk} ruta=${window.mdState.currentFilePath} plantilla=${tplOk}`);
  }

  // 33. Diagramas Mermaid: un fence ```mermaid``` se reemplaza por un <div
  // class="mermaid"> renderizado (SVG), no un bloque de código
  window.mdCodeMirror.setValue('```mermaid\ngraph TD;\nA-->B;\n```\n');
  window.renderPreview();
  const mermaidDiv = await waitFor(() => document.querySelector('#preview-pane .mermaid'), 6000);
  const mermaidSvg = await waitFor(() => document.querySelector('#preview-pane .mermaid svg'), 6000);
  const mermaidOk = !!mermaidDiv && !!mermaidSvg;
  check('Diagramas Mermaid: un fence ```mermaid``` se renderiza como SVG', mermaidOk, `div=${!!mermaidDiv} svg=${!!mermaidSvg}`);

  // 33b. Imágenes dentro de nodos Mermaid: un label "![[archivo]]" (mismo
  // ![[...]] de video/PDF embebido) se reemplaza por un <img> real si la
  // ruta está permitida, y por un aviso de texto si no lo está.
  let mermaidImgOk = false;
  let mermaidImgDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    window.mdState.currentFilePath = fixtureMdPath;
    window.mdCodeMirror.setValue([
      '```mermaid',
      'flowchart TD',
      'A["![[photo.png]]"] --> B["Nodo de texto normal"]',
      'B --> C["![[../fuera-de-la-carpeta.png]]"]',
      '```'
    ].join('\n'));
    window.renderPreview();
    await waitFor(() => document.querySelector('#preview-pane .mermaid svg'), 6000);
    await waitFor(() => document.querySelector('#preview-pane .mermaid img') ||
      Array.from(document.querySelectorAll('#preview-pane .mermaid .nodeLabel')).some((l) => l.textContent.includes('no permitida')), 3000);
    const hasImg = !!document.querySelector('#preview-pane .mermaid img');
    const normalTextOk = Array.from(document.querySelectorAll('#preview-pane .mermaid .nodeLabel')).some((l) => l.textContent.includes('Nodo de texto normal'));
    const blockedOk = Array.from(document.querySelectorAll('#preview-pane .mermaid .nodeLabel')).some((l) => l.textContent.includes('no permitida'));
    mermaidImgOk = hasImg && normalTextOk && blockedOk;
    mermaidImgDetail = `imagenInsertada=${hasImg} textoNormalOk=${normalTextOk} rutaBloqueadaOk=${blockedOk}`;
  }
  check('Diagramas Mermaid: "![[archivo]]" en un nodo se reemplaza por <img> (o aviso si la ruta no está permitida)', mermaidImgOk, mermaidImgDetail);

  // 34. Exportar a EPUB: genera un archivo .epub real (jszip en main.js,
  // el diálogo se saltea en modo test y escribe a un temporal)
  let epubOk = false;
  if (fixtureMdPath) {
    await window.openFileAtPath(fixtureMdPath);
    window.mdCodeMirror.setValue('# Capitulo Uno\n\nTexto de prueba.\n');
    window.renderPreview();
    await waitFor(() => document.querySelector('#preview-pane h1'));
    const payload = { chapters: [{ title: 'Mi Libro', html: document.getElementById('preview-pane').innerHTML }], images: [], title: 'Mi Libro' };
    const savedPath = await window.mdEditor.exportEpub(payload, 'test.epub');
    epubOk = !!savedPath && savedPath.endsWith('.epub');
    check('Exportar a EPUB genera un archivo .epub', epubOk, `ruta=${savedPath}`);
  } else {
    check('Exportar a EPUB genera un archivo .epub', false, 'sin fixturesDir');
  }

  // 34b. Exportar carpeta a EPUB (libro): un capítulo por archivo Markdown
  // de la carpeta (título = su primer "# Encabezado"), imágenes locales
  // embebidas como archivos reales del .epub (no como md-local://, que no
  // existe fuera de la app), portada salteada automáticamente en modo test.
  let epubBookOk = false;
  let epubBookDetail = 'sin fixturesDir';
  if (fixturesDir) {
    // Carpeta propia (no fixturesDir a secas): para esta altura de la suite
    // ya hay varios .md de otros checks ahí (note.md, kanban-a.md, etc.), y
    // el export de libro los tomaría a todos como capítulos.
    await window.mdEditor.createFolder(fixturesDir, 'libro-epub');
    const bookDir = window.mdEditor.joinPath(fixturesDir, 'libro-epub');
    const bookImagePath = await window.mdEditor.copyAsset(window.mdEditor.joinPath(fixturesDir, 'photo.png'), bookDir);
    const bookImageName = bookImagePath.split(/[\\/]/).pop();
    const bookAPath = window.mdEditor.joinPath(bookDir, 'libro-a.md');
    const bookBPath = window.mdEditor.joinPath(bookDir, 'libro-b.md');
    await window.mdEditor.saveFile(`# Capitulo A\n\nTexto con imagen ![foto](${bookImageName}).\n`, bookAPath, false);
    await window.mdEditor.saveFile('# Capitulo B\n\nSegundo capitulo, sin imagen.\n', bookBPath, false);
    window.mdState.rootFolder = bookDir;

    const originalAlert = window.alert;
    let alertMsg = null;
    window.alert = (msg) => { alertMsg = msg; };
    document.getElementById('btn-export-epub-book').click();
    await new Promise((r) => setTimeout(r, 500));
    window.alert = originalAlert;

    const twoChaptersOk = !!alertMsg && /2 capítulo/.test(alertMsg);
    const savedPathOk = !!alertMsg && /\.epub$/.test(alertMsg.split(': ').pop().trim());
    epubBookOk = twoChaptersOk && savedPathOk;
    epubBookDetail = `alerta="${alertMsg}"`;
  }
  check('Exportar carpeta a EPUB (libro): un capítulo por archivo, imágenes embebidas', epubBookOk, epubBookDetail);

  // 35. Exportar a Anki: "## Pregunta" + texto -> tarjetas Frente/Dorso
  let ankiOk = false;
  {
    window.mdCodeMirror.setValue('## Pregunta uno\n\nRespuesta uno.\n\n## Pregunta dos\n\nRespuesta dos.\n');
    const originalAlert = window.alert;
    let alertMsg = null;
    window.alert = (msg) => {
      alertMsg = msg;
    };
    document.getElementById('btn-export-anki').click();
    await new Promise((r) => setTimeout(r, 300));
    window.alert = originalAlert;
    ankiOk = !!alertMsg && /2 tarjeta/.test(alertMsg);
    check('Exportar a tarjetas Anki: detecta preguntas de "## Encabezado"', ankiOk, `alerta="${alertMsg}"`);
  }

  // 36. Sincronización con git al guardar: en un repo git real, guardar +
  // gitSync deja un commit nuevo
  const gitRepoDir = fixturesDir ? window.mdEditor.joinPath(fixturesDir, 'gitrepo') : null;
  if (gitRepoDir) {
    const isRepo = await window.mdEditor.isGitRepo(gitRepoDir);
    if (isRepo) {
      const notePath = window.mdEditor.joinPath(gitRepoDir, 'nota.md');
      await window.mdEditor.saveFile('# Nota nueva\n', notePath, false);
      const syncResult = await window.mdEditor.gitSync(gitRepoDir);
      check('Sincronización con git: commitea cambios en un repo existente', !!syncResult.ok, JSON.stringify(syncResult));
    } else {
      check('Sincronización con git: commitea cambios en un repo existente', false, 'git no disponible en este entorno, se saltea');
    }
  } else {
    check('Sincronización con git: commitea cambios en un repo existente', false, 'sin fixturesDir');
  }

  // 36b. Git con control fino: el panel lista los archivos cambiados, se
  // puede elegir cuáles entran (checkbox) y escribir un mensaje propio —
  // el archivo destildado se queda afuera del commit.
  let gitPanelOk = false;
  let gitPanelDetail = 'sin fixturesDir';
  if (gitRepoDir && (await window.mdEditor.isGitRepo(gitRepoDir))) {
    const notePath = window.mdEditor.joinPath(gitRepoDir, 'nota.md');
    const note2Path = window.mdEditor.joinPath(gitRepoDir, 'nota2.md');
    await window.mdEditor.saveFile('# Nota modificada\n', notePath, false);
    await window.mdEditor.saveFile('# Nota 2\n', note2Path, false);

    window.mdState.rootFolder = gitRepoDir;
    window.mdGitPanel.open();
    await waitFor(() => document.querySelectorAll('#git-file-list .git-file-row').length >= 2);

    const rows = Array.from(document.querySelectorAll('#git-file-list .git-file-row'));
    const note2Checkbox = rows.find((r) => r.querySelector('.git-file-name').textContent.includes('nota2.md'))?.querySelector('input');
    if (note2Checkbox) note2Checkbox.checked = false;

    const originalAlert = window.alert;
    let commitMsg = null;
    window.alert = (m) => { commitMsg = m; };
    document.getElementById('git-commit-message').value = 'MK test: commit selectivo';
    document.getElementById('git-commit-btn').click();
    await waitFor(() => commitMsg !== null);
    window.alert = originalAlert;
    window.mdGitPanel.close();

    const statusAfter = await window.mdEditor.gitStatus(gitRepoDir);
    const noteCommittedOk = !statusAfter.some((f) => f.file === 'nota.md');
    const note2StillPendingOk = statusAfter.some((f) => f.file === 'nota2.md');
    gitPanelOk = !!note2Checkbox && !!commitMsg && noteCommittedOk && note2StillPendingOk;
    gitPanelDetail = `checkboxEncontrado=${!!note2Checkbox} commiteo=${!!commitMsg} notaCommiteadaOk=${noteCommittedOk} nota2QuedoFueraOk=${note2StillPendingOk}`;
  } else {
    gitPanelDetail = gitRepoDir ? 'git no disponible en este entorno, se saltea' : 'sin fixturesDir';
  }
  check('Git con control fino: elegir archivos + mensaje propio deja afuera lo destildado', gitPanelOk, gitPanelDetail);

  // 36c. Git: "Ver cambios" en un archivo modificado parte el diff en hunks
  // independientes; destildar uno solo (dejando el resto tildado) commitea
  // los demás y deja ESE cambio puntual pendiente — no es "todo o nada" por
  // archivo, es "git add -p" hecho desde el panel.
  let gitHunkOk = false;
  let gitHunkDetail = 'sin fixturesDir';
  if (gitRepoDir && (await window.mdEditor.isGitRepo(gitRepoDir))) {
    const hunkPath = window.mdEditor.joinPath(gitRepoDir, 'hunkfile.md');
    const baseLines = Array.from({ length: 15 }, (_, i) => `linea${i + 1}`);
    await window.mdEditor.saveFile(baseLines.join('\n') + '\n', hunkPath, false);
    await window.mdEditor.gitAddFiles(gitRepoDir, ['hunkfile.md']);
    await window.mdEditor.gitCommitStaged(gitRepoDir, 'MK test: base para hunks');

    // Dos cambios lejos entre sí (>3 líneas de contexto) -> dos hunks separados.
    const modifiedLines = [...baseLines];
    modifiedLines[1] = 'linea2 MODIFICADA';
    modifiedLines[13] = 'linea14 MODIFICADA';
    await window.mdEditor.saveFile(modifiedLines.join('\n') + '\n', hunkPath, false);

    window.mdState.rootFolder = gitRepoDir;
    window.mdGitPanel.open();
    const findHunkRow = () => Array.from(document.querySelectorAll('#git-file-list .git-file-row'))
      .find((r) => r.querySelector('.git-file-name')?.textContent.includes('hunkfile.md'));
    await waitFor(() => !!findHunkRow());

    const hunkRow = findHunkRow();
    const toggleBtn = hunkRow.querySelector('.git-hunk-toggle');
    toggleBtn.click();
    const hunkListEl = hunkRow.parentElement.querySelector('.git-hunk-list');
    await waitFor(() => hunkListEl.querySelectorAll('.git-hunk').length >= 2);
    const twoHunksShownOk = hunkListEl.querySelectorAll('.git-hunk').length === 2;

    // Destildar el segundo hunk: solo el primero se commitea.
    const secondHunkCheckbox = hunkListEl.querySelectorAll('.git-hunk')[1].querySelector('input[type="checkbox"]');
    secondHunkCheckbox.checked = false;
    secondHunkCheckbox.dispatchEvent(new Event('change'));

    const originalAlert = window.alert;
    let hunkCommitMsg = null;
    window.alert = (m) => { hunkCommitMsg = m; };
    document.getElementById('git-commit-message').value = 'MK test: solo un hunk';
    document.getElementById('git-commit-btn').click();
    await waitFor(() => hunkCommitMsg !== null);
    window.alert = originalAlert;
    window.mdGitPanel.close();

    const diffAfter = await window.mdEditor.gitDiffFile(gitRepoDir, 'hunkfile.md');
    const remainingHunks = (diffAfter.match(/^@@/gm) || []).length;
    const secondChangeStillPendingOk = /linea14 MODIFICADA/.test(diffAfter || '');
    const firstChangeAlreadyCommittedOk = !/linea2 MODIFICADA/.test(diffAfter || '');

    gitHunkOk = twoHunksShownOk && !!hunkCommitMsg && remainingHunks === 1 && secondChangeStillPendingOk && firstChangeAlreadyCommittedOk;
    gitHunkDetail = `dosHunksOk=${twoHunksShownOk} commiteo=${!!hunkCommitMsg} hunksRestantes=${remainingHunks} segundoCambioPendienteOk=${secondChangeStillPendingOk} primerCambioYaCommiteadoOk=${firstChangeAlreadyCommittedOk}` + (gitHunkOk ? '' : ` aviso="${hunkCommitMsg}"`);
  } else {
    gitHunkDetail = gitRepoDir ? 'git no disponible en este entorno, se saltea' : 'sin fixturesDir';
  }
  check('Git: seleccionar hunks dentro de un archivo (no todo o nada) al commitear', gitHunkOk, gitHunkDetail);

  // 37. Tablero Kanban: "## Columna" + listas = columnas/tarjetas; clic
  // marca/desmarca, arrastrar mueve una tarjeta a otra columna
  window.mdCodeMirror.setValue('## Por hacer\n- [ ] tarea A\n- [ ] tarea B\n\n## Hecho\n- [x] tarea C\n');
  window.mdKanban.open();
  await waitFor(() => document.querySelectorAll('.kanban-column').length === 2);
  const kanbanColumnsOk = document.querySelectorAll('.kanban-column').length === 2;
  const kanbanCardsOk = document.querySelectorAll('.kanban-card').length === 3;

  const firstCard = document.querySelector('.kanban-card');
  firstCard.click();
  await waitFor(() => window.mdCodeMirror.getValue().includes('[x] tarea A'));
  const kanbanToggleOk = window.mdCodeMirror.getValue().includes('[x] tarea A');

  const hechoColumn = Array.from(document.querySelectorAll('.kanban-column')).find((c) => c.querySelector('.kanban-column-title').textContent.startsWith('Hecho'));
  const dt = new DataTransfer();
  dt.setData('application/x-mk-kanban-card', '2'); // línea de "- [ ] tarea B" en el contenido original
  hechoColumn.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
  await waitFor(() => /## Hecho\n[\s\S]*tarea B/.test(window.mdCodeMirror.getValue()));
  const kanbanMoveOk = /## Hecho\n[\s\S]*tarea B/.test(window.mdCodeMirror.getValue());
  window.mdKanban.close();

  check(
    'Tablero Kanban: columnas/tarjetas desde encabezados+listas, marcar y mover funcionan',
    kanbanColumnsOk && kanbanCardsOk && kanbanToggleOk && kanbanMoveOk,
    `columnas=${kanbanColumnsOk} tarjetas=${kanbanCardsOk} marcar=${kanbanToggleOk} mover=${kanbanMoveOk}`
  );

  // 37b. Tablero Kanban en modo "carpeta completa": junta columnas del mismo
  // título entre varios archivos, cada tarjeta marca de qué archivo vino, y
  // togglear una tarjeta escribe directo a SU archivo (no al buffer del
  // editor, que puede ser un archivo totalmente distinto).
  let kanbanFolderOk = false;
  let kanbanFolderDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const kanbanAPath = window.mdEditor.joinPath(fixturesDir, 'kanban-a.md');
    const kanbanBPath = window.mdEditor.joinPath(fixturesDir, 'kanban-b.md');
    await window.mdEditor.saveFile('## Por hacer\n- [ ] tarea desde A\n', kanbanAPath, false);
    await window.mdEditor.saveFile('## Por hacer\n- [ ] tarea desde B\n\n## Hecho\n- [x] ya hecha en B\n', kanbanBPath, false);

    window.mdState.rootFolder = fixturesDir;
    window.mdKanban.open();
    window.mdKanban.setScope('folder');
    // Esperar la marca propia del modo carpeta (badge de archivo de origen),
    // no solo la cantidad de tarjetas: el render síncrono de "archivo activo"
    // de open() puede satisfacer una condición débil antes de que termine el
    // render async de setScope('folder').
    await waitFor(() => document.querySelector('.kanban-card-source') && document.querySelectorAll('.kanban-card').length >= 3);

    const porHacerColumn = Array.from(document.querySelectorAll('.kanban-column')).find((c) => c.querySelector('.kanban-column-title').textContent.startsWith('Por hacer'));
    const cardsInPorHacer = porHacerColumn ? porHacerColumn.querySelectorAll('.kanban-card').length : 0;
    const hasSourceBadge = !!document.querySelector('.kanban-card-source');

    const cardFromA = Array.from(document.querySelectorAll('.kanban-card')).find((c) => c.textContent.includes('tarea desde A'));
    if (cardFromA) cardFromA.click();
    await waitFor(async () => {
      const onDisk = await window.mdEditor.readFile(kanbanAPath);
      return onDisk && onDisk.content.includes('[x] tarea desde A');
    });
    const diskA = await window.mdEditor.readFile(kanbanAPath);
    const toggleWroteCorrectFileOk = !!diskA && diskA.content.includes('[x] tarea desde A');

    // Arrastrar entre columnas en modo carpeta: la tarjeta de B va a "Hecho"
    // (B ya tiene esa columna); la de A también (A no la tiene: se crea).
    const dragTo = async (text, colTitle) => {
      await waitFor(() => Array.from(document.querySelectorAll('.kanban-card')).some((c) => c.textContent.includes(text)));
      const card = Array.from(document.querySelectorAll('.kanban-card')).find((c) => c.textContent.includes(text));
      const colEl = Array.from(document.querySelectorAll('.kanban-column')).find((c) => c.querySelector('.kanban-column-title').textContent.startsWith(colTitle));
      const dt = new DataTransfer();
      card.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      colEl.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    };
    await dragTo('tarea desde B', 'Hecho');
    const movedB = await waitFor(async () => {
      const d = await window.mdEditor.readFile(kanbanBPath);
      return d && d.content === '## Por hacer\n\n## Hecho\n- [x] ya hecha en B\n- [ ] tarea desde B\n';
    });
    await dragTo('tarea desde A', 'Hecho');
    const movedA = await waitFor(async () => {
      const d = await window.mdEditor.readFile(kanbanAPath);
      return d && /## Por hacer\n\n## Hecho\n- \[x\] tarea desde A/.test(d.content);
    });

    window.mdKanban.setScope('file');
    window.mdKanban.close();

    kanbanFolderOk = cardsInPorHacer === 2 && hasSourceBadge && !!cardFromA && toggleWroteCorrectFileOk && !!movedB && !!movedA;
    kanbanFolderDetail = `tarjetasPorHacer=${cardsInPorHacer} badgeOrigen=${hasSourceBadge} tarjetaAEncontrada=${!!cardFromA} escribioArchivoCorrecto=${toggleWroteCorrectFileOk} arrastreB=${!!movedB} arrastreA(crea columna)=${!!movedA}`;
  }
  check('Tablero Kanban en modo "carpeta completa": junta columnas de varios archivos, togglea y arrastra entre columnas en el archivo correcto', kanbanFolderOk, kanbanFolderDetail);

  // 37c. Bases de datos relacionales (tipo Notion): crear dos bases, columna
  // numérica, fórmula que referencia otra columna, relación entre bases
  // (elegir una fila de la otra base desde el picker) y borrar fila/base.
  let dbSuiteOk = false;
  let dbSuiteDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    await window.mdDatabase.open();
    await waitFor(() => !document.getElementById('database-panel').hidden);
    const dbPanelOpenOk = !document.getElementById('database-panel').hidden;

    // Base 1: "Tareas Test"
    document.getElementById('database-new-btn').click();
    await waitFor(() => !document.getElementById('database-content').hidden);
    const dbNameInput = document.getElementById('database-name-input');
    dbNameInput.value = 'Tareas Test';
    dbNameInput.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => Array.from(document.querySelectorAll('.database-list-item')).some((el) => el.textContent === 'Tareas Test'));

    // Base 2: "Etiquetas Test", con una fila "Urgente"
    document.getElementById('database-new-btn').click();
    await waitFor(() => document.querySelectorAll('.database-list-item').length === 2);
    dbNameInput.value = 'Etiquetas Test';
    dbNameInput.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => Array.from(document.querySelectorAll('.database-list-item')).some((el) => el.textContent === 'Etiquetas Test'));
    document.getElementById('database-add-row-btn').click();
    await waitFor(() => document.querySelectorAll('.database-table tbody tr').length === 1);
    const etiquetaNombreInput = document.querySelector('.database-table tbody tr td input');
    etiquetaNombreInput.value = 'Urgente';
    etiquetaNombreInput.dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(() => document.querySelector('.database-table tbody tr td .database-cell-input').value === 'Urgente');

    // Volver a "Tareas Test"
    const tareasItem = Array.from(document.querySelectorAll('.database-list-item')).find((el) => el.textContent === 'Tareas Test');
    tareasItem.click();
    await waitFor(() => dbNameInput.value === 'Tareas Test');

    async function addColumn(name, type, configure) {
      document.getElementById('database-add-column-btn').click();
      await waitFor(() => document.querySelector('.database-column-popover'));
      const pop = document.querySelector('.database-column-popover');
      pop.querySelector('input.database-cell-input').value = name;
      const typeSelect = pop.querySelector('select.database-cell-input');
      typeSelect.value = type;
      typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      if (configure) configure(pop);
      Array.from(pop.querySelectorAll('button')).find((b) => b.textContent === 'Guardar').click();
      await waitFor(() => !document.querySelector('.database-column-popover'));
    }

    await addColumn('Cant', 'number');
    await waitFor(() => document.querySelectorAll('.database-th').length === 3); // Nombre + Cant + "+"
    const columnAddedOk = Array.from(document.querySelectorAll('.database-th')).some((th) => th.textContent === 'Cant');

    // Fila con valores, para poder calcular la fórmula sobre "Cant"
    document.getElementById('database-add-row-btn').click();
    await waitFor(() => document.querySelectorAll('.database-table tbody tr').length === 1);
    let cells = document.querySelectorAll('.database-table tbody tr td');
    cells[0].querySelector('input').value = 'Fila uno';
    cells[0].querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
    cells[1].querySelector('input').value = '4';
    cells[1].querySelector('input').dispatchEvent(new Event('change', { bubbles: true }));
    await waitFor(async () => {
      const dbs = await window.mdEditor.db.listDatabases(fixturesDir);
      const tareas = dbs.find((d) => d.name === 'Tareas Test');
      const rows = tareas ? await window.mdEditor.db.listRows(fixturesDir, tareas.id) : [];
      return rows[0] && Object.values(rows[0].cells).includes('4');
    });

    await addColumn('Total', 'formula', (pop) => { pop.querySelector('textarea').value = 'prop("Cant") * 2'; });
    await waitFor(() => Array.from(document.querySelectorAll('.database-th')).some((th) => th.textContent === 'Total'));
    await waitFor(() => document.querySelector('.database-cell-readonly') && document.querySelector('.database-cell-readonly').textContent === '8');
    const formulaOk = document.querySelector('.database-cell-readonly').textContent === '8';

    await addColumn('Tags', 'relation', (pop) => {
      const selects = pop.querySelectorAll('select.database-cell-input');
      const targetSelect = selects[selects.length - 1];
      const opt = Array.from(targetSelect.options).find((o) => o.textContent === 'Etiquetas Test');
      targetSelect.value = opt.value;
    });
    await waitFor(() => Array.from(document.querySelectorAll('.database-th')).some((th) => th.textContent === 'Tags'));

    cells = document.querySelectorAll('.database-table tbody tr td');
    const relationCellBtn = cells[3].querySelector('.database-select-chip-btn');
    relationCellBtn.click();
    await waitFor(() => document.querySelector('.database-relation-popover'));
    await waitFor(() => Array.from(document.querySelectorAll('.database-relation-popover .database-popover-row')).some((b) => b.textContent === 'Urgente'));
    const urgenteBtn = Array.from(document.querySelectorAll('.database-relation-popover .database-popover-row')).find((b) => b.textContent === 'Urgente');
    urgenteBtn.click();
    await waitFor(() => document.querySelector('.database-chip-relation') && document.querySelector('.database-chip-relation').textContent === 'Urgente');
    const relationOk = !!document.querySelector('.database-chip-relation') && document.querySelector('.database-chip-relation').textContent === 'Urgente';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    document.querySelector('.database-row-del').click();
    await waitFor(() => document.querySelectorAll('.database-table tbody tr').length === 0);
    const rowDeleteOk = document.querySelectorAll('.database-table tbody tr').length === 0;

    const originalConfirmDb = window.confirm;
    window.confirm = () => true;
    document.getElementById('database-delete-btn').click();
    await waitFor(async () => (await window.mdEditor.db.listDatabases(fixturesDir)).length === 1);
    window.confirm = originalConfirmDb;
    const dbDeleteOk = (await window.mdEditor.db.listDatabases(fixturesDir)).length === 1;

    window.mdDatabase.close();

    dbSuiteOk = dbPanelOpenOk && columnAddedOk && formulaOk && relationOk && rowDeleteOk && dbDeleteOk;
    dbSuiteDetail = `panel=${dbPanelOpenOk} columna=${columnAddedOk} formula=${formulaOk} relacion=${relationOk} borrarFila=${rowDeleteOk} borrarBase=${dbDeleteOk}`;
  }
  check('Bases de datos: crear, columnas tipadas, fórmula, relación entre bases y borrar', dbSuiteOk, dbSuiteDetail);

  // 37d. Relaciones de dos vías: crear una columna de relación de A a B crea
  // sola la columna espejo en B; setRelations desde A también actualiza el
  // lado B (y viceversa al sacar); borrar la columna de un lado borra el
  // espejo del otro, para no dejar un pairedColumnId colgando.
  let mirrorOk = false;
  let mirrorDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const dbA = await window.mdEditor.db.createDatabase(fixturesDir, 'MirrorA');
    const dbB = await window.mdEditor.db.createDatabase(fixturesDir, 'MirrorB');
    const colsA = await window.mdEditor.db.listColumns(fixturesDir, dbA.id);
    const relCol = await window.mdEditor.db.createColumn(fixturesDir, dbA.id, { name: 'Vinculo', type: 'relation', options: { targetDatabaseId: dbB.id } });

    const colsB = await window.mdEditor.db.listColumns(fixturesDir, dbB.id);
    const mirrorCol = colsB.find((c) => c.type === 'relation');
    const mirrorPointsBack = !!mirrorCol && JSON.parse(mirrorCol.options || '{}').targetDatabaseId === dbA.id;
    const relColUpdated = await window.mdEditor.db.listColumns(fixturesDir, dbA.id).then((cs) => cs.find((c) => c.id === relCol.id));
    const pairedOnBothSides = mirrorCol && JSON.parse(relColUpdated.options || '{}').pairedColumnId === mirrorCol.id
      && JSON.parse(mirrorCol.options || '{}').pairedColumnId === relCol.id;

    const rowA = await window.mdEditor.db.createRow(fixturesDir, dbA.id, { [colsA[0].id]: 'fila A' });
    const rowB = await window.mdEditor.db.createRow(fixturesDir, dbB.id, { [colsB[0].id]: 'fila B' });
    await window.mdEditor.db.setRelations(fixturesDir, relCol.id, rowA, [rowB]);

    const rowsBAfterLink = await window.mdEditor.db.listRows(fixturesDir, dbB.id);
    const mirrorShowsLinkOk = (rowsBAfterLink.find((r) => r.id === rowB).relations[mirrorCol.id] || []).includes(rowA);

    await window.mdEditor.db.setRelations(fixturesDir, relCol.id, rowA, []);
    const rowsBAfterUnlink = await window.mdEditor.db.listRows(fixturesDir, dbB.id);
    const mirrorClearedOk = !(rowsBAfterUnlink.find((r) => r.id === rowB).relations[mirrorCol.id] || []).includes(rowA);

    await window.mdEditor.db.deleteColumn(fixturesDir, relCol.id);
    const colsBAfterDelete = await window.mdEditor.db.listColumns(fixturesDir, dbB.id);
    const mirrorDeletedTooOk = !colsBAfterDelete.some((c) => c.id === mirrorCol.id);

    await window.mdEditor.db.deleteDatabase(fixturesDir, dbA.id);
    await window.mdEditor.db.deleteDatabase(fixturesDir, dbB.id);

    mirrorOk = mirrorPointsBack && pairedOnBothSides && mirrorShowsLinkOk && mirrorClearedOk && mirrorDeletedTooOk;
    mirrorDetail = `espejoCreado=${mirrorPointsBack} parejaEnAmbosLados=${pairedOnBothSides} espejoMuestraVinculo=${mirrorShowsLinkOk} espejoLimpiaAlSacar=${mirrorClearedOk} borrarColBorraEspejo=${mirrorDeletedTooOk}`;
  }
  check('Bases de datos: relación de dos vías crea/sincroniza/borra el espejo automático', mirrorOk, mirrorDetail);

  // 38. Grafo de notas: nodos = archivos de la carpeta, aristas = wikilinks
  let graphOk = false;
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    await window.mdGraph.open();
    const graphData = window.mdGraph.getData();
    window.mdGraph.close();
    const hasNodesOk = graphData.nodes.length > 0;
    const hasEdgeOk = graphData.edges.some((e) => e.source === 'other' && e.target === 'note');
    graphOk = hasNodesOk && hasEdgeOk;
    check('Grafo de notas: detecta nodos y aristas de wikilinks', graphOk, `nodos=${graphData.nodes.length} aristaOtherNote=${hasEdgeOk}`);
  } else {
    check('Grafo de notas: detecta nodos y aristas de wikilinks', false, 'sin fixturesDir');
  }

  // 38b. Grafo de notas: reacomodo manual de un nodo se persiste por
  // carpeta (config.json) y se aplica de nuevo la próxima vez que se abre.
  let graphPersistOk = false;
  let graphPersistDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    await window.mdGraph.open();
    const before = window.mdGraph.getData();
    const nodeId = before.nodes[0].id;
    await window.mdGraph.moveNodeForTest(nodeId, 321, 123);
    window.mdGraph.close();

    await window.mdGraph.open();
    const after = window.mdGraph.getData();
    const moved = after.nodes.find((n) => n.id === nodeId);
    window.mdGraph.close();
    graphPersistOk = !!moved && Math.round(moved.x) === 321 && Math.round(moved.y) === 123;
    graphPersistDetail = `nodo=${nodeId} x=${moved ? moved.x : null} y=${moved ? moved.y : null}`;
  }
  check('Grafo de notas: el reacomodo manual de un nodo se persiste por carpeta y se reaplica al reabrir', graphPersistOk, graphPersistDetail);

  // 39. Ejecutar código JS: botón "Ejecutar" en un bloque ```js``` corre en
  // un Worker aislado y muestra la salida (console.log + valor de retorno)
  window.mdCodeMirror.setValue('```js\nconsole.log("hola");\n2 + 2;\n```\n');
  window.renderPreview();
  const runBtn = await waitFor(() => document.querySelector('#preview-pane .run-code-btn'));
  runBtn.click();
  const outputEl = await waitFor(() => {
    const el = document.querySelector('#preview-pane .run-code-output');
    return el && !el.hidden && el.textContent !== 'Ejecutando...' ? el : null;
  }, 5000);
  const runCodeOk = !!outputEl && outputEl.textContent.includes('hola') && outputEl.textContent.includes('=> 4');
  check('Ejecutar código JS: "Ejecutar" corre el bloque en un Worker y muestra la salida', runCodeOk, `salida="${outputEl ? outputEl.textContent.replace(/\n/g, '\\n') : null}"`);

  // 40. Operaciones de páginas PDF: abrir (pdf-lib en memoria), rotar,
  // reordenar (drag&drop, mismo mecanismo que el Kanban) y borrar páginas
  let pdfPagesOk = false;
  let pdfPagesDetail = 'sin fixturesDir';
  if (fixturePdfPath) {
    await window.mdPdfPages.loadFromPath(fixturePdfPath);
    const initialCount = window.mdPdfPages.getState().pageCount;

    const rows = () => document.querySelectorAll('.pdfpages-page-row');
    rows()[0].querySelector('button[title="Rotar +90°"]').click();
    const rotatedOk = window.mdPdfPages.getState().rotations[0] === 90;

    // Arrastra la página 0 (ya rotada) hasta soltarla en la fila de la página 2
    const dt = new DataTransfer();
    dt.setData('application/x-mk-pdfpage', '0');
    rows()[2].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const reorderedOk = JSON.stringify(window.mdPdfPages.getState().rotations) === JSON.stringify([0, 90, 0]);

    rows()[rows().length - 1].querySelector('button[title="Borrar página"]').click();
    const deletedOk = window.mdPdfPages.getState().pageCount === initialCount - 1;

    await window.mdPdfPages.mergeFromPath(fixturePdf2Path);
    const mergedOk = window.mdPdfPages.getState().pageCount === initialCount - 1 + 1;

    pdfPagesOk = initialCount === 3 && rotatedOk && reorderedOk && deletedOk && mergedOk;
    pdfPagesDetail = `inicial=${initialCount} rotado=${rotatedOk} reordenado=${reorderedOk} borrado=${deletedOk} unido=${mergedOk}`;
  }
  check('Editor de páginas PDF: abrir, rotar, reordenar, borrar y unir', pdfPagesOk, pdfPagesDetail);

  // 41. Marca de agua, texto/firma y "separar" (extraer rango) producen PDFs
  // válidos de verdad, no solo cambian el estado en memoria: se guardan
  // (diálogo salteado en modo test) y se releen con PDFLib para confirmarlo.
  let pdfWatermarkOk = false;
  let pdfWatermarkDetail = 'sin fixturesDir';
  if (fixturePdfPath) {
    await window.mdPdfPages.loadFromPath(fixturePdfPath);
    document.getElementById('pdfpages-watermark-text').value = 'BORRADOR';
    document.getElementById('pdfpages-watermark-apply').click();
    document.getElementById('pdfpages-stamp-text').value = 'Firmado';
    document.getElementById('pdfpages-stamp-page').value = '2';
    document.getElementById('pdfpages-stamp-apply').click();

    const originalAlert = window.alert;
    let savedMsg = null;
    window.alert = (m) => { savedMsg = m; };
    document.getElementById('pdfpages-save').click();
    await waitFor(() => savedMsg !== null);
    window.alert = originalAlert;

    const savedPath = savedMsg ? savedMsg.replace('Guardado en: ', '') : null;
    let reopenedOk = false;
    if (savedPath) {
      const base64 = await window.mdEditor.pdfReadBytes(savedPath);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const reopened = await PDFLib.PDFDocument.load(bytes);
      reopenedOk = reopened.getPageCount() === 3;
    }

    document.getElementById('pdfpages-split-range').value = '1-2';
    let splitMsg = null;
    window.alert = (m) => { splitMsg = m; };
    document.getElementById('pdfpages-split-apply').click();
    await waitFor(() => splitMsg !== null);
    window.alert = originalAlert;
    const splitPath = splitMsg ? splitMsg.replace('Guardado en: ', '') : null;
    let splitOk = false;
    if (splitPath) {
      const base64 = await window.mdEditor.pdfReadBytes(splitPath);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const extracted = await PDFLib.PDFDocument.load(bytes);
      splitOk = extracted.getPageCount() === 2;
    }

    pdfWatermarkOk = reopenedOk && splitOk;
    pdfWatermarkDetail = `guardadoOk=${reopenedOk} separadoOk=${splitOk} (2 de 3 páginas)`;
  }
  check('Editor de páginas PDF: marca de agua, firma y "separar" generan PDFs válidos al guardar', pdfWatermarkOk, pdfWatermarkDetail);

  // 42. Subrayar texto en PDF: pdf.js renderiza la página, un rectángulo
  // normalizado se hornea de verdad en el PDF (pdf-lib + blendMode Multiply)
  // al guardar, no queda solo como dibujo en el canvas.
  let pdfHighlightOk = false;
  let pdfHighlightDetail = 'sin fixturesDir';
  if (fixturePdfPath) {
    await window.mdPdfHighlight.loadFromPath(fixturePdfPath);
    const stateBefore = window.mdPdfHighlight.getState();
    window.mdPdfHighlight.addHighlightForTest(0.1, 0.4, 0.5, 0.08);
    const stateAfter = window.mdPdfHighlight.getState();

    const originalAlert = window.alert;
    let savedMsg = null;
    window.alert = (m) => { savedMsg = m; };
    document.getElementById('pdfhighlight-save').click();
    await waitFor(() => savedMsg !== null);
    window.alert = originalAlert;

    const savedPath = savedMsg ? savedMsg.replace('Guardado en: ', '') : null;
    let reopenedOk = false;
    if (savedPath) {
      const base64 = await window.mdEditor.pdfReadBytes(savedPath);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const reopened = await PDFLib.PDFDocument.load(bytes);
      reopenedOk = reopened.getPageCount() === 3;
    }

    pdfHighlightOk = stateBefore.highlightCount === 0 && stateAfter.highlightCount === 1 && reopenedOk;
    pdfHighlightDetail = `antes=${stateBefore.highlightCount} despues=${stateAfter.highlightCount} guardadoOk=${reopenedOk}`;
  }
  check('Subrayar texto en PDF: agrega un rectángulo y lo hornea al guardar', pdfHighlightOk, pdfHighlightDetail);

  // Escribir en PDF: clic en modo "Escribir" crea un cuadro; el texto (con
  // acentos y ñ) y los campos del formulario quedan de verdad en el PDF.
  let pdfWriteOk = false;
  let pdfWriteDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdPdfHighlight.open();
    await window.mdPdfHighlight.loadFromPath(window.mdEditor.joinPath(fixturesDir, 'formulario.pdf'));
    const st = window.mdPdfHighlight.getState();
    const fieldsOk = st && st.formFields.join(',') === 'nombre,acepto,pais' && document.querySelectorAll('.pdfhighlight-form-field').length === 3;

    window.mdPdfHighlight.setMode('text');
    const canvasEl = document.getElementById('pdfhighlight-canvas');
    const r = canvasEl.getBoundingClientRect();
    canvasEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: r.left + r.width * 0.5, clientY: r.top + r.height * 0.8 }));
    const boxOk = !!(await waitFor(() => document.querySelector('#pdfhighlight-canvas-wrap .pdf-text-box')));
    const edit = document.querySelector('#pdfhighlight-canvas-wrap .pdf-text-edit');
    if (edit) {
      edit.textContent = 'Hola ñandú, ¿qué tal? 😀';
      edit.dispatchEvent(new Event('input', { bubbles: true }));
    }
    window.mdPdfHighlight.setFormValueForTest('nombre', 'Julián');
    window.mdPdfHighlight.setFormValueForTest('acepto', true);
    window.mdPdfHighlight.setFormValueForTest('pais', 'España');
    const bytes = await window.mdPdfHighlight.buildPdfForTest();

    const saved = await PDFLib.PDFDocument.load(bytes);
    const f = saved.getForm();
    const formOk = f.getTextField('nombre').getText() === 'Julián' && f.getCheckBox('acepto').isChecked() && f.getDropdown('pais').getSelected()[0] === 'España';
    const doc = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    const content = await (await doc.getPage(1)).getTextContent();
    const allText = content.items.map((it) => it.str).join(' ');
    const textOk = allText.includes('Hola ñandú, ¿qué tal? ?'); // el emoji no entra en Helvetica: queda "?"
    window.mdPdfHighlight.setMode('highlight');
    window.mdPdfHighlight.close();
    pdfWriteOk = fieldsOk && boxOk && formOk && textOk;
    pdfWriteDetail = `campos=${fieldsOk} cuadro=${boxOk} formulario=${formOk} texto=${textOk} ("${allText.slice(0, 60)}")`;
  }
  check('Escribir en PDF: texto libre (acentos/ñ) y formulario (texto, casilla, lista) quedan en el PDF guardado', pdfWriteOk, pdfWriteDetail);

  // Bases de datos: ordenar por columna (menú del encabezado) y filtrar por
  // campo (popover "Filtros"), ambos guardados en la config de la vista.
  let dbSortFilterOk = false;
  let dbSortFilterDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const sfDb = await window.mdEditor.db.createDatabase(fixturesDir, 'OrdenFiltro');
    const [nameCol] = await window.mdEditor.db.listColumns(fixturesDir, sfDb.id);
    const priceCol = await window.mdEditor.db.createColumn(fixturesDir, sfDb.id, { name: 'Precio', type: 'number' });
    for (const [n, p] of [['A', 3], ['B', 10], ['C', 7]]) {
      await window.mdEditor.db.createRow(fixturesDir, sfDb.id, { [nameCol.id]: n, [priceCol.id]: p });
    }
    await window.mdDatabase.open(sfDb.id);
    const names = () => Array.from(document.querySelectorAll('.database-table tbody tr td:first-child input')).map((i) => i.value).join('');
    await waitFor(() => names() === 'ABC');

    const priceTh = Array.from(document.querySelectorAll('.database-th')).find((th) => th.textContent === 'Precio');
    priceTh.click();
    await waitFor(() => document.querySelector('.database-view-popover'));
    Array.from(document.querySelectorAll('.database-view-popover button')).find((b) => b.textContent.includes('descendente')).click();
    await waitFor(() => names() === 'BCA');
    const sortOk = names() === 'BCA';
    const views = await window.mdEditor.db.listViews(fixturesDir, sfDb.id);
    const sortSaved = (JSON.parse(views[0].config || '{}').sorts || [])[0]?.dir === 'desc';

    document.getElementById('database-filters-btn').click();
    await waitFor(() => document.querySelector('.database-filters-popover'));
    Array.from(document.querySelectorAll('.database-filters-popover button')).find((b) => b.textContent === '+ Agregar filtro').click();
    await waitFor(() => document.querySelector('.database-filter-row'));
    const colSel = document.querySelector('.database-filter-row select');
    colSel.value = priceCol.id;
    colSel.dispatchEvent(new Event('change'));
    await waitFor(() => document.querySelector('.database-filter-row select:nth-child(2)') &&
      Array.from(document.querySelector('.database-filter-row select:nth-child(2)').options).some((o) => o.value === 'gt'));
    const opSel = document.querySelector('.database-filter-row select:nth-child(2)');
    opSel.value = 'gt';
    opSel.dispatchEvent(new Event('change'));
    await waitFor(() => document.querySelector('.database-filter-row input'));
    const valInput = document.querySelector('.database-filter-row input');
    valInput.value = '5';
    valInput.dispatchEvent(new Event('change'));
    await waitFor(() => names() === 'BC');
    const filterOk = names() === 'BC' && document.getElementById('database-filters-btn').textContent === 'Filtros (1)';
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    window.mdDatabase.close();
    await window.mdEditor.db.deleteDatabase(fixturesDir, sfDb.id);
    dbSortFilterOk = sortOk && sortSaved && filterOk;
    dbSortFilterDetail = `orden=${names() || sortOk} ordenGuardado=${sortSaved} filtro=${filterOk}`;
  }
  check('Bases de datos: ordenar por columna y filtrar por campo (guardado en la vista)', dbSortFilterOk, dbSortFilterDetail);

  // Terminal integrada: abre un pty real, ejecuta un comando y ve la salida;
  // Ctrl+W con el foco en la terminal NO cierra la pestaña del editor.
  {
    await window.mdTerminal.show();
    const session = await waitFor(() => window.mdTerminal.getSessions().find((s) => !s.exited));
    let outputOk = false;
    let ctrlWOk = false;
    if (session) {
      const screenText = () => {
        const buf = session.term.buffer.active;
        let text = '';
        for (let i = 0; i < buf.length; i++) text += buf.getLine(i).translateToString(true) + '\n';
        return text;
      };
      await new Promise((r) => setTimeout(r, 500)); // que el shell termine de arrancar
      window.mdEditor.terminal.write(session.id, 'echo MK_TERM_$((40+2))\r');
      outputOk = !!(await waitFor(() => screenText().includes('MK_TERM_42'), 8000));

      const tabsBefore = document.querySelectorAll('#tabbar .tab').length;
      const textarea = session.el.querySelector('textarea');
      textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', code: 'KeyW', ctrlKey: true, bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 100));
      ctrlWOk = document.querySelectorAll('#tabbar .tab').length === tabsBefore;
    }
    const panelShown = !document.getElementById('terminal-panel').hidden;
    // Tope de vueltas: si cerrar una pestaña no la saca del DOM, que falle el
    // check en vez de colgar toda la suite.
    for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) {
      document.querySelector('.terminal-tab-close').click();
    }
    const closedOk = document.getElementById('terminal-panel').hidden && window.mdTerminal.getSessions().length === 0;
    check(
      'Terminal integrada: pty real ejecuta un comando, Ctrl+W no cierra pestañas del editor, se cierra bien',
      panelShown && outputOk && ctrlWOk && closedOk,
      `panel=${panelShown} salida=${outputOk} ctrlW=${ctrlWOk} cerrada=${closedOk}`
    );
  }

  // Terminal: elegir el shell. La lista viene del sistema; pedir uno de la
  // lista abre ese; pedir cualquier otro programa se ignora (predeterminado);
  // Ajustes tiene el selector y el panel el menú ▾.
  {
    const { shells } = await window.mdTerminal.listShells();
    const sh = shells.find((s) => s.name === 'sh' || s.name === 'dash');
    const hasBash = shells.some((s) => s.name === 'bash');
    const noGitShell = !shells.some((s) => s.name === 'git-shell');
    let chosenOk = false;
    let rejectOk = false;
    if (sh) {
      const s1 = await window.mdTerminal.newTerminal(null, sh.path);
      chosenOk = !!s1 && s1.shellName === sh.name;
      const s2 = await window.mdTerminal.newTerminal(null, '/usr/bin/env');
      rejectOk = !!s2 && s2.shellName === 'bash';
    }
    const selectOk = document.querySelectorAll('#terminal-shell-select option').length === shells.length + 1;
    document.getElementById('terminal-new-menu').click();
    await waitFor(() => document.querySelectorAll('#terminal-shell-menu button').length === shells.length);
    const menuOk = document.querySelectorAll('#terminal-shell-menu button').length === shells.length;
    document.body.click();
    for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) document.querySelector('.terminal-tab-close').click();
    check('Terminal: elegir shell (lista del sistema, abre el elegido, rechaza otros programas, Ajustes y menú ▾)',
      hasBash && noGitShell && chosenOk && rejectOk && selectOk && menuOk,
      `shells=${shells.map((s) => s.name).join(',')} elegido=${chosenOk} rechaza=${rejectOk} ajustes=${selectOk} menú=${menuOk}`);
  }

  // Terminal: pantalla dividida — dos shells lado a lado en una pestaña,
  // cada uno con su salida y su ancho; cerrar un panel deja el otro.
  {
    const a = await window.mdTerminal.newTerminal();
    await new Promise((r) => setTimeout(r, 300));
    const b = await window.mdTerminal.splitTerminal();
    let detail = 'sin sesiones';
    let ok = false;
    if (a && b && !a.exited && !b.exited) {
      const screen = (s) => {
        const buf = s.term.buffer.active;
        let text = '';
        for (let i = 0; i < buf.length; i++) text += buf.getLine(i).translateToString(true) + '\n';
        return text;
      };
      const oneTab = document.querySelectorAll('.terminal-tab').length === 1 && a.group === b.group;
      await new Promise((r) => requestAnimationFrame(r));
      const aw = a.el.getBoundingClientRect().width;
      const bw = b.el.getBoundingClientRect().width;
      const sideBySide = aw > 50 && Math.abs(aw - bw) < 20 && b.el.getBoundingClientRect().left > a.el.getBoundingClientRect().left;
      await new Promise((r) => setTimeout(r, 500));
      window.mdEditor.terminal.write(b.id, 'echo SOLO_EN_B\r');
      const outB = !!(await waitFor(() => screen(b).includes('SOLO_EN_B'), 8000));
      const notInA = !screen(a).includes('SOLO_EN_B');
      b.el.querySelector('.terminal-pane-close').click();
      const afterClose = window.mdTerminal.getSessions().length === 1 && !a.el.hidden && document.querySelectorAll('.terminal-tab').length === 1;
      ok = oneTab && sideBySide && outB && notInA && afterClose;
      detail = `unaPestaña=${oneTab} ladoALado=${sideBySide}(${Math.round(aw)}/${Math.round(bw)}) salidaB=${outB} noEnA=${notInA} cerrarPanel=${afterClose}`;
    }
    for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) document.querySelector('.terminal-tab-close').click();
    check('Terminal: pantalla dividida (dos shells lado a lado, cerrar un panel deja el otro)', ok && window.mdTerminal.getSessions().length === 0, detail);
  }

  // Terminal: F5 / "Ejecutar archivo" guarda y corre el archivo activo.
  let runFileOk = false;
  let runFileDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const scriptPath = window.mdEditor.joinPath(fixturesDir, 'correr prueba.sh');
    await window.mdEditor.saveFile('echo RUN_OK_$((1+1))\n', scriptPath, false);
    await window.mdTabs.openTab(scriptPath);
    const cmd = window.mdTerminal.commandForFile(scriptPath);
    await window.mdTerminal.runActiveFile();
    const session = await waitFor(() => window.mdTerminal.getSessions().find((s) => !s.exited));
    const screen = () => {
      if (!session) return '';
      const buf = session.term.buffer.active;
      let t = '';
      for (let i = 0; i < buf.length; i++) t += buf.getLine(i).translateToString(true) + '\n';
      return t;
    };
    const ran = !!(await waitFor(() => screen().includes('RUN_OK_2'), 8000));
    const pyCmd = window.mdTerminal.commandForFile('/tmp/x y/it\'s.py');
    runFileOk = ran && cmd.startsWith('cd ') && cmd.includes("bash '") && pyCmd.includes("python3 '/tmp/x y/it'\\''s.py'");
    runFileDetail = `salida=${ran} cmd=${cmd} py=${pyCmd}`;
    for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) document.querySelector('.terminal-tab-close').click();
    document.querySelector('#tabbar .tab.active .tab-close').click();
  }
  check('Terminal: ejecutar el archivo actual (F5) arma el comando según la extensión y lo corre', runFileOk, runFileDetail);

  // Bases de datos: vista Calendario y parseo/inferencia de CSV.
  let dbCalOk = false;
  let dbCalDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const calDb = await window.mdEditor.db.createDatabase(fixturesDir, 'CalTest');
    const [calName] = await window.mdEditor.db.listColumns(fixturesDir, calDb.id);
    const calDate = await window.mdEditor.db.createColumn(fixturesDir, calDb.id, { name: 'Entrega', type: 'date' });
    const now = new Date();
    const todayIsoStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    await window.mdEditor.db.createRow(fixturesDir, calDb.id, { [calName.id]: 'Entrega hoy', [calDate.id]: todayIsoStr });
    await window.mdEditor.db.createView(fixturesDir, calDb.id, { name: 'Calendario', type: 'calendar', config: { dateColumn: calDate.id } });
    await window.mdDatabase.open(calDb.id);
    await waitFor(() => document.querySelectorAll('.database-view-tab').length === 2);
    document.querySelectorAll('.database-view-tab')[1].click();
    await waitFor(() => document.querySelector('.database-calendar-today .database-calendar-chip'));
    const calChipOk = (document.querySelector('.database-calendar-today .database-calendar-chip') || {}).textContent === 'Entrega hoy';
    window.mdDatabase.close();
    await window.mdEditor.db.deleteDatabase(fixturesDir, calDb.id);

    const parsed = window.mdDatabase.parseCsv('Nombre;Precio;Fecha;Estado;Pagado\n"Café; con leche";1.234,5;03/10/2026;Listo;sí\nTé;2;2026-10-04;Listo;no\nMate;3;;Pendiente;x\nAgua;4;;Pendiente;no\n');
    const kinds = [1, 2, 3, 4].map((i) => window.mdDatabase.inferColumn(parsed.slice(1).map((r) => r[i])).type).join(',');
    const csvOk = parsed.length === 5 && parsed[1][0] === 'Café; con leche' && kinds === 'number,date,select,checkbox';
    dbCalOk = calChipOk && csvOk;
    dbCalDetail = `calendario=${calChipOk} csvFilas=${parsed.length} tipos=${kinds}`;
  }
  check('Bases de datos: vista Calendario y CSV (separador ;, comillas, inferir número/fecha/selección/casilla)', dbCalOk, dbCalDetail);

  // Home: tareas "- [ ] ... 📅 fecha" de las notas en el calendario, tildarlas
  // reescribe el archivo; Pomodoro asociado a una tarea; plan de hoy → nota diaria.
  let homeExtrasOk = false;
  let homeExtrasDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const now = new Date();
    const todayIsoStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const notePath = window.mdEditor.joinPath(fixturesDir, 'con-fechas.md');
    await window.mdEditor.saveFile(`# Pendientes\n\n- [ ] Llamar al banco 📅 ${todayIsoStr}\n- [ ] Sin fecha\n`, notePath, false);

    await window.mdHome.open();
    window.mdHome.setMode('week');
    const noteChip = await waitFor(() => Array.from(document.querySelectorAll('#home-main .home-today .home-note-item')).find((c) => c.textContent.includes('Llamar al banco')));
    let toggledOk = false;
    if (noteChip) {
      noteChip.querySelector('input').click();
      toggledOk = !!(await waitFor(async () => (await window.mdEditor.readFile(notePath)).content.includes('- [x] Llamar al banco 📅')));
    }

    // Tarea del Home + plan de hoy
    const title = 'Plan ' + Date.now();
    const input = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    input.value = title;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await window.mdHome.sendPlanToDailyNote();
    const daily = window.mdCodeMirror.getValue();
    const planOk = daily.includes('## Plan del día') && daily.includes(`- [ ] ${title}`) && daily.includes('Llamar al banco');
    await window.mdHome.sendPlanToDailyNote(); // segunda vez: no duplica
    const noDup = window.mdCodeMirror.getValue().split(title).length === 2;

    // Pomodoro sobre la tarea
    await window.mdHome.open();
    const card = Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title));
    card.click();
    await waitFor(() => document.querySelector('.home-editor'));
    Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent.includes('Pomodoro')).click();
    await waitFor(() => document.getElementById('status-pomodoro').textContent.includes(title));
    const pomoOk = document.getElementById('status-pomodoro').textContent.includes(title);
    window.mdPomodoro.reset();

    // Limpieza
    await window.mdHome.open();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title)).click();
    await waitFor(() => document.querySelector('.home-editor'));
    Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
    window.confirm = originalConfirm;
    window.mdHome.close();

    homeExtrasOk = !!noteChip && toggledOk && planOk && noDup && pomoOk;
    homeExtrasDetail = `chipNota=${!!noteChip} tildaArchivo=${toggledOk} plan=${planOk} sinDuplicar=${noDup} pomodoro=${pomoOk}`;
  }
  check('Home: tareas 📅 de las notas, plan de hoy a la nota diaria y Pomodoro sobre una tarea', homeExtrasOk, homeExtrasDetail);

  // Corto plazo 2: duplicar fila y ancho de columna (bases de datos), buscar
  // en la salida de la terminal, renombrar tarea del Home con doble clic.
  let short2Ok = false;
  let short2Detail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const dupDb = await window.mdEditor.db.createDatabase(fixturesDir, 'DupTest');
    const [dupName] = await window.mdEditor.db.listColumns(fixturesDir, dupDb.id);
    const dupNum = await window.mdEditor.db.createColumn(fixturesDir, dupDb.id, { name: 'Cant', type: 'number' });
    await window.mdEditor.db.createRow(fixturesDir, dupDb.id, { [dupName.id]: 'Original', [dupNum.id]: 7 });
    await window.mdEditor.db.createRow(fixturesDir, dupDb.id, { [dupName.id]: 'Otra' });
    await window.mdDatabase.open(dupDb.id);
    const names = () => Array.from(document.querySelectorAll('.database-table tbody tr td:first-child input')).map((i) => i.value).join('|');
    await waitFor(() => names() === 'Original|Otra');
    const firstRow = document.querySelector('.database-table tbody tr');
    firstRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
    await waitFor(() => document.querySelector('.database-row-menu'));
    Array.from(document.querySelectorAll('.database-row-menu button')).find((b) => b.textContent.includes('Duplicar')).click();
    await waitFor(() => names() === 'Original|Original|Otra');
    const dupRows = await window.mdEditor.db.listRows(fixturesDir, dupDb.id);
    const dupOk = names() === 'Original|Original|Otra' && dupRows[1].cells[dupNum.id] === '7';

    const grip = document.querySelector('.database-th .database-col-resizer');
    const r = grip.getBoundingClientRect();
    grip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: r.left }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: r.left - 1000 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    const widthSaved = await waitFor(async () => {
      const v = await window.mdEditor.db.listViews(fixturesDir, dupDb.id);
      return (JSON.parse(v[0].config || '{}').colWidths || {})[dupName.id] === 60;
    });
    window.mdDatabase.close();
    await window.mdEditor.db.deleteDatabase(fixturesDir, dupDb.id);

    await window.mdTerminal.show();
    const ts = await waitFor(() => window.mdTerminal.getSessions().find((x) => !x.exited));
    await new Promise((res) => setTimeout(res, 400));
    window.mdEditor.terminal.write(ts.id, 'echo AGUJA_EN_PAJAR\r');
    await waitFor(() => {
      const buf = ts.term.buffer.active;
      for (let i = 0; i < buf.length; i++) if (buf.getLine(i).translateToString(true).includes('AGUJA_EN_PAJAR')) return true;
      return false;
    }, 8000);
    window.mdTerminal.openSearch();
    const sInput = document.getElementById('terminal-search-input');
    sInput.value = 'aguja_en';
    sInput.dispatchEvent(new Event('input'));
    const searchOk = !document.getElementById('terminal-search').hidden && ts.term.getSelection().toLowerCase() === 'aguja_en';
    sInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) document.querySelector('.terminal-tab-close').click();

    await window.mdHome.open();
    window.mdHome.setMode('week');
    const rTitle = 'Renombrar ' + Date.now();
    const qa = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    qa.value = rTitle;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const findCard = (t) => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(t));
    const titleSpan = findCard(rTitle).querySelector('.home-task-title');
    titleSpan.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    titleSpan.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, detail: 2 }));
    const renameInput = document.querySelector('.home-task-rename');
    let renameOk = false;
    if (renameInput) {
      renameInput.value = rTitle + ' OK';
      renameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await new Promise((res) => setTimeout(res, 350)); // pasado el retraso del clic simple
      renameOk = !!findCard(rTitle + ' OK') && !document.querySelector('.home-editor');
    }
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    const toDelete = findCard(rTitle);
    if (toDelete) {
      toDelete.click();
      await waitFor(() => document.querySelector('.home-editor'));
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
    }
    window.confirm = originalConfirm;
    window.mdHome.close();

    short2Ok = dupOk && !!widthSaved && searchOk && renameOk;
    short2Detail = `duplicar=${dupOk} ancho=${!!widthSaved} buscarTerminal=${searchOk} renombrar=${renameOk}`;
  }
  check('Corto plazo: duplicar fila, ancho de columna, buscar en la terminal y renombrar tarea con doble clic', short2Ok, short2Detail);

  // Modo Live Preview: marcadores ocultos fuera de la línea del cursor,
  // widgets (casilla clicable, tabla) y vuelta limpia a los otros modos.
  {
    window.mdTabs.newTab('# Título\n\nTexto **negrita**.\n\n- [ ] tarea\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nfin');
    const cm = window.mdCodeMirror;
    window.mdModes.setLayoutMode('live');
    cm.setCursor({ line: 10, ch: 0 });
    window.mdLivePreview.rebuild();
    const container = document.querySelector('.container');
    const layoutOk = container.classList.contains('mode-live') && !cm.getOption('lineNumbers');
    const lineText = (n) => (cm.display.view.find((v) => v.line === cm.getLineHandle(n)) || {}).text;
    const headingEl = lineText(0);
    const hashHidden = !!headingEl && !headingEl.textContent.includes('#') && headingEl.textContent.includes('Título');
    const boldEl = lineText(2);
    const boldHidden = !!boldEl && !boldEl.textContent.includes('**');
    const tableWidget = !!document.querySelector('.cm-live .mk-live-table table');

    // Casilla: clic la tilda en el texto real.
    const box = document.querySelector('.cm-live .mk-live-task');
    if (box) box.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }));
    const taskToggled = cm.getLine(4) === '- [x] tarea';

    // Cursor en el encabezado: esa línea vuelve a mostrar "#".
    cm.setCursor({ line: 0, ch: 3 });
    const rawOnActive = (lineText(0) || {}).textContent === '# Título';
    // Cursor dentro de la tabla: se muestra cruda.
    cm.setCursor({ line: 7, ch: 1 });
    const tableRawWhenActive = !document.querySelector('.cm-live .mk-live-table');

    // El botón 🎯 cicla normal → enfoque → lectura → live → normal.
    window.mdModes.setLayoutMode('normal');
    const btn = document.getElementById('btn-focus');
    const cycle = [];
    for (let i = 0; i < 4; i++) { btn.click(); cycle.push(window.mdModes.getLayoutMode()); }
    const cycleOk = cycle.join(',') === 'focus,read,live,normal';
    const restoredOk = cm.getOption('lineNumbers') === true && cm.getOption('mode') === 'markdown' && !document.querySelector('.mk-live-widget');

    window.mdTabs.closeTab && (() => {
      const active = document.querySelector('#tabbar .tab.active .tab-close');
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      active.click();
      window.confirm = originalConfirm;
    })();
    check(
      'Modo Live Preview: oculta marcadores, widgets (casilla, tabla), línea activa cruda, ciclo de modos y vuelta limpia',
      layoutOk && hashHidden && boldHidden && tableWidget && taskToggled && rawOnActive && tableRawWhenActive && cycleOk && restoredOk,
      `layout=${layoutOk} #oculto=${hashHidden} **oculto=${boldHidden} tabla=${tableWidget} casilla=${taskToggled} lineaActivaCruda=${rawOnActive} tablaCruda=${tableRawWhenActive} ciclo=${cycle.join(',')} restaurado=${restoredOk}`
    );
  }

  // Avisos anticipados: tarea del Home con aviso "3 días antes" y fila de
  // base de datos con aviso "1 día antes" en su columna Fecha. La
  // notificación dice cuántos días faltan y el día/hora; no se repite.
  {
    const pad = (n) => String(n).padStart(2, '0');
    const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const in3 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3);
    const in1 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    await window.mdHome.open();
    window.mdHome.setMode('week');
    const title = 'Entregar TP ' + Date.now();
    const qa = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    qa.value = title;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const findCard = () => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title));
    findCard().click();
    await waitFor(() => document.querySelector('.home-editor'));
    const editor = document.querySelector('.home-editor');
    const dateIn = editor.querySelector('input[type="date"]');
    dateIn.value = isoOf(in3);
    const timeIn = editor.querySelector('input[type="time"]');
    timeIn.value = '18:30';
    timeIn.dispatchEvent(new Event('input'));
    editor.querySelector('.reminder-add').click();
    const row = editor.querySelector('.reminder-row');
    row.querySelector('select').value = '3';
    row.querySelector('input[type="time"]').value = hhmm;
    Array.from(editor.querySelectorAll('button')).find((b) => b.textContent === 'Guardar').click();

    const OriginalNotification = window.Notification;
    const shown = [];
    window.Notification = function (t, o) { shown.push({ title: t, body: o && o.body }); };
    window.mdHome.checkReminders();
    window.mdHome.checkReminders(); // segunda vuelta: no repite
    const homeNotif = shown.filter((n) => n.title.includes(title));
    const weekday = in3.toLocaleDateString(undefined, { weekday: 'long' }).toLowerCase();
    const homeOk = homeNotif.length === 1 && homeNotif[0].title.includes(`Faltan 3 días para ${title}`) &&
      homeNotif[0].body.toLowerCase().includes(weekday) && homeNotif[0].body.includes('18:30');

    let dbOk = false;
    if (fixturesDir) {
      window.mdState.rootFolder = fixturesDir;
      const rdb = await window.mdEditor.db.createDatabase(fixturesDir, 'AvisosTest');
      const [rName] = await window.mdEditor.db.listColumns(fixturesDir, rdb.id);
      const rDate = await window.mdEditor.db.createColumn(fixturesDir, rdb.id, { name: 'Entrega', type: 'date', options: { reminders: [{ days: 1, time: hhmm }] } });
      await window.mdEditor.db.createRow(fixturesDir, rdb.id, { [rName.id]: 'Informe final', [rDate.id]: isoOf(in1) });
      await window.mdHome.loadDbReminders();
      window.mdHome.checkReminders();
      const dbNotif = shown.filter((n) => n.title.includes('Informe final'));
      dbOk = dbNotif.length === 1 && dbNotif[0].title.includes('Mañana: Informe final') && dbNotif[0].body.includes('AvisosTest');
      await window.mdEditor.db.deleteDatabase(fixturesDir, rdb.id);
      await window.mdHome.loadDbReminders();
    }
    window.Notification = OriginalNotification;
    document.querySelectorAll('.reminder-toast').forEach((t) => t.remove());

    // Limpieza: la tarea puede haber quedado en la semana siguiente.
    if (!findCard()) document.getElementById('home-next').click();
    const card = findCard();
    if (card) {
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      card.click();
      await waitFor(() => document.querySelector('.home-editor'));
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
      window.confirm = originalConfirm;
    }
    window.mdHome.close();
    check(
      'Avisos anticipados: "Faltan 3 días" con día y hora (Home), "Mañana" (base de datos), sin repetir',
      homeOk && dbOk && !!card,
      `home=${homeOk} (${homeNotif.map((n) => n.title + ' / ' + n.body).join(' ; ')}) baseDatos=${dbOk} limpieza=${!!card}`
    );
  }

  // Aviso automático "1 semana antes": tarea del Home y tarea 📅 de una nota
  // con fecha dentro de 7 días avisan sin configurar nada; se puede apagar;
  // el editor de avisos muestra "1 semana antes" y tiene el botón rápido.
  {
    const pad = (n) => String(n).padStart(2, '0');
    const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const today = isoOf(now);
    const in7 = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
    let detail = 'sin fixturesDir';
    let ok = false;
    if (fixturesDir) {
      window.mdState.rootFolder = fixturesDir;
      const notePath = window.mdEditor.joinPath(fixturesDir, 'semana-antes.md');
      await window.mdEditor.saveFile(`# Pendientes\n\n- [ ] Entregar maqueta 📅 ${in7}\n`, notePath, false);
      await window.mdHome.open();
      window.mdHome.setMode('week');
      const title = 'Examen final ' + Date.now();
      const qa = await waitFor(() => document.querySelector('#home-main .home-day.home-today .home-quick-add'));
      if (!qa) throw new Error('semana antes: sin quick-add; home-main=' + (document.getElementById('home-main') || {}).className + ' días=' + document.querySelectorAll('#home-main .home-day').length);
      qa.value = title;
      qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      const findCard = () => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title));
      findCard().click();
      await waitFor(() => document.querySelector('.home-editor'));
      let editor = document.querySelector('.home-editor');
      editor.querySelector('input[type="date"]').value = in7;
      const labels = Array.from(editor.querySelectorAll('.reminder-list ~ .reminder-add')).map((b) => b.textContent);
      const presetOk = labels.includes('+ 1 semana antes');
      Array.from(editor.querySelectorAll('button')).find((b) => b.textContent === 'Guardar').click();
      await window.mdHome.rootChanged();

      const list = window.mdHome.weekBeforeReminders(today);
      const homeR = list.find((r) => r.title === `Falta 1 semana para ${title}`);
      const noteR = list.find((r) => r.title.includes('Entregar maqueta'));
      const toggle = document.getElementById('home-week-before');
      toggle.checked = false;
      toggle.dispatchEvent(new Event('change'));
      const offEmpty = window.mdHome.weekBeforeReminders(today).length === 0;
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change'));
      const labelOk = window.mdReminderUI.dayLabel(7) === '1 semana antes';

      // Limpieza
      document.getElementById('home-next').click();
      const card = findCard();
      if (card) {
        const originalConfirm = window.confirm;
        window.confirm = () => true;
        card.click();
        await waitFor(() => document.querySelector('.home-editor'));
        editor = document.querySelector('.home-editor');
        Array.from(editor.querySelectorAll('button')).find((b) => b.textContent === 'Eliminar').click();
        window.confirm = originalConfirm;
      }
      document.getElementById('home-today').click(); // el test siguiente espera la semana actual
      window.mdHome.close();
      ok = !!homeR && homeR.lateOk && !!noteR && noteR.source.kind === 'note' && offEmpty && labelOk && presetOk && !!card;
      detail = `home=${!!homeR} tardeOk=${homeR && homeR.lateOk} nota=${!!noteR} apagado=${offEmpty} etiqueta=${labelOk} botón=${presetOk} limpieza=${!!card}`;
    }
    check('Aviso "1 semana antes": automático para tareas del Home y de notas, se puede apagar, botón rápido', ok, detail);
  }

  // Posponer un aviso: suena (notificación + tarjeta en pantalla), "10 min"
  // lo guarda como pospuesto, cuando le toca vuelve a sonar "(pospuesto)", y
  // "✓ Hecho" en la tarjeta tilda la tarea.
  {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const title = 'Posponer ' + Date.now();
    const qa = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    qa.value = title;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const findCard = () => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title));
    findCard().click();
    await waitFor(() => document.querySelector('.home-editor'));
    const editor = document.querySelector('.home-editor');
    editor.querySelector('.reminder-add').click();
    const row = editor.querySelector('.reminder-row');
    row.querySelector('select').value = '0';
    row.querySelector('input[type="time"]').value = hhmm;
    Array.from(editor.querySelectorAll('button')).find((b) => b.textContent === 'Guardar').click();
    window.mdHome.close();

    const OriginalNotification = window.Notification;
    const shown = [];
    window.Notification = function (t) { shown.push(t); };
    const toastOf = () => Array.from(document.querySelectorAll('.reminder-toast')).find((t) => t.textContent.includes(title));
    window.mdHome.checkReminders();
    const firstToast = toastOf();
    const snoozesBefore = window.mdHome.getSnoozes().length;
    if (firstToast) Array.from(firstToast.querySelectorAll('button')).find((b) => b.textContent === '10 min').click();
    const snoozed = window.mdHome.getSnoozes().find((s) => s.title.includes(title));
    const snoozeOk = !!firstToast && !toastOf() && window.mdHome.getSnoozes().length === snoozesBefore + 1 && !!snoozed &&
      Math.abs(snoozed.at - (Date.now() + 10 * 60 * 1000)) < 5000;

    // Adelantar el reloj del pospuesto: vuelve a sonar marcado "(pospuesto)".
    if (snoozed) snoozed.at = Date.now() - 1000;
    window.mdHome.checkReminders();
    const againToast = toastOf();
    const againOk = !!againToast && againToast.textContent.includes('(pospuesto)') &&
      shown.some((t) => t.includes('(pospuesto)') && t.includes(title)) && !window.mdHome.getSnoozes().some((s) => s.title.includes(title));
    if (againToast) Array.from(againToast.querySelectorAll('button')).find((b) => b.textContent === '✓ Hecho').click();
    window.Notification = OriginalNotification;
    document.querySelectorAll('.reminder-toast').forEach((t) => t.remove());

    await window.mdHome.open();
    window.mdHome.setMode('week');
    const card = findCard();
    const doneOk = !!card && card.classList.contains('home-task-done');
    if (card) {
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      card.click();
      await waitFor(() => document.querySelector('.home-editor'));
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
      window.confirm = originalConfirm;
    }
    window.mdHome.close();
    document.querySelectorAll('.reminder-toast').forEach((t) => t.remove());
    check(
      'Posponer aviso: tarjeta en pantalla, "10 min" lo pospone, vuelve a sonar "(pospuesto)" y "✓ Hecho" tilda la tarea',
      snoozeOk && againOk && doneOk,
      `pospuesto=${snoozeOk} vuelveASonar=${againOk} hecho=${doneOk}`
    );
  }

  // Mejoras varias: Shift+clic en el sidebar, "Copiar ruta", renombrar
  // pestaña de la terminal, orden por varias columnas, "→ Mañana" en el
  // Home, y callout + Mermaid en Live Preview.
  let variosOk = false;
  let variosDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const pad = (n) => String(n).padStart(2, '0');
    const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Sidebar: Ctrl+clic en una fila y Shift+clic dos filas más abajo → 3 seleccionadas.
    const tree = await window.mdEditor.readFolder(fixturesDir);
    window.mdSidebar.renderFolder(tree);
    const rows = Array.from(document.querySelectorAll('#sidebar-pane .tree-row')).filter((r) => !r.closest('ul.collapsed') && r._node);
    rows[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }));
    rows[3].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
    const rangeOk = window.mdSidebar.getSelectedForTest().length === 3;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    const fileRow = document.querySelector('#sidebar-pane .tree-file');
    fileRow.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 }));
    const copyBtn = await waitFor(() => Array.from(document.querySelectorAll('.context-menu button')).find((b) => b.textContent === 'Copiar ruta'));
    if (copyBtn) copyBtn.click();
    const copied = await window.mdEditor.clipboardReadText();
    const copyOk = !!copyBtn && copied === fileRow._node.ruta;

    // Terminal: doble clic en el nombre de la pestaña → renombrar.
    await window.mdTerminal.show();
    await waitFor(() => document.querySelector('.terminal-tab-label'));
    document.querySelector('.terminal-tab-label').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    const tabInput = document.querySelector('.terminal-tab-rename');
    let renameTabOk = false;
    if (tabInput) {
      tabInput.value = 'servidor';
      tabInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      renameTabOk = document.querySelector('.terminal-tab-label').textContent === '1: servidor';
    }
    for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) document.querySelector('.terminal-tab-close').click();

    // Bases de datos: Grupo ↑ y después Precio ↓.
    window.mdState.rootFolder = fixturesDir;
    const msDb = await window.mdEditor.db.createDatabase(fixturesDir, 'MultiOrden');
    const [msName] = await window.mdEditor.db.listColumns(fixturesDir, msDb.id);
    const msGroup = await window.mdEditor.db.createColumn(fixturesDir, msDb.id, { name: 'Grupo', type: 'text' });
    const msPrice = await window.mdEditor.db.createColumn(fixturesDir, msDb.id, { name: 'Precio', type: 'number' });
    for (const [n, g, p] of [['A', 'x', 1], ['B', 'y', 5], ['C', 'x', 9], ['D', 'y', 2]]) {
      await window.mdEditor.db.createRow(fixturesDir, msDb.id, { [msName.id]: n, [msGroup.id]: g, [msPrice.id]: p });
    }
    await window.mdDatabase.open(msDb.id);
    const names = () => Array.from(document.querySelectorAll('.database-table tbody tr td:first-child input')).map((i) => i.value).join('');
    await waitFor(() => names() === 'ABCD');
    const clickMenu = async (colName, label) => {
      const th = Array.from(document.querySelectorAll('.database-th')).find((t) => t.firstChild && t.firstChild.textContent === colName);
      th.click();
      await waitFor(() => document.querySelector('.database-view-popover'));
      Array.from(document.querySelectorAll('.database-view-popover button')).find((b) => b.textContent === label).click();
    };
    await clickMenu('Grupo', '↑ Ordenar ascendente');
    await waitFor(() => names() === 'ACBD');
    await clickMenu('Precio', '+ Después por esta ↓');
    await waitFor(() => names() === 'CABD');
    const arrows = Array.from(document.querySelectorAll('.database-sort-arrow')).map((a) => a.textContent.trim()).join(',');
    const multiSortOk = names() === 'CABD' && arrows === '↑1,↓2';
    window.mdDatabase.close();
    await window.mdEditor.db.deleteDatabase(fixturesDir, msDb.id);

    // Home: "→ Mañana" en el editor mueve la tarea de hoy a mañana.
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const title = 'Manana ' + Date.now();
    const qa = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    qa.value = title;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const findCard = () => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title));
    findCard().click();
    await waitFor(() => document.querySelector('.home-editor'));
    Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === '→ Mañana').click();
    const now = new Date();
    const tomorrowIso = isoOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const inToday = !!Array.from(document.querySelectorAll('#home-main .home-today .home-task')).find((c) => c.textContent.includes(title));
    window.mdHome.setMode('month');
    if (!findCard()) document.getElementById('home-next').click();
    const tomorrowCell = Array.from(document.querySelectorAll('#home-main .home-calendar-cell')).find((c) => c.querySelector('.home-calendar-number') &&
      c.querySelector('.home-calendar-number').title.includes(new Date(tomorrowIso + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long' })));
    const tomorrowOk = !inToday && !!tomorrowCell && !!Array.from(tomorrowCell.querySelectorAll('.home-task')).find((c) => c.textContent.includes(title));
    const card = findCard();
    if (card) {
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      card.click();
      await waitFor(() => document.querySelector('.home-editor'));
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
      window.confirm = originalConfirm;
    }
    window.mdHome.setMode('week');
    window.mdHome.close();

    // Live Preview: callout y Mermaid renderizados fuera del cursor.
    window.mdTabs.newTab('# T\n\n> [!TIP]\n> Consejo.\n\n```mermaid\ngraph LR; A-->B\n```\n\nfin');
    window.mdModes.setLayoutMode('live');
    window.mdCodeMirror.setCursor({ line: 9, ch: 0 });
    window.mdLivePreview.rebuild();
    const calloutOk = !!document.querySelector('.cm-live .mk-live-callout .callout');
    const mermaidOk = !!(await waitFor(() => document.querySelector('.cm-live .mk-live-mermaid svg'), 5000));
    window.mdModes.setLayoutMode('normal');
    const originalConfirm2 = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm2;

    variosOk = rangeOk && copyOk && renameTabOk && multiSortOk && tomorrowOk && calloutOk && mermaidOk;
    variosDetail = `shiftRango=${rangeOk} copiarRuta=${copyOk} renombrarTerminal=${renameTabOk} ordenMultiple=${multiSortOk}(${names()} ${arrows}) manana=${tomorrowOk} callout=${calloutOk} mermaid=${mermaidOk}`;
  }
  check('Mejoras: Shift+clic, copiar ruta, renombrar terminal, orden múltiple, "→ Mañana", callout y Mermaid en Live Preview', variosOk, variosDetail);

  // Home: arrastrar a otro día una tarea "📅" de una nota (reescribe la fecha
  // en el archivo) y una fila de base de datos (cambia su columna Fecha).
  let dragHomeOk = false;
  let dragHomeDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const pad = (n) => String(n).padStart(2, '0');
    const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now = new Date();
    const todayIsoStr = isoOf(now);
    window.mdState.rootFolder = fixturesDir;
    const notePath = window.mdEditor.joinPath(fixturesDir, 'arrastrar.md');
    await window.mdEditor.saveFile(`- [ ] Pagar la luz 📅 ${todayIsoStr} #casa\n`, notePath, false);
    const dDb = await window.mdEditor.db.createDatabase(fixturesDir, 'ArrastreDB');
    const [dName] = await window.mdEditor.db.listColumns(fixturesDir, dDb.id);
    const dDate = await window.mdEditor.db.createColumn(fixturesDir, dDb.id, { name: 'Fecha', type: 'date' });
    const dRow = await window.mdEditor.db.createRow(fixturesDir, dDb.id, { [dName.id]: 'Reunión', [dDate.id]: todayIsoStr });

    await window.mdHome.open();
    window.mdHome.setMode('week');
    const days = () => Array.from(document.querySelectorAll('#home-main .home-day'));
    const todayIdx = days().findIndex((d) => d.classList.contains('home-today'));
    const targetIdx = (todayIdx + 1) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const targetIso = isoOf(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + targetIdx));
    const drag = (chip) => {
      const dt = new DataTransfer();
      chip.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
      days()[targetIdx].dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    };
    const noteChip = await waitFor(() => Array.from(days()[todayIdx].querySelectorAll('.home-note-item')).find((c) => c.textContent.includes('Pagar la luz')));
    if (noteChip) drag(noteChip);
    const noteMoved = await waitFor(async () => (await window.mdEditor.readFile(notePath)).content === `- [ ] Pagar la luz 📅 ${targetIso} #casa\n`);
    const dbChip = await waitFor(() => Array.from(days()[todayIdx].querySelectorAll('.home-db-item')).find((c) => c.textContent.includes('Reunión')));
    if (dbChip) drag(dbChip);
    const dbMoved = await waitFor(async () => {
      const rows = await window.mdEditor.db.listRows(fixturesDir, dDb.id);
      return rows.find((r) => r.id === dRow).cells[dDate.id] === targetIso;
    });
    const shownInTarget = await waitFor(() => days()[targetIdx].querySelector('.home-db-item') && days()[targetIdx].querySelector('.home-note-item'));
    window.mdHome.close();
    await window.mdEditor.db.deleteDatabase(fixturesDir, dDb.id);
    dragHomeOk = !!noteChip && !!noteMoved && !!dbChip && !!dbMoved && !!shownInTarget;
    dragHomeDetail = `chipNota=${!!noteChip} notaMovida=${!!noteMoved} chipBD=${!!dbChip} filaMovida=${!!dbMoved} seVeEnDestino=${!!shownInTarget}`;
  }
  check('Home: arrastrar de día tareas 📅 de notas y filas de bases de datos', dragHomeOk, dragHomeDetail);

  // Home guardado en la carpeta abierta: activarlo copia las tareas a
  // <carpeta>/.mk/home.json, lo nuevo se guarda ahí, y desactivarlo vuelve a
  // la configuración de la app con las tareas tal como quedaron.
  let inFolderOk = false;
  let inFolderDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const homeFile = window.mdEditor.joinPath(fixturesDir, '.mk', 'home.json');
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const before = 'Antes ' + Date.now();
    const addTask = (t) => {
      const qa = document.querySelector('#home-main .home-day.home-today .home-quick-add');
      qa.value = t;
      qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    addTask(before);
    await new Promise((r) => setTimeout(r, 400)); // debounce de guardado

    const toggle = document.getElementById('home-in-folder-toggle');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change'));
    const seeded = await waitFor(async () => {
      const f = await window.mdEditor.readFile(homeFile);
      return f && f.content.includes(before) && window.mdHome.dataLocation() === fixturesDir;
    });
    const after = 'EnCarpeta ' + Date.now();
    addTask(after);
    const savedInFolder = await waitFor(async () => {
      const f = await window.mdEditor.readFile(homeFile);
      return f && f.content.includes(after);
    });

    toggle.checked = false;
    toggle.dispatchEvent(new Event('change'));
    await waitFor(() => window.mdHome.dataLocation() === null);
    const findCard = (t) => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(t));
    const backInApp = await waitFor(() => findCard(after) && findCard(before));

    const originalConfirm = window.confirm;
    window.confirm = () => true;
    for (const t of [before, after]) {
      const card = findCard(t);
      if (!card) continue;
      card.click();
      await waitFor(() => document.querySelector('.home-editor'));
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
    }
    window.confirm = originalConfirm;
    window.mdHome.close();
    inFolderOk = !!seeded && !!savedInFolder && !!backInApp;
    inFolderDetail = `copiadoACarpeta=${!!seeded} nuevaEnCarpeta=${!!savedInFolder} vuelveAApp=${!!backInApp}`;
  }
  check('Home en la carpeta abierta (.mk/home.json): activar copia las tareas, guarda ahí, desactivar vuelve sin perder nada', inFolderOk, inFolderDetail);

  // Abrir con IA: comando correcto por herramienta (con el archivo como
  // contexto, comillas seguras) y pestaña de terminal con su nombre. Sin
  // ejecutar nada de verdad (dryRun).
  {
    const file = "/tmp/mis notas/it's.md";
    const c = window.mdTerminal.aiCommand('claude', file, false);
    const g = window.mdTerminal.aiCommand('gemini', file, false);
    const x = window.mdTerminal.aiCommand('codex', file, false);
    const f = window.mdTerminal.aiCommand('claude', '/tmp/mis notas', true);
    const cmdOk = c.startsWith("cd '/tmp/mis notas' && claude '") && c.includes("@it'\\''s.md") &&
      g.includes("&& gemini -i '") && g.includes('@it') &&
      x.includes('&& codex \'') && x.includes('el archivo it') &&
      f === "cd '/tmp/mis notas' && claude";
    let tabOk = false;
    if (fixturesDir) {
      await window.mdTerminal.openWithAI('gemini', window.mdEditor.joinPath(fixturesDir, 'note.md'), { dryRun: true });
      tabOk = !!(await waitFor(() => Array.from(document.querySelectorAll('.terminal-tab-label')).some((l) => l.textContent.includes('Gemini CLI'))));
      for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) document.querySelector('.terminal-tab-close').click();
    }
    const menuOk = document.querySelectorAll('#ai-menu button[data-ai]').length === 3;
    check('Abrir con IA: comandos de Claude Code / Gemini CLI / Codex con el archivo como contexto, pestaña con nombre', cmdOk && tabOk && menuOk, `comandos=${cmdOk} pestaña=${tabOk} menu=${menuOk} | ${c} | ${g} | ${x}`);
  }

  // Archivo cambiado FUERA de la pestaña (bug real: una pestaña vieja pisó
  // OBJETIVOS.md): sin cambios propios se recarga; con cambios, el
  // autoguardado no pisa la versión del disco (⚠); guardar a mano pregunta.
  let externalOk = false;
  let externalDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const p = window.mdEditor.joinPath(fixturesDir, 'externo.md');
    await window.mdEditor.saveFile('versión 1\n', p, false);
    await window.mdTabs.openTab(p);
    const cm = window.mdCodeMirror;
    await window.mdEditor.saveFile('versión 2 (desde afuera)\n', p, false);
    await window.mdTabs.syncActiveWithDisk();
    const reloaded = cm.getValue() === 'versión 2 (desde afuera)\n' && !window.mdTabs.getActiveTabInfo().modified;

    cm.replaceRange('mi cambio\n', { line: 0, ch: 0 }); // cambio propio sin guardar
    await window.mdEditor.saveFile('versión 3 (desde afuera)\n', p, false);
    await new Promise((r) => setTimeout(r, 2500)); // pasa el autoguardado
    const diskAfterAutosave = (await window.mdEditor.readFile(p)).content;
    const notOverwritten = diskAfterAutosave === 'versión 3 (desde afuera)\n';
    const warned = !!document.querySelector('#tabbar .tab.active.tab-conflict');

    const originalConfirm = window.confirm;
    let asked = false;
    window.confirm = () => { asked = true; return true; }; // "guardar mi versión"
    await window.mdTabs.saveActive();
    window.confirm = originalConfirm;
    const diskAfterSave = (await window.mdEditor.readFile(p)).content;
    const savedMine = asked && diskAfterSave === 'mi cambio\nversión 2 (desde afuera)\n' && !document.querySelector('#tabbar .tab.active.tab-conflict');
    document.querySelector('#tabbar .tab.active .tab-close').click();
    externalOk = reloaded && notOverwritten && warned && savedMine;
    externalDetail = `recarga=${reloaded} noPisa=${notOverwritten} avisa=${warned} guardarPregunta=${savedMine}`;
  }
  check('Archivo cambiado fuera de MK: recarga si no hay cambios, el autoguardado no lo pisa (⚠), guardar a mano pregunta', externalOk, externalDetail);

  // Menú contextual de pestañas: cerrar las de la derecha / las otras /
  // todas, con una sola confirmación si hay cambios sin guardar.
  {
    const originalConfirm = window.confirm;
    let asked = 0;
    window.confirm = () => { asked++; return true; };
    const count = () => document.querySelectorAll('#tabbar .tab').length;
    const menuClick = async (tabIdx, label) => {
      document.querySelectorAll('#tabbar .tab')[tabIdx].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
      const btn = await waitFor(() => Array.from(document.querySelectorAll('.tab-menu button')).find((b) => b.textContent === label));
      if (btn) btn.click();
    };
    ['A', 'B', 'C', 'D'].forEach((t) => window.mdTabs.newTab(`# ${t}\n`));
    const n0 = count();
    await menuClick(n0 - 3, 'Cerrar las de la derecha'); // deja hasta "B"
    const rightOk = count() === n0 - 2;
    window.mdCodeMirror.replaceRange('x', { line: 0, ch: 0 }); // la activa queda con cambios
    await menuClick(0, 'Cerrar las otras');
    const othersOk = count() === 1 && asked === 1;
    window.mdTabs.newTab('# E\n');
    await menuClick(0, 'Cerrar todas');
    const allOk = count() === 1 && window.mdCodeMirror.getValue() === '';
    window.confirm = originalConfirm;
    check('Pestañas: clic derecho → cerrar las de la derecha / las otras / todas (una sola confirmación)', rightOk && othersOk && allOk, `derecha=${rightOk} otras=${othersOk}(preguntó ${asked}) todas=${allOk}`);
  }

  // Sidebar: crear un archivo dentro de una subcarpeta lo deja VISIBLE (antes
  // el árbol se redibujaba todo plegado) y mover una carpeta actualiza las
  // pestañas abiertas de sus archivos (antes seguían con la ruta vieja).
  let sidebarFixOk = false;
  let sidebarFixDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const sub = window.mdEditor.joinPath(fixturesDir, 'carpeta-sub');
    await window.mdEditor.createFolder(fixturesDir, 'carpeta-sub');
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(fixturesDir));
    const creating = window.mdSidebar.createEntry(sub, false);
    await answerAsk('adentro'); // sin extensión → adentro.md
    await creating;
    const newPath = window.mdEditor.joinPath(sub, 'adentro.md');
    const row = await waitFor(() => Array.from(document.querySelectorAll('#sidebar-pane .tree-row')).find((r) => r._node && r._node.ruta === newPath));
    const visible = !!row && !row.closest('ul.collapsed');
    const addedMd = (await window.mdEditor.readFile(newPath)) !== null;

    // La pestaña de adentro.md quedó abierta (createEntry la abre). Mover la carpeta a moveA.
    await window.mdSidebar.moveEntries([{ ruta: sub, esCarpeta: true, nombre: 'carpeta-sub' }], window.mdEditor.joinPath(fixturesDir, 'moveA'));
    const expected = window.mdEditor.joinPath(fixturesDir, 'moveA', 'carpeta-sub', 'adentro.md');
    const tabUpdated = window.mdTabs.getActiveTabInfo().filePath === expected;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    sidebarFixOk = visible && addedMd && tabUpdated;
    sidebarFixDetail = `archivoVisible=${visible} agregaMd=${addedMd} pestañaSigueCarpeta=${tabUpdated}`;
  }
  check('Sidebar: lo creado dentro de una subcarpeta queda visible; mover una carpeta actualiza sus pestañas abiertas', sidebarFixOk, sidebarFixDetail);

  // Vista Gráfico: suma por categoría, cantidad por mes (con los meses vacíos
  // en 0) y que se dibuje el SVG con su tabla.
  let chartOk = false;
  let chartDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const gdb = await window.mdEditor.db.createDatabase(fixturesDir, 'GraficoTest');
    const [gName] = await window.mdEditor.db.listColumns(fixturesDir, gdb.id);
    const choices = [{ id: 'a', label: 'Comida', color: '#888' }, { id: 'b', label: 'Ocio', color: '#888' }];
    const gCat = await window.mdEditor.db.createColumn(fixturesDir, gdb.id, { name: 'Cat', type: 'select', options: { choices } });
    const gAmt = await window.mdEditor.db.createColumn(fixturesDir, gdb.id, { name: 'Monto', type: 'number' });
    const gDate = await window.mdEditor.db.createColumn(fixturesDir, gdb.id, { name: 'Fecha', type: 'date' });
    await window.mdEditor.db.createRows(fixturesDir, gdb.id, [
      { [gName.id]: 'x', [gCat.id]: 'a', [gAmt.id]: 10, [gDate.id]: '2026-01-05' },
      { [gName.id]: 'y', [gCat.id]: 'a', [gAmt.id]: 5, [gDate.id]: '2026-03-10' },
      { [gName.id]: 'z', [gCat.id]: 'b', [gAmt.id]: 7, [gDate.id]: '2026-03-20' }
    ]);
    await window.mdEditor.db.createView(fixturesDir, gdb.id, { name: 'Gráfico', type: 'chart', config: { chartType: 'bar', groupBy: gCat.id, measure: 'sum', valueCol: gAmt.id } });
    await window.mdDatabase.open(gdb.id);
    await waitFor(() => document.querySelectorAll('.database-view-tab').length === 2);
    document.querySelectorAll('.database-view-tab')[1].click();
    const svgOk = !!(await waitFor(() => document.querySelector('.database-chart svg .chart-mark')));
    const tableRows = document.querySelectorAll('.database-chart .chart-table tr').length; // encabezado + 2
    const byCat = window.mdDatabase.chartData({ groupBy: gCat.id, measure: 'sum', valueCol: gAmt.id });
    const catOk = byCat.data.map((d) => `${d.label}=${d.value}`).join(',') === 'Comida=15,Ocio=7';
    const byMonth = window.mdDatabase.chartData({ groupBy: gDate.id, measure: 'count', dateBucket: 'month' });
    const monthOk = byMonth.time && byMonth.data.map((d) => d.value).join(',') === '1,0,2';
    window.mdDatabase.close();
    await window.mdEditor.db.deleteDatabase(fixturesDir, gdb.id);
    chartOk = svgOk && tableRows === 3 && catOk && monthOk;
    chartDetail = `svg=${svgOk} tabla=${tableRows} porCategoria=${catOk} porMes=${monthOk}(${byMonth.data.map((d) => d.label + '=' + d.value).join(' ')})`;
  }
  check('Bases de datos: vista Gráfico (suma por categoría, cantidad por mes con meses vacíos en 0, SVG + tabla)', chartOk, chartDetail);

  // Tareas 📅 de notas: lo que está dentro de código NO es una tarea (un
  // ejemplo de la documentación aparecía en el Home y moverlo reescribía el archivo).
  {
    const txt = '- [ ] real 📅 2026-10-01\n- [x] ejemplo `- [ ] algo 📅 2026-10-03`\n```\n- [ ] en bloque 📅 2026-10-05\n```\n- [ ] otra 📅 2026-10-07';
    const found = window.mdHome.parseNoteTasks('/x.md', txt).map((i) => i.date).join(',');
    check('Tareas 📅 de notas: ignora las que están dentro de código (inline o bloques)', found === '2026-10-01,2026-10-07', `encontradas=${found}`);
  }

  // Búsqueda global también en tareas del Home y filas de bases de datos
  // (por etiqueta de selección); clic en la fila abre la base ya filtrada.
  let searchAllOk = false;
  let searchAllDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const token = 'zorzal' + Date.now();
    const sdb = await window.mdEditor.db.createDatabase(fixturesDir, 'BuscarDB');
    const [sName] = await window.mdEditor.db.listColumns(fixturesDir, sdb.id);
    const sSel = await window.mdEditor.db.createColumn(fixturesDir, sdb.id, { name: 'Estado', type: 'select', options: { choices: [{ id: 'z', label: `Estado ${token}`, color: '#888' }] } });
    await window.mdEditor.db.createRow(fixturesDir, sdb.id, { [sName.id]: 'Fila con etiqueta', [sSel.id]: 'z' });

    await window.mdHome.open();
    window.mdHome.setMode('week');
    const qa = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    qa.value = `Tarea ${token}`;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    window.mdHome.close();

    window.mdSearch.open();
    const si = document.getElementById('search-input');
    si.value = token;
    si.dispatchEvent(new Event('input'));
    await waitFor(() => document.querySelectorAll('#search-results .search-section-title').length >= 2, 6000);
    const sections = Array.from(document.querySelectorAll('#search-results .search-section-title')).map((t) => t.textContent).join(' | ');
    const hasTask = /Tareas del Home \(1\)/.test(sections);
    const hasRow = /Bases de datos \(1\)/.test(sections);
    const rowItem = Array.from(document.querySelectorAll('#search-results .search-result-item')).find((i) => i.textContent.includes('BuscarDB'));
    if (rowItem) rowItem.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    const filtered = await waitFor(() => !document.getElementById('database-panel').hidden && document.getElementById('database-filter-input').value === token);
    window.mdDatabase.close();

    // Limpieza: la tarea de prueba.
    const found = await window.mdHome.searchTasks(token);
    if (found[0]) {
      await window.mdHome.revealTask(found[0].id);
      await waitFor(() => document.querySelector('.home-editor'));
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
      window.confirm = originalConfirm;
      window.mdHome.close();
    }
    await window.mdEditor.db.deleteDatabase(fixturesDir, sdb.id);
    searchAllOk = hasTask && hasRow && !!filtered && !!found[0];
    searchAllDetail = `secciones="${sections}" abreBaseFiltrada=${!!filtered} revelaTarea=${!!found[0]}`;
  }
  check('Búsqueda global: también tareas del Home y filas de bases de datos (clic abre la base filtrada)', searchAllOk, searchAllDetail);

  // Estadísticas del Home: una tarea de hoy hecha suma a la semana y a la
  // racha; el panel muestra los 4 números y los gráficos.
  {
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const before = window.mdHome.computeStats();
    const title = 'Stats ' + Date.now();
    const qa = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    qa.value = title;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const findCard = () => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title));
    findCard().querySelector('input[type="checkbox"]').click();
    const after = window.mdHome.computeStats();
    const statsOk = after.week.done === before.week.done + 1 && after.week.total === before.week.total + 1 && after.streak >= 1;
    window.mdHome.openStats();
    const tiles = document.querySelectorAll('.home-stats .home-stat-tile').length;
    const chartOk = !!document.querySelector('.home-stats svg .chart-mark');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const closedOk = !document.querySelector('.home-stats');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    findCard().click();
    await waitFor(() => document.querySelector('.home-editor'));
    Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
    window.confirm = originalConfirm;
    window.mdHome.close();
    check('Home: estadísticas (semana, racha, 4 números, gráfico) y Escape las cierra', statsOk && tiles === 4 && chartOk && closedOk, `stats=${statsOk} numeros=${tiles} grafico=${chartOk} cierra=${closedOk}`);
  }

  // Preview: las fórmulas se insertan después de sanitizar (optimización),
  // sin abrir huecos: HTML dentro de $…$ no se ejecuta y una fórmula dentro
  // de un atributo (URL de un enlace) no puede inyectar atributos.
  {
    window.mdModes.setLayoutMode('normal');
    window.mdTabs.newTab('Normal $x^2$ y $<img src=x onerror="window.__xss1=1">$ y [enlace]($" onmouseover="window.__xss2=1$) fin');
    window.renderPreview();
    const pane = document.getElementById('preview-pane');
    const katexOk = !!pane.querySelector('.katex');
    const noImg = !pane.querySelector('img[onerror]');
    const noHandler = !Array.from(pane.querySelectorAll('a')).some((a) => a.hasAttribute('onmouseover'));
    const noEvents = !pane.innerHTML.match(/on(error|mouseover)=/i) || !pane.querySelector('[onerror],[onmouseover]');
    document.querySelector('#tabbar .tab.active .tab-close').click();
    check('Preview: fórmulas rápidas y seguras (HTML en $…$ no se ejecuta, no inyectan atributos)', katexOk && noImg && noHandler && noEvents && !window.__xss1 && !window.__xss2, `katex=${katexOk} sinImgOnerror=${noImg} sinOnmouseover=${noHandler}`);
  }

  // Fotos, video y audio: tipos reconocidos, visor de audio con duración,
  // adelantar (pedido por rango al protocolo md-local) y formato no
  // soportado → botón para abrir con la app del sistema.
  let mediaOk = false;
  let mediaDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const kinds = ['a.PNG', 'b.webp', 'c.avif', 'd.mkv', 'e.mov', 'f.flac', 'g.m4a', 'h.opus', 'i.txt'].map((f) => window.mdMedia.kindOf(f) || '-').join(',');
    const kindsOk = kinds === 'image,image,image,video,video,audio,audio,audio,-';
    window.showMediaPreview(window.mdEditor.joinPath(fixturesDir, 'tono.wav'));
    const audio = await waitFor(() => document.querySelector('#preview-pane .media-viewer audio'));
    let duration = 0;
    let seeked = false;
    if (audio) {
      await waitFor(() => audio.readyState >= 1 && audio.duration > 0, 5000);
      duration = audio.duration;
      await new Promise((resolve) => {
        audio.addEventListener('seeked', () => { seeked = true; resolve(); }, { once: true });
        audio.currentTime = 1.5;
        setTimeout(resolve, 3000);
      });
    }
    const audioOk = Math.abs(duration - 2) < 0.1 && seeked && Math.abs(audio.currentTime - 1.5) < 0.2;
    window.showMediaPreview(window.mdEditor.joinPath(fixturesDir, 'escaneo.tiff'));
    const fallback = await waitFor(() => document.querySelector('#preview-pane .media-unsupported button'), 5000);
    const fallbackOk = !!fallback && fallback.textContent.includes('aplicación del sistema');
    window.mdModes.setLayoutMode('normal');
    window.renderPreview();
    mediaOk = kindsOk && audioOk && fallbackOk;
    mediaDetail = `tipos=${kinds} audio=${audioOk}(duración ${duration.toFixed(2)}s, adelantar=${seeked}) noSoportado=${fallbackOk}`;
  }
  check('Fotos, video y audio: tipos reconocidos, audio con adelantar (rangos) y formato no soportado ofrece la app del sistema', mediaOk, mediaDetail);

  // Bloque ```chart```: tabla Markdown → gráfico en el preview y en Live
  // Preview; errores claros si falta la tabla o la columna.
  {
    const fence = '```';
    window.mdModes.setLayoutMode('normal');
    window.mdTabs.newTab([
      '# Gráficos', '',
      fence + 'chart', 'tipo: barras', 'título: Gastos', '| Categoría | Monto |', '|---|---|', '| Comida | 1.234,5 |', '| Casa | 135 |', '| Ocio | 84 € |', fence, '',
      fence + 'chart', 'tipo: torta', 'valor: Nada', '| A | B |', '|---|---|', '| x | 1 |', fence, '', 'fin'
    ].join('\n'));
    window.renderPreview();
    const blocks = document.querySelectorAll('#preview-pane .md-chart-block');
    const bars = blocks[0] ? blocks[0].querySelectorAll('.chart-mark').length : 0;
    const title = blocks[0] && blocks[0].querySelector('.md-chart-title') ? blocks[0].querySelector('.md-chart-title').textContent : '';
    const firstValue = window.mdCharts.parseChartBlock('| a | b |\n|---|---|\n| x | 1.234,5 |').data[0].value;
    const errorOk = !!(blocks[1] && blocks[1].querySelector('.md-chart-error') && blocks[1].textContent.includes('Nada'));
    window.mdModes.setLayoutMode('live');
    window.mdCodeMirror.setCursor({ line: 21, ch: 0 });
    window.mdLivePreview.rebuild();
    const liveOk = !!(await waitFor(() => document.querySelector('.cm-live .mk-live-chart svg .chart-mark')));
    window.mdModes.setLayoutMode('normal');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    check('Bloque chart: tabla Markdown → gráfico (preview y Live Preview), números es/en y error claro', blocks.length === 2 && bars === 3 && title === 'Gastos' && firstValue === 1234.5 && errorOk && liveOk, `bloques=${blocks.length} barras=${bars} título="${title}" 1.234,5→${firstValue} error=${errorOk} live=${liveOk}`);
  }

  // Base de datos dentro de una nota (```database```): la vista tabla con
  // sus filtros, la vista gráfico, límite de filas, error claro y "Abrir".
  let embedOk = false;
  let embedDetail = 'sin fixturesDir';
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const edb = await window.mdEditor.db.createDatabase(fixturesDir, 'Libros Embed');
    const [eName] = await window.mdEditor.db.listColumns(fixturesDir, edb.id);
    const eLeido = await window.mdEditor.db.createColumn(fixturesDir, edb.id, { name: 'Leído', type: 'checkbox' });
    const ePag = await window.mdEditor.db.createColumn(fixturesDir, edb.id, { name: 'Páginas', type: 'number' });
    await window.mdEditor.db.createRows(fixturesDir, edb.id, [
      { [eName.id]: 'Rayuela', [eLeido.id]: '1', [ePag.id]: 600 },
      { [eName.id]: 'Ficciones', [eLeido.id]: '0', [ePag.id]: 200 },
      { [eName.id]: 'El Aleph', [eLeido.id]: '0', [ePag.id]: 150 },
      { [eName.id]: 'Martín Fierro', [eLeido.id]: '0', [ePag.id]: 100 }
    ]);
    await window.mdEditor.db.createView(fixturesDir, edb.id, { name: 'Pendientes', type: 'table', config: { filters: [{ columnId: eLeido.id, op: 'unchecked', value: '' }] } });
    await window.mdEditor.db.createView(fixturesDir, edb.id, { name: 'Gráfico', type: 'chart', config: { chartType: 'bar', groupBy: eName.id, measure: 'sum', valueCol: ePag.id } });
    const fence = '```';
    window.mdModes.setLayoutMode('normal');
    window.mdTabs.newTab([
      fence + 'database', 'base: Libros Embed', 'vista: Pendientes', 'filas: 2', fence, '',
      fence + 'database', 'Libros Embed', 'vista: Gráfico', fence, '',
      fence + 'database', 'base: No Existe', fence, '', 'fin'
    ].join('\n'));
    window.renderPreview();
    await waitFor(() => document.querySelectorAll('#preview-pane .db-embed:not(.db-embed-loading)').length === 3, 5000);
    const embeds = document.querySelectorAll('#preview-pane .db-embed');
    const bodyRows = embeds[0] ? embeds[0].querySelectorAll('table.db-embed-table tr').length - 1 : 0;
    const moreText = embeds[0] && embeds[0].querySelector('.db-embed-more') ? embeds[0].querySelector('.db-embed-more').textContent : '';
    const chartOk = !!(embeds[1] && embeds[1].querySelector('svg .chart-mark'));
    const errOk = !!(embeds[2] && embeds[2].textContent.includes('Libros Embed'));
    embeds[0].querySelector('.db-embed-open').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    const opened = await waitFor(() => !document.getElementById('database-panel').hidden && document.getElementById('database-name-input').value === 'Libros Embed');
    window.mdDatabase.close();
    window.mdModes.setLayoutMode('live');
    window.mdCodeMirror.setCursor({ line: 15, ch: 0 });
    window.mdLivePreview.rebuild();
    const liveOk = !!(await waitFor(() => document.querySelector('.cm-live .mk-live-db table.db-embed-table'), 5000));
    window.mdModes.setLayoutMode('normal');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    await window.mdEditor.db.deleteDatabase(fixturesDir, edb.id);
    embedOk = bodyRows === 2 && moreText.includes('1 fila') && chartOk && errOk && !!opened && liveOk;
    embedDetail = `filas=${bodyRows} "${moreText}" grafico=${chartOk} error=${errOk} abrir=${!!opened} live=${liveOk}`;
  }
  check('Base de datos dentro de una nota: vista con filtros, gráfico, límite de filas, error claro, Abrir y Live Preview', embedOk, embedDetail);

  // Vigilar la carpeta: lo que cambia afuera de MK (acá, escrito por el
  // proceso principal sin pasar por las pestañas) aparece solo — archivo
  // nuevo en el árbol, pestaña abierta recargada, carpetas nuevas vigiladas.
  let watchOk = false;
  let watchDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const J = window.mdEditor.joinPath;
    const wdir = J(fixturesDir, 'vigilada');
    await window.mdEditor.createFolder(fixturesDir, 'vigilada');
    const openPath = J(wdir, 'abierta.md');
    await window.mdEditor.saveFile('# versión 1\n', openPath, false);
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(wdir));
    await window.openFileAtPath(openPath);
    await new Promise((r) => setTimeout(r, 400));
    const rowExists = (name) => Array.from(document.querySelectorAll('.tree-row')).some((r) => r.textContent.trim() === name);
    const events = [];
    const onEvt = (e) => events.push(...e.detail.changes.map((c) => c.path));
    document.addEventListener('mk:folder-changed', onEvt);

    await window.mdEditor.saveFile('# nuevo\n', J(wdir, 'aparece-solo.md'), false);
    const newRow = !!(await waitFor(() => rowExists('aparece-solo.md'), 4000));
    await window.mdEditor.saveFile('# versión 2 (desde afuera)\n', openPath, false);
    const reloaded = !!(await waitFor(() => window.mdCodeMirror.getValue().includes('versión 2'), 4000));
    await window.mdEditor.createFolder(wdir, 'sub');
    await new Promise((r) => setTimeout(r, 400));
    const nested = J(wdir, 'sub', 'interno.md');
    await window.mdEditor.saveFile('x', nested, false);
    const nestedSeen = !!(await waitFor(() => events.includes(nested), 4000));
    await window.mdEditor.saveFile('ignorado', J(wdir, '.oculto.md'), false);
    await new Promise((r) => setTimeout(r, 500));
    const hiddenIgnored = !events.some((p) => p.endsWith('.oculto.md'));
    document.removeEventListener('mk:folder-changed', onEvt);
    watchOk = newRow && reloaded && nestedSeen && hiddenIgnored;
    watchDetail = `árbol=${newRow} pestañaRecargada=${reloaded} subcarpetaNueva=${nestedSeen} ocultosIgnorados=${hiddenIgnored}`;
  }
  check('Vigilar la carpeta: archivos nuevos, pestañas abiertas y subcarpetas nuevas se actualizan solos', watchOk, watchDetail);

  // Índice de la carpeta: la segunda búsqueda no relee nada; guardar un
  // archivo relee solo ese y la búsqueda ya ve el texto nuevo; un archivo
  // nuevo entra en la lista al instante.
  let indexOk = false;
  let indexDetail = 'sin fixturesDir';
  if (fixturesDir) {
    const J = window.mdEditor.joinPath;
    const idir = J(fixturesDir, 'indexada');
    await window.mdEditor.createFolder(fixturesDir, 'indexada');
    for (let i = 0; i < 5; i++) await window.mdEditor.saveFile(`# nota ${i}\npalabra-comun\n`, J(idir, `n${i}.md`), false);
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(idir));
    await new Promise((r) => setTimeout(r, 400));
    const first = await window.mdEditor.searchInFolder(idir, 'palabra-comun');
    const s1 = await window.mdEditor.indexStats();
    const second = await window.mdEditor.searchInFolder(idir, 'palabra-comun');
    const s2 = await window.mdEditor.indexStats();
    const noReread = s2.reads === s1.reads && s2.listBuilds === s1.listBuilds && second.length === first.length && first.length === 5;
    await window.mdEditor.saveFile('# nota 2\ntexto-recien-guardado\n', J(idir, 'n2.md'), false);
    const fresh = await window.mdEditor.searchInFolder(idir, 'texto-recien-guardado');
    const s3 = await window.mdEditor.indexStats();
    const onlyOne = s3.reads === s2.reads + 1;
    await window.mdEditor.saveFile('palabra-comun', J(idir, 'nueva.md'), false);
    const withNew = await window.mdEditor.searchInFolder(idir, 'palabra-comun');
    indexOk = noReread && fresh.length === 1 && onlyOne && withNew.length === 5;
    indexDetail = `sinReleer=${noReread} textoNuevo=${fresh.length} soloUno=${onlyOne}(${s3.reads - s2.reads}) archivoNuevo=${withNew.length}`;
  }
  check('Índice de la carpeta: búsquedas repetidas no releen, guardar relee solo ese archivo, archivos nuevos entran al instante', indexOk, indexDetail);

  // Home: tarea recurrente diaria (aparece los 7 días de la semana siguiente,
  // tildar una repetición no tilda las demás) y recordatorio con hora.
  {
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const title = 'Recurrente ' + Date.now();
    const input = document.querySelector('#home-main .home-day.home-today .home-quick-add');
    input.value = title;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const cardsOf = () => Array.from(document.querySelectorAll('#home-main .home-task')).filter((c) => c.textContent.includes(title));
    cardsOf()[0].click();
    await waitFor(() => document.querySelector('.home-editor'));
    const editor = document.querySelector('.home-editor');
    const repeatSel = Array.from(editor.querySelectorAll('select')).find((s) => Array.from(s.options).some((o) => o.value === 'daily'));
    repeatSel.value = 'daily';
    repeatSel.dispatchEvent(new Event('change'));
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const timeInput = editor.querySelector('input[type="time"]');
    timeInput.value = hhmm;
    timeInput.dispatchEvent(new Event('input'));
    const remindSel = Array.from(editor.querySelectorAll('select')).find((s) => Array.from(s.options).some((o) => o.value === '15'));
    remindSel.value = '0';
    Array.from(editor.querySelectorAll('button')).find((b) => b.textContent === 'Guardar').click();

    document.getElementById('home-next').click();
    const nextWeekCount = cardsOf().length;
    cardsOf()[0].querySelector('input[type="checkbox"]').click();
    const doneCount = cardsOf().filter((c) => c.classList.contains('home-task-done')).length;
    document.getElementById('home-today').click();

    const OriginalNotification = window.Notification;
    let notifiedTitle = null;
    window.Notification = function (t) { notifiedTitle = t; };
    window.mdHome.checkReminders();
    window.Notification = OriginalNotification;
    document.querySelectorAll('.reminder-toast').forEach((t) => t.remove());

    const originalConfirm = window.confirm;
    window.confirm = () => true;
    cardsOf()[0].click();
    await waitFor(() => document.querySelector('.home-editor'));
    Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar serie').click();
    window.confirm = originalConfirm;
    const deleted = cardsOf().length === 0;
    window.mdHome.close();
    check(
      'Home: tarea recurrente diaria, tildar una sola repetición y recordatorio a la hora',
      nextWeekCount === 7 && doneCount === 1 && notifiedTitle && notifiedTitle.includes(title) && deleted,
      `semanaSiguiente=${nextWeekCount} tildadas=${doneCount} aviso=${notifiedTitle} borrada=${deleted}`
    );
  }

  // Home: agregar una tarea desde la columna de hoy (vista semana), verla
  // en el calendario (vista mes) y borrarla — deja home.json como estaba.
  {
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const todayCol = document.querySelector('#home-main .home-day.home-today');
    const input = todayCol && todayCol.querySelector('.home-quick-add');
    const title = 'Tarea de prueba ' + Date.now();
    if (input) {
      input.value = title;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    }
    const findCard = () => Array.from(document.querySelectorAll('#home-main .home-task'))
      .find((c) => c.textContent.includes(title));
    const inWeek = !!findCard();
    window.mdHome.setMode('month');
    const cells = document.querySelectorAll('#home-main .home-calendar-cell').length;
    const inMonth = !!document.querySelector('#home-main .home-calendar-cell.home-today .home-task');
    const card = findCard();
    let deleted = false;
    if (card) {
      const originalConfirm = window.confirm;
      window.confirm = () => true;
      card.click();
      await waitFor(() => document.querySelector('.home-editor'));
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
      window.confirm = originalConfirm;
      deleted = !findCard();
    }
    window.mdHome.setMode('week');
    window.mdHome.close();
    check(
      'Home: agrega tarea en la semana, aparece en el calendario del mes y se borra',
      inWeek && inMonth && cells % 7 === 0 && cells >= 28 && deleted,
      `inWeek=${inWeek} inMonth=${inMonth} cells=${cells} deleted=${deleted}`
    );
  }

  return results;
})();
