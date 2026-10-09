(async () => {
  const results = [];
  const check = (name, pass, detail = '') => { console.log('MK_TEST_PROGRESS:' + name); results.push({ name, pass:!!pass, detail }); };
  const api = window.mdOffice;
  const params = new URLSearchParams(window.location.search);
  const root = params.get('mkTestFixtures');
  const xmlOf = async (base64, part) => (await window.JSZip.loadAsync(base64, { base64:true })).file(part).async('string');
  async function saveReviewed(as = false, choice = 'save') {
    let finished = false;
    const job = api.save(as).finally(() => { finished = true; });
    for (let attempt = 0; attempt < 200 && !finished; attempt++) {
      const node = document.querySelector('dialog.office-guide[open]');
      if (node?.textContent.includes('Revisar antes de guardar')) {
        const caption = choice === 'copy' ? 'Guardar una copia…' : choice === 'cancel' ? 'Cancelar' : as ? 'Guardar documento' : 'Guardar en el archivo original';
        const button = [...node.querySelectorAll('button')].find(button => button.textContent === caption);
        if (!button) { const text = node.textContent; node.close(); throw new Error('Acción de guardado ausente: ' + caption + ' · ' + text); }
        button.click();
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    await job;
  }
  async function closeActive() { const state = api.getState(); if (state?.modified) await saveReviewed(true); document.querySelector('#tabbar .tab.active .tab-close')?.click(); }
  try {
    await api.open(window.mdEditor.joinPath(root, 'prueba.docx'));
    check('Office Word: abrir conserva la ruta y usa un editor visual', window.mdTabs.getActiveState().kind === 'docx' && api.getState().filePath.endsWith('prueba.docx') && document.querySelector('.office-word-page').isContentEditable);
    const first = document.querySelector('.office-word-page').textContent;
    await api.setWordHtml('<h1>Informe visual</h1><p><strong>Presupuesto</strong> con <u>subrayado</u>, H<sub>2</sub>O y <span style="color:#cc3344;font-size:18pt;font-family:Georgia">color y tamaño</span>.</p><table><tr><th colspan="2">Equipo</th></tr><tr><td>Ana</td><td>75 €</td></tr></table><p>Coincidencia repetida</p><p>Coincidencia repetida</p>');
    check('Office Word: editar marca la pestaña como pendiente', api.getState().modified && window.mdTabs.getActiveState().modified);
    await api.undo(); check('Office Word: deshacer recupera el documento original', document.querySelector('.office-word-page').textContent === first && !api.getState().modified);
    await api.undo(1); check('Office Word: rehacer recupera la edición', document.querySelector('.office-word-page').textContent.includes('Informe visual'));
    const packageXml = await xmlOf(await api.exportBase64(), 'word/document.xml');
    check('Office Word: exporta estilos y tablas combinadas reales', /w:u/.test(packageXml) && /w:color w:val="cc3344"/i.test(packageXml) && /w:sz w:val="36"/.test(packageXml) && /w:gridSpan w:val="2"/.test(packageXml));
    // La búsqueda visual debe atravesar nodos con distinto formato.
    document.querySelector('.office-search').value = 'Presupuesto con'; document.querySelector('.office-search').dispatchEvent(new Event('input'));
    document.querySelector('.office-search').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
    await new Promise(r => setTimeout(r, 30));
    check('Office Word: búsqueda encuentra frases que atraviesan negrita y texto normal', window.getSelection().toString() === 'Presupuesto con');
    await saveReviewed(true); const wordPath = api.getState().filePath; const cleanRecovery = api.getState().content;
    check('Office Word: guardar escribe un .docx nativo y limpia el estado', wordPath.endsWith('.docx') && !api.getState().modified);
    await api.reveal({ filePath:wordPath, location:{ text:'Coincidencia repetida', occurrence:2 } }, 'repetida');
    const repeatedParagraphs = [...document.querySelectorAll('.office-word-page p')].filter(node => node.textContent === 'Coincidencia repetida');
    check('Búsqueda Word: distingue párrafos idénticos', window.getSelection().anchorNode.parentElement.closest('p') === repeatedParagraphs[1]);

    await api.setWordHtml('<h1>Cambios recuperados</h1><p>Edición pendiente.</p>');
    await new Promise(resolve => setTimeout(resolve, 350));
    const savedSession = await window.mdEditor.loadSession();
    check('Office: la sesión local contiene la recuperación pendiente', savedSession.tabs.some(tab => tab.kind === 'docx' && tab.modified && JSON.parse(tab.content).value.html.includes('Cambios recuperados')));
    const recovery = api.getState(); api.forget(recovery.key); await api.restore(recovery.content, recovery.filePath);
    check('Office Word: recuperar mantiene contenido pendiente y la ruta', api.getState().modified && api.getState().filePath === wordPath && document.querySelector('.office-word-page').textContent.includes('Cambios recuperados'));
    await api.undo(); check('Office Word: la recuperación conserva el historial de deshacer', document.querySelector('.office-word-page').textContent.includes('Informe visual') && !api.getState().modified);
    await api.undo(1);
    const disk = await window.mdEditor.officeRead(wordPath);
    const foreign = await window.mdDocxExport.buildHtmlBase64('<p>Edición externa</p>');
    const external = await window.mdEditor.officeSave({ kind:'docx', filePath:wordPath, base64:foreign, expected:disk.version });
    await saveReviewed();
    const afterConflict = await window.mdEditor.officeRead(wordPath);
    check('Office: un cambio externo bloquea el guardado y conserva ambos contenidos', !external.error && afterConflict.base64 === foreign && api.getState().modified && document.querySelector('.office-status').textContent.includes('cambió fuera'));
    await closeActive();
    await api.restore(cleanRecovery, wordPath);
    check('Office: documentos guardados se recuperan desde la versión actual del disco', document.querySelector('.office-word-page').textContent.includes('Edición externa') && !api.getState().modified);
    await closeActive();

    await api.create('xlsx');
    check('Office Excel: crea un libro con cuadrícula editable', window.mdTabs.getActiveState().kind === 'xlsx' && !!document.querySelector('.office-grid'));
    await api.setCell(1, 'A1', '12'); await api.setCell(1, 'B1', '5'); await api.setCell(1, 'C1', '=SUM(A1:B1)');
    check('Office Excel: valores numéricos y fórmulas se recalculan', api.getCell(1, 'A1') === 12 && api.getCell(1, 'C1').result === 17);
    await api.setCell(1, 'A1', '20'); check('Office Excel: dependencias se actualizan al editar', api.getCell(1, 'C1').result === 25);
    await api.undo(); check('Office Excel: deshacer restaura valores y fórmulas', api.getCell(1, 'A1') === 12 && api.getCell(1, 'C1').result === 17);
    await api.undo(1); check('Office Excel: rehacer restaura el cálculo', api.getCell(1, 'C1').result === 25);
    await api.setCell(1, 'D1', 'Semillas');
    document.querySelector('.office-search').value = 'Semillas'; document.querySelector('.office-search').dispatchEvent(new Event('input'));
    document.querySelector('.office-search').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true })); await new Promise(r => setTimeout(r, 50));
    check('Office Excel: buscar selecciona la celda encontrada', document.querySelector('.office-cell-selected').dataset.address === 'D1');
    document.querySelector('.office-grid td[data-address="E1"]').click();
    const transfer = new DataTransfer(); transfer.setData('text/plain', '3\t4\n5\t6');
    document.querySelector('.office-grid-scroll').dispatchEvent(new window.ClipboardEvent('paste', { bubbles:true, cancelable:true, clipboardData:transfer }));
    check('Office Excel: pegar una tabla conserva filas, columnas y tipos', api.getCell(1,'E1') === 3 && api.getCell(1,'F2') === 6 && document.querySelector('[data-address="E1"]').textContent === '3');
    const saveButton = document.querySelector('[data-office-action="save"]');
    document.querySelector('.office-grid td[data-address="E1"]').dispatchEvent(new MouseEvent('dblclick', { bubbles:true }));
    const field = document.querySelector('.office-cell-edit'); field.value = 'Edición directa'; field.dispatchEvent(new Event('blur'));
    check('Office Excel: confirmar una celda no desmonta el botón Guardar', saveButton.isConnected && api.getCell(1,'E1') === 'Edición directa');
    await saveReviewed(); const excelPath = api.getState().filePath;
    const workbook = new window.ExcelJS.Workbook(); await workbook.xlsx.load(Uint8Array.from(atob((await window.mdEditor.officeRead(excelPath)).base64), c => c.charCodeAt(0)));
    check('Office Excel: guardado real conserva fórmulas y valores', workbook.getWorksheet(1).getCell('C1').formula === 'SUM(A1:B1)' && workbook.getWorksheet(1).getCell('C1').result === 25);
    await api.setCell(1, 'B1', '10'); const excelRecovery = api.getState(); api.forget(excelRecovery.key); await api.restore(excelRecovery.content, excelRecovery.filePath);
    check('Office Excel: recuperación reproduce operaciones y recalcula', api.getCell(1, 'B1') === 10 && api.getCell(1, 'C1').result === 30 && api.getState().modified);
    const excelKey = api.getState().key; window.mdTabs.newTab('# Nota de prueba');
    check('Office: cambiar a Markdown oculta el editor Office', !document.querySelector('.office-word-page') && !document.querySelector('.container').classList.contains('office-active'));
    await api.activate(excelKey); check('Office: cambiar de pestaña conserva las celdas pendientes', api.getCell(1, 'B1') === 10 && api.getState().modified);
    await closeActive();

    await api.create('pptx'); const items = await api.getSlideItems(0); const textItem = items.find(item => item.kind === 'sp');
    check('Office PowerPoint: crea una presentación con diapositivas visuales', window.mdTabs.getActiveState().kind === 'pptx' && !!document.querySelector('.office-slide-canvas') && !!textItem);
    const originalText = textItem.text;
    await api.editSlide(0, textItem.id, 'Proyecto Aula Verde'); check('Office PowerPoint: editar cambia el texto visual', (await api.getSlideItems(0)).find(item => item.id === textItem.id).text === 'Proyecto Aula Verde');
    await api.undo(); check('Office PowerPoint: deshacer conserva los cuadros originales', (await api.getSlideItems(0)).find(item => item.id === textItem.id).text === originalText);
    await api.undo(1);
    const add = [...document.querySelectorAll('.office-formatbar button')].find(button => button.textContent === '+ Diapositiva'); add.click(); await new Promise(r => setTimeout(r, 80));
    check('Office PowerPoint: añadir diapositiva actualiza la lista', document.querySelectorAll('.office-slide-list button').length === 2);
    const pptXml = await xmlOf(await api.exportBase64(), 'ppt/presentation.xml');
    check('Office PowerPoint: el paquete exportado registra las dos diapositivas', (pptXml.match(/<p:sldId /g) || []).length === 2);
    await saveReviewed(); const pptPath = api.getState().filePath; const pptRecovery = api.getState(); api.forget(pptRecovery.key); await api.restore(pptRecovery.content, pptPath);
    check('Office PowerPoint: recuperar conserva diapositivas y textos', document.querySelectorAll('.office-slide-list button').length === 2 && (await api.getSlideItems(0)).find(item => item.id === textItem.id).text === 'Proyecto Aula Verde');
    await closeActive();

    // Un PPTX importado debe conservar partes que el editor no interpreta.
    const source = await window.mdPresentation.create(); const zip = await window.JSZip.loadAsync(source, { base64:true }); zip.file('ppt/custom-preserved.xml', '<custom>Dato intacto</custom>');
    const imported = await zip.generateAsync({ type:'base64' }); const deck = await window.mdPresentation.load(imported); const shapes = await deck.items(0); deck.setText(0, shapes.find(s => s.kind === 'sp').id, 'Texto modificado');
    deck.addSlide(0, true); deck.reorder(1, -1); deck.removeSlide(1);
    const preserved = await window.JSZip.loadAsync(await deck.exportBase64(), { base64:true });
    check('Office PowerPoint: editar y reordenar conserva las partes ajenas del paquete', await preserved.file('ppt/custom-preserved.xml').async('string') === '<custom>Dato intacto</custom>');
    const examplePath = kind => window.mdEditor.joinPath(root, 'OfficeCompat', `proyecto-aula-verde.${kind}`);
    const wordOriginal = await window.mdEditor.officeRead(examplePath('docx'));
    await api.open(examplePath('docx'));
    check('Compatibilidad Word: ejemplo completo con estilos, imagen y tablas', !!document.querySelector('.office-word-page img') && document.querySelectorAll('.office-word-page table').length === 2 && !!document.querySelector('.office-word-page strong'));
    await api.setWordHtml(document.querySelector('.office-word-page').innerHTML + '<p>Revisión de compatibilidad</p>');
    const beforeCancel = document.querySelector('.office-word-page'); beforeCancel.focus();
    await saveReviewed(false, 'cancel');
    check('Accesibilidad Office: cancelar la revisión devuelve el foco al documento', document.activeElement === beforeCancel);
    check('Compatibilidad Word: cancelar conserva el original y los cambios pendientes', (await window.mdEditor.officeRead(examplePath('docx'))).base64 === wordOriginal.base64 && api.getState().modified && !api.getState().saving);
    await saveReviewed(false, 'copy'); const wordCopy = api.getState().filePath;
    check('Compatibilidad Word: guardar copia no reemplaza el original', wordCopy !== examplePath('docx') && (await window.mdEditor.officeRead(examplePath('docx'))).base64 === wordOriginal.base64 && !api.getState().modified);
    await api.undo(); check('Flujo Word: deshacer después de guardar marca cambios pendientes', api.getState().modified);
    await api.undo(1); check('Flujo Word: rehacer vuelve al estado guardado', !api.getState().modified);
    await closeActive(); await api.open(wordCopy);
    check('Flujo Word: cerrar y abrir conserva texto, imagen y ambas tablas', document.querySelector('.office-word-page').textContent.includes('Revisión de compatibilidad') && !!document.querySelector('.office-word-page img') && document.querySelectorAll('.office-word-page table').length === 2);
    const wordVersion = await window.mdEditor.officeRead(wordCopy);
    await window.mdEditor.officeSave({ kind:'docx', filePath:wordCopy, expected:wordVersion.version, base64:await window.mdDocxExport.buildHtmlBase64('<p>Actualización externa limpia</p>') });
    await api.checkDisk(api.getState().key);
    check('Flujo Word: cambio externo recarga una pestaña limpia', document.querySelector('.office-word-page').textContent === 'Actualización externa limpia' && !api.getState().modified);
    await closeActive();

    await api.open(examplePath('xlsx'));
    await api.setCell(1, 'C4', '20'); await api.setCell(1, 'F4', '=FUNCION_NO_ADMITIDA(A1)');
    await saveReviewed(true); const fullExcelPath = api.getState().filePath;
    const fullBook = new window.ExcelJS.Workbook(); await fullBook.xlsx.load(Uint8Array.from(atob((await window.mdEditor.officeRead(fullExcelPath)).base64), c => c.charCodeAt(0)));
    check('Compatibilidad Excel: hojas, estilos, combinaciones, fechas y vínculos', fullBook.worksheets.length === 3 && fullBook.getWorksheet(1).getCell('A1').isMerged && fullBook.getWorksheet(1).getCell('A3').font.bold && fullBook.getWorksheet('Calendario').getCell('C2').value instanceof Date && fullBook.getWorksheet('Seguimiento').getCell('A12').value.hyperlink.startsWith('https:'), JSON.stringify({ sheets:fullBook.worksheets.length, merged:fullBook.getWorksheet(1).getCell('A1').isMerged, font:fullBook.getWorksheet(1).getCell('A3').font, date:fullBook.getWorksheet('Calendario').getCell('C2').value, dateType:typeof fullBook.getWorksheet('Calendario').getCell('C2').value, link:fullBook.getWorksheet('Seguimiento').getCell('A12').value }));
    check('Compatibilidad Excel: fórmulas entre hojas y fórmulas no admitidas se conservan', fullBook.getWorksheet('Seguimiento').getCell('B10').formula === "'Presupuesto'!E12" && fullBook.getWorksheet(1).getCell('F4').formula === 'FUNCION_NO_ADMITIDA(A1)' && fullBook.getWorksheet(1).getCell('E4').result === 100);
    await closeActive(); await api.open(fullExcelPath);
    check('Flujo Excel: cerrar y abrir conserva la edición y el resultado calculado', api.getCell(1,'C4') === 20 && api.getCell(1,'E4').result === 100);
    const toolToggle = [...document.querySelectorAll('.office-toolbar button')].find(b => b.textContent === 'Herramientas'); toolToggle.click();
    await new Promise(resolve => setTimeout(resolve, 80));
    check('Interfaz Office: ocultar herramientas conserva acceso a las celdas', document.querySelector('.office-formatbar').hidden && toolToggle.getAttribute('aria-expanded') === 'false' && !!document.querySelector('.office-grid'));
    await api.undo(-1); await api.activate(api.getState().key);
    check('Interfaz Office: preferencia de herramientas se conserva al reconstruir', document.querySelector('.office-formatbar').hidden);
    toolToggle.isConnected ? toolToggle.click() : [...document.querySelectorAll('.office-toolbar button')].find(b => b.textContent === 'Herramientas').click();
    await new Promise(resolve => setTimeout(resolve, 80));
    document.querySelector('.office-grid-scroll').focus();
    document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key:'f', ctrlKey:true, shiftKey:true, bubbles:true }));
    check('Teclado Office: Ctrl+Shift+F abre la búsqueda global', !document.getElementById('search-panel').hidden);
    window.mdSearch.close();
    const hits = await window.mdEditor.searchOffice(root, 'semillas');
    check('Búsqueda global: encuentra contenido de los tres formatos Office', ['docx','xlsx','pptx'].every(kind => hits.results.some(r => r.kind === kind)));
    const excelHit = hits.results.find(r => r.kind === 'xlsx'); await api.reveal(excelHit, 'semillas');
    check('Búsqueda global: lleva a la celda concreta', document.querySelector('.office-cell-selected').dataset.address === excelHit.location.address);
    const pptHit = hits.results.find(r => r.kind === 'pptx'); await api.reveal(pptHit, 'semillas');
    check('Búsqueda global: lleva a la diapositiva concreta', [...document.querySelectorAll('.office-slide-list button')].indexOf(document.querySelector('.office-slide-active')) === pptHit.location.slide);
    const pptItems = await api.getSlideItems(pptHit.location.slide); const pptText = pptItems.find(item => item.kind === 'sp' && !item.readOnly);
    await api.editSlide(pptHit.location.slide, pptText.id, 'Diapositiva revisada'); await saveReviewed(true); const fullPptPath = api.getState().filePath;
    await closeActive(); await api.open(fullPptPath);
    check('Flujo PowerPoint: cerrar y abrir conserva la edición y las ocho diapositivas', (await api.getSlideItems(pptHit.location.slide)).some(item => item.text === 'Diapositiva revisada') && document.querySelectorAll('.office-slide-list button').length === 8);
    const presenter = [...document.querySelectorAll('.office-formatbar button')].find(b => b.textContent === 'Presentar'); presenter.focus(); presenter.click();
    await new Promise(resolve => setTimeout(resolve, 100));
    const presentation = document.querySelector('dialog.office-present-overlay[open]');
    check('Accesibilidad PowerPoint: presentación modal con foco dentro', !!presentation && presentation.contains(document.activeElement));
    presentation.close(); check('Accesibilidad PowerPoint: cerrar devuelve el foco', document.activeElement === presenter);
    await closeActive();
    const wordHit = hits.results.find(r => r.kind === 'docx'); await api.reveal(wordHit, 'semillas');
    check('Búsqueda global: selecciona el texto de Word', window.getSelection().toString().toLowerCase() === 'semillas');
    await closeActive();
    const deniedSearch = await window.mdEditor.searchOffice('/etc', 'passwd'); check('Búsqueda Office: rechaza carpetas no autorizadas', deniedSearch.results.length === 0);
    const denied = await window.mdEditor.officeRead('/etc/passwd'); check('Office: leer rutas no autorizadas no expone contenido', !!denied.error && !denied.base64);
    const malformed = await window.mdEditor.officeSave({ kind:'xlsx', base64:'AAAA' }); check('Office: datos inválidos no se guardan', !!malformed.error);
    for (const id of ['report','meeting','budget','calendar','project']) {
      const item = window.mdOfficeTools.catalog.find(item => item.id === id);
      await api.create(item.kind, await window.mdOfficeTools.sourceFor(id));
      check('Plantilla completa: ' + id, api.getState().kind === item.kind && !!document.querySelector('#office-panel'));
      if (id === 'budget') {
        await api.setCell(1, 'B2', '2'); await api.setCell(1, 'C2', '10');
        check('Plantilla presupuesto: calcula IVA y total', api.getCell(1, 'E2').result === 24.2 && api.getCell(1, 'E12').result === 24.2);
      }
      if (id === 'project') check('Plantilla presentación: seis diapositivas', document.querySelectorAll('.office-slide-list button').length === 6);
      check('Barra contextual de Office', document.body.classList.contains('office-context') && getComputedStyle(document.getElementById('btn-toc')).display === 'none');
      window.mdOfficeTools.help(item.kind);
      check('Ayuda integrada accesible: ' + id, document.querySelector('dialog.office-guide[open]').open && document.querySelector('dialog.office-guide[open]').textContent.includes('Ejemplo'));
      document.querySelector('dialog.office-guide[open]').close(); await closeActive();
    }
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 5);
    const loaded = await window.mdOfficeTools.task('excel', { source:await window.mdOfficeTools.sourceFor('budget') });
    clearInterval(timer);
    check('Office: la interfaz responde durante la lectura en segundo plano', ticks > 0 && loaded.model.sheets.length === 1);
    window.mdOfficeTools.progress('Preparando documento de prueba…');
    check('Office: progreso accesible de apertura', document.querySelector('.office-opening[role="status"] progress') !== null);
    window.mdOfficeTools.progress(null);
    check('Office: el progreso se retira al finalizar', !document.querySelector('.office-opening'));
    window.mdOfficeTools.templates();
    check('Catálogo de plantillas accesible', document.querySelectorAll('.office-template').length === 5 && document.querySelector('dialog.office-guide[open]').open);
    document.querySelector('dialog.office-guide[open]').close();
    const csp = window.__mkCspViolations || []; check('Office: las bibliotecas funcionan con la política CSP de MK', csp.length === 0, csp.join(' | '));
  } catch (error) { check('Office: integración completa', false, error.stack || String(error)); }
  finally { window.mdOffice.hide(); window.mdTabs.newTab('# Fin de pruebas Office'); }
  return results;
})();
