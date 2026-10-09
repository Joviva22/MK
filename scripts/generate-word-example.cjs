// Regenera el documento de demostración: node scripts/generate-word-example.cjs
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const {Document,Packer,Paragraph,TextRun,HeadingLevel,Table,TableRow,TableCell,WidthType,ExternalHyperlink,ImageRun,PageBreak}=require('docx');
const dir=path.join(__dirname, '..', 'Ejemplos', 'Word'); fs.mkdirSync(dir,{recursive:true});
const p=(text,opts={})=>new Paragraph({children:[new TextRun(text)],...opts});
const heading=(text)=>p(text,{heading:HeadingLevel.HEADING_1});
const cell=(text,opts={})=>new TableCell({children:[p(text)],...opts});
// Ilustración geométrica del huerto: PNG autónomo, sin descargas.
const width = 480, height = 180;
const raw = Buffer.alloc((width * 3 + 1) * height);
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    let color = [224, 241, 227];
    if (x > 20 && x < 460 && y > 20 && y < 160) color = [139, 97, 65];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 9; col++) {
      const dx = x - (50 + col * 47), dy = y - (45 + row * 45);
      if (dx * dx + dy * dy < 140) color = [47, 128, 68];
      if ((dx - 6) ** 2 + (dy + 4) ** 2 < 45) color = [100, 177, 86];
    }
    const offset = y * (width * 3 + 1) + 1 + x * 3;
    raw[offset] = color[0]; raw[offset + 1] = color[1]; raw[offset + 2] = color[2];
  }
}
function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let crc = 0xffffffff;
  for (const byte of payload) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, checksum]);
}
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);

const children=[p('Proyecto Aula Verde',{heading:HeadingLevel.TITLE}),p('Informe de planificación · Ejemplo completo para MK',{heading:HeadingLevel.SUBTITLE}),p('Autora: Lucía Martín · Versión 1.0 · 7 de octubre de 2026'),heading('1. Resumen ejecutivo'),p('Este proyecto propone un huerto escolar, un registro de consumo de agua y talleres de sostenibilidad. El documento demuestra qué contenido de Word puedes consultar, editar y exportar desde MK.'),new Paragraph({children:[new TextRun({text:'Objetivo principal: ',bold:true}),new TextRun({text:'aprender haciendo',italics:true}),new TextRun({text:' y compartir los resultados con las familias.'})]}),heading('2. Formatos de texto'),new Paragraph({children:[new TextRun({text:'Negrita. ',bold:true}),new TextRun({text:'Cursiva. ',italics:true}),new TextRun({text:'Subrayado. ',underline:{}}),new TextRun({text:'Texto eliminado. ',strike:true}),new TextRun({text:'Atención destacada.',highlight:'yellow'})]}),new Paragraph({children:[new TextRun('Agua: H'),new TextRun({text:'2',subScript:true}),new TextRun('O. Superficie: 24 m'),new TextRun({text:'2',superScript:true}),new TextRun('. Temperatura: 18 °C; presupuesto: 1.250 €.')]}),heading('3. Fases y responsables'),...['Preparar el terreno y revisar accesibilidad.','Sembrar especies de temporada.','Registrar mediciones semanales.','Presentar resultados y conclusiones.'].map(text=>p(text,{numbering:{reference:'steps',level:0}})),p('Materiales',{bullet:{level:0}}),p('Semillas y herramientas de mano',{bullet:{level:1}}),p('Cuaderno de seguimiento',{bullet:{level:1}}),p('Organización',{bullet:{level:0}}),p('Equipos de cuatro estudiantes',{bullet:{level:1}}),heading('4. Presupuesto'),new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[new TableRow({tableHeader:true,children:['Concepto','Cantidad','Coste'].map(t=>cell(t,{shading:{fill:'E8EEF7'}}))}),... [['Semillas','12 sobres','60 €'],['Herramientas','8 kits','240 €'],['Riego','1 sistema','150 €'],['Total inicial','—','450 €']].map(row=>new TableRow({children:row.map(t=>cell(t))}))]}),heading('5. Tabla con celdas combinadas'),new Table({rows:[new TableRow({children:[cell('Seguimiento por trimestre',{columnSpan:3})]}),new TableRow({children:[cell('Grupo A',{rowSpan:2}),cell('Octubre'),cell('Preparación')]}),new TableRow({children:[cell('Noviembre'),cell('Siembra')]}),new TableRow({children:[cell('Observaciones'),new TableCell({columnSpan:2,children:[p('Revisar el riego cada lunes.'),p('Registrar incidencias en el cuaderno.')]})]})]}),heading('6. Referencias e imagen'),new Paragraph({children:[new ExternalHyperlink({link:'https://www.un.org/sustainabledevelopment/es/',children:[new TextRun('Objetivos de Desarrollo Sostenible')]})]}),new Paragraph({children:[new ImageRun({type:'png',data:png,transformation:{width:480,height:180}})]}),p('Figura 1. Esquema del huerto con tres hileras de plantas; no requiere archivos externos.'),heading('7. Registro técnico'),p('agua_litros = lectura_actual - lectura_anterior',{style:'CodeExample'}),p('eficiencia = cosecha_kg / agua_litros',{style:'CodeExample'}),new Paragraph({children:[new PageBreak()]}),heading('8. Evaluación y cierre'),p('Indicadores: participación, ahorro de agua, evolución de las plantas y calidad de los registros.'),p('Riesgos: falta de lluvia, vacaciones y pérdidas de material. Mitigación: turnos de mantenimiento y una reserva de semillas.'),p('Conclusión: revisar el plan mensualmente y documentar las decisiones para la siguiente promoción.'),heading('9. Comprobación en MK'),p('Al abrir este archivo, comprueba títulos, formatos, listas, enlace, imagen y ambas tablas. Edita el presupuesto y exporta a Word. El contenido debe conservarse; la distribución exacta de páginas puede cambiar.')];
const doc=new Document({title:'Proyecto Aula Verde',creator:'MK',styles:{paragraphStyles:[{id:'CodeExample',name:'Code',basedOn:'Normal',run:{font:'Consolas',size:20}}]},numbering:{config:[{reference:'steps',levels:[{level:0,format:'decimal',text:'%1.',start:1}]}]},sections:[{children}]});
Packer.toBuffer(doc).then(buf=>fs.writeFileSync(path.join(dir, 'proyecto-aula-verde.docx'),buf)).catch(error => { console.error(error); process.exitCode = 1; });
