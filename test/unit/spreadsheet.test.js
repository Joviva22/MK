'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const sheet = require('../../src/shared/spreadsheet');
test('Excel: entradas numéricas, texto explícito y fórmulas', () => {
  assert.equal(sheet.parseInput('12,50'), 12.5);
  assert.equal(sheet.parseInput("'=SUM(A1)"), '=SUM(A1)');
  assert.equal(sheet.parseInput('001-A'), '001-A');
  assert.deepEqual(sheet.parseInput('=SUMA(A1:A3)'), { formula:'SUMA(A1:A3)' });
  assert.equal(sheet.parseInput('2026-10-12').toISOString().slice(0,10), '2026-10-12');
  assert.equal(sheet.parseInput('2026-02-31'), '2026-02-31');
  assert.equal(sheet.columnName(27), 'AA'); assert.equal(sheet.columnName(16384), 'XFD');
});
test('Excel: referencias, rangos, dependencias entre hojas y recálculo', () => {
  const wb = new ExcelJS.Workbook(), data = wb.addWorksheet('Datos'), total = wb.addWorksheet('Resumen');
  data.addRows([[2,3],[5,7]]); data.getCell('C1').value = { formula:'A1*B1' }; data.getCell('C2').value = { formula:'A2*B2' };
  total.getCell('A1').value = { formula:"SUM('datos'!C1:C2)" };
  assert.equal(sheet.recalculate(wb).size, 0); assert.equal(total.getCell('A1').result, 41);
  data.getCell('A1').value = 4; sheet.recalculate(wb); assert.equal(total.getCell('A1').result, 47);
  assert.equal(total.getCell('A1').formula, "SUM('datos'!C1:C2)");
});
test('Excel: IF solo evalúa la rama seleccionada y redondea negativos', () => {
  assert.equal(sheet.evaluate('IF(1>0,7,1/0)'), 7);
  assert.equal(sheet.evaluate('SI(FALSO;1/0;REDONDEAR(-1.5;0))'), -2);
  assert.equal(sheet.evaluate('2+3*4^2'), 50);
});
test('Excel: ciclos, fórmulas no admitidas y límites se muestran sin ejecutar código', () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Hoja');
  ws.getCell('A1').value = { formula:'B1' }; ws.getCell('B1').value = { formula:'A1' };
  ws.getCell('C1').value = { formula:'UNSUPPORTED(2)', result:42 };
  const errors = sheet.recalculate(wb);
  assert.equal(errors.get(ws.id+'!A1'), '#CICLO!'); assert.equal(errors.get(ws.id+'!C1'), '#N/D');
  assert.equal(ws.getCell('C1').result, 42);
  assert.throws(() => sheet.evaluate('globalThis.process.exit(1)'), /#N\/D/);
  ws.getCell('D1').value = { formula:'SUM(A1:XFD1048576)' }; assert.equal(sheet.recalculate(wb).get(ws.id+'!D1'), '#N/D');
});
test('Excel: el fichero real conserva tipos, formato y fórmulas tras escribir y leer', async () => {
  const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Presupuesto');
  ws.getCell('A1').value = 'Semillas'; ws.getCell('B1').value = 12; ws.getCell('C1').value = { formula:'B1*5', result:60 }; ws.getCell('C1').numFmt = '#,##0.00 "€"';
  const result = new ExcelJS.Workbook(); await result.xlsx.load(await wb.xlsx.writeBuffer());
  assert.equal(result.getWorksheet(1).getCell('C1').formula, 'B1*5'); assert.equal(result.getWorksheet(1).getCell('C1').numFmt, '#,##0.00 "€"');
});
