'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const JSZip = require('jszip');
const { inspect, saveRisk } = require('../../src/shared/officecompat');
const { extractOfficeEntries, searchFolder } = require('../../src/office-search');
const { restoreModel } = require('../../src/shared/spreadsheet');
const examples = path.join(__dirname, '../../Ejemplos');
test('Excel: restaurar el modelo conserva combinaciones y opciones de cálculo al volver a guardar', async () => {
  const ExcelJS = require('exceljs'); const original = new ExcelJS.Workbook();
  await original.xlsx.readFile(path.join(examples, 'Excel/proyecto-aula-verde.xlsx'));
  original.calcProperties.fullCalcOnLoad = true;
  original.getWorksheet(1).getRow(5).addPageBreak();
  const restored = restoreModel(new ExcelJS.Workbook(), original.model);
  assert.ok(restored.getWorksheet(1).getCell('A1').isMerged);
  assert.equal(restored.calcProperties.fullCalcOnLoad, true);
  assert.equal(restored.getWorksheet(1).rowBreaks.length, 1);
  const reread = new ExcelJS.Workbook(); await reread.xlsx.load(await restored.xlsx.writeBuffer());
  assert.ok(reread.getWorksheet(1).getCell('A1').isMerged);
  assert.equal(reread.getWorksheet('Calendario').getCell('C2').value.toISOString(), '2026-10-12T12:00:00.000Z');
});
test('compatibilidad: campos, cambios y encabezados se explican antes de guardar', () => {
  const warnings = inspect('docx', ['word/header1.xml'], '<w:fldChar w:fldCharType="begin"/><w:ins w:id="1"><w:t>Nuevo</w:t></w:ins>');
  assert.deepEqual(warnings.sort(), ['campos automáticos', 'control de cambios', 'encabezados o pies de página'].sort());
  assert.match(saveRisk('docx', warnings), /campos automáticos/);
  assert.match(saveRisk('docx', []), /maquetación/);
  assert.equal(saveRisk('xlsx', []), '');
  assert.match(saveRisk('xlsx', inspect('xlsx', ['xl/charts/chart1.xml', 'xl/connections.xml'])), /gráficos.*conexiones de datos/);
  assert.equal(saveRisk('pptx', []), '');
});
test('búsqueda de ejemplos completos: Word, hojas y fórmulas, diapositivas en orden', async () => {
  for (const [dir, kind, expected] of [['Word','docx','aprender haciendo'], ['Excel','xlsx','SUM(E4:E8)'], ['PowerPoint','pptx','Diseño del huerto']]) {
    const entries = await extractOfficeEntries(await fs.readFile(path.join(examples, dir, `proyecto-aula-verde.${kind}`)), kind);
    const hit = entries.find(e => e.text.includes(expected)); assert.ok(hit, kind);
    if (kind === 'xlsx') assert.deepEqual(hit.location, { sheet:'Presupuesto', address:'E10' });
    if (kind === 'pptx') assert.equal(typeof hit.location.slide, 'number');
    if (kind === 'docx') assert.ok(hit.location.paragraph > 0);
  }
});
test('búsqueda: entidades y prefijos XML, orden real de diapositivas', async () => {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', '<p:presentation><p:sldIdLst><p:sldId id="256" r:id="r2"/><p:sldId id="257" r:id="r1"/></p:sldIdLst></p:presentation>');
  zip.file('ppt/_rels/presentation.xml.rels', '<Relationships><Relationship Id="r1" Target="slides/slide1.xml"/><Relationship Id="r2" Target="slides/slide2.xml"/></Relationships>');
  zip.file('ppt/slides/slide1.xml', '<x:p><x:r><x:t>Segundo</x:t></x:r></x:p>');
  zip.file('ppt/slides/slide2.xml', '<x:p><x:r><x:t>Agua &amp; </x:t></x:r><x:r><x:t>H&#x32;O &lt; 10</x:t></x:r></x:p>');
  const entries = await extractOfficeEntries(await zip.generateAsync({ type:'nodebuffer' }), 'pptx');
  assert.equal(entries[0].text, 'Agua & H2O < 10'); assert.equal(entries[0].location.slide, 0);
  assert.equal(entries[1].text, 'Segundo'); assert.equal(entries[1].location.slide, 1);
});
test('búsqueda Word: párrafos idénticos conservan su ubicación independiente', async () => {
  const zip = new JSZip(); zip.file('word/document.xml', '<w:body><w:p><w:r><w:t>Texto repetido</w:t></w:r></w:p><w:p><w:r><w:t>Texto repetido</w:t></w:r></w:p></w:body>');
  const entries = await extractOfficeEntries(await zip.generateAsync({ type:'nodebuffer' }), 'docx');
  assert.equal(entries[0].location.occurrence, 1); assert.equal(entries[1].location.occurrence, 2);
  assert.equal(entries[1].location.paragraph, 2);
});
test('búsqueda: cambios externos invalidan caché, archivos dañados se avisan y enlaces se omiten', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mk-office-search-'));
  t.after(() => fs.rm(root, { recursive:true, force:true }));
  const zip = new JSZip(); zip.file('word/document.xml', '<w:p><w:r><w:t>Semillas iniciales</w:t></w:r></w:p>');
  const target = path.join(root, 'informe.docx'); await fs.writeFile(target, await zip.generateAsync({ type:'nodebuffer' }));
  await fs.writeFile(path.join(root, 'roto.xlsx'), 'Archivo dañado');
  await fs.symlink(path.join(examples, 'Word/proyecto-aula-verde.docx'), path.join(root, 'externo.docx'));
  const first = await searchFolder(root, 'semillas'); assert.equal(first.results.length, 1); assert.equal(first.skipped.length, 1);
  zip.file('word/document.xml', '<w:p><w:r><w:t>Contenido reemplazado</w:t></w:r></w:p>');
  await fs.writeFile(target, await zip.generateAsync({ type:'nodebuffer' }));
  assert.equal((await searchFolder(root, 'semillas')).results.length, 0);
  assert.equal((await searchFolder(root, 'reemplazado')).results.length, 1);
});
