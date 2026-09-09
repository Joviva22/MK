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
  window.mdCodeMirror.setValue('# Titulo de prueba\n\nTexto en **negrita**.');
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
  const tableAnswers = ['3', '2']; // columnas, filas
  const originalPromptTable = window.prompt;
  window.prompt = () => tableAnswers.shift();
  document.getElementById('editor-pane').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  const insertTableBtn = Array.from(document.querySelectorAll('#context-menu button')).find((b) => b.textContent === 'Insertar tabla');
  if (insertTableBtn) insertTableBtn.click();
  window.prompt = originalPromptTable;
  const tableLines = window.mdCodeMirror.getValue().split('\n');
  const threeColsOk = tableLines[0] === '| Columna 1 | Columna 2 | Columna 3 |';
  const sepRowOk = tableLines[1] === '| --- | --- | --- |';
  const twoDataRowsOk = tableLines.length === 4;
  check(
    'Menú contextual: "Insertar tabla" pregunta el tamaño y arma la tabla completa',
    !!insertTableBtn && threeColsOk && sepRowOk && twoDataRowsOk,
    `boton=${!!insertTableBtn} encabezado=${threeColsOk} separador=${sepRowOk} filas=${twoDataRowsOk} contenido="${window.mdCodeMirror.getValue().replace(/\n/g, '\\n')}"`
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
    const originalPrompt = window.prompt;
    const originalConfirm = window.confirm;
    const originalAlert = window.alert;
    let alerted = false;
    window.alert = () => { alerted = true; };
    try {
      const newName = `mgmt-test-${Date.now()}.md`;
      window.prompt = () => newName;
      await window.mdSidebar.createEntry(fixturesDir, false);
      const createdPath = window.mdEditor.joinPath(fixturesDir, newName);
      const createdOnDisk = await window.mdEditor.readFile(createdPath);
      const createdInTree = await waitFor(() =>
        Array.from(document.querySelectorAll('.tree-row span:not(.tree-icon)')).find((el) => el.textContent === newName)
      );

      const renamedName = `mgmt-renamed-${Date.now()}.md`;
      window.prompt = () => renamedName;
      await window.mdSidebar.renameEntry({ nombre: newName, ruta: createdPath, esCarpeta: false });
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
      window.prompt = originalPrompt;
      window.confirm = originalConfirm;
      window.alert = originalAlert;
    }
  } else {
    check('Gestión de archivos: crear/renombrar/eliminar desde el sidebar', false, 'sin fixturesDir');
  }

  // 19. F11 (ver F11.md): sin menú nativo, el atajo pasa por
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
    await waitFor(async () => (await window.mdEditor.readFile(multiAPath)) === null);
    window.confirm = originalConfirmMulti;

    const aGoneOk = (await window.mdEditor.readFile(multiAPath)) === null;
    const bGoneOk = (await window.mdEditor.readFile(multiBPath)) === null;
    multiSelectOk = bothSelectedOk && selectedCountOk && !!bulkDeleteBtn && aGoneOk && bGoneOk;
    multiSelectDetail = `filasSeleccionadasOk=${bothSelectedOk} cuentaOk=${selectedCountOk} botonBulkEncontrado=${!!bulkDeleteBtn} aBorradoOk=${aGoneOk} bBorradoOk=${bGoneOk}`;
  }
  check('Sidebar: Ctrl+clic selecciona varios archivos y el menú contextual los elimina en bloque', multiSelectOk, multiSelectDetail);

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
  const originalPrompt = window.prompt;
  window.prompt = () => 'Mi Título De Prueba';
  let templateOk = false;
  try {
    const apuntesBtn = document.querySelector('#new-menu button[data-template="apuntes"]');
    apuntesBtn.click();
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
    window.prompt = originalPrompt;
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
    const savedPath = await window.mdEditor.exportEpub(document.getElementById('preview-pane').innerHTML, 'Mi Libro', 'test.epub');
    epubOk = !!savedPath && savedPath.endsWith('.epub');
    check('Exportar a EPUB genera un archivo .epub', epubOk, `ruta=${savedPath}`);
  } else {
    check('Exportar a EPUB genera un archivo .epub', false, 'sin fixturesDir');
  }

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

    window.mdKanban.setScope('file');
    window.mdKanban.close();

    kanbanFolderOk = cardsInPorHacer === 2 && hasSourceBadge && !!cardFromA && toggleWroteCorrectFileOk;
    kanbanFolderDetail = `tarjetasPorHacer=${cardsInPorHacer} badgeOrigen=${hasSourceBadge} tarjetaAEncontrada=${!!cardFromA} escribioArchivoCorrecto=${toggleWroteCorrectFileOk}`;
  }
  check('Tablero Kanban en modo "carpeta completa": junta columnas de varios archivos y togglea el archivo correcto', kanbanFolderOk, kanbanFolderDetail);

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

  return results;
})();
