'use strict';
// Regenera los ejemplos nativos: node scripts/generate-office-examples.js
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const PptxGenJS = require('pptxgenjs');
const JSZip = require('jszip');
const spreadsheet = require('../src/shared/spreadsheet');
const root = path.join(__dirname, '..', 'Ejemplos');
const palette = { ink:'234E70', blue:'3A7CA5', green:'398455', pale:'E8EEF7', paper:'F6F8FC', text:'334155' };
async function excel() {
  const book = new ExcelJS.Workbook(); book.creator = 'MK'; book.title = 'Proyecto Aula Verde'; book.created = new Date('2026-10-07T10:00:00Z');
  const budget = book.addWorksheet('Presupuesto', { views:[{ state:'frozen', ySplit:3 }] });
  budget.columns = [{ width:28 },{ width:19 },{ width:13 },{ width:17 },{ width:19 }];
  budget.mergeCells('A1:E1'); budget.getCell('A1').value = 'AULA VERDE · PRESUPUESTO'; budget.getCell('A1').font = { name:'Calibri', size:20, bold:true, color:{ argb:'FF'+palette.ink } }; budget.getRow(1).height = 34;
  budget.getCell('A2').value = 'Cambia cantidades y precios: los importes se recalculan en MK.';
  budget.getRow(3).values = ['Concepto','Responsable','Cantidad','Precio unitario','Importe'];
  for (const [i, row] of [['Semillas','Ana',12,5],['Herramientas','Luis',8,30],['Riego','Marta',1,150],['Sustrato','Pablo',10,8],['Formación','Lucía',2,90]].entries()) { const n = i+4; budget.getRow(n).values = [...row,{ formula:`C${n}*D${n}` }]; }
  budget.getCell('D10').value = 'Subtotal'; budget.getCell('E10').value = { formula:'SUM(E4:E8)' };
  budget.getCell('C11').value = 0.21; budget.getCell('C11').numFmt = '0%'; budget.getCell('D11').value = 'IVA'; budget.getCell('E11').value = { formula:'E10*C11' };
  budget.getCell('D12').value = 'TOTAL'; budget.getCell('E12').value = { formula:'SUM(E10:E11)' };
  budget.getCell('D14').value = 'Reserva'; budget.getCell('E14').value = 1250;
  budget.getCell('D15').value = 'Saldo'; budget.getCell('E15').value = { formula:'E14-E12' };
  budget.getCell('D16').value = 'Estado'; budget.getCell('E16').value = { formula:'IF(E15>=0,"Dentro de presupuesto","Revisar")' };
  for (let row=4;row<=15;row++) for (const col of ['D','E']) if (typeof budget.getCell(col+row).value !== 'string') budget.getCell(col+row).numFmt = '#,##0.00 "€"';
  const calendar = book.addWorksheet('Calendario'); calendar.columns=[{width:28},{width:19},{width:19},{width:20},{width:28}];
  calendar.addRows([['Fase','Responsable','Inicio','Estado','Entregable'],['Preparar terreno','Ana',new Date('2026-10-12T12:00:00Z'),'En curso','Plano del huerto'],['Sembrar','Luis',new Date('2026-10-19T12:00:00Z'),'Pendiente','Registro de semillas'],['Medir consumo','Marta',new Date('2026-10-26T12:00:00Z'),'Pendiente','Lecturas semanales'],['Presentar resultados','Pablo',new Date('2026-11-23T12:00:00Z'),'Pendiente','Informe y diapositivas']]);
  for (let row=2;row<=5;row++) calendar.getCell('C'+row).numFmt = 'dd/mm/yyyy';
  const metrics=book.addWorksheet('Seguimiento');metrics.columns=[{width:24},{width:18},{width:18},{width:20},{width:20}];
  metrics.addRows([['Semana','Agua (litros)','Cosecha (kg)','Kg por litro','Observación'],['Semana 1',45,3,{formula:'ROUND(C2/B2,3)'},'Siembra inicial'],['Semana 2',38,4,{formula:'ROUND(C3/B3,3)'},'Riego ajustado'],['Semana 3',35,5,{formula:'ROUND(C4/B4,3)'},'Mejora del consumo'],['Semana 4',32,6,{formula:'ROUND(C5/B5,3)'},'Cosecha estable']]);
  metrics.getCell('A7').value='Total agua';metrics.getCell('B7').value={formula:'SUM(B2:B5)'};
  metrics.getCell('A8').value='Promedio cosecha';metrics.getCell('B8').value={formula:'AVERAGE(C2:C5)'};
  metrics.getCell('A10').value='Coste del proyecto';metrics.getCell('B10').value={formula:"'Presupuesto'!E12"};metrics.getCell('B10').numFmt='#,##0.00 "€"';
  metrics.getCell('A12').value = { text:'Objetivos de Desarrollo Sostenible', hyperlink:'https://www.un.org/sustainabledevelopment/es/' };
  for(const ws of book.worksheets){ const header=ws.getRow(ws===budget?3:1);header.eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+palette.ink}};cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.alignment={vertical:'middle',wrapText:true};});header.height=28;ws.eachRow(row=>row.eachCell(cell=>{cell.border={bottom:{style:'thin',color:{argb:'FF'+palette.pale}}};}));ws.autoFilter=ws===budget?'A3:E8':'A1:E5'; }
  budget.getRow(12).eachCell(cell=>{cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF'+palette.pale}};cell.font={bold:true,color:{argb:'FF'+palette.ink}};});
  spreadsheet.recalculate(book);
  const dir=path.join(root,'Excel');fs.mkdirSync(dir,{recursive:true});await book.xlsx.writeFile(path.join(dir,'proyecto-aula-verde.xlsx'));
}
async function powerpoint(){
  const deck=new PptxGenJS();deck.layout='LAYOUT_WIDE';deck.author='MK';deck.subject='Ejemplo completo de presentación';deck.title='Proyecto Aula Verde';deck.lang='es-ES';
  deck.theme={headFontFace:'Calibri',bodyFontFace:'Calibri',lang:'es-ES'};
  function slide(title){const s=deck.addSlide();s.background={color:palette.paper};s.addText(title,{x:.65,y:.4,w:12,h:.75,fontSize:32,bold:true,color:palette.ink,margin:0});s.addText('Aula Verde · MK',{x:.65,y:7,w:9,h:.2,fontSize:11,color:palette.text,margin:0});s.addText(String(deck._slides.length),{x:12,y:7,w:.4,h:.2,fontSize:11,color:palette.text,margin:0});return s;}
  function text(s,t,x,y,w=11.9,h=1.3,size=22){s.addText(t,{x,y,w,h,fontSize:size,color:palette.text,margin:0,breakLine:false});}
  let s=slide('Proyecto Aula Verde');text(s,'Un huerto escolar para aprender sostenibilidad',.65,2,11.6,1.5,38);text(s,'Equipo de coordinación · Octubre de 2026',.65,4.1);text(s,'Ejemplo de PowerPoint con textos, imágenes, tablas y gráfico.',.65,5.3,11.6,.9,20);s.addNotes('Presentar al equipo y explicar el objetivo del proyecto.');
  s=slide('Objetivos');for(const [i,[title,body]] of [['Aprender','Cultivar plantas y registrar su evolución.'],['Medir','Controlar el consumo de agua cada semana.'],['Compartir','Presentar resultados a las familias.']].entries()){const x=.65+i*4.15;s.addShape(deck.ShapeType.roundRect,{x,y:1.8,w:3.8,h:3.6,rectRadius:.15,fill:{color:palette.pale},line:{color:palette.pale}});text(s,title,x+.25,2.2,3.3,.7,28);text(s,body,x+.25,3.1,3.3,1.8,22);}
  s=slide('Calendario de trabajo');s.addTable([['Fase','Fecha','Responsable'],['Preparar terreno','12 octubre','Ana'],['Sembrar','19 octubre','Luis'],['Medir consumo','26 octubre','Marta'],['Presentar resultados','23 noviembre','Pablo']],{x:.65,y:1.7,w:12,h:3.5,fontSize:21,border:{color:'BCCCDC',pt:1},color:palette.text,fill:{color:'FFFFFF'},rowH:.7});text(s,'Cada fase termina con una evidencia en el cuaderno de seguimiento.',.65,5.7,12,1,21);
  s=slide('Presupuesto inicial');s.addChart(deck.ChartType.bar,[{name:'Coste (€)',labels:['Semillas','Herramientas','Riego','Sustrato','Formación'],values:[60,240,150,80,180]}],{x:.65,y:1.6,w:7.8,h:4.6,catAxisLabelFontSize:16,valAxisLabelFontSize:14,showLegend:false,showTitle:false,chartColors:[palette.blue],showValue:true});text(s,'710 €\nSubtotal',9,2.0,3.2,1.5,32);text(s,'859,10 €\nTotal con IVA',9,4,3.2,1.5,28);s.addNotes('Los gráficos se conservan al editar con MK, aunque su vista previa es simplificada.');
  s=slide('Responsables y entregables');for(const [i,[name,role]] of [['Ana','Plano del huerto'],['Luis','Registro de semillas'],['Marta','Mediciones de agua'],['Pablo','Informe y fotografías']].entries()){const x=.65+(i%2)*6.3,y=1.7+Math.floor(i/2)*2.1;s.addShape(deck.ShapeType.rect,{x,y,w:5.8,h:1.7,fill:{color:palette.pale},line:{color:palette.pale}});text(s,name,x+.25,y+.2,5.3,.6,27);text(s,role,x+.25,y+.9,5.3,.5,20);}
  s=slide('Diseño del huerto');const example=path.join(root,'Word','proyecto-aula-verde.docx');if(fs.existsSync(example)){const zip=await JSZip.loadAsync(fs.readFileSync(example));const image=Object.values(zip.files).find(f=>/^word\/media\/.*\.png$/.test(f.name));if(image)s.addImage({data:'image/png;base64,'+await image.async('base64'),x:.65,y:1.8,w:8,h:3});}text(s,'Tres hileras\nNueve plantas por hilera\nTurnos semanales de riego',9,1.8,3.6,3.4,22);text(s,'Imagen incrustada: el documento no depende de archivos externos.',.65,5.8,12,.6,20);
  s=slide('Resultados esperados');text(s,'Consumo semanal: 45 → 32 litros\nCosecha semanal: 3 → 6 kg\nMejor organización de los equipos\nRegistro continuo de decisiones',.85,1.9,11.3,3.9,28);s.addNotes('Distinguir los resultados de ejemplo de las mediciones reales.');
  s=slide('Siguientes pasos');text(s,'1. Revisar el presupuesto.\n2. Confirmar responsables y fechas.\n3. Iniciar la primera fase.\n4. Compartir el informe final.',.85,1.9,11.3,3.7,28);text(s,'Abre este archivo en MK, cambia un texto, mueve una imagen y guarda una copia.',.85,6,11.3,.7,20);
  const dir=path.join(root,'PowerPoint');fs.mkdirSync(dir,{recursive:true});await deck.writeFile({fileName:path.join(dir,'proyecto-aula-verde.pptx')});
}
Promise.all([excel(),powerpoint()]).catch(error=>{console.error(error);process.exitCode=1;});
