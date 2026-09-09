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
    roundTrip = !!onDisk && onDisk.includes(marker);
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

  // 21. Vista de cambios (diff.js) con el paquete "diff" (Myers) en vez del
  // LCS a mano — regresión: que siga marcando agregados/borrados bien
  let diffOk = false;
  if (fixtureMdPath) {
    await window.openFileAtPath(fixtureMdPath);
    const onDisk = await window.mdEditor.readFile(fixtureMdPath);
    window.mdCodeMirror.setValue(onDisk + '\nLinea agregada para el diff.\n');
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

  return results;
})();
