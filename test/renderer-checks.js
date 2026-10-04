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
  // (galería de Ajustes → Apariencia, themegallery.js)
  const themeBtn = document.querySelector('#theme-gallery .tg-card[data-theme="dracula"]');
  if (themeBtn) themeBtn.click();
  await waitFor(() => document.documentElement.getAttribute('data-theme') === 'dracula');
  check('Cambiar de tema actualiza data-theme en <html>', document.documentElement.getAttribute('data-theme') === 'dracula');
  {
    const nordCard = document.querySelector('#theme-gallery .tg-card[data-theme="nord"]');
    nordCard.dispatchEvent(new MouseEvent('mouseenter'));
    const pv = document.querySelector('#theme-gallery .tg-preview');
    const hoverShows = pv.getAttribute('data-theme') === 'nord' && document.documentElement.getAttribute('data-theme') === 'dracula';
    const pressed = document.querySelector('#theme-gallery .tg-card[aria-pressed="true"]');
    const cards = document.querySelectorAll('#theme-gallery .tg-card').length;
    const muestraColores = window.getComputedStyle(nordCard.querySelector('.tg-mini')).backgroundColor !== window.getComputedStyle(document.querySelector('#theme-gallery .tg-card[data-theme="light"] .tg-mini')).backgroundColor;
    check('Galería de temas en Ajustes: una muestra por tema, vista previa al pasar el mouse, marca el actual',
      hoverShows && pressed && pressed.dataset.theme === 'dracula' && cards === window.mdThemes.THEME_LIST.length + 1 && muestraColores,
      `hover=${hoverShows} marcado=${pressed && pressed.dataset.theme} tarjetas=${cards} colores=${muestraColores}`);
  }
  const lightBtn = document.querySelector('#theme-gallery .tg-card[data-theme="light"]');
  if (lightBtn) lightBtn.click();
  await waitFor(() => !document.documentElement.getAttribute('data-theme'));

  // 9b. Tema personalizado: color pickers aplican en vivo (--accent inline),
  // avisa si el contraste texto/fondo queda bajo, y "Guardar" persiste en
  // config.json bajo customTheme.
  await window.mdCustomTheme.open();
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
  const marksOk = document.querySelector('#command-palette-list mark')?.textContent.toLowerCase() === 'guardar';
  const escapedMatch = document.createElement('div');
  window.mdSearchPresentation.highlight(escapedMatch, '<img src=x> [nota] [NOTA]', '[nota]');
  check('Búsqueda: resaltado literal seguro y coincidencias en la paleta', marksOk && !escapedMatch.querySelector('img') && escapedMatch.querySelectorAll('mark').length === 2 && escapedMatch.textContent === '<img src=x> [nota] [NOTA]');
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
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    check('Búsqueda: separa nombre y ruta, resalta texto y navega con flechas', !!found?.querySelector('.search-result-name') && !!found?.querySelector('.search-result-path') && found?.querySelector('mark')?.textContent === 'Hola MK' && found?.classList.contains('selected'));
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
  const hintsShown = await waitFor(() => document.querySelector('.CodeMirror-hints, .cm-tooltip-autocomplete'));
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
    const actions = fileRow.querySelector('.tree-actions');
    const activeBeforeActions = window.mdState.currentFilePath;
    actions.focus();
    actions.click();
    const actionsOpen = !!document.querySelector('.context-menu button');
    check('Explorador: acciones accesibles sin abrir el archivo', actionsOpen && actions.getAttribute('aria-label').includes('note.md') && window.mdState.currentFilePath === activeBeforeActions);
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
  check('PDF: pestañas de documentos visibles y editor oculto',
    document.getElementById('tabbar').getBoundingClientRect().height > 0 &&
    getComputedStyle(document.getElementById('editor-pane')).display === 'none');
  await window.mdPdfHighlight.open();
  const pdfTab = document.querySelector('.pdf-document-tabs button');
  const pdfTabsVisible = !!pdfTab && pdfTab.getBoundingClientRect().height > 0;
  if (pdfTab) pdfTab.click();
  check('Editor PDF: muestra documentos abiertos y permite cambiar de pestaña',
    pdfTabsVisible && document.getElementById('pdfhighlight-panel').hidden &&
    !document.querySelector('.container').classList.contains('pdf-reading'));

  window.mdModes.setLayoutMode('normal'); // el clic de pestaña ya salió del PDF
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
  check('Pomodoro: Lucky Emblem en lugar del tomate con cualquier tema',
    !!pomodoroStatusEl.querySelector('.lucky-mini svg') && !pomodoroStatusEl.textContent.includes('🍅'));
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

  {
    const history = window.mdPomodoroHistory;
    await history.settled();
    const before = history.getState().records.map((r) => r.id);
    const statsBefore = JSON.stringify(window.mdPet.getState().stats);
    await history.record({ category: 'PCP_TEST', seconds: 1500, completed: true });
    await history.record({ category: 'PCP_TEST', seconds: 1500, completed: true });
    await window.mdPomodoroPanel.open();
    const panel = document.getElementById('pomodoro-history-panel');
    const fifty = panel.querySelector('#pomodoro-totals').textContent.includes('PCP_TEST: 50 min');
    const row = Array.from(panel.querySelectorAll('.pomodoro-record')).find((row) => row.textContent.includes('PCP_TEST'));
    row.querySelector('button').click();
    row.querySelector('.pomodoro-record-form input[type="number"]').value = '30';
    Array.from(row.querySelectorAll('.pomodoro-record-form button')).find((btn) => btn.textContent === 'Guardar registro').click();
    await waitFor(() => panel.querySelector('#pomodoro-totals').textContent.includes('PCP_TEST: 55 min'));
    const edited = panel.querySelector('#pomodoro-totals').textContent.includes('PCP_TEST: 55 min');
    const saved = await window.mdEditor.getConfig();
    const persisted = saved.pomodoroHistory.records.filter((r) => r.category === 'PCP_TEST').reduce((sum, r) => sum + r.seconds, 0) === 3300;
    const filter = panel.querySelector('#pomodoro-filter-category');
    filter.value = 'PCP_TEST'; filter.dispatchEvent(new Event('change'));
    const filtered = panel.querySelectorAll('.pomodoro-record').length === 2;
    panel.querySelector('#pomodoro-new-category').value = 'EC_TEST';
    panel.querySelector('#pomodoro-add-category').click();
    await waitFor(() => history.getState().categories.includes('EC_TEST') && !document.getElementById('pomodoro-add-category').disabled);
    const categoryCreated = history.getState().categories.includes('EC_TEST');
    panel.querySelector('#pomodoro-close').click();
    check('Pomodoros: PCP 50 min, edición a 55 min persistida, categorías y filtros, sin XP manual', fifty && edited && persisted && filtered && categoryCreated && statsBefore === JSON.stringify(window.mdPet.getState().stats), `50=${fifty} edita=${edited} persiste=${persisted} filtra=${filtered} categoría=${categoryCreated}`);
    for (const r of history.getState().records) if (!before.includes(r.id)) await history.remove(r.id);
  }

  // Contexto de estudio: nota estable durante el foco, edición y filtros.
  if (fixtureMdPath && fixtureOtherPath) {
    const H = window.mdPomodoroHistory;
    const before = new Set(H.getState().records.map((r) => r.id));
    const configBefore = await window.mdEditor.getConfig();
    await window.mdEditor.setConfig({ pomodoroFocusMinutes: 25, pomodoroBreakMinutes: 5 });
    await window.openFileAtPath(fixtureMdPath);
    await window.mdPomodoroPanel.open();
    document.getElementById('pomodoro-active-category').value = 'CONTEXT_TEST';
    document.getElementById('pomodoro-active-detail').value = 'Ejercicio de contexto';
    document.getElementById('pomodoro-start-note').click();
    await waitFor(() => window.mdPomodoro.getState().phase === 'focus' && window.mdPomodoro.getState().detail === 'Ejercicio de contexto');
    document.getElementById('pomodoro-close').click();
    const session = window.mdPomodoro.getState().sessionId;
    await window.openFileAtPath(fixtureOtherPath);
    const originalOtherContent = window.mdCodeMirror.getValue();
    window.mdCodeMirror.setValue(originalOtherContent + '\nCambio pendiente del contexto de estudio\n');
    await window.mdPomodoro.toggle();
    await H.settled();
    const liveRecord = H.getState().records.find((r) => r.id === session);
    check('Estudio: iniciar desde el panel y cambiar pestaña conserva nota, categoría y detalle en disco', liveRecord?.notePath === fixtureMdPath && liveRecord.category === 'CONTEXT_TEST' && liveRecord.detail === 'Ejercicio de contexto' && (await window.mdEditor.getConfig()).pomodoroHistory.records.find((r) => r.id === session)?.notePath === fixtureMdPath);
    await window.mdPomodoro.reset();
    await H.record({ id: 'study-note-a', category: 'STUDY_TEST', seconds: 60, notePath: fixtureMdPath, detail: 'Repaso A' });
    await H.record({ id: 'study-note-b', category: 'STUDY_TEST', seconds: 120, notePath: fixtureOtherPath, detail: 'Repaso B' });
    await window.mdPomodoroPanel.open();
    let panel = document.getElementById('pomodoro-history-panel');
    function filterStudy(id, value) { const field = panel.querySelector(id); field.value = value; field.dispatchEvent(new Event('change')); }
    filterStudy('#pomodoro-filter-category', 'STUDY_TEST');
    filterStudy('#pomodoro-filter-note', fixtureMdPath);
    check('Estudio: filtro por nota aplica a registros y estadísticas sin mezclar apuntes', panel.querySelectorAll('.pomodoro-record').length === 1 && panel.querySelector('#pomodoro-totals').textContent.includes('STUDY_TEST: 1 min'));
    const contentA = window.mdTabs.getActiveTabInfo().content;
    let row = panel.querySelector('.pomodoro-record');
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Abrir nota').click();
    await waitFor(() => !document.getElementById('pomodoro-history-panel'));
    check('Estudio: abrir la nota desde el historial conserva la otra pestaña', window.mdTabs.getActiveTabInfo().filePath === fixtureMdPath);
    await window.openFileAtPath(fixtureOtherPath);
    check('Estudio: volver al apunte no sustituye sus cambios sin guardar', window.mdCodeMirror.getValue() === contentA && window.mdTabs.getActiveTabInfo().modified);
    await window.mdPomodoroPanel.open();
    panel = document.getElementById('pomodoro-history-panel');
    row = panel.querySelector('.pomodoro-record');
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Editar').click();
    row.querySelector('.pomodoro-record-detail').value = 'Repaso corregido';
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Quitar vínculo').click();
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Guardar registro').click();
    await waitFor(() => H.getState().records.find((r) => r.id === 'study-note-a')?.detail === 'Repaso corregido' && !panel.querySelector('.pomodoro-record-form'));
    const edited = H.getState().records.find((r) => r.id === 'study-note-a');
    check('Estudio: detalle y vínculo editables con persistencia y sin alterar minutos', edited?.detail === 'Repaso corregido' && edited.notePath === '' && edited.seconds === 60 && panel.querySelectorAll('.pomodoro-record').length === 0);
    filterStudy('#pomodoro-filter-note', '*');
    panel.querySelector('#pomodoro-close').click();
    await H.record({ id: 'study-denied', category: 'STUDY_TEST', seconds: 60, notePath: '/etc/no-autorizado.md' });
    await window.mdPomodoroPanel.open();
    panel = document.getElementById('pomodoro-history-panel');
    row = panel.querySelector('[data-id="study-denied"]');
    Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Abrir nota').click();
    await waitFor(() => panel.querySelector('.pomodoro-error').textContent);
    check('Estudio: los vínculos del historial respetan permisos y muestran errores sin borrar registros', !!panel.querySelector('.pomodoro-error').textContent && H.getState().records.some((r) => r.id === 'study-denied') && window.mdTabs.getActiveTabInfo().filePath === fixtureOtherPath);
    filterStudy('#pomodoro-filter-category', '*');
    panel.querySelector('#pomodoro-close').click();
    for (const r of H.getState().records) if (!before.has(r.id)) await H.remove(r.id);
    window.mdCodeMirror.setValue(originalOtherContent);
    await window.mdEditor.setConfig({ pomodoroFocusMinutes: configBefore.pomodoroFocusMinutes, pomodoroBreakMinutes: configBefore.pomodoroBreakMinutes });
  }

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
  {
    const H = window.mdHome;
    const cm = window.mdCodeMirror;
    const doc = cm.getDoc();
    const content = cm.getValue();
    const cursorBefore = cm.getCursor();
    await H.open();
    document.getElementById('home-today').click();
    H.setMode('day');
    const workspaceOk = document.body.classList.contains('home-active') && document.querySelector('.container').inert &&
      !document.getElementById('home-panel').classList.contains('modal-overlay') && !!document.querySelector('.home-agenda');
    const model = H.getData();
    const before = model.tasks.slice();
    const count = model.tasks.length;
    document.getElementById('home-add-task').click();
    const draft = document.querySelector('.home-editor');
    const draftOk = !!draft && !draft.querySelector('.home-create-advanced').open && model.tasks.length === count;
    Array.from(draft.querySelectorAll('button')).find((button) => button.textContent === 'Cancelar').click();
    const cancelOk = model.tasks.length === count;
    document.getElementById('home-add-task').click();
    const create = document.querySelector('.home-editor');
    const title = `Agenda UX ${Date.now()}`;
    create.querySelector('input').value = title;
    const date = create.querySelector('input[type="date"]').value;
    Array.from(create.querySelectorAll('button')).find((button) => button.textContent === 'Crear tarea').click();
    const created = model.tasks.find((task) => task.title === title);
    const card = () => Array.from(document.querySelectorAll('.home-agenda .home-task')).find((node) => node.textContent.includes(title));
    const createdOk = !!created && created.date === date && !!card();
    card().querySelector('input[type="checkbox"]').click();
    const group = document.querySelector('.home-agenda .home-completed');
    const doneOk = created.done && !!group && !group.open && !document.getElementById('home-feedback').hidden;
    document.querySelector('#home-feedback button').click();
    const undoDone = !created.done;
    card().querySelector('button[title="Pasar a mañana"]').click();
    const moved = created.date !== date;
    created.notes = 'Nota posterior que debe conservarse';
    document.querySelector('#home-feedback button').click();
    const undoMove = created.date === date && created.notes === 'Nota posterior que debe conservarse';
    const recurring = { id: `agenda-repeat-${Date.now()}`, title: 'Repetición de prueba', date, priority: 'media', repeat: { freq: 'daily' }, category: 'universidad', time: '10:00', duration: 90 };
    model.tasks.push(recurring);
    H.setMode('day');
    const recurringCard = Array.from(document.querySelectorAll('.home-agenda .home-task')).find((node) => node.textContent.includes(recurring.title));
    recurringCard.querySelector('button[title="Pasar a mañana"]').click();
    const detached = model.tasks.find((task) => task.title === recurring.title && task.id !== recurring.id);
    const detachedOk = detached && detached.category === recurring.category && detached.duration === 90;
    document.querySelector('#home-feedback button').click();
    const undoRepeat = !model.tasks.some((task) => task.id === detached?.id) && !recurring.skipDates;
    model.tasks = before;
    await window.mdEditor.homeSave(model, H.dataLocation());
    H.close();
    const returnOk = !document.body.classList.contains('home-active') && !document.querySelector('.container').inert &&
      cm.getDoc() === doc && cm.getValue() === content && JSON.stringify(cm.getCursor()) === JSON.stringify(cursorBefore);
    check('Home: vista principal, creación sin borradores persistidos y vuelta al documento', workspaceOk && draftOk && cancelOk && createdOk && returnOk,
      `vista=${workspaceOk} borrador=${draftOk} cancelar=${cancelOk} crear=${createdOk} volver=${returnOk}`);
    check('Home: completadas plegables y deshacer conserva cambios posteriores y recurrencias', doneOk && undoDone && moved && undoMove && detachedOk && undoRepeat,
      `completada=${doneOk} deshacer=${undoDone} mover=${moved} posterior=${undoMove} desprendida=${!!detachedOk} serie=${undoRepeat}`);
    H.setMode('week');
  }

  {
    const tools = document.getElementById('tools-menu');
    const trigger = document.getElementById('btn-tools');
    trigger.click();
    const opens = !tools.hidden && tools.contains(document.getElementById('btn-plugins'));
    window.mdToolbarStyle.applyLabels('icons');
    const readable = getComputedStyle(document.querySelector('#btn-plugins .tb-label')).display !== 'none';
    tools.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const closes = tools.hidden && document.activeElement === trigger;
    window.mdToolbarStyle.applyLabels('mixed');
    const width = document.getElementById('reading-width-select');
    const before = width.value;
    width.value = 'compact';
    width.dispatchEvent(new Event('change'));
    const persisted = (await window.mdEditor.getConfig()).readingWidth === 'compact';
    const applied = getComputedStyle(document.getElementById('preview-pane')).maxWidth === '720px';
    width.value = before;
    width.dispatchEvent(new Event('change'));
    check('Apariencia: herramientas accesibles y ancho de lectura persistente', opens && readable && closes && persisted && applied,
      `abre=${opens} etiquetas=${readable} escape=${closes} persiste=${persisted} ancho=${applied}`);
  }

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
    .find((row) => row.querySelector('label').textContent === 'Plugins')
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

    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(gitRepoDir));
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
    await window.mdPdfHighlight.open();
    window.mdPdfHighlight.setMode('text');
    const formatVisible = !document.getElementById('pdfhighlight-text-options').hidden && document.querySelector('.pdfhighlight-selection-actions').hidden;
    window.mdPdfHighlight.setMode('select');
    const formatHidden = document.getElementById('pdfhighlight-text-options').hidden && !document.querySelector('.pdfhighlight-selection-actions').hidden;
    const jump = document.getElementById('pdfhighlight-page-input');
    jump.value = '2'; jump.dispatchEvent(new Event('change'));
    await waitFor(() => window.mdPdfHighlight.getState().pageNum === 2 && window.mdPdfHighlight.getState().pageReady);
    const jumped = window.mdPdfHighlight.getState().pageNum === 2;
    jump.value = '999'; jump.dispatchEvent(new Event('change'));
    const bounded = window.mdPdfHighlight.getState().pageNum === 2 && jump.value === '2';
    const zoom = document.getElementById('pdfhighlight-zoom');
    zoom.value = '1.5'; zoom.dispatchEvent(new Event('change'));
    await waitFor(() => window.mdPdfHighlight.getState().pageReady);
    const zoomed = window.mdPdfHighlight.getState().zoom === '1.5' && document.getElementById('pdfhighlight-canvas').width === 600;
    zoom.value = 'fit'; zoom.dispatchEvent(new Event('change'));
    await window.mdPdfHighlight.goToPage(1);
    check('PDF: formato contextual, salto de página válido y zoom', formatVisible && formatHidden && jumped && bounded && zoomed,
      `texto=${formatVisible} selección=${formatHidden} página=${jumped} límites=${bounded} zoom=${zoomed}`);
    const stateBefore = window.mdPdfHighlight.getState();
    window.mdPdfHighlight.addHighlightForTest(0.1, 0.4, 0.5, 0.08);
    const stateAfter = window.mdPdfHighlight.getState();
    const noteBeforePdfSave = window.mdCodeMirror.getValue();
    document.getElementById('pdfhighlight-canvas').dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
    await waitFor(() => window.mdPdfHighlight.getState().savedPath);
    const savedPath = window.mdPdfHighlight.getState().savedPath;
    let reopenedOk = false;
    if (savedPath) {
      const base64 = await window.mdEditor.pdfReadBytes(savedPath);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const reopened = await PDFLib.PDFDocument.load(bytes);
      reopenedOk = reopened.getPageCount() === 3;
    }

    const feedbackOk = document.getElementById('pdfhighlight-save-status').dataset.state === 'saved' && !window.mdPdfHighlight.getState().unsaved;
    pdfHighlightOk = stateBefore.highlightCount === 0 && stateAfter.highlightCount === 1 && reopenedOk && feedbackOk && window.mdCodeMirror.getValue() === noteBeforePdfSave;
    window.mdPdfHighlight.close();
    pdfHighlightDetail = `antes=${stateBefore.highlightCount} despues=${stateAfter.highlightCount} guardadoOk=${reopenedOk}`;
  }
  check('Subrayar texto en PDF: agrega un rectángulo y lo hornea al guardar', pdfHighlightOk, pdfHighlightDetail);

  // Escribir en PDF: clic en modo "Escribir" crea un cuadro; el texto (con
  // acentos y ñ) y los campos del formulario quedan de verdad en el PDF.
  let pdfWriteOk = false;
  let pdfWriteDetail = 'sin fixturesDir';
  if (fixturesDir) {
    await window.mdPdfHighlight.open();
    const confirmPdf = window.confirm;
    window.confirm = () => true;
    await window.mdPdfHighlight.loadFromPath(window.mdEditor.joinPath(fixturesDir, 'formulario.pdf'));
    window.confirm = confirmPdf;
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

  // Selección PDF, referencia a página, texto girado y páginas sin OCR.
  if (fixturesDir) {
    const originalConfirmPdf = window.confirm;
    const originalAlertPdf = window.alert;
    window.confirm = () => true;
    window.alert = () => {};
    try {
      const selectedPdf = window.mdEditor.joinPath(fixturesDir, 'selección (PDF)#.pdf');
      await window.mdPdfHighlight.loadFromPath(selectedPdf);
      await window.mdPdfHighlight.open();
      window.mdPdfHighlight.setMode('select');
      const selectOriginal = () => {
        const span = document.querySelector('.pdf-select-text-layer span');
        const range = document.createRange();
        range.selectNodeContents(span);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event('selectionchange'));
        return span;
      };
      const span = selectOriginal();
      const rect = span.getBoundingClientRect();
      check('PDF: texto original seleccionable con capa alineada y acciones de copia', window.mdPdfHighlight.getState().selectedText === 'Selección para una nota' && rect.width > 0 && rect.height > 0 && !document.getElementById('pdfhighlight-copy').disabled);
      const beforeHighlights = window.mdPdfHighlight.getState().highlightCount;
      document.getElementById('pdfhighlight-canvas').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
      window.dispatchEvent(new MouseEvent('mouseup'));
      check('PDF: seleccionar no crea subrayados', window.mdPdfHighlight.getState().highlightCount === beforeHighlights);
      await window.mdPdfHighlight.goToPage(2);
      const rotatedSpan = selectOriginal();
      const rotatedRect = rotatedSpan.getBoundingClientRect();
      const canvasRect = document.getElementById('pdfhighlight-canvas').getBoundingClientRect();
      check('PDF: texto girado seleccionable dentro de la página', rotatedSpan.textContent.includes('página dos') && rotatedRect.left >= canvasRect.left - 2 && rotatedRect.right <= canvasRect.right + 2 && rotatedRect.top >= canvasRect.top - 2 && rotatedRect.bottom <= canvasRect.bottom + 2);
      document.getElementById('pdfhighlight-new-note').click();
      const fragment = window.mdCodeMirror.getValue();
      check('PDF: crear nota conserva cita, página y ruta con espacios/acentos/#', fragment.includes('> Texto girado página dos') && fragment.includes('%23.pdf#page=2') && window.mdTabs.getActiveState().modified && document.getElementById('pdfhighlight-panel').hidden);
      window.renderPreview();
      const link = document.querySelector('#preview-pane a[href*="#page=2"]');
      link.click();
      await waitFor(() => !document.getElementById('pdfhighlight-panel').hidden && window.mdPdfHighlight.getState().pageNum === 2 && window.mdPdfHighlight.getState().pageReady);
      check('PDF: enlace de una nota vuelve a la página original', window.mdPdfHighlight.getState().sourcePath === selectedPdf && window.mdPdfHighlight.getState().pageNum === 2);
      selectOriginal();
      document.getElementById('pdfhighlight-add-note').click();
      check('PDF: añadir al final de nota abierta preserva su contenido anterior', window.mdCodeMirror.getValue().startsWith(fragment) && window.mdCodeMirror.getValue().length > fragment.length);
      window.mdModes.setLayoutMode('live');
      window.mdCodeMirror.setCursor({ line: 0, ch: 0 });
      await waitFor(() => document.querySelector('.mk-live-pdf-link'));
      document.querySelector('.mk-live-pdf-link').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
      await waitFor(() => !document.getElementById('pdfhighlight-panel').hidden && window.mdPdfHighlight.getState().pageNum === 2 && window.mdPdfHighlight.getState().pageReady);
      check('PDF: cita en Live Preview abre su página original', window.mdPdfHighlight.getState().sourcePath === selectedPdf && window.mdPdfHighlight.getState().pageNum === 2 && !document.getElementById('pdfhighlight-panel').hidden);
      window.mdModes.setLayoutMode('normal');
      await window.mdPdfHighlight.open();
      await window.mdPdfHighlight.goToPage(3);
      check('PDF: página sin texto explica falta de OCR y desactiva acciones', !window.mdPdfHighlight.getState().pageHasText && document.getElementById('pdfhighlight-new-note').disabled && document.getElementById('pdfhighlight-selection-info').textContent.includes('OCR'));
      await Promise.all([window.mdPdfHighlight.goToPage(2), window.mdPdfHighlight.goToPage(1)]);
      check('PDF: cambios rápidos de página conservan solo el último render y su selección', window.mdPdfHighlight.getState().pageNum === 1 && document.querySelector('.pdf-select-text-layer').textContent.includes('Selección para una nota'));
      let deniedAlert = false;
      window.alert = () => { deniedAlert = true; };
      await window.mdPdfHighlight.openLink('md-local://file/etc/no-autorizado.pdf#page=1', null);
      check('PDF: referencias no conceden acceso a rutas no autorizadas', deniedAlert && window.mdPdfHighlight.getState().sourcePath === selectedPdf);
      window.alert = () => {};
      check('PDF: referencias externas no se interceptan como archivos locales', await window.mdPdfHighlight.openLink('https://example.com/archivo.pdf#page=2', null) === false);
      window.mdPdfHighlight.addHighlightForTest(0.1, 0.1, 0.2, 0.1);
      window.confirm = () => false;
      const rejected = await window.mdPdfHighlight.loadFromPath(fixturePdfPath);
      check('PDF: cancelar cambio de archivo preserva anotaciones sin guardar', rejected === false && window.mdPdfHighlight.getState().sourcePath === selectedPdf && window.mdPdfHighlight.getState().highlightCount === 1);
      window.mdPdfHighlight.close();
    } finally { window.confirm = originalConfirmPdf; window.alert = originalAlertPdf; }
  }

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
    check('Home: día actual y campo para añadir tareas identificados',
      input.hasAttribute('aria-label') && input.closest('.home-day').getAttribute('aria-current') === 'date');
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
  {
    window.mdTabs.newTab('# Primera\n\ntexto');
    const first = document.querySelector('#tabbar .tab.active');
    window.mdModes.setLayoutMode('live');
    check('Live Preview: libera el DOM de lectura oculto sin perder la nota', window.mdPreview.isStale() && !document.getElementById('preview-pane').childNodes.length && window.mdCodeMirror.getValue().includes('Primera'));
    const before = window.mdLivePreview.metrics().rebuilds;
    window.mdTabs.newTab('# Segunda\n\ntexto');
    const onlyOnce = window.mdLivePreview.metrics().rebuilds - before === 1;
    const deferred = window.mdPreview.isStale();
    window.mdModes.setLayoutMode('normal');
    const refreshed = !window.mdPreview.isStale() && document.getElementById('preview-pane').textContent.includes('Segunda');
    check('Pestañas: preview oculto diferido y actualizado al volver al modo normal', deferred && refreshed);
    first.click();
    const normalRestored = window.mdCodeMirror.getOption('mode') === 'markdown' && !window.mdCodeMirror.getWrapperElement().classList.contains('cm-live');
    check('Pestañas CM6: Live Preview se construye una vez y restaura el modo normal de otra pestaña', onlyOnce && normalRestored, `unaVez=${onlyOnce} normal=${normalRestored}`);
    document.querySelector('#tabbar .tab.active .tab-close').click();
    document.querySelector('#tabbar .tab.active .tab-close').click();
  }

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
    const lineText = (n) => document.querySelectorAll('#editor-pane .CodeMirror-line, #editor-pane .cm-line')[n];
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
      document.getElementById('home-today').click(); // aislar de la semana seleccionada por pruebas anteriores
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
    const mermaidOk = !!(await waitFor(() => document.querySelector('.cm-live .mk-live-mermaid svg'), 10000));
    const mermaidError = mermaidOk ? '' : document.querySelector('.cm-live .mk-live-mermaid')?.textContent || 'widget ausente';
    window.mdModes.setLayoutMode('normal');
    const originalConfirm2 = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm2;

    variosOk = rangeOk && copyOk && renameTabOk && multiSortOk && tomorrowOk && calloutOk && mermaidOk;
    variosDetail = `shiftRango=${rangeOk} copiarRuta=${copyOk} renombrarTerminal=${renameTabOk} ordenMultiple=${multiSortOk}(${names()} ${arrows}) manana=${tomorrowOk} callout=${calloutOk} mermaid=${mermaidOk}${mermaidError ? ` (${mermaidError})` : ''}`;
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

  if (fixturesDir) {
    const conflictPath = window.mdEditor.joinPath(fixturesDir, 'conflicto.md');
    async function prepareConflict() {
      await window.mdEditor.saveFile('original\n', conflictPath, false);
      await window.mdTabs.openTab(conflictPath);
      await window.mdTabs.syncActiveWithDisk();
      window.mdCodeMirror.setValue('mis cambios <img src=x onerror=alert(1)>\n');
      await window.mdEditor.saveFile('versión externa\n', conflictPath, false);
    }
    async function choose(action) {
      const saving = window.mdTabs.saveActive(false);
      const button = await waitFor(() => document.querySelector(`[data-conflict-action="${action}"]`));
      if (!button) throw new Error('No apareció el diálogo de conflicto');
      button.click();
      await saving;
    }
    await prepareConflict();
    const pending = window.mdTabs.saveActive(false);
    const overlay = await waitFor(() => document.querySelector('.conflict-overlay'));
    await window.mdTabs.saveActive(false);
    check('Conflictos: guardar otra vez no duplica el diálogo', document.querySelectorAll('.conflict-overlay').length === 1);

    check('Conflictos: comparación de texto sin interpretar HTML', overlay &&
      overlay.querySelectorAll('pre').length === 2 && !overlay.querySelector('img') &&
      overlay.textContent.includes('versión externa') && overlay.textContent.includes('mis cambios'));
    overlay.querySelector('[data-conflict-action="cancel"]').click();
    await pending;
    check('Conflictos: cancelar conserva cambios y disco, con autoguardado pausado',
      window.mdTabs.getActiveState().conflict && window.mdCodeMirror.getValue().startsWith('mis cambios') &&
      (await window.mdEditor.readFile(conflictPath)).content === 'versión externa\n');
    await choose('keep');
    const copy = window.mdTabs.getActiveTabInfo();
    check('Conflictos: conservar ambas crea borrador y deja intacto el disco',
      copy.filePath === null && copy.modified && copy.content.startsWith('mis cambios') &&
      (await window.mdEditor.readFile(conflictPath)).content === 'versión externa\n');
    await window.mdTabs.openTab(conflictPath);
    check('Conflictos: la pestaña original muestra la versión externa',
      window.mdCodeMirror.getValue() === 'versión externa\n' && !window.mdTabs.getActiveState().conflict);
    await prepareConflict();
    await choose('reload');
    check('Conflictos: usar disco recarga y limpia el estado de cambios',
      window.mdCodeMirror.getValue() === 'versión externa\n' && !window.mdTabs.getActiveState().modified);
    await prepareConflict();
    await choose('overwrite');
    check('Conflictos: sobrescribir guarda la versión local',
      (await window.mdEditor.readFile(conflictPath)).content.startsWith('mis cambios') &&
      !window.mdTabs.getActiveState().conflict);
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

    const saving = window.mdTabs.saveActive();
    const overwrite = await waitFor(() => document.querySelector('[data-conflict-action="overwrite"]'));
    const asked = !!overwrite;
    if (!overwrite) throw new Error('Cambio externo: no apareció el diálogo de conflicto');
    overwrite.click();
    await saving;
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
    // Editar en el lugar: renombrar la primera fila y tildarla como leída
    // (sale de la vista "Pendientes" al redibujarse).
    const firstName = embeds[0].querySelector('table.db-embed-table tr:nth-child(2) td.db-embed-editable');
    firstName.click();
    const nameInput = firstName.querySelector('input');
    nameInput.value = 'Ficciones (ed. 1944)';
    nameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await waitFor(async () => (await window.mdEditor.db.listRows(fixturesDir, edb.id)).some((row) => row.cells[eName.id] === 'Ficciones (ed. 1944)'));
    const renamedOk = (await window.mdEditor.db.listRows(fixturesDir, edb.id)).some((row) => row.cells[eName.id] === 'Ficciones (ed. 1944)');
    const box = await waitFor(() => embeds[0].querySelector('table.db-embed-table tr:nth-child(2) input[type="checkbox"]'));
    const xpBefore = window.mdPet.info().xp;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    const leftView = await waitFor(() => !embeds[0].textContent.includes('Ficciones') && embeds[0].querySelectorAll('table.db-embed-table tr').length - 1 === 2, 3000);
    const petOk = window.mdPet.info().xp === xpBefore + 10; // tildar una fila da XP a la mascota
    const editOk = renamedOk && !!leftView && petOk;
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
    embedOk = bodyRows === 2 && moreText.includes('1 fila') && chartOk && errOk && editOk && !!opened && liveOk;
    embedDetail = `filas=${bodyRows} "${moreText}" grafico=${chartOk} error=${errOk} editar=${editOk}(mascota=${typeof petOk === 'undefined' ? '-' : petOk}) abrir=${!!opened} live=${liveOk}`;
  }
  check('Base de datos dentro de una nota: vista con filtros, gráfico, límite de filas, error claro, editar en el lugar, Abrir y Live Preview', embedOk, embedDetail);

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
    const remindSel = Array.from(editor.querySelectorAll('select')).find((s) => s.dataset.field !== 'duration' && Array.from(s.options).some((o) => o.value === '15'));
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

  // Errores visibles y registrados: guardar donde no se puede devuelve null
  // (no revienta) y muestra un aviso que apunta al log; un home.json dañado
  // se aparta (queda como .corrupt-…) en vez de pisarse con uno vacío.
  {
    let detail = 'sin fixturesDir';
    let ok = false;
    if (fixturesDir) {
      const J = window.mdEditor.joinPath;
      const bad = await window.mdEditor.saveFile('x', J(fixturesDir, 'no-existe-esta-carpeta', 'nota.md'), false);
      const toast = await waitFor(() => Array.from(document.querySelectorAll('.app-error-toast')).find((t) => t.textContent.includes('No se pudo guardar nota.md')));
      const logOk = !!toast && toast.textContent.includes('mk.log');
      document.querySelectorAll('.app-error-toast').forEach((t) => t.remove());
      const hroot = J(fixturesDir, 'home-danado');
      await window.mdEditor.createFolder(fixturesDir, 'home-danado');
      await window.mdEditor.createFolder(hroot, '.mk');
      await window.mdEditor.saveFile('{ esto no es json', J(hroot, '.mk', 'home.json'), false);
      const loaded = await window.mdEditor.homeLoad(hroot);
      const original = await window.mdEditor.readFile(J(hroot, '.mk', 'home.json'));
      ok = bad === null && !!toast && logOk && loaded === null && original === null;
      detail = `guardarDevuelveNull=${bad === null} aviso=${!!toast} log=${logOk} homeDañadoApartado=${loaded === null && original === null}`;
    }
    check('Errores: guardar sin poder avisa (con el log) sin romper, y un JSON dañado se aparta en vez de pisarse', ok, detail);
  }

  // Ajustes y barra: panel con secciones y buscador, Ctrl+, / Esc; botones
  // solo íconos / con texto; auto-ocultar; el botón de modo dice el modo;
  // punto de "sin guardar" en el sidebar.
  {
    const overlay = document.getElementById('settings-overlay');
    document.getElementById('btn-settings').click();
    const opened = !overlay.hidden && document.activeElement === document.getElementById('settings-search');
    overlay.querySelector('.set-nav-btn[data-section="terminal"]').click();
    const sectionOk = !overlay.querySelector('.set-section[data-section="terminal"]').hidden && overlay.querySelector('.set-section[data-section="editor"]').hidden;
    const search = document.getElementById('settings-search');
    search.value = 'tabulacion'; // sin tilde: igual encuentra "Tabulación"
    search.dispatchEvent(new Event('input'));
    const visibleRows = Array.from(overlay.querySelectorAll('.set-row')).filter((r) => !r.hidden && !r.closest('.set-section').hidden);
    const searchOk = visibleRows.length === 1 && visibleRows[0].textContent.includes('Tabulación');
    search.value = 'zzzz nada';
    search.dispatchEvent(new Event('input'));
    const emptyOk = !document.getElementById('settings-empty').hidden;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const closedOk = overlay.hidden;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }));
    const ctrlCommaOk = !overlay.hidden;
    window.mdSettingsPanel.close();

    const lbl = (id) => document.querySelector(`#${id} .tb-label`);
    const visible = (el) => !!el && getComputedStyle(el).display !== 'none';
    window.mdToolbarStyle.applyLabels('icons');
    const iconsOk = !visible(lbl('btn-open')) && !visible(lbl('btn-terminal'));
    window.mdToolbarStyle.applyLabels('text');
    const textOk = visible(lbl('btn-open')) && visible(lbl('btn-terminal')) && lbl('btn-terminal').textContent === 'Terminal';
    window.mdToolbarStyle.applyLabels('mixed');
    const mixedOk = visible(lbl('btn-open')) && !visible(lbl('btn-terminal'));
    await window.mdToolbarStyle.setAutohide(true);
    const hiddenOk = document.body.classList.contains('toolbar-autohide');
    await window.mdToolbarStyle.setAutohide(false);

    window.mdModes.setLayoutMode('read');
    const modeLabel = document.querySelector('#btn-focus .mode-label');
    const modeOk = !!modeLabel && modeLabel.textContent === 'Lectura' && document.getElementById('btn-focus').dataset.mode === 'read';
    window.mdModes.setLayoutMode('normal');

    const shortOk = Array.from(document.querySelectorAll('.toolbar-buttons-settings-row label')).some((l) => l.textContent === 'Modo de vista');

    let dotOk = false;
    if (fixturesDir) {
      const p = window.mdEditor.joinPath(fixturesDir, 'punto-sin-guardar.md');
      await window.mdEditor.saveFile('# hola\n', p, false);
      window.mdSidebar.renderFolder(await window.mdEditor.readFolder(fixturesDir));
      await window.openFileAtPath(p);
      window.mdCodeMirror.replaceRange('x', { line: 0, ch: 0 });
      const row = () => Array.from(document.querySelectorAll('.tree-row')).find((r) => r.textContent.trim() === 'punto-sin-guardar.md');
      const dotOn = !!(await waitFor(() => row() && row().classList.contains('tree-row-unsaved'), 2000));
      await window.mdTabs.saveActive();
      const dotOff = !row().classList.contains('tree-row-unsaved');
      dotOk = dotOn && dotOff;
    }
    check('Ajustes y barra: panel con secciones y buscador (Ctrl+, / Esc), íconos/texto/mixto, auto-ocultar, botón de modo con nombre, punto de sin guardar',
      opened && sectionOk && searchOk && emptyOk && closedOk && ctrlCommaOk && iconsOk && textOk && mixedOk && hiddenOk && modeOk && shortOk && dotOk,
      `abre=${opened} sección=${sectionOk} buscar=${searchOk} vacío=${emptyOk} esc=${closedOk} ctrl,=${ctrlCommaOk} íconos=${iconsOk} texto=${textOk} mixto=${mixedOk} ocultar=${hiddenOk} modo=${modeOk} nombreCorto=${shortOk} punto=${dotOk}`);
  }

  // Más lenguajes: comandos de F5 (Rust, TypeScript, Makefile...) y resaltado
  // que se carga al abrir el archivo (Rust necesita además el "simple mode").
  {
    const T = window.mdTerminal;
    const rsCmd = T.commandForFile('/tmp/a b/main.rs');
    const tsCmd = T.commandForFile('/tmp/x.ts');
    const mkCmd = T.commandForFile('/tmp/proj/Makefile');
    const cmdsOk = rsCmd.includes("rustc '/tmp/a b/main.rs' -o") && tsCmd.includes('tsx') && mkCmd === "cd '/tmp/proj' && make" && !!T.commandForFile('/tmp/q.sql');
    let hlOk = 'sin fixtures';
    if (fixturesDir) {
      const rs = window.mdEditor.joinPath(fixturesDir, 'hola.rs');
      await window.mdEditor.saveFile('fn main() {\n    let x = 5;\n    println!("{}", x);\n}\n', rs, false);
      await window.openFileAtPath(rs);
      const kw = await waitFor(() => document.querySelector('#editor-pane .cm-keyword'), 4000);
      const info = window.mdTabs.getActiveTabInfo();
      hlOk = !!kw && window.mdTabs.isActiveTabCode() && (window.mdCM6 ? !!window.mdCM6.legacyModes.rust : typeof CodeMirror.modes.rust === 'function');
      const php = window.mdEditor.joinPath(fixturesDir, 'x.php');
      await window.mdEditor.saveFile('<?php echo "hola"; ?>\n', php, false);
      await window.openFileAtPath(php);
      const phpOk = !!(await waitFor(() => (window.mdCM6 ? window.mdCM6.php : CodeMirror.modes.php) && document.querySelector('#editor-pane .cm-keyword'), 4000));
      hlOk = hlOk && phpOk && !!info;
    }
    const dbg = `motor=${window.mdCM6 ? 'CM6' : 'CM5'} tab=${(window.mdTabs.getActiveTabInfo() || {}).filePath} opt=${window.mdCodeMirror.getOption('mode')} csp=${(window.__mkCspViolations || []).slice(-2).join(';')}`;
    check('Más lenguajes: F5 para Rust/TypeScript/SQL/Makefile y resaltado cargado al abrir (Rust, PHP)', cmdsOk && hlOk === true,
      `comandos=${cmdsOk} (${rsCmd} | ${mkCmd}) resaltado=${hlOk} ${hlOk === true ? '' : dbg}`);
  }

  // Bases de datos: escrituras agrupadas — 30 cambios seguidos escriben el
  // archivo una sola vez (y los datos en memoria están al día al instante).
  if (fixturesDir) {
    const db = window.mdEditor.db;
    const base = await db.createDatabase(fixturesDir, 'Agrupada');
    const [col] = await db.listColumns(fixturesDir, base.id);
    await new Promise((r) => setTimeout(r, 450));
    const w0 = (await db.writeStats()).writes;
    for (let i = 0; i < 30; i++) await db.createRow(fixturesDir, base.id, { [col.id]: `fila ${i}` });
    const rowsNow = (await db.listRows(fixturesDir, base.id)).length;
    const pendingOk = (await db.writeStats()).pending === 1;
    await new Promise((r) => setTimeout(r, 500));
    const w1 = (await db.writeStats()).writes;
    await db.deleteDatabase(fixturesDir, base.id);
    check('Bases de datos: 30 cambios seguidos → una sola escritura del archivo, datos al día al instante', rowsNow === 30 && pendingOk && w1 - w0 === 1,
      `filas=${rowsNow} pendiente=${pendingOk} escrituras=${w1 - w0}`);
  }

  // Barra de estado: palabras (y de la selección), estado de guardado y rama
  // de git de la carpeta abierta.
  {
    const cm = window.mdCodeMirror;
    window.mdTabs.newTab('Hola mundo, esto son seis palabras');
    await new Promise((r) => setTimeout(r, 250));
    const words = document.getElementById('status-words').textContent;
    cm.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 10 });
    await new Promise((r) => setTimeout(r, 250));
    const selWords = document.getElementById('status-words').textContent;
    const wordsOk = words.startsWith('6 palabras') && selWords.startsWith('Selección: 2 palabras') && window.mdStatusBar.countWords("l'agua va-y-viene") === 2;
    cm.replaceRange('x', { line: 0, ch: 0 });
    window.mdStatusBar.updateSave();
    const saveOk = document.getElementById('status-save').textContent.includes('Sin guardar');
    let gitOk = 'sin repo';
    if (gitRepoDir) {
      window.mdSidebar.renderFolder(await window.mdEditor.readFolder(gitRepoDir));
      await window.mdStatusBar.updateGit();
      const g = document.getElementById('status-git');
      gitOk = !g.hidden && /^⎇ \S+/.test(g.textContent);
    }
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    const active = document.querySelector('#tabbar .tab.active .tab-close');
    if (active) active.click();
    window.confirm = originalConfirm;
    check('Barra de estado: palabras (y de la selección), estado de guardado y rama de git', wordsOk && saveOk && gitOk === true,
      `palabras="${words}" selección="${selWords}" guardado=${saveOk} git=${gitOk}`);
  }

  // Accesibilidad: botones de símbolo con nombre, pestañas y árbol con roles
  // y flechas, diálogo que atrapa el foco y lo devuelve, menú con teclado.
  {
    const sym = document.getElementById('terminal-split');
    const labelOk = sym.getAttribute('aria-label') && sym.getAttribute('aria-label').startsWith('Dividir');
    const tabOk = document.getElementById('tabbar').getAttribute('role') === 'tablist' && !!document.querySelector('#tabbar .tab[role="tab"][aria-selected="true"]');
    let treeOk = 'sin fixtures';
    if (fixturesDir) {
      window.mdSidebar.renderFolder(await window.mdEditor.readFolder(fixturesDir));
      const rows = Array.from(document.querySelectorAll('#sidebar-pane .tree-row[role="treeitem"]')).filter((r) => !r.closest('ul.collapsed'));
      rows[0].focus();
      rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      treeOk = document.querySelector('[role="tree"]') !== null && document.activeElement === rows[1];
    }
    const opener = document.getElementById('btn-settings');
    opener.focus();
    window.mdSettingsPanel.open();
    await new Promise((r) => setTimeout(r, 200));
    const overlay = document.getElementById('settings-overlay');
    const box = overlay.firstElementChild;
    const dialogOk = box.getAttribute('role') === 'dialog' && box.getAttribute('aria-modal') === 'true';
    // Tab desde el último elemento vuelve al primero (no se escapa).
    const focusables = Array.from(box.querySelectorAll('button:not([disabled]), input:not([disabled]):not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
    focusables[focusables.length - 1].focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    const trapOk = overlay.contains(document.activeElement);
    window.mdSettingsPanel.close();
    await new Promise((r) => setTimeout(r, 200));
    const returnOk = document.activeElement === opener;
    const exportBtn = document.getElementById('btn-export');
    const menuOk = exportBtn.getAttribute('aria-haspopup') === 'menu' && document.getElementById('export-menu').getAttribute('role') === 'menu';
    check('Accesibilidad: botones con nombre, pestañas y árbol con roles y flechas, diálogo atrapa y devuelve el foco, menús con roles',
      labelOk && tabOk && treeOk === true && dialogOk && trapOk && returnOk && menuOk,
      `botón=${labelOk} pestañas=${tabOk} árbol=${treeOk} diálogo=${dialogOk} atrapa=${trapOk} devuelve=${returnOk} menú=${menuOk}`);
  }

  // Módulos: apagar Terminal oculta sus botones, lo saca de la paleta y del
  // menú del sidebar y frena sus atajos; prenderlo lo devuelve.
  {
    const M = window.mdModules;
    await M.setModule('terminal', false);
    const btnHidden = getComputedStyle(document.getElementById('btn-terminal')).display === 'none' && getComputedStyle(document.getElementById('btn-run-file')).display === 'none';
    const paletteOk = !M.allowsCommand('Terminal: mostrar/ocultar') && M.allowsCommand('Guardar');
    const panel = document.getElementById('terminal-panel');
    const wasHidden = panel.hidden;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '`', code: 'Backquote', ctrlKey: true, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '`', code: 'Backquote', ctrlKey: true, bubbles: true, cancelable: true }));
    const keyOk = panel.hidden === wasHidden;
    const settingsOk = !!document.getElementById('module-terminal') && !document.getElementById('module-terminal').checked;
    await M.setModule('terminal', true);
    const backOk = getComputedStyle(document.getElementById('btn-terminal')).display !== 'none' && M.allowsCommand('Terminal: mostrar/ocultar');
    check('Módulos: apagar oculta botones, saca de la paleta, frena atajos y se vuelve a prender', btnHidden && paletteOk && keyOk && settingsOk && backOk,
      `botones=${btnHidden} paleta=${paletteOk} atajo=${keyOk} ajustes=${settingsOk} vuelve=${backOk}`);
  }

  // Grafo interactivo: etiquetas y carpetas en los nodos, filtros, "solo
  // vecinas" y menú de clic derecho.
  if (fixturesDir) {
    const J = window.mdEditor.joinPath;
    const gdir = J(fixturesDir, 'grafo-test');
    await window.mdEditor.createFolder(fixturesDir, 'grafo-test');
    await window.mdEditor.createFolder(gdir, 'sub');
    await window.mdEditor.saveFile('# A\n#viaje ver [[B]] y [[C]]\n', J(gdir, 'GA.md'), false);
    await window.mdEditor.saveFile('# B\n[[GA]]\n', J(gdir, 'B.md'), false);
    await window.mdEditor.saveFile('# C\n#viaje\n', J(gdir, 'sub', 'C.md'), false);
    await window.mdEditor.saveFile('# Suelta\n', J(gdir, 'Suelta.md'), false);
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(gdir));
    await window.mdGraph.open();
    const G = window.mdGraph;
    const all = G.getVisible().length;
    G.setFilters({ tag: 'viaje' });
    const byTag = G.getVisible().sort().join(',');
    G.setFilters({ tag: '', folder: 'sub' });
    const byFolder = G.getVisible().join(',');
    G.setFilters({ folder: '', hideOrphans: true });
    const noOrphans = !G.getVisible().includes('Suelta');
    G.setFilters({ hideOrphans: false, focus: 'B' });
    const focus = G.getVisible().sort().join(',');
    G.setFilters({ focus: null });
    const neigh = G.neighborsOf('GA').sort().join(',');
    // Menú de clic derecho sobre un nodo (en su posición en pantalla).
    const canvas = document.getElementById('graph-canvas');
    const node = G.getData().nodes.find((n) => n.id === 'GA');
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: rect.left + node.x * rect.width / canvas.width, clientY: rect.top + node.y * rect.height / canvas.height }));
    const menu = document.querySelector('.graph-menu');
    const menuOk = !!menu && menu.textContent.includes('Abrir en el panel secundario') && menu.textContent.includes('backlinks');
    if (menu) menu.remove();
    G.close();
    check('Grafo interactivo: filtros por etiqueta y carpeta, ocultar sueltas, solo vecinas y menú de clic derecho',
      all === 4 && byTag === 'C,GA' && byFolder === 'C' && noOrphans && focus === 'B,GA' && neigh === 'B,C' && menuOk,
      `todas=${all} etiqueta=${byTag} carpeta=${byFolder} sinSueltas=${noOrphans} vecinas=${focus} vecinosGA=${neigh} menú=${menuOk}`);
  }

  // Widgets en notas: tareas de hoy (tildables), progreso, total de una base,
  // mascotas y error claro si el tipo no existe.
  if (fixturesDir) {
    window.mdState.rootFolder = fixturesDir;
    const stamp = Date.now();
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const qa = await waitFor(() => document.querySelector('#home-main .home-day.home-today .home-quick-add'));
    qa.value = `Widget ${stamp}`;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    window.mdHome.close();
    const wdb = await window.mdEditor.db.createDatabase(fixturesDir, 'Widget Gastos');
    const [wName] = await window.mdEditor.db.listColumns(fixturesDir, wdb.id);
    const wMonto = await window.mdEditor.db.createColumn(fixturesDir, wdb.id, { name: 'Monto', type: 'number' });
    await window.mdEditor.db.createRows(fixturesDir, wdb.id, [{ [wName.id]: 'a', [wMonto.id]: 10 }, { [wName.id]: 'b', [wMonto.id]: 32.5 }]);
    const fence = '```';
    window.mdModes.setLayoutMode('normal');
    window.mdTabs.newTab([fence + 'widget', 'tareas: hoy', fence, '', fence + 'widget', 'progreso', fence, '', fence + 'widget', 'base: Widget Gastos', 'suma: Monto', fence, '', fence + 'widget', 'mascotas', fence, '', fence + 'widget', 'algo raro', fence].join('\n'));
    window.renderPreview();
    const ws = await waitFor(() => { const l = document.querySelectorAll('#preview-pane .md-widget'); return l.length === 5 && l[2].querySelector('.md-widget-number') ? l : null; }, 5000);
    const tasksW = ws && ws[0];
    const row = tasksW && Array.from(tasksW.querySelectorAll('li')).find((li) => li.textContent.includes(`Widget ${stamp}`));
    let tickOk = false;
    if (row) {
      row.querySelector('input').click();
      tickOk = !!(await waitFor(async () => (await window.mdHome.widgetItems('hoy')).some((i) => i.title === `Widget ${stamp}` && i.done), 3000));
    }
    const progOk = !!(ws && ws[1].querySelectorAll('.md-widget-tile').length === 3);
    const baseOk = !!(ws && ws[2].querySelector('.md-widget-number').textContent.replace(/[^\d,.]/g, '').replace(',', '.') === '42.5');
    const petsOk = !!(ws && ws[3].textContent.includes('Tu equipo'));
    const errOk = !!(ws && ws[4].querySelector('.md-widget-error'));
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    await window.mdEditor.db.deleteDatabase(fixturesDir, wdb.id);
    check('Widgets en notas: tareas de hoy (tildables), progreso, total de una base, mascotas y error claro',
      !!row && tickOk && progOk && baseOk && petsOk && errOk,
      `tarea=${!!row} tildar=${tickOk} progreso=${progOk} base=${baseOk}(${ws && ws[2].querySelector('.md-widget-number') && ws[2].querySelector('.md-widget-number').textContent}) mascotas=${petsOk} error=${errOk}`);
  }

  // Bloque run: muestra el comando, pide confirmación la primera vez (con el
  // comando exacto), ejecuta en la terminal y no vuelve a preguntar por el
  // mismo texto; si el comando cambia, pregunta de nuevo.
  {
    const R = window.mdRunBlocks;
    const parsed = R.parse('título: Saludo\necho uno\n# comentario\necho dos');
    const parseOk = parsed.title === 'Saludo' && parsed.commands.join('|') === 'echo uno|echo dos';
    const stamp = Date.now();
    const cmd = [`echo RUN_OK_${stamp}`];
    const notePath = fixturesDir ? window.mdEditor.joinPath(fixturesDir, 'script.md') : null;
    const originalConfirm = window.confirm;
    const asked = [];
    window.confirm = (m) => { asked.push(m); return false; };
    await R.run(cmd, notePath); // dice que no: no corre
    const deniedOk = asked.length === 1 && asked[0].includes(`echo RUN_OK_${stamp}`);
    window.confirm = (m) => { asked.push(m); return true; };
    await R.run(cmd, notePath);
    const session = await waitFor(() => window.mdTerminal.getSessions().find((x) => !x.exited));
    const screen = () => { const b = session.term.buffer.active; let t = ''; for (let i = 0; i < b.length; i++) t += b.getLine(i).translateToString(true) + '\n'; return t; };
    const ranOk = !!(await waitFor(() => screen().includes(`RUN_OK_${stamp}`) && screen().split(`RUN_OK_${stamp}`).length > 2, 8000));
    const askedBefore = asked.length;
    await R.run(cmd, notePath); // mismo comando: no pregunta
    const trustOk = asked.length === askedBefore;
    await R.run([`echo OTRO_${stamp}`], notePath); // distinto: pregunta
    const changedOk = asked.length === askedBefore + 1;
    window.confirm = originalConfirm;
    for (let i = 0; i < 10 && document.querySelector('.terminal-tab-close'); i++) document.querySelector('.terminal-tab-close').click();
    // En el preview: tarjeta con el comando y ▶ Ejecutar.
    const fence = '```';
    window.mdModes.setLayoutMode('normal');
    window.mdTabs.newTab([fence + 'run', 'título: Prueba', 'ls -la', fence].join('\n'));
    window.renderPreview();
    const card = await waitFor(() => document.querySelector('#preview-pane .md-run'));
    const cardOk = !!card && card.textContent.includes('Prueba') && card.textContent.includes('ls -la') && !!card.querySelector('.md-run-btn:not([disabled])');
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    check('Bloque run: comando visible, confirmación con el texto exacto, ejecuta en la terminal, no repregunta el mismo, sí uno distinto',
      parseOk && deniedOk && ranOk && trustOk && changedOk && cardOk,
      `parse=${parseOk} rechaza=${deniedOk} ejecuta=${ranOk} confiado=${trustOk} cambiado=${changedOk} tarjeta=${cardOk}`);
  }

  // Explorador de multimedia: encuentra fotos/videos/audios (subcarpetas
  // incluidas), filtra por tipo y busca; "Insertar" pone la ruta relativa
  // en la nota abierta.
  if (fixturesDir) {
    const J = window.mdEditor.joinPath;
    const mdir = J(fixturesDir, 'multi-test');
    await window.mdEditor.createFolder(fixturesDir, 'multi-test');
    await window.mdEditor.createFolder(mdir, 'fotos');
    await window.mdEditor.saveFile('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>', J(mdir, 'fotos', 'playa.svg'), false);
    await window.mdEditor.saveFile('x', J(mdir, 'cancion.mp3'), false);
    await window.mdEditor.saveFile('x', J(mdir, 'clip.webm'), false);
    await window.mdEditor.saveFile('# nota\n', J(mdir, 'nota.md'), false);
    window.mdSidebar.renderFolder(await window.mdEditor.readFolder(mdir));
    await window.openFileAtPath(J(mdir, 'nota.md'));
    await window.mdMediaBrowser.open();
    const items = window.mdMediaBrowser.getItems();
    const foundOk = items.length === 3 && items.some((i) => i.rel === J('fotos', 'playa.svg') && i.kind === 'image');
    window.mdMediaBrowser.setFilter('audio');
    const cards = document.querySelectorAll('.media-browser .media-card');
    const filterOk = cards.length === 1 && cards[0].textContent.includes('cancion.mp3');
    window.mdMediaBrowser.setFilter('image');
    document.querySelector('.media-browser .media-card .media-insert').click();
    const inserted = window.mdCodeMirror.getValue();
    const insertOk = inserted.includes('![playa.svg](fotos/playa.svg)');
    const closedOk = document.querySelector('.media-browser-overlay').hidden;
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    check('Explorador de multimedia: encuentra fotos/videos/audios, filtra y "Insertar" pone la ruta relativa en la nota',
      foundOk && filterOk && insertOk && closedOk,
      `encontrados=${items.length} filtro=${filterOk} insertar=${insertOk} cierra=${closedOk}`);
  }

  // Exportar que falla (carpeta inexistente): devuelve null y avisa, en vez
  // de que el botón no haga nada.
  {
    document.querySelectorAll('.app-error-toast').forEach((t) => t.remove());
    const res = await window.mdEditor.exportAnki([{ front: 'a', back: 'b' }], 'no-existe/tarjetas.txt');
    const toast = await waitFor(() => Array.from(document.querySelectorAll('.app-error-toast')).find((t) => t.textContent.includes('No se pudieron exportar las tarjetas')));
    document.querySelectorAll('.app-error-toast').forEach((t) => t.remove());
    check('Exportar: si falla la escritura, devuelve null y avisa (con el log)', res === null && !!toast, `resultado=${res} aviso=${!!toast}`);
  }

  // Guiño a Kingdom Hearts: la hoja se recorta sola; la primera keyblade de
  // regalo, las otras por hitos; golpe al tildar; cursor; Lucky Emblem al
  // elegir el tema y uno escondido que suma al encontrarlo.
  {
    const K = window.mdKeyblades;
    const sheet = `${fixturesDir}-kh/keyblades.png`;
    const imp = await K.importSheet(null, sheet);
    const st = K.getState();
    const sliced = imp.ok && st.count === 3 && st.cfg.unlocked.includes(0);
    const locked2 = !st.cfg.unlocked.includes(2) || window.mdPet.getState().stats.tasks >= 10;
    await K.setCfgForTest({ swing: true, cursor: true, equipped: 0 });
    document.dispatchEvent(new window.PointerEvent('pointerdown', { clientX: 200, clientY: 200, bubbles: true }));
    document.dispatchEvent(new CustomEvent('mk:pet-gain', { detail: { kind: 'task' } }));
    const swung = !!document.querySelector('.kh-swing img');
    await new Promise((r) => setTimeout(r, 200));
    const cursorOn = document.body.classList.contains('kh-cursor') && Array.from(document.querySelectorAll('style')).some((s) => s.textContent.includes('body.kh-cursor') && s.textContent.includes('data:image/png'));
    const chips = document.querySelectorAll('#kh-settings .kh-key').length;
    await K.setCfgForTest({ cursor: false });

    const before = document.documentElement.getAttribute('data-theme');
    document.querySelector('#theme-gallery .tg-card[data-theme="kingdom-hearts"]').click();
    const celebrated = !!document.querySelector('.lucky-celebrate .lucky-big svg');
    await new Promise((r) => setTimeout(r, 100));
    const hiddenEl = window.mdLuckyEmblem.hiddenEl();
    const n0 = window.mdLuckyEmblem.found();
    if (hiddenEl) hiddenEl.click();
    await new Promise((r) => setTimeout(r, 150));
    const foundOk = window.mdLuckyEmblem.found() === n0 + 1 && !window.mdLuckyEmblem.hiddenEls().includes(hiddenEl);
    const cfg = await window.mdEditor.getConfig();
    window.mdThemes.applyTheme(before || 'light');
    await window.mdEditor.setConfig({ theme: before || 'light' });
    await K.clearSheet();
    check('Kingdom Hearts: keyblades recortadas, llavero, golpe, cursor y Lucky Emblem',
      sliced && locked2 && swung && cursorOn && chips === 3 && celebrated && !!hiddenEl && foundOk && cfg.khLuckyFound === n0 + 1,
      `recorte=${st.count} golpe=${swung} cursor=${cursorOn} llavero=${chips} emblema=${celebrated} escondido=${!!hiddenEl} encontrado=${foundOk}`);
  }

  // Sora: su hoja se reconoce por tamaño, se recorta en animaciones, se une
  // a las mascotas y da un golpe (cuadros de ataque) al tildar; retrato.
  {
    const before = window.mdPet.getState();
    await window.mdPet.setState({ enabled: true });
    const r = await window.mdKhChars.importChars([`${fixturesDir}-kh/sora.png`]);
    const sora = window.mdKhChars.get('sora');
    const animsOk = !!sora && sora.anims.walk.frames.length === 5 && sora.anims.attack.frames.length === 4 && !!sora.portraits.feliz;
    const joined = window.mdPet.getState().pets.some((p) => p.kind === 'kh' && p.species === 'sora');
    const toast = document.querySelector('.kh-portrait-toast img'); // "¡Sora se unió!"
    document.querySelectorAll('.kh-portrait-toast').forEach((t) => t.remove());
    await window.mdPet.gain('task', `test:kh:${Date.now()}`);
    await new Promise((res) => setTimeout(res, 150));
    const img = Array.from(document.querySelectorAll('.pet .pet-kh'))[0];
    const attacking = !!img && sora.anims.attack.frames.includes(img.getAttribute('src'));
    await window.mdPet.setState(before);
    check('Sora: hoja reconocida y recortada, se une (con retrato) y ataca al tildar',
      r.ok && animsOk && joined && attacking && !!toast, `import=${r.ok || r.error} anims=${animsOk} seUne=${joined} ataque=${attacking} retrato=${!!toast}`);
  }

  // Preview incremental (por bloques): mismo HTML que el camino completo en
  // una nota con de todo; con HTML crudo de bloque vuelve al completo; al
  // editar un bloque solo cambia ese.
  {
    const P = window.mdPreview;
    const rich = [
      '# Título', '', 'Párrafo con **negrita**, [enlace][ref], [otro](https://ejemplo.com) y `código`.', '',
      '> [!NOTE]', '> Un callout', '', '- [ ] tarea', '- [x] hecha', '  - anidada', '', '1. uno', '2. dos', '',
      '| a | b |', '|---|---|', '| 1 | 2 |', '', '```js', 'const x = 1;', '```', '', '---', '',
      'Texto con salto  ', 'duro y ==resaltado== y #etiqueta y [[Otra nota]].', '', '![foto](img/a.png)', '',
      '[ref]: https://referencia.com "título"', ''
    ].join('\n');
    const same = P.renderWholeForTest(rich) === P.renderBlocksForTest(rich);
    const withHtml = P.renderBlocksForTest('<details>\n<summary>Ver</summary>\n\nadentro\n\n</details>\n') === null;
    await window.mdTabs.newTab(rich);
    window.renderPreview();
    const modeOk = P.mode() === 'por bloques';
    const pane = document.getElementById('preview-pane') || document.querySelector('.preview');
    const firstP = pane && pane.querySelector('p');
    window.mdCodeMirror.replaceRange('Nuevo párrafo al final.\n', { line: window.mdCodeMirror.lineCount(), ch: 0 });
    window.renderPreview();
    const updated = pane && pane.textContent.includes('Nuevo párrafo al final.');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    // Y con todas las notas reales del repo (copiadas por run.js).
    const corpus = fixturesDir.replace(/-fixtures$/, '-corpus');
    const tree = await window.mdEditor.readFolder(corpus);
    const names = ((tree && tree.tree) || []).filter((n) => !n.esCarpeta && /\.md$/.test(n.nombre));
    const differ = [];
    let wholeOnly = 0;
    for (const n of names) {
      const r = await window.mdEditor.readFile(n.ruta);
      const b = P.renderBlocksForTest(r.content);
      if (b === null) wholeOnly++;
      else if (b !== P.renderWholeForTest(r.content)) differ.push(n.nombre);
    }
    check(`Preview incremental: igual al completo en las ${names.length} notas reales del repo`,
      names.length > 20 && !differ.length, `distintas=${differ.join(', ') || 'ninguna'} conHTMLcrudo=${wholeOnly}`);
    check('Preview incremental: mismo HTML que el completo, HTML crudo usa el completo, se actualiza al editar',
      same && withHtml && modeOk && !!firstP && updated, `igual=${same} htmlCrudo=${withHtml} modo=${P.mode()} actualiza=${updated}`);
  }

  // Home → Horario: tareas con hora en su franja (alto = duración), las que
  // se pisan lado a lado, sin hora en "todo el día"; crear en un hueco y
  // mover / cambiar duración.
  {
    const H = window.mdHome;
    await H.open();
    const d = H.getData();
    const day = new Date().toISOString().slice(0, 10);
    d.tasks.push({ id: 'hr-a', title: 'Clase hr', date: day, time: '09:00', duration: 120, done: false, priority: 'media' });
    d.tasks.push({ id: 'hr-b', title: 'Reunión hr', date: day, time: '10:00', duration: 60, done: false, priority: 'media' });
    d.tasks.push({ id: 'hr-c', title: 'Sin hora hr', date: day, done: false, priority: 'media' });
    H.setMode('hours');
    const evA = document.querySelector('.home-hour-event[data-task-id="hr-a"]');
    const evB = document.querySelector('.home-hour-event[data-task-id="hr-b"]');
    const placed = !!evA && !!evB && parseFloat(evA.style.top) === 9 * 48 && Math.round(parseFloat(evA.style.height)) === 2 * 48 - 2;
    const sideBySide = evA && evB && evA.style.left !== evB.style.left;
    const allDay = Array.from(document.querySelectorAll('.home-hours-allday-cell .home-task')).some((c) => c.textContent.includes('Sin hora hr'));
    const col = document.querySelector(`.home-hour-col[data-date="${day}"]`);
    const input = H.hoursApi.promptNewAt(col, day, 14 * 60, 15 * 60 + 30);
    input.value = 'Nueva hr';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const created = H.getData().tasks.find((t) => t.title === 'Nueva hr');
    const createdOk = !!created && created.time === '14:00' && created.duration === 90 && created.date === day;
    H.hoursApi.retime({ task: H.getData().tasks.find((t) => t.id === 'hr-b'), date: day, recurring: false }, day, 16 * 60 + 15, 45);
    const moved = H.getData().tasks.find((t) => t.id === 'hr-b');
    const movedOk = moved.time === '16:15' && moved.duration === 45;
    H.getData().tasks = H.getData().tasks.filter((t) => !/ hr$/.test(t.title));
    await window.mdEditor.homeSave(H.getData(), H.dataLocation());
    H.setMode('week');
    H.close();
    check('Home → Horario: franjas por hora con duración, solapadas lado a lado, crear y mover',
      placed && sideBySide && allDay && createdOk && movedOk,
      `ubica=${placed} ladoAlado=${sideBySide} todoElDía=${allDay} crea=${createdOk} mueve=${movedOk}`);
  }

  // Home: las tareas hechas hace más de N días pasan al archivo; siguen en
  // la búsqueda y en la racha, y al elegirlas vuelven al Home.
  {
    const H = window.mdHome;
    await H.open();
    const d = H.getData();
    const old = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10);
    const recent = new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10);
    d.tasks.push({ id: 'arch-old', title: 'Declaración archivable zq', date: old, done: true });
    d.tasks.push({ id: 'arch-recent', title: 'Reciente zq', date: recent, done: true });
    d.tasks.push({ id: 'arch-pending', title: 'Pendiente vieja zq', date: old, done: false });
    H.setArchiveDays(90);
    const moved = await H.archiveOld();
    const ids = new Set(H.getData().tasks.map((t) => t.id));
    const archived = (await H.loadArchive()).map((t) => t.id);
    const found = await H.searchTasks('archivable zq');
    const counted = !!H.getData().archivedDays[old];
    await H.unarchive('arch-old');
    const back = H.getData().tasks.some((t) => t.id === 'arch-old') && !(await H.loadArchive()).some((t) => t.id === 'arch-old');
    const notAgain = (await H.archiveOld()) === 0;
    H.getData().tasks = H.getData().tasks.filter((t) => !t.id.startsWith('arch-'));
    delete H.getData().archivedDays[old];
    await window.mdEditor.homeSave(H.getData(), H.dataLocation());
    H.close();
    check('Home: archivar tareas hechas viejas (búsqueda, racha y vuelven al elegirlas)',
      moved === 1 && !ids.has('arch-old') && ids.has('arch-recent') && ids.has('arch-pending') && archived.includes('arch-old') && found.some((t) => t.archived) && counted && back && notAgain,
      `movidas=${moved} archivo=${archived.join(',')} busca=${found.map((t) => t.archived).join(',')} racha=${counted} vuelve=${back} noOtraVez=${notAgain}`);
  }

  // Versión del formato: config y Home quedan marcados (schemaVersion) al
  // guardar, y un setConfig parcial no la borra.
  {
    await window.mdEditor.setConfig({ probeVersion: 1 });
    const cfg = await window.mdEditor.getConfig();
    const home = await window.mdEditor.homeLoad(null);
    check('Datos con versión de formato (config y Home) para migrar sin romper',
      cfg.schemaVersion === 1 && (!home || home.schemaVersion === 1),
      `config=${cfg.schemaVersion} home=${home && home.schemaVersion}`);
  }

  // Reportar un problema: informe con versión y registro, sin la carpeta
  // personal; la URL del issue lleva título y cuerpo.
  {
    await window.mdReportDialog.open();
    const body = window.mdReportDialog.getBody();
    const version = await window.mdEditor.appVersion();
    const url = window.mdReportDialog.issueUrl();
    window.mdReportDialog.close();
    check('Reportar un problema: informe sin datos personales y enlace al issue',
      body.includes(`MK ${version}`) && body.includes('## Entorno') && !/\/home\/[^/\s]+/.test(body) && url.startsWith('https://github.com/Joviva22/MK/issues/new?title=') && url.includes('&body='),
      `version=${body.includes(version)} home=${/\/home\/[^/\s]+/.test(body)} largo=${body.length}`);
  }

  // Modo máquina de escribir: la línea del cursor queda cerca del centro;
  // "atenuar párrafos" marca solo el párrafo del cursor y sigue al cursor.
  {
    const T = window.mdTypewriter;
    const cm = window.mdCodeMirror;
    window.mdTabs.newTab(Array.from({ length: 120 }, (_, i) => (i % 4 === 3 ? '' : `línea ${i}`)).join('\n'));
    await T.set({ typewriter: true, dim: true });
    cm.focus();
    cm.setCursor({ line: 60, ch: 0 });
    await new Promise((r) => setTimeout(r, 150));
    const info = cm.getScrollInfo();
    const { top, bottom } = cm.charCoords({ line: 60, ch: 0 }, 'local');
    const offCenter = Math.abs((top + bottom) / 2 - info.top - info.clientHeight / 2);
    const centered = offCenter < 30;
    const marked = () => Array.from(document.querySelectorAll('#editor-pane .mk-current-para')).map((el) => (el.querySelector('.CodeMirror-line') || el).textContent);
    const para1 = marked().join('|');
    cm.setCursor({ line: 1, ch: 0 });
    await new Promise((r) => setTimeout(r, 100));
    const para2 = marked().join('|');
    const dimOk = para1 === 'línea 60|línea 61|línea 62' && para2 === 'línea 0|línea 1|línea 2' && document.body.classList.contains('mk-dim-paragraphs');
    await T.set({ typewriter: false, dim: false });
    const cleared = !document.querySelector('#editor-pane .mk-current-para') && !document.body.classList.contains('mk-typewriter');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    check('Modo máquina de escribir: cursor centrado y solo su párrafo con color pleno',
      centered && dimOk && cleared, `desvío=${Math.round(offCenter)}px párrafo="${para1}" → "${para2}" limpia=${cleared}`);
  }

  // Categorías del Home: @categoría en el alta rápida, chip en la tarjeta y
  // filtro (las nuevas heredan la categoría filtrada).
  {
    const parsed = window.mdHome.parseCategoryToken('@uni repasar parcial');
    const parseOk = parsed.category === 'universidad' && parsed.title === 'repasar parcial';
    await window.mdHome.open();
    window.mdHome.setMode('week');
    window.mdHome.setCategoryFilter('');
    const stamp = Date.now();
    const qa = () => document.querySelector('#home-main .home-day.home-today .home-quick-add');
    (await waitFor(qa)).value = `Leer apuntes ${stamp} @uni`;
    qa().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const card = () => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(`Leer apuntes ${stamp}`));
    const c1 = await waitFor(card);
    const chipOk = !!c1 && c1.dataset.category === 'universidad' && c1.querySelector('.home-task-cat').textContent === 'Universidad';

    window.mdHome.setCategoryFilter('casa');
    const hiddenOk = !card();
    qa().value = `Lavar ropa ${stamp}`;
    qa().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const c2 = await waitFor(() => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(`Lavar ropa ${stamp}`)));
    const inheritOk = !!c2 && c2.dataset.category === 'casa';
    window.mdHome.setCategoryFilter('');

    // Limpieza
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    for (const text of [`Leer apuntes ${stamp}`, `Lavar ropa ${stamp}`]) {
      const c = Array.from(document.querySelectorAll('#home-main .home-task')).find((x) => x.textContent.includes(text));
      if (!c) continue;
      c.click();
      await waitFor(() => document.querySelector('.home-editor'));
      Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
      await new Promise((r) => setTimeout(r, 100));
    }
    window.confirm = originalConfirm;
    window.mdHome.close();
    check('Categorías del Home: @categoría, chip y filtro (las nuevas heredan)',
      parseOk && chipOk && hiddenOk && inheritOk,
      `@=${parseOk} chip=${chipOk} filtra=${hiddenOk} hereda=${inheritOk}`);
  }

  // Versión en Ajustes → Sistema; el aviso de versión nueva viene apagado y
  // en modo test no sale a internet.
  {
    const version = await window.mdEditor.appVersion();
    const desc = document.getElementById('app-version-desc');
    const cfg = await window.mdEditor.getConfig();
    const r = await window.mdEditor.checkUpdate();
    check('Versión: visible en Ajustes, aviso apagado por defecto, sin red en test',
      /^\d+\.\d+\.\d+$/.test(version) && desc.textContent.includes(version) && !cfg.updateCheck && r.current === version && r.newer === false,
      `v=${version} desc="${desc.textContent}" aviso=${!!cfg.updateCheck}`);
  }

  // Reemplazar en la carpeta: vista previa sin tocar nada, se saltan las
  // pestañas con cambios sin guardar, cada archivo deja su versión en el
  // historial, y las pestañas abiertas se recargan.
  {
    const R = window.mdReplaceFolder;
    const rfRoot = window.mdState.rootFolder || fixturesDir;
    const cm = window.mdCodeMirror;
    const a = window.mdEditor.joinPath(rfRoot, 'reemplazo-a.md');
    const b = window.mdEditor.joinPath(rfRoot, 'reemplazo-b.md');
    const c = window.mdEditor.joinPath(rfRoot, 'reemplazo-c.md');
    await window.mdEditor.saveFile('Proyecto Zeta y zeta\n', a, false);
    await window.mdEditor.saveFile('nada que ver\nel proyecto zeta\n', b, false);
    await window.mdEditor.saveFile('zeta sin guardar\n', c, false);
    await window.mdTabs.openTab(a);
    await window.mdTabs.openTab(c);
    cm.replaceRange('cambio local ', { line: 0, ch: 0 });
    await window.mdTabs.openTab(a);
    R.open();
    R.setForTest('zeta', 'Omega', { wholeWord: true });
    const pv = await R.runPreview();
    const untouched = (await window.mdEditor.readFile(a)).content === 'Proyecto Zeta y zeta\n';
    const cBox = Array.from(document.querySelectorAll('.rf-file input')).find((i) => i.dataset.path === c);
    const skipsUnsaved = cBox && cBox.disabled && !cBox.checked;
    const res = (await R.apply(true)) || { total: -1 };
    const aNow = (await window.mdEditor.readFile(a)).content;
    const bNow = (await window.mdEditor.readFile(b)).content;
    const cNow = (await window.mdEditor.readFile(c)).content;
    await new Promise((r) => setTimeout(r, 300));
    const tabReloaded = cm.getValue() === aNow;
    const hist = await window.mdEditor.listBackups(a);
    const regexErr = (R.setForTest('(', 'x', { regex: true }), await R.runPreview());
    R.close();
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    for (const p of [a, c]) {
      await window.mdTabs.openTab(p);
      document.querySelector('#tabbar .tab.active .tab-close').click();
    }
    window.confirm = originalConfirm;
    check('Reemplazar en la carpeta: vista previa, salta sin guardar, historial y recarga',
      pv.total === 4 && untouched && skipsUnsaved && res.total === 3 && aNow === 'Proyecto Omega y Omega\n' && bNow === 'nada que ver\nel proyecto Omega\n' && cNow === 'zeta sin guardar\n' && tabReloaded && Array.isArray(hist) && hist.length >= 1 && !!regexErr.error,
      `previa=${pv.total} intacto=${untouched} salta=${skipsUnsaved} hechos=${res.total} a="${aNow.trim()}" recarga=${tabReloaded} historial=${hist && hist.length} regex=${!!regexErr.error}`);
  }

  // Reabrir pestaña cerrada: Ctrl+Alt+W vuelve a abrir la última (con el
  // cursor donde estaba); una "Sin título" con texto vuelve con su texto.
  {
    const cm = window.mdCodeMirror;
    const p = window.mdEditor.joinPath(fixturesDir, 'externo.md');
    await window.mdEditor.saveFile('uno\ndos\ntres\n', p, false);
    await window.mdTabs.openTab(p);
    cm.setCursor({ line: 2, ch: 1 });
    document.querySelector('#tabbar .tab.active .tab-close').click();
    const closedOk = !window.mdTabs.getActiveTabInfo() || window.mdTabs.getActiveTabInfo().filePath !== p;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, altKey: true, bubbles: true }));
    await new Promise((r) => setTimeout(r, 300));
    const info = window.mdTabs.getActiveTabInfo();
    const reopened = info && info.filePath === p && cm.getCursor().line === 2 && cm.getCursor().ch === 1;
    document.querySelector('#tabbar .tab.active .tab-close').click();

    window.mdTabs.newTab('borrador que no quiero perder\n');
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    await window.mdTabs.reopenClosed();
    const draftBack = cm.getValue() === 'borrador que no quiero perder\n' && window.mdTabs.getActiveTabInfo().modified;
    window.confirm = () => true;
    document.querySelector('#tabbar .tab.active .tab-close').click();
    window.confirm = originalConfirm;
    check('Reabrir pestaña cerrada (Ctrl+Alt+W): archivo con cursor y borrador con su texto',
      closedOk && reopened && draftBack, `cerro=${closedOk} reabre=${reopened} borrador=${draftBack}`);
  }

  // Pegar una imagen (Ctrl+V con una captura): se guarda en assets/ junto a
  // la nota y se inserta ![](assets/…). Con texto en el portapapeles, se
  // pega el texto como siempre. En un temporal aparte (no los fixtures).
  {
    const dir = `${fixturesDir.replace(/[^/]+$/, '')}mk-test-export-paste-${Date.now()}`;
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
    await window.mdEditor.saveImageAsset(dir, 'semilla', 'png', png); // crea la carpeta
    const note = window.mdEditor.joinPath(dir, 'nota.md');
    await window.mdEditor.saveFile('# Nota\n', note, false);
    await window.mdTabs.openTab(note);
    const cm = window.mdCodeMirror;
    cm.setCursor({ line: 1, ch: 0 });
    const paste = (dt) => cm.getInputField().dispatchEvent(new window.ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    const dt = new DataTransfer();
    dt.items.add(new window.File([png], 'image.png', { type: 'image/png' }));
    paste(dt);
    let inserted = '';
    for (let i = 0; i < 30 && !inserted; i++) {
      await new Promise((r) => setTimeout(r, 50));
      const m = cm.getValue().match(/!\[pegado-[\d-]+\]\((assets\/pegado-[\d-]+\.png)\)/);
      inserted = m ? m[1] : '';
    }
    const saved = inserted ? !!(await window.mdEditor.readFile(window.mdEditor.joinPath(dir, inserted))) : false;
    const before = cm.getValue();
    const withText = new DataTransfer();
    withText.items.add('hola', 'text/plain');
    withText.items.add(new window.File([png], 'image.png', { type: 'image/png' }));
    paste(withText);
    await new Promise((r) => setTimeout(r, 200));
    const textKept = (cm.getValue().match(/\]\(assets\//g) || []).length === 1 && cm.getValue().length >= before.length;
    cm.setValue('# Nota\n');
    await window.mdTabs.saveActive();
    document.querySelector('#tabbar .tab.active .tab-close').click();
    check('Pegar imagen: se guarda en assets/ y se inserta el enlace (con texto, pega el texto)',
      !!inserted && saved && textKept, `insertado=${inserted} guardado=${saved} texto=${textKept}`);
  }

  // Bienvenida: en test no aparece sola; el perfil "Escribir" apaga los
  // módulos avanzados, "Más tarde" salta la carpeta y al terminar queda
  // marcada como vista.
  {
    const W = window.mdWelcome;
    const overlay = document.querySelector('.welcome-overlay');
    const hiddenAtStart = overlay.hidden;
    W.open();
    const shown = !overlay.hidden && document.activeElement && overlay.contains(document.activeElement);
    W.selectProfile('escribir');
    W.next();
    await new Promise((r) => setTimeout(r, 150));
    const writeOnly = !window.mdModules.isOn('terminal') && !window.mdModules.isOn('home') && window.mdModules.isOn('links');
    const onFolderStep = !overlay.querySelector('.welcome-step[data-step="1"]').hidden;
    await W.chooseFolder('later');
    const onLast = !overlay.querySelector('.welcome-step[data-step="2"]').hidden;
    W.next();
    await new Promise((r) => setTimeout(r, 100));
    const cfg = await window.mdEditor.getConfig();
    await window.mdModules.setOff([]);
    check('Bienvenida: perfil de módulos, carpeta "más tarde" y queda vista',
      hiddenAtStart && shown && writeOnly && onFolderStep && onLast && overlay.hidden && cfg.onboarded === true && window.mdModules.isOn('terminal'),
      `inicio=${hiddenAtStart} abre=${shown} perfil=${writeOnly} paso2=${onFolderStep} paso3=${onLast} cierra=${overlay.hidden} vista=${cfg.onboarded}`);
  }

  // Respaldo: exportar → revisar → importar (en test sin diálogos ni recarga).
  // Importar sin elegir antes el archivo se rechaza.
  {
    const cfg = await window.mdEditor.getConfig();
    const file = `${fixturesDir.replace(/[^/]+$/, "")}mk-test-export-respaldo-${Date.now()}.mkbackup`;
    const exp = await window.mdEditor.backupExport(file);
    const sneaky = await window.mdEditor.backupImport('/tmp/otro.mkbackup');
    const picked = await window.mdEditor.backupPick(file);
    const imp = await window.mdEditor.backupImport(picked.file);
    const after = await window.mdEditor.getConfig();
    const sameTheme = after.theme === cfg.theme;
    check('Respaldo: exportar e importar (solo el archivo elegido; copia previa automática)',
      exp.ok && !!sneaky.error && picked.ok && imp.ok && /antes-de-importar-/.test(imp.safety) && sameTheme,
      `exp=${exp.ok || exp.error} sneaky=${!!sneaky.error} pick=${picked.ok || picked.error} imp=${imp.ok || imp.error} tema=${sameTheme}`);
  }

  // Mascotas: equipo, XP (una vez por tarea/día), evolución → huevo → nace
  // otra criatura; logro → huevo legendario; ocultas siguen ganando;
  // ánimo; imágenes propias; tildar en el Home; migración de la versión 1.
  {
    const P = window.mdPet;
    const before = P.getState();
    await P.setState({ version: 2, enabled: true, source: 'mk', pets: [{ id: 'p1', kind: 'mk', species: 'agua', mkSpecies: 'agua', name: '', xp: 0, legendary: false }], team: ['p1'], eggs: [], awarded: [], achievements: [], stats: { tasks: 0, pomodoros: 0, taskDays: [] }, nextId: 2, fed: {} });
    const a = await P.gain('task', 'test:t1');
    const dup = await P.gain('task', 'test:t1');
    const pomo = await P.gain('pomodoro', null);
    const xpOk = a.xp === 10 && dup.duplicate && pomo.xp === 35;

    // Evoluciona (nivel 5) → aparece un huevo; el huevo nace a los 60 XP.
    await P.setState({ pets: [{ ...P.getState().pets[0], xp: 235 }] });
    const evo = await P.gain('task', 'test:t2');
    const petEl = document.querySelector('.pet');
    const evolveOk = evo.evolved && evo.stage === 2 && evo.name === 'Olaquín' && petEl && petEl.dataset.stage === '2';
    const eggOk = P.getState().eggs.length === 1 && P.getState().eggs[0].type === 'normal';
    for (let i = 3; i <= 8; i++) await P.gain('task', `test:t${i}`); // 60 XP
    const st1 = P.getState();
    const hatchOk = st1.eggs.length === 0 && st1.pets.length === 2 && st1.team.length === 2 && st1.pets[1].species !== 'agua' && document.querySelectorAll('.pet').length === 2;

    // Logro (50 Pomodoros) → huevo legendario.
    await P.setState({ stats: { ...P.getState().stats, pomodoros: 49 } });
    await P.gain('pomodoro', null);
    const st2 = P.getState();
    const legendOk = st2.achievements.includes('concentracion') && st2.eggs.some((e) => e.type === 'legendary' && e.pick.kind === 'mk');

    // Ocultas: siguen ganando experiencia.
    await P.setState({ enabled: false });
    const xpHiddenBefore = P.getState().pets[0].xp;
    await P.gain('task', 'test:hidden');
    const hiddenOk = P.getState().pets[0].xp === xpHiddenBefore + 10 && document.querySelector('.pet-lane').hidden;
    await P.setState({ enabled: true });

    // Ánimo (el Home recalcula las atrasadas reales cada tanto: aislado).
    const realSetOverdue = P.setOverdue;
    realSetOverdue(3);
    P.setOverdue = () => {};
    const sadOk = !!(await waitFor(() => document.querySelector('.pet') && document.querySelector('.pet').dataset.mood === 'sad', 3000));
    P.setOverdue = realSetOverdue;
    P.setOverdue(0);

    // Colección: tarjetas, equipo y logros.
    P.openCollection();
    const col = document.querySelector('.pet-collection-overlay');
    const colOk = !col.hidden && col.querySelectorAll('.pet-col-card[data-pet-id]').length === 2 && col.textContent.includes('Concentración') && col.textContent.includes('Huevo legendario');
    col.querySelector('.pet-col-card[data-pet-id="p1"] .pet-col-team').click(); // p1 descansa
    const restOk = !P.getState().team.includes('p1') && document.querySelectorAll('.pet').length === 1;
    col.hidden = true;

    // Imágenes propias para la líder.
    let customOk = 'sin fixtures';
    if (fixturesDir) {
      const svgPath = window.mdEditor.joinPath(fixturesDir, 'mi-mascota.svg');
      await window.mdEditor.saveFile('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="5" fill="red"/></svg>', svgPath, false);
      const leadId = P.getState().team[0];
      const res = await window.mdEditor.pet.pickSprite(leadId, 1, svgPath);
      const s3 = P.getState();
      s3.pets.find((p) => p.id === leadId).kind = 'custom';
      await P.setState({ pets: s3.pets });
      const img = document.querySelector('.pet .pet-img');
      const loaded = img && await new Promise((r) => { if (img.complete && img.naturalWidth) r(true); img.onload = () => r(true); img.onerror = () => r(false); setTimeout(() => r(false), 2000); });
      customOk = !!(res && res.ok && loaded);
      await window.mdEditor.pet.clearSprites(leadId);
    }

    // Home: tildar una tarea da XP a la líder; destildar y tildar no suma.
    await P.setState({ pets: [{ id: 'p1', kind: 'mk', species: 'fuego', name: '', xp: 0, legendary: false }], team: ['p1'], eggs: [], awarded: [] });
    await window.mdHome.open();
    window.mdHome.setMode('week');
    const title = 'Mascota ' + Date.now();
    const qa = await waitFor(() => document.querySelector('#home-main .home-day.home-today .home-quick-add'));
    qa.value = title;
    qa.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    const findCard = () => Array.from(document.querySelectorAll('#home-main .home-task')).find((c) => c.textContent.includes(title));
    (await waitFor(findCard)).querySelector('input[type="checkbox"]').click();
    await new Promise((r) => setTimeout(r, 200));
    const homeXp = P.info().xp === 10;
    findCard().querySelector('input[type="checkbox"]').click();
    findCard().querySelector('input[type="checkbox"]').click();
    await new Promise((r) => setTimeout(r, 200));
    const noFarm = P.info().xp === 10;
    const originalConfirm = window.confirm;
    window.confirm = () => true;
    findCard().click();
    await waitFor(() => document.querySelector('.home-editor'));
    Array.from(document.querySelectorAll('.home-editor button')).find((b) => b.textContent === 'Eliminar').click();
    window.confirm = originalConfirm;
    window.mdHome.close();

    await P.setState({ ...before, enabled: false });
    check('Mascotas: XP sin duplicar, evoluciona → huevo → nace otra, logro → huevo legendario, ocultas siguen ganando, ánimo, colección y equipo, imágenes propias, Home',
      xpOk && evolveOk && eggOk && hatchOk && legendOk && hiddenOk && sadOk && colOk && restOk && customOk === true && homeXp && noFarm,
      `xp=${xpOk} evoluciona=${evolveOk} huevo=${eggOk} nace=${hatchOk} legendario=${legendOk} ocultaGana=${hiddenOk} triste=${sadOk} colección=${colOk} descansa=${restOk} propia=${customOk} home=${homeXp} sinTrampa=${noFarm}`);
  }

  // Correo: dirección + contraseña (nunca vuelve al renderer), prueba, aviso
  // del Home por correo y resumen diario; siempre a la propia dirección.
  {
    const m = window.mdEditor.mail;
    const bad = await m.setSettings({ address: 'no es un correo' });
    await m.setSettings({ enabled: true, address: 'yo@example.com' });
    const pw = await m.setPassword('abcd efgh ijkl mnop');
    const st = await m.status();
    const noLeak = !JSON.stringify(st).includes('abcd');
    const test = await m.test();
    const tmsg = await m.lastTestMessage();
    const testOk = test.ok && tmsg && tmsg.to.some((t) => t.address === 'yo@example.com') && tmsg.subject.includes('prueba');
    await window.mdMail.notify('🔔 Falta 1 semana para Examen', 'Detalle');
    const rmsg = await m.lastTestMessage();
    const reminderOk = rmsg && rmsg.subject.includes('Examen') && rmsg.to.length === 1 && rmsg.to[0].address === 'yo@example.com';
    const summary = window.mdHome.dailySummaryText(new Date().toISOString().slice(0, 10));
    const summaryOk = summary.subject.startsWith('MK: tu día') && summary.text.includes('HOY');
    await m.setSettings({ enabled: false });
    const off = await m.send('x', 'y');
    const forgot = await m.clearPassword();
    const ok = !bad.ok && pw.ok && st.hasPassword && noLeak && testOk && reminderOk && summaryOk && off.reason === 'disabled' && !forgot.hasPassword;
    check('Correo: guarda la contraseña sin devolverla, prueba, aviso y resumen a tu propia dirección, apagado no envía', ok,
      `dirMala=${!bad.ok} guardada=${st.hasPassword} sinFuga=${noLeak} prueba=${testOk} aviso=${reminderOk} resumen=${summaryOk} apagado=${off.reason} olvidada=${!forgot.hasPassword}`);
  }

  // Vista de estudio: misma fuente de datos que Home y Pomodoros.
  if (fixtureMdPath && fixturePdfPath) {
    await window.mdHome.open(); window.mdHome.close();
    const home = window.mdHome.getData();
    const savedHome = JSON.parse(JSON.stringify(home));
    const H = window.mdPomodoroHistory;
    const previousRecords = new Set(H.getState().records.map((r) => r.id));
    const previousConfig = await window.mdEditor.getConfig();
    const originalConfirm = window.confirm;
    let originalNote;
    try {
      await window.mdPomodoro.reset();
      await window.mdEditor.setConfig({ pomodoroFocusMinutes: 25 });
      const today = window.mdHomeLogic.iso(new Date());
      const tomorrow = window.mdHomeLogic.iso(window.mdHomeLogic.addDays(new Date(), 1));
      home.categories.push({ id: 'study_dash', name: 'Asignatura Test', color: '#3b82f6' });
      home.tasks.push(
        { id: 'dash-today', category: 'study_dash', title: 'Entrega de hoy', date: today },
        { id: 'dash-none', category: 'study_dash', title: 'Repasar sin fecha' },
        { id: 'dash-done', category: 'study_dash', title: 'Terminada', done: true, date: today },
        { id: 'dash-old', category: 'study_dash', title: 'Entrega atrasada', date: window.mdHomeLogic.iso(window.mdHomeLogic.addDays(new Date(), -1)) },
        { id: 'dash-repeat', category: 'study_dash', title: 'Serie diaria', date: today, repeat: { freq: 'daily' }, doneDates: [today] },
        { id: 'dash-other', category: 'personal', title: 'No mezclar asignaturas', date: today }
      );
      await H.record({ id: 'dashboard-time', category: 'DASH_TIME_TEST', seconds: 1500, date: new Date().toISOString() });
      await H.record({ id: 'dashboard-other', category: 'OTHER_TIME_TEST', seconds: 900 });
      await window.openFileAtPath(fixtureMdPath);
      originalNote = window.mdCodeMirror.getValue();
      window.mdCodeMirror.setValue(originalNote + '\nCambios sin guardar del dashboard\n');
      await window.mdStudy.open('study_dash');
      let panel = document.getElementById('study-panel');
      check('Estudio por asignatura: pendientes, atrasadas y próxima repetición sin mezclar categorías', panel.querySelectorAll('#study-pending .study-row').length === 4 && panel.querySelectorAll('#study-upcoming .study-row').length === 2 && panel.querySelector('#study-pending').textContent.includes('Atrasada') && panel.querySelector('#study-pending').textContent.includes(tomorrow) && !panel.querySelector('#study-pending').textContent.includes('No mezclar asignaturas'));
      const expectedPlan = window.mdStudyLogic.todayPlan(home.tasks, home.categories, today, window.mdHomeLogic, 25);
      panel.querySelector('#study-plan-minutes').value = '25'; panel.querySelector('#study-plan-update').click();
      await waitFor(() => !panel.querySelector('#study-close').disabled && window.mdStudy.getState().planMinutes === 25);
      const planRows = [...panel.querySelectorAll('#study-today .study-row')];
      const storedPlan = await window.mdEditor.homeLoad(window.mdHome.dataLocation());
      check('Plan de hoy: respeta presupuesto, prioriza vencimientos y guarda por Home', planRows.length === 1 && planRows[0].dataset.taskId === expectedPlan.items[0].task.id && storedPlan.study.planMinutes === 25);
      panel.querySelector('#study-focus-category').value = 'DASH_TIME_TEST';
      panel.querySelector('#study-save-mapping').click();
      await waitFor(() => panel.querySelector('#study-time-today').textContent === '25 min' && !panel.querySelector('#study-close').disabled);
      check('Estudio por asignatura: reutiliza minutos registrados de la categoría elegida', panel.querySelector('#study-time-today').textContent === '25 min' && panel.querySelector('#study-time-week').textContent === '25 min');
      panel.querySelector('#study-link-active').click();
      await waitFor(() => panel.querySelectorAll('#study-materials .study-row').length === 1 && !panel.querySelector('#study-close').disabled);
      await window.mdStudy.linkMaterial(fixtureMdPath); await window.mdStudy.linkMaterial(fixturePdfPath); window.mdStudy.refresh();
      const stored = await window.mdEditor.homeLoad(window.mdHome.dataLocation());
      check('Estudio por asignatura: materiales deduplicados persistidos en el Home sin copiar archivos', stored.study.subjects.study_dash.materials.length === 2 && stored.study.subjects.study_dash.pomodoroCategory === 'DASH_TIME_TEST' && panel.querySelectorAll('#study-materials .study-row').length === 2);
      const row = Array.from(panel.querySelectorAll('#study-materials .study-row')).find((r) => r.dataset.path === fixtureMdPath);
      Array.from(row.querySelectorAll('button')).find((b) => b.textContent === 'Abrir e iniciar foco').click();
      await waitFor(() => !document.getElementById('study-panel'));
      check('Estudio por asignatura: abrir apunte e iniciar foco conserva cambios y asigna su contexto', window.mdCodeMirror.getValue().includes('Cambios sin guardar del dashboard') && window.mdTabs.getActiveTabInfo().modified && window.mdPomodoro.getState().category === 'DASH_TIME_TEST' && window.mdPomodoro.getState().notePath === fixtureMdPath);
      await window.mdStudy.open('study_dash'); panel = document.getElementById('study-panel');
      const session = window.mdPomodoro.getState().sessionId;
      window.confirm = () => false;
      panel.querySelector('#study-start-focus').click();
      await waitFor(() => !panel.querySelector('#study-start-focus').disabled);
      check('Estudio por asignatura: cancelar otro foco no sustituye el temporizador actual', window.mdPomodoro.getState().sessionId === session);
      window.confirm = () => true; await window.mdPomodoro.reset();
      const pdfRow = Array.from(panel.querySelectorAll('#study-materials .study-row')).find((r) => r.dataset.path === fixturePdfPath);
      Array.from(pdfRow.querySelectorAll('button')).find((b) => b.textContent === 'Abrir').click();
      await waitFor(() => !document.getElementById('study-panel'));
      check('Estudio por asignatura: PDF vinculado se abre en selección sin perder materiales', !document.getElementById('pdfhighlight-panel').hidden && window.mdPdfHighlight.getState().sourcePath === fixturePdfPath && window.mdPdfHighlight.getState().mode === 'select');
      window.mdPdfHighlight.close();
      await window.mdStudy.open('study_dash'); panel = document.getElementById('study-panel');
      await window.mdStudy.linkMaterial('/etc/no-autorizado.md'); window.mdStudy.refresh();
      const blocked = Array.from(panel.querySelectorAll('#study-materials .study-row')).find((r) => r.dataset.path === '/etc/no-autorizado.md');
      Array.from(blocked.querySelectorAll('button')).find((b) => b.textContent === 'Abrir').click();
      await waitFor(() => panel.querySelector('.study-error').textContent);
      check('Estudio por asignatura: enlaces no autorizan rutas y el error conserva los materiales', !!panel.querySelector('.study-error').textContent && window.mdStudy.getState().subjects.study_dash.materials.length === 3);
      home.categories.find((c) => c.id === 'study_dash').name = 'Asignatura renombrada'; window.mdStudy.refresh();
      check('Estudio por asignatura: renombrar Home conserva materiales y vínculo del historial', panel.querySelector('#study-subject').selectedOptions[0].textContent === 'Asignatura renombrada' && panel.querySelectorAll('#study-materials .study-row').length === 3 && panel.querySelector('#study-time-today').textContent === '25 min');
    } finally {
      window.confirm = originalConfirm;
      window.mdStudy.close(); window.mdPdfHighlight.close(); await window.mdPomodoro.reset();
      for (const record of H.getState().records) if (!previousRecords.has(record.id)) await H.remove(record.id);
      Object.keys(home).forEach((key) => { if (!(key in savedHome)) delete home[key]; }); Object.assign(home, savedHome);
      await window.mdEditor.homeSave(home, window.mdHome.dataLocation());
      await window.mdEditor.setConfig({ pomodoroFocusMinutes: previousConfig.pomodoroFocusMinutes });
      await window.openFileAtPath(fixtureMdPath); if (originalNote != null) window.mdCodeMirror.setValue(originalNote);
    }
  }

  // Repaso y examen: tarjetas desde notas, solución oculta, programación y errores.
  if (fixtureMdPath) {
    await window.mdStudy.open(); window.mdStudy.close();
    const home = window.mdHome.getData(), savedHome = JSON.parse(JSON.stringify(home));
    const M = window.mdLearning, originalConfirm = window.confirm;
    const click = async (id, next) => {
      document.getElementById(id).click();
      await waitFor(() => document.getElementById(next) && !document.getElementById(next).disabled, 5000);
    };
    const input = (id, value) => { const node = document.getElementById(id); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); };
    try {
      home.categories.push({ id: 'learn_test', name: 'PCP Repaso', color: '#55aaff' });
      home.study = window.mdStudyLogic.normalize(home.study); home.study.learning = { cards: [], reviews: [] };
      await window.openFileAtPath(fixtureMdPath);
      const noteBefore = window.mdCodeMirror.getValue();
      window.mdCodeMirror.setSelection({ line: 0, ch: 0 }, { line: 0, ch: 3 });
      const selected = window.mdCodeMirror.getSelection();
      M.open('learn_test');
      await click('learning-from-note', 'learning-save-card');
      check('Repaso: crea borrador desde selección de nota sin modificar el apunte', document.getElementById('learning-answer').value === selected && window.mdCodeMirror.getValue() === noteBefore);
      await click('learning-save-card', 'learning-save-card');
      check('Repaso: rechaza pregunta vacía conservando borrador y sin crear duplicados', M.getState().cards.length === 0 && document.getElementById('learning-answer').value === selected && document.querySelector('#learning-panel [role="alert"]').textContent.includes('pregunta'));
      input('learning-question', '¿Qué es una caché?'); input('learning-answer', '<b>Referencia literal</b>');
      await click('learning-save-card', 'learning-review');
      const stored = await window.mdEditor.homeLoad(window.mdHome.dataLocation());
      check('Repaso: tarjeta y nota de origen quedan guardadas en su Home', stored.study.learning.cards.length === 1 && stored.study.learning.cards[0].notePath === fixtureMdPath && stored.study.learning.cards[0].category === 'learn_test');
      await click('learning-new', 'learning-save-card'); input('learning-question', 'Borrador no guardado');
      window.confirm = () => false;
      check('Repaso: cancelar cierre conserva borrador sin crear tarjeta', !M.close() && document.getElementById('learning-question').value === 'Borrador no guardado' && M.getState().cards.length === 1);
      await click('learning-cancel-edit', 'learning-review');
      await click('learning-review', 'learning-reveal');
      check('Repaso: la respuesta permanece oculta antes de revelarla', !document.getElementById('learning-solution') && !document.getElementById('learning-good'));
      await click('learning-reveal', 'learning-good');
      check('Repaso: respuesta tratada como texto y no como HTML', document.getElementById('learning-solution').textContent === '<b>Referencia literal</b>' && !document.querySelector('#learning-solution b') && document.getElementById('learning-attempt').readOnly);
      await click('learning-good', 'learning-finish');
      const reviewed = M.getState(), due = reviewed.cards[0].due;
      check('Repaso: valorar programa próxima fecha y guarda exactamente un resultado', reviewed.reviews.length === 1 && reviewed.reviews[0].mode === 'review' && Date.parse(due) > Date.now());
      await click('learning-finish', 'learning-exam'); await click('learning-exam', 'learning-reveal');
      await click('learning-reveal', 'learning-reveal');
      check('Examen: obliga a intentar responder antes de mostrar referencia', !document.getElementById('learning-solution') && document.querySelector('#learning-panel [role="alert"]').textContent.includes('Intenta responder'));
      input('learning-attempt', 'Respuesta equivocada de prueba');
      await click('learning-reveal', 'learning-wrong'); await click('learning-wrong', 'learning-finish');
      const failed = M.getState();
      check('Examen: guarda intento y error sin alterar calendario de repaso', failed.reviews.length === 2 && failed.reviews[1].attempt === 'Respuesta equivocada de prueba' && failed.reviews[1].grade === 0 && failed.cards[0].due === due);
      await click('learning-finish', 'learning-errors'); await click('learning-errors', 'learning-reveal');
      input('learning-attempt', 'Respuesta corregida'); await click('learning-reveal', 'learning-correct'); await click('learning-correct', 'learning-finish');
      await click('learning-finish', 'learning-exam');
      check('Examen: practicar y acertar retira el error pendiente conservando historial', document.getElementById('learning-errors').disabled && M.getState().reviews.length === 3);
      window.confirm = () => true; M.close();
      const homeModule = await import('./home-data.js');
      await homeModule.readStored(window.mdHome.dataLocation());
      await window.mdStudy.open('learn_test'); document.getElementById('study-learning').click();
      await waitFor(() => document.getElementById('learning-panel'));
      check('Repaso y examen: reapertura mantiene tarjeta, fechas y resultados', M.getState().cards.length === 1 && M.getState().reviews.length === 3 && M.getState().cards[0].due === due);
      M.close(); window.mdHome.getData().categories.find((c) => c.id === 'learn_test').name = 'PCP renombrada'; M.open('learn_test');
      check('Repaso: renombrar categoría mantiene sus tarjetas e historial', document.querySelector('#learning-panel h3').textContent === 'PCP renombrada' && M.getState().cards.length === 1 && M.getState().reviews.length === 3);
    } finally {
      window.confirm = () => true; M.close(); window.mdStudy.close(); window.confirm = originalConfirm;
      const target = window.mdHome.getData(); Object.keys(target).forEach((key) => { if (!(key in savedHome)) delete target[key]; }); Object.assign(target, savedHome);
      await window.mdEditor.homeSave(target, window.mdHome.dataLocation());
    }
  }

  // Comprensión: temas persistentes, vínculos y resumen de tareas reales.
  if (fixtureMdPath && fixturePdfPath) {
    await window.mdStudy.open(); window.mdStudy.close();
    const home = window.mdHome.getData(); const savedHome = JSON.parse(JSON.stringify(home));
    try {
      home.categories.push({ id: 'topic_test', name: 'Comprensión Test', color: '#3b82f6' });
      home.study = window.mdStudyLogic.normalize(home.study);
      home.study.subjects.topic_test = { materials: [{ path: fixtureMdPath, label: 'Apunte' }, { path: fixturePdfPath, label: 'PDF' }], topics: [], pomodoroCategory: 'Comprensión Test' };
      home.study.learning.cards.push({ id: 'topic_card', category: 'topic_test', question: '¿Qué es exclusión mutua?', answer: 'Referencia', due: '2020-01-01T00:00:00.000Z', interval: 0, repetitions: 0, notePath: '' });
      home.study.learning.reviews.push({ id: 'topic_error', cardId: 'topic_card', category: 'topic_test', question: '¿Qué es exclusión mutua?', mode: 'exam', grade: 0, date: new Date().toISOString(), attempt: 'Intento' });
      home.tasks.push({ id: 'topic_done', category: 'topic_test', title: 'Ejercicio', done: true, doneAt: window.mdHomeLogic.iso(new Date()), date: '2020-01-01' });
      await window.mdEditor.homeSave(home, window.mdHome.dataLocation());
      await window.mdStudy.open('topic_test');
      const input = document.getElementById('study-topic-name'); input.value = 'Semáforos'; input.dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('study-topic-create').click();
      await waitFor(() => document.querySelector('#study-topics [data-topic-id]'));
      const getRow = () => document.querySelector('#study-topics [data-topic-id]');
      const clickLabel = (label) => [...getRow().querySelectorAll('button')].find((b) => b.textContent === label).click();
      getRow().querySelector('select[aria-label^="Material"]').value = fixturePdfPath; clickLabel('Vincular material');
      await waitFor(() => window.mdStudy.getState().subjects.topic_test.topics[0].materials.includes(fixturePdfPath) && !document.getElementById('study-topic-create').disabled);
      getRow().querySelector('select[aria-label^="Tarjeta"]').value = 'topic_card'; clickLabel('Vincular tarjeta');
      await waitFor(() => getRow().textContent.includes('1 repasos pendientes') && !document.getElementById('study-topic-create').disabled);
      check('Comprensión: vincula PDF y tarjeta, muestra repaso y último error de examen', getRow().textContent.includes('1 errores de último examen') && window.mdStudy.getState().subjects.topic_test.topics[0].materials[0] === fixturePdfPath);
      const state = getRow().querySelector('select[aria-label^="Estado"]'); state.value = 'mastered'; state.dispatchEvent(new Event('change', { bubbles: true }));
      await waitFor(() => !document.getElementById('study-topic-create').disabled);
      check('Comprensión: dominar es autoevaluación y conserva señales de refuerzo', window.mdStudy.getState().subjects.topic_test.topics[0].status === 'mastered' && document.querySelector('#study-weekly [data-category-id="topic_test"]').textContent.includes('Semáforos'));
      check('Resumen semanal: cuenta finalización aunque vencimiento sea antiguo', document.querySelector('#study-weekly [data-category-id="topic_test"]').textContent.includes('1 tareas completadas'));
      window.mdStudy.close();
      const stored = await window.mdEditor.homeLoad(window.mdHome.dataLocation());
      check('Comprensión: temas, estado y enlaces confirmados en disco', stored.study.subjects.topic_test.topics[0].status === 'mastered' && stored.study.subjects.topic_test.topics[0].cardIds[0] === 'topic_card');
    } finally {
      window.mdStudy.close(); const target = window.mdHome.getData();
      Object.keys(target).forEach((key) => { if (!(key in savedHome)) delete target[key]; }); Object.assign(target, savedHome);
      await window.mdEditor.homeSave(target, window.mdHome.dataLocation());
    }
  }

  // Pokémon regionales, especies fuera del PBS y mascotas propias libres.
  if (fixturesDir) {
    const P = window.mdPet;
    const before = P.getState();
    const created = [];
    const dir = window.mdEditor.joinPath(`${fixturesDir}-pokemon`, 'Graphics', 'Characters');
    const col = document.querySelector('.pet-collection-overlay');
    try {
      await P.setState({ pets: [{ id: 'p1', kind: 'mk', species: 'agua', xp: 200 }, { id: 'p2', kind: 'kh', species: 'roxas', xp: 145 }], team: ['p1', 'p2'], nextId: 3, source: 'mk' });
      await P.loadCatalog(dir);
      P.openCollection();
      const chooser = col.querySelector('#pet-chooser');
      if (chooser.hidden) col.querySelector('#pet-col-add').click();
      const more = Array.from(col.querySelectorAll('#pet-chooser-list button')).find((b) => b.textContent.startsWith('Mostrar más'));
      const initialCount = col.querySelectorAll('.pet-char-option').length;
      more?.click();
      check('Pokémon: catálogo completo accesible con Mostrar más, sin tope fijo de opciones', !!more && col.querySelectorAll('.pet-char-option').length > initialCount);
      const search = col.querySelector('#pet-chooser-search');
      search.value = 'vulpix_1'; search.dispatchEvent(new Event('input'));
      const regional = Array.from(col.querySelectorAll('.pet-char-option')).find((b) => b.textContent.includes('Vulpix (Alolan)') && b.textContent.includes('forma fija'));
      regional.click();
      await waitFor(() => P.getState().pets.some((p) => p.kind === 'game' && p.line?.ids[0] === 'vulpix_1'));
      const pet = P.getState().pets.find((p) => p.kind === 'game' && p.line?.ids[0] === 'vulpix_1'); created.push(pet.id);
      const sprites = await window.mdEditor.pet.sprites(pet.id);
      check('Pokémon: regional seleccionable con nombre y sprite real, sin modificar a Roxas', sprites[1]?.label === 'Vulpix (Alolan)' && P.getState().pets.find((p) => p.species === 'roxas')?.xp === 145 && P.getState().pets.find((p) => p.id === 'p1')?.xp === 200);
      const failed = await window.mdEditor.pet.useChars(pet.id, dir, ['FUTURE_MON', 'MISSING'], ['Otro', 'Falta']);
      check('Pokémon: una etapa ausente no sustituye las imágenes actuales', !!failed.error && (await window.mdEditor.pet.sprites(pet.id))[1]?.label === sprites[1].label);
      search.value = 'FUTURE_MON'; search.dispatchEvent(new Event('input'));
      check('Pokémon: sprites ausentes del PBS también se pueden elegir', Array.from(col.querySelectorAll('.pet-char-option')).some((b) => b.textContent.includes('FUTURE_MON')));
      const petsBeforeCancel = JSON.stringify(P.getState().pets);
      col.querySelector('#pet-col-custom-pokemon').click();
      await answerAsk('Pokémon del futuro'); await answerAsk('Región propia');
      await waitFor(() => col.querySelector('#pet-chooser-status').textContent.includes('cancelada'));
      check('Pokémon: cancelar importación propia conserva toda la colección', JSON.stringify(P.getState().pets) === petsBeforeCancel);
      const imagePath = window.mdEditor.joinPath(`${fixturesDir}-kh`, 'keyblades.png');
      const custom = await P.addCustomPokemon('Pokémon futuro', 'Región inventada', imagePath); created.push(custom.id);
      const saved = await waitFor(async () => { const config = await window.mdEditor.getConfig(); return config.pet?.pets.find((p) => p.id === custom.id); });
      check('Pokémon: especie y región libres con imagen propia persisten sin exigir Pokédex', custom.kind === 'custom' && saved?.pokemon?.species === 'Pokémon futuro' && saved.pokemon.form === 'Región inventada' && !!(await window.mdEditor.pet.sprites(custom.id))[1] && P.getState().pets.find((p) => p.species === 'roxas')?.xp === 145);
    } finally {
      col.hidden = true;
      for (const id of created) await window.mdEditor.pet.clearSprites(id);
      await P.setState(before);
    }
  }

  // Excalidraw local: carga diferida, guardado, conflictos y rechazo de rutas.
  if (fixturesDir) {
    const D = window.mdDrawing;
    const scenePath = window.mdEditor.joinPath(fixturesDir, 'pizarra.excalidraw');
    const source = JSON.stringify({ type: 'excalidraw', version: 2, source: 'MK', elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} });
    const originalConfirm = window.confirm;
    try {
      check('Excalidraw: no carga el motor durante el arranque', !window.mdDrawingEngine);
      await window.mdEditor.saveFile(source, scenePath, false);
      await window.openFileAtPath(scenePath);
      await waitFor(() => !!D.getAPI(), 15000);
      await waitFor(() => D.getState().ready);
      check('Excalidraw: abre archivo local en pizarra sin convertirlo a Markdown', !!document.getElementById('drawing-panel') && D.getState().filePath === scenePath && !!D.getAPI());
      const saveButton = document.getElementById('drawing-save');
      const cleanButton = saveButton.disabled && !document.getElementById('drawing-save-as').disabled;
      D.getAPI().updateScene({ appState: { viewBackgroundColor: '#fafafa' } });
      await waitFor(() => D.getState().dirty, 5000);
      const dirtyButton = !saveButton.disabled;
      saveButton.click();
      await Promise.resolve();
      const busyButtons = D.getState().saving && saveButton.disabled && document.getElementById('drawing-close').disabled;
      await waitFor(() => !D.getState().saving);
      const saved = await window.mdEditor.drawingRead(scenePath);
      check('Excalidraw: guarda escena local y limpia cambios pendientes', !D.getState().dirty && JSON.parse(saved.content).appState.viewBackgroundColor === '#fafafa');
      check('Excalidraw: guardar muestra progreso, evita acciones simultáneas y confirma el archivo', cleanButton && dirtyButton && busyButtons && saveButton.disabled && document.querySelector('.drawing-document-name').textContent === 'pizarra.excalidraw' && document.querySelector('.drawing-status').textContent === 'Guardada');
      const originalTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const previousAPI = D.getAPI();
      window.mdThemes.applyTheme('kingdom-hearts');
      await waitFor(() => document.querySelector('#drawing-panel .excalidraw.theme--dark'));
      const darkDrawing = !!document.querySelector('#drawing-panel .excalidraw.theme--dark');
      window.mdThemes.applyTheme('light');
      await waitFor(() => !document.querySelector('#drawing-panel .excalidraw.theme--dark'));
      check('Excalidraw: sigue el tema de MK sin perder la escena ni crear cambios pendientes', darkDrawing && previousAPI === D.getAPI() && !D.getState().dirty && D.getAPI().getAppState().viewBackgroundColor === '#fafafa');
      window.mdThemes.applyTheme(originalTheme);
      D.getAPI().updateScene({ appState: { viewBackgroundColor: '#ffeecc' } });
      await waitFor(() => D.getState().dirty, 5000);
      window.confirm = () => false;
      check('Excalidraw: cancelar cierre conserva la pizarra modificada', !D.close() && !!document.getElementById('drawing-panel') && D.getState().dirty);
      await window.mdEditor.saveFile(source, scenePath, false);
      await D.save();
      check('Excalidraw: conflicto en disco conserva cambios y evita sobrescritura', D.getState().dirty && (await window.mdEditor.drawingRead(scenePath)).content === source && document.querySelector('#drawing-panel [role="status"]').textContent.includes('cambió en disco'));
      const denied = await window.mdEditor.drawingRead('/etc/no-autorizado.excalidraw');
      const bad = await window.mdEditor.drawingSave({ filePath: scenePath, content: '# No es pizarra', expected: source });
      check('Excalidraw: niega rutas externas y contenido que no es escena', denied === null && !!bad.error);
    } finally { window.confirm = () => true; D.close(); window.confirm = originalConfirm; }
  }

  // Materiales dentro del Markdown: PDF.js, pizarra guardada y widgets Live Preview.
  if (fixtureMdPath && fixturePdfPath) {
    const scenePath = window.mdEditor.joinPath(fixturesDir, 'embed.excalidraw');
    const scene = JSON.stringify({ type: 'excalidraw', version: 2, elements: [
      { id: 'shape', type: 'rectangle', x: 0, y: 0, width: 160, height: 80, strokeColor: '#123456', backgroundColor: '#eeeeee', fillStyle: 'solid', roughness: 0, opacity: 100 },
      { id: 'text', type: 'text', x: 10, y: 20, width: 100, height: 25, text: 'PCP', originalText: 'PCP', fontSize: 20, fontFamily: 1, textAlign: 'left', verticalAlign: 'top', lineHeight: 1.25, opacity: 100 }
    ], appState: { viewBackgroundColor: '#ffffff' }, files: {} });
    await window.mdEditor.saveFile(scene, scenePath, false);
    await window.openFileAtPath(fixtureMdPath);
    const before = window.mdCodeMirror.getValue();
    const source = '# Materiales\n\n![[prueba.pdf#page=1|Apuntes]]\n\n![[embed.excalidraw|Esquema]]\n\nFin';
    const firstPdf = () => document.querySelector('#preview-pane .md-study-embed[data-embed-target*="prueba.pdf"]');
    const drawing = () => document.querySelector('#preview-pane .md-study-embed[data-embed-target*="embed.excalidraw"]');
    const button = (host, label) => [...host.querySelectorAll('button')].find((b) => b.textContent === label);
    try {
      check('PDF incrustado: lectura limitada no afecta al visor normal', await window.mdEditor.pdfReadBytes(fixturePdfPath, 1) === null && !!await window.mdEditor.pdfReadBytes(fixturePdfPath));
      window.mdModes.setLayoutMode('normal'); window.mdCodeMirror.setValue(source); window.renderPreview();
      await waitFor(() => firstPdf()?.querySelector('canvas') && drawing()?.querySelector('canvas'), 20000);
      check('Materiales incrustados: PDF y pizarra con texto se renderizan dentro del apunte', !!firstPdf()?.querySelector('canvas') && !!drawing()?.querySelector('canvas'), `${firstPdf()?.textContent} / ${drawing()?.textContent}`);
      if (firstPdf()?.querySelector('canvas')) {
        const next = button(firstPdf(), 'Siguiente');
        if (!next.disabled) { next.click(); await waitFor(() => firstPdf()?.textContent.includes('Página 2 de')); }
        check('PDF incrustado: navegación no cambia el Markdown ni el contexto del archivo', window.mdCodeMirror.getValue() === source && window.mdState.currentFilePath === fixtureMdPath && (!next.disabled || firstPdf().textContent.includes('Página')));
      }
      if (drawing()?.querySelector('canvas')) {
        const oldCanvas = drawing().querySelector('canvas');
        button(drawing(), 'Editar pizarra').click(); await waitFor(() => window.mdDrawing.getAPI());
        window.mdDrawing.getAPI().updateScene({ appState: { viewBackgroundColor: '#f0eeee' } });
        await waitFor(() => window.mdDrawing.getState().dirty);
        await window.mdDrawing.save(); await waitFor(() => drawing()?.querySelector('canvas') && drawing().querySelector('canvas') !== oldCanvas, 10000);
        check('Pizarra incrustada: guardar edición actualiza vista sin modificar la nota', drawing().querySelector('canvas') !== oldCanvas && window.mdCodeMirror.getValue() === source);
        window.mdDrawing.close();
      }
      window.mdCodeMirror.setCursor({ line: 6, ch: 0 }); window.mdModes.setLayoutMode('live'); window.mdLivePreview.rebuild();
      await waitFor(() => document.querySelector('.cm-live .md-study-embed canvas'), 15000);
      check('Live Preview: materiales incrustados conservan controles y sintaxis editable', document.querySelectorAll('.cm-live .md-study-embed').length === 2 && !!document.querySelector('.cm-live .md-study-embed canvas') && window.mdCodeMirror.getValue() === source);
      window.mdModes.setLayoutMode('normal'); window.mdCodeMirror.setValue('![[../../etc/no-autorizado.pdf]]\n\nFin'); window.renderPreview();
      await waitFor(() => document.querySelector('#preview-pane .md-study-embed')?.textContent.includes('fuera de la carpeta'), 5000);
      check('Materiales incrustados: rutas fuera del proyecto se bloquean antes de leer', document.querySelector('#preview-pane .md-study-embed').textContent.includes('fuera de la carpeta') && !document.querySelector('#preview-pane .md-study-embed canvas'));
      window.mdCodeMirror.setValue('```md\n![[prueba.pdf]]\n![[embed.excalidraw]]\n```'); window.renderPreview();
      check('Materiales incrustados: ejemplos dentro de código permanecen literales', !document.querySelector('#preview-pane .md-study-embed') && document.querySelector('#preview-pane code').textContent.includes('![[embed.excalidraw]]'));
      window.mdCodeMirror.setValue('<span class="md-study-embed" data-embed-target="prueba.pdf" data-embed-base="/etc/falsa.md" data-embed-root="/etc"></span>'); window.renderPreview();
      await waitFor(() => document.querySelector('#preview-pane .md-study-embed')?.textContent.includes('Inserción no válida'));
      check('Materiales incrustados: HTML ajeno no puede falsificar la ruta base ni los permisos', document.querySelector('#preview-pane .md-study-embed').textContent.includes('Inserción no válida') && !document.querySelector('#preview-pane canvas'));
      const exported = window.mdRenderMarkdownForExport(source, fixtureMdPath, fixturesDir);
      check('Exportación: materiales conservan enlaces sin widgets vacíos ni scripts', !exported.includes('md-study-embed') && exported.includes('prueba.pdf#page=1') && exported.includes('embed.excalidraw'));
    } finally {
      const originalConfirm = window.confirm; window.confirm = () => true; window.mdDrawing.close(); window.confirm = originalConfirm;
      window.mdModes.setLayoutMode('normal'); window.mdCodeMirror.setValue(before); window.renderPreview();
      await waitFor(() => window.mdStudyEmbed.activeCount() === 0);
      check('Materiales incrustados: retirar widgets libera sus controladores', window.mdStudyEmbed.activeCount() === 0);
    }
  }

  // Vista de estudio: un único editor y materiales acoplados sin perder estado.
  if (fixturesDir && fixtureMdPath) {
    const originalConfirm = window.confirm; window.confirm = () => true;
    const previousMode = window.mdModes.getLayoutMode();
    await window.openFileAtPath(fixtureMdPath);
    const before = window.mdCodeMirror.getValue();
    try {
      window.mdCodeMirror.setValue('Nota modificada sin guardar\n');
      const pdfPath = window.mdEditor.joinPath(fixturesDir, 'selección (PDF)#.pdf');
      await window.mdStudyWorkspace.open({ notePath: fixtureMdPath, pdfPath });
      check('Vista de estudio: PDF junto al editor y nota modificada intacta', document.querySelector('#study-workspace-pdf .pdfhighlight-modal') && document.getElementById('pdfhighlight-panel').hidden && window.mdCodeMirror.getValue() === 'Nota modificada sin guardar\n' && window.mdModes.getLayoutMode() === 'focus');
      await window.mdPdfHighlight.goToPage(2);
      window.mdPdfHighlight.addHighlightForTest(0.1, 0.1, 0.2, 0.1);
      await window.mdStudyWorkspace.open({ pdfPath });
      check('Vista de estudio: reabrir el mismo PDF conserva página y anotaciones', window.mdPdfHighlight.getState().pageNum === 2 && window.mdPdfHighlight.getState().highlightCount === 1);
      const span = document.querySelector('#study-workspace-pdf .pdf-select-text-layer span');
      const range = document.createRange(); range.selectNodeContents(span);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range); document.dispatchEvent(new Event('selectionchange'));
      document.getElementById('pdfhighlight-add-note').click();
      check('Vista de estudio: cita selección con página sin cerrar el PDF ni sobrescribir nota', window.mdStudyWorkspace.isOpen() && window.mdCodeMirror.getValue().startsWith('Nota modificada sin guardar') && window.mdCodeMirror.getValue().includes('> Texto girado página dos') && window.mdCodeMirror.getValue().includes('%23.pdf#page=2') && document.querySelector('#study-workspace-pdf canvas'));
      const citedNote = window.mdCodeMirror.getValue();
      window.mdTabs.newTab('Otra nota para estudiar');
      check('Vista de estudio: cambiar de pestaña mantiene PDF visible, página y anotaciones', document.querySelector('#study-workspace-pdf canvas') && window.mdPdfHighlight.getState().pageNum === 2 && window.mdPdfHighlight.getState().highlightCount === 1);
      await waitFor(() => [...document.querySelectorAll('#study-workspace .pdf-document-tabs button')].some((b) => b.title === fixtureMdPath));
      [...document.querySelectorAll('#study-workspace .pdf-document-tabs button')].find((b) => b.title === fixtureMdPath).click();
      check('Vista de estudio: volver a la nota conserva sus cambios y cita', window.mdCodeMirror.getValue() === citedNote);
      document.querySelector('#tabbar .tab:last-child .tab-close').click();
      await window.mdStudyWorkspace.showDrawing(window.mdEditor.joinPath(fixturesDir, 'embed.excalidraw'));
      await waitFor(() => window.mdDrawing.getAPI() && window.mdDrawing.getState().ready);
      const api = window.mdDrawing.getAPI(); const elements = api.getSceneElements();
      api.updateScene({ elements: elements.map((item, i) => i ? item : { ...item, strokeColor: item.strokeColor === '#ff0000' ? '#00aa00' : '#ff0000', version: item.version + 1 }) });
      await waitFor(() => window.mdDrawing.getState().dirty);
      document.getElementById('study-workspace-drawing-hide').click();
      await waitFor(() => !document.getElementById('study-workspace').classList.contains('has-drawing'));
      document.getElementById('study-workspace-drawing-show').click();
      await waitFor(() => document.getElementById('study-workspace').classList.contains('has-drawing'));
      check('Vista de estudio: pizarra acoplada editable, ocultar conserva cambios', window.mdDrawing.getState().docked && window.mdDrawing.getState().dirty && document.querySelector('#study-workspace-drawing #drawing-panel') && window.mdCodeMirror.getValue().includes('Nota modificada'));
      window.confirm = () => false;
      check('Vista de estudio: cancelar cierre protege la pizarra modificada', window.mdStudyWorkspace.close() === false && window.mdStudyWorkspace.isOpen() && window.mdDrawing.getState().dirty);
      window.confirm = () => true; window.mdStudyWorkspace.close();
      check('Vista de estudio: cerrar restaura visor y conserva página y anotaciones PDF', !document.getElementById('study-workspace') && document.querySelector('#pdfhighlight-panel .pdfhighlight-modal') && window.mdPdfHighlight.getState().pageNum === 2 && window.mdPdfHighlight.getState().highlightCount === 1);
    } finally {
      window.confirm = () => true; window.mdStudyWorkspace.close(); window.mdDrawing.close(); window.mdPdfHighlight.close();
      window.confirm = originalConfirm; window.mdCodeMirror.setValue(before); window.mdModes.setLayoutMode(previousMode);
    }
  }

  // Atajos configurables: captura, conflictos, desactivación y recuperación.
  {
    await window.mdShortcuts.ready;
    const originalConfig = await window.mdEditor.getConfig();
    const record = (id, key, modifiers = {}) => document.getElementById(`shortcut-${id}`).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }));
    const press = (key, modifiers = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers }));
    const save = async () => { document.getElementById('shortcut-apply').click(); await waitFor(() => !document.getElementById('shortcut-apply').disabled); };
    try {
      window.mdSettingsPanel.open('shortcuts');
      check('Atajos: sección accesible con todos los campos y combinaciones originales', document.querySelector('[data-section="shortcuts"].set-section').hidden === false && document.querySelectorAll('[data-shortcut]').length === window.mdShortcutLogic.actions.length && document.getElementById('shortcut-quickOpen').value === 'Ctrl+P');
      record('quickOpen', 'j', { ctrlKey: true, altKey: true }); await save();
      const stored = await window.mdEditor.getConfig();
      check('Atajos: grabar y guardar confirma configuración persistida', stored.shortcuts.quickOpen === 'Ctrl+Alt+J' && window.mdShortcuts.getBindings().quickOpen === 'Ctrl+Alt+J');
      window.mdSettingsPanel.close(); window.mdFileOpen.close();
      press('p', { ctrlKey: true });
      check('Atajos: combinación anterior ya no abre el buscador rápido', document.getElementById('file-open-panel').hidden);
      press('j', { ctrlKey: true, altKey: true });
      await waitFor(() => !document.getElementById('file-open-panel').hidden);
      check('Atajos: combinación nueva ejecuta la acción', !document.getElementById('file-open-panel').hidden); window.mdFileOpen.close();
      window.mdSettingsPanel.open('shortcuts'); record('palette', 'j', { ctrlKey: true, altKey: true }); await save();
      check('Atajos: conflicto rechazado sin cambiar combinaciones activas', document.getElementById('shortcut-status').textContent.includes('conflicto') && window.mdShortcuts.getBindings().palette === 'Ctrl+Shift+P');
      document.getElementById('shortcut-discard').click(); record('quickOpen', 'q', { ctrlKey: true }); await save();
      check('Atajos: salir y teclas reservadas no se reasignan ni ejecutan al grabar', document.getElementById('shortcut-status').textContent.includes('reservado') && window.mdShortcuts.getBindings().quickOpen === 'Ctrl+Alt+J');
      document.getElementById('shortcut-discard').click(); record('quickOpen', 'Backspace'); await save();
      check('Atajos: quitar conserva desactivación en disco', window.mdShortcuts.getBindings().quickOpen === '' && (await window.mdEditor.getConfig()).shortcuts.quickOpen === '');
      record('tags', 't', { ctrlKey: true, altKey: true }); await save();
      await window.mdModules.setOff(['links']); window.mdTags.close(); window.mdSettingsPanel.close();
      press('t', { ctrlKey: true, altKey: true });
      check('Atajos: combinación personalizada respeta módulos apagados', document.getElementById('tags-panel').hidden);
      window.mdSettingsPanel.open('shortcuts'); document.getElementById('shortcut-reset').click();
      await waitFor(() => !document.getElementById('shortcut-reset').disabled);
      check('Atajos: restauración global recupera predeterminados y limpia cambios guardados', window.mdShortcuts.getBindings().quickOpen === 'Ctrl+P' && Object.keys((await window.mdEditor.getConfig()).shortcuts).length === 0);
    } finally {
      window.mdSettingsPanel.open('shortcuts'); document.getElementById('shortcut-reset').click(); await waitFor(() => !document.getElementById('shortcut-reset').disabled);
      await window.mdEditor.setConfig({ shortcuts: originalConfig.shortcuts || {} });
      await window.mdModules.setOff(originalConfig.disabledModules || []); window.mdSettingsPanel.close(); window.mdFileOpen.close();
    }
  }

  // Rutas: el proceso principal solo deja tocar lo que el usuario abrió
  // (pathguard.js). Afuera: leer, crear, abrir como carpeta, md-local://,
  // bases de datos y git se niegan; adentro (fixtures) todo sigue andando.
  {
    const outsideRead = await window.mdEditor.readFile('/etc/hostname');
    const outsideCreate = await window.mdEditor.createFile('/etc', 'mk-no-deberia.md');
    const outsideFolder = await window.mdEditor.readFolder('/usr/share');
    // Una imagen de afuera no carga; una de adentro (fixtures) sí.
    const loadImg = (p) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve('carga');
      img.onerror = () => resolve('bloqueada');
      img.src = window.mdEditor.toLocalUrl(p);
    });
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>';
    let insideImg = 'sin fixtures';
    let outsideImg = 'sin fixtures';
    if (fixturesDir) {
      await window.mdEditor.saveFile(svg, window.mdEditor.joinPath(fixturesDir, 'guard-ok.svg'), false);
      insideImg = await loadImg(window.mdEditor.joinPath(fixturesDir, 'guard-ok.svg'));
      // El ícono de MK: una imagen real que existe en cualquier máquina y
      // está fuera de lo autorizado (la carpeta del programa).
      const appIcon = window.mdEditor.joinPath(window.mdEditor.dirName(decodeURIComponent(window.location.pathname)), '..', 'build', 'icon.png');
      outsideImg = await loadImg(appIcon);
    }
    const mdLocalStatus = `${insideImg}/${outsideImg}`;
    let dbDenied = false;
    try {
      await window.mdEditor.db.listDatabases('/usr/share');
    } catch {
      dbDenied = true;
    }
    const gitDenied = !(await window.mdEditor.isGitRepo('/usr/share'));
    let insideOk = true;
    if (fixturesDir) insideOk = !!(await window.mdEditor.readFolder(fixturesDir));
    const ok = outsideRead === null && !!(outsideCreate && outsideCreate.error) && outsideFolder === null &&
      mdLocalStatus === 'carga/bloqueada' && dbDenied && gitDenied && insideOk;
    check('Rutas: afuera de lo abierto se niega (leer, crear, carpeta, md-local, base de datos, git); adentro funciona', ok,
      `leer=${outsideRead === null} crear=${outsideCreate && outsideCreate.error} carpeta=${outsideFolder === null} md-local=${mdLocalStatus} db=${dbDenied} git=${gitDenied} adentro=${insideOk}`);
  }

  // Sandbox: el preload usa su propio helper de rutas (sin require('path')).
  // Casos con el resultado de path de Node (generados con Node).
  {
    const cases = [["join",["/a/b","c"],"/a/b/c"],["join",["/a/b","../c","d.md"],"/a/c/d.md"],["join",["/a",""],"/a"],["join",["a","./b"],"a/b"],["dirname",["/a/b/c.md"],"/a/b"],["dirname",["/a"],"/"],["dirname",["c.md"],"."],["dirname",["/a/b/"],"/a"],["resolve",["/a/b/c.md","..","img.png"],"/a/b/img.png"],["resolve",["/a/b","/x/y"],"/x/y"],["relative",["/a/b","/a/b/c/d.md"],"c/d.md"],["relative",["/a/b/c","/a/x"],"../../x"],["relative",["/a","/a"],""],["normalize",["/a//b/./c/.."],"/a/b"],["isAbsolute",["/a"],true],["isAbsolute",["a/b"],false]];
    const got = window.mdEditor.pathSelfTest(cases.map(([fn, args]) => [fn, args]));
    const bad = cases.map((c, i) => (got[i] === c[2] ? null : `${c[0]}(${c[1].join(',')})=${got[i]}≠${c[2]}`)).filter(Boolean);
    check('Sandbox: rutas del preload iguales a las de Node y resaltado de código vía proceso principal',
      bad.length === 0 && (await window.mdEditor.highlightCodeBatch([{ code: 'def f(): return 1', lang: 'python' }]))[0].includes('hljs-keyword'),
      bad.join(' | ') || 'ok');
  }

  // Ninguna función chocó con la Content Security Policy (cspwatch.js).
  {
    const v = window.__mkCspViolations || [];
    check('Content Security Policy: ninguna violación durante toda la suite', v.length === 0, v.slice(0, 5).join(' | ') || 'ninguna');
  }

  return results;
})();
