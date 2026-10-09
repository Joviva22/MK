(function () {
'use strict';
const descriptions = {
  Guardar:'Guarda los cambios. Ctrl+S.', 'Guardar como…':'Crea una copia con otro nombre o ubicación.',
  Deshacer:'Recupera el estado anterior. Ctrl+Z.', Rehacer:'Reaplica el cambio deshecho. Ctrl+Y.',
  Tabla:'Inserta una tabla con las filas y columnas indicadas.', Imagen:'Inserta una imagen desde tu equipo.',
  Anterior:'Busca la coincidencia anterior.', Siguiente:'Busca la siguiente coincidencia.',
  '+ Hoja':'Añade una hoja al libro.', 'Renombrar hoja':'Cambia el nombre de la hoja actual.', 'Eliminar hoja':'Elimina la hoja actual; Deshacer permite recuperarla.',
  '+ Diapositiva':'Añade una diapositiva después de la actual.', Duplicar:'Copia la diapositiva seleccionada.', 'Eliminar diapositiva':'Elimina la diapositiva actual.',
  '+ Texto':'Inserta un cuadro de texto editable.', '+ Imagen':'Inserta una imagen local en la diapositiva.', Presentar:'Muestra la presentación. Flechas para avanzar; Escape para salir.',
  '+ Fila':'Añade una fila a la tabla seleccionada.', '+ Columna':'Añade una columna a la tabla seleccionada.', 'Quitar imagen':'Elimina la imagen seleccionada.',
  Enlace:'Convierte el texto seleccionado en un enlace web.', Ayuda:'Muestra instrucciones y ejemplos del documento abierto.',
  'Convertir a nota':'Crea una nota Markdown a partir del contenido de Word.'
};
let collapsed = new Set();
const ready = window.mdEditor.getConfig().then(config => { collapsed = new Set(config.officeToolsCollapsed || []); }).catch(() => {});
async function setCollapsed(kind, value) {
  const next = new Set(collapsed); if (value) next.add(kind); else next.delete(kind);
  await window.mdEditor.setConfig({ officeToolsCollapsed:[...next] }); collapsed = next;
}
function task(type, payload) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('office-worker.js');
    const timeout = setTimeout(() => { worker.terminate(); reject(new Error('El documento tardó demasiado en procesarse.')); }, 120000);
    const finish = () => { clearTimeout(timeout); worker.terminate(); };
    worker.onmessage = ({ data }) => { finish(); if (data.error) reject(new Error(data.error)); else resolve(data.value); };
    worker.onerror = () => { finish(); reject(new Error('No se pudo procesar el documento en segundo plano.')); };
    worker.postMessage({ type, ...payload });
  });
}
let progressNode;
function progress(message) {
  if (!message) { progressNode?.remove(); progressNode = null; return; }
  if (!progressNode) {
    progressNode = document.createElement('aside'); progressNode.className = 'office-opening'; progressNode.setAttribute('role', 'status'); progressNode.setAttribute('aria-live', 'polite');
    const meter = document.createElement('progress'); meter.setAttribute('aria-label', 'Apertura del documento'); progressNode.append(meter, document.createElement('span')); document.body.append(progressNode);
  }
  progressNode.querySelector('span').textContent = message;
}
function dialog(title) {
  const previous = document.activeElement;
  const node = document.createElement('dialog'); node.className = 'office-guide';
  const heading = document.createElement('h2'); heading.textContent = title; heading.id = 'office-guide-title'; node.setAttribute('aria-labelledby', heading.id);
  const close = document.createElement('button'); close.textContent = 'Cerrar'; close.className = 'toolbar-button'; close.addEventListener('click', () => node.close());
  node.append(heading, close); node.addEventListener('close', () => { node.remove(); previous?.focus(); }); document.body.append(node); node.showModal(); return node;
}
function confirmSave(kind, warnings, hasOriginal) {
  const risk = window.mdOfficeCompat.saveRisk(kind, warnings);
  if (!risk) return Promise.resolve('save');
  return new Promise(resolve => {
    const node = dialog('Revisar antes de guardar');
    let choice = 'cancel';
    const text = document.createElement('p'); text.textContent = risk; node.append(text);
    const hint = document.createElement('p'); hint.textContent = hasOriginal ? 'Guardar una copia permite conservar el archivo original. La copia también tendrá las limitaciones indicadas.' : 'Revisa el documento exportado en tu aplicación habitual si necesitas conservar la maquetación exacta.'; node.append(hint);
    const choose = (caption, value) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'toolbar-button'; button.textContent = caption; button.addEventListener('click', () => { choice = value; node.close(); }); node.append(button); return button; };
    if (hasOriginal) choose('Guardar una copia…', 'copy').focus();
    choose(hasOriginal ? 'Guardar en el archivo original' : 'Guardar documento', 'save');
    node.querySelector('button').textContent = 'Cancelar';
    node.addEventListener('close', () => resolve(choice), { once:true });
  });
}
const guides = {
  docx:[['Escribir y dar formato','Selecciona una frase y pulsa Negrita o elige un título. Inserta tablas e imágenes desde la barra del documento.'],['Ejemplo: informe','Nuevo → Plantillas completas → Informe de proyecto. Sustituye los campos entre corchetes, completa los objetivos y añade tus resultados.'],['Imágenes y tablas','Selecciona la imagen para ajustar su ancho; coloca el cursor en una tabla para añadir filas o columnas.']],
  xlsx:[['Editar celdas','Selecciona una celda y escribe, o pulsa F2. Enter confirma; Escape cancela. Usa flechas y Tab para moverte.'],['Ejemplo: presupuesto','Abre la plantilla Presupuesto. Cambia cantidades y precios: los importes y el total se calculan con fórmulas. Prueba =SUM(B2:B5).'],['Trabajar con hojas','El selector cambia de hoja. Puedes renombrarlas, añadirlas y pegar filas copiadas desde otra tabla. Usa los controles de página para recorrer libros grandes.']],
  pptx:[['Editar diapositivas','Elige una miniatura y selecciona un objeto. Cambia texto, posición y tamaño desde sus propiedades; arrástralo en el lienzo.'],['Ejemplo: presentación','Abre Presentación de proyecto: completa contexto, objetivos, plan, presupuesto y conclusiones. Añade una imagen desde + Imagen.'],['Presentar','Pulsa Presentar. Usa flechas para avanzar y Escape para salir. Puedes duplicar y reordenar diapositivas.']],
  markdown:[['Empezar','Nuevo crea notas o documentos Office. Abrir carga un archivo; Carpeta muestra tus archivos en el lateral.'],['Ejemplo: nota','Escribe # Mi título y una lista con - delante de cada elemento. La vista previa muestra el resultado.'],['Encontrar herramientas','Ctrl+Shift+P abre la paleta de comandos. Las herramientas visibles se adaptan al documento abierto.']]
};
function help(kind) {
  kind ||= window.mdTabs.getActiveState()?.kind || 'markdown';
  const node = dialog('Ayuda práctica');
  for (const [title, text] of guides[kind] || guides.markdown) { const h = document.createElement('h3'); h.textContent = title; const p = document.createElement('p'); p.textContent = text; node.append(h,p); }
  const p = document.createElement('p'); p.textContent = 'Guardar: Ctrl+S · Deshacer: Ctrl+Z · Rehacer: Ctrl+Y · Buscar: Ctrl+F. Los cambios pendientes se pueden recuperar al volver a abrir MK.'; node.append(p);
  const button = document.createElement('button'); button.textContent = 'Ver plantillas'; button.addEventListener('click', () => { node.close(); templates(); }); node.append(button);
}
const catalog = [
  { id:'report', kind:'docx', name:'Informe de proyecto', detail:'Portada, resumen, objetivos, planificación, resultados y conclusiones.' },
  { id:'meeting', kind:'docx', name:'Acta de reunión', detail:'Asistentes, agenda, acuerdos y tareas con responsables.' },
  { id:'budget', kind:'xlsx', name:'Presupuesto', detail:'Cantidades, precios, IVA, importes automáticos y total.' },
  { id:'calendar', kind:'xlsx', name:'Calendario mensual', detail:'Mes actual, semana de lunes a domingo y hoja de tareas.' },
  { id:'project', kind:'pptx', name:'Presentación de proyecto', detail:'Seis diapositivas: portada, contexto, objetivos, plan, presupuesto y cierre.' }
];
function base64(buffer) { let text = ''; const bytes = new Uint8Array(buffer); for (let i=0; i<bytes.length; i+=8192) text += String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(text); }
async function sourceFor(id) {
  if (id === 'report' || id === 'meeting') {
    const html = id === 'report' ? '<h1>[Título del proyecto]</h1><p><strong>Autor:</strong> [Nombre] · <strong>Fecha:</strong> [Fecha]</p><h2>Resumen ejecutivo</h2><p>[Resume el problema, la propuesta y el resultado esperado.]</p><h2>Objetivos</h2><ul><li>[Objetivo medible 1]</li><li>[Objetivo medible 2]</li></ul><h2>Plan de trabajo</h2><table><tr><th>Fase</th><th>Responsable</th><th>Fecha</th></tr><tr><td>[Preparación]</td><td>[Nombre]</td><td>[Fecha]</td></tr><tr><td>[Ejecución]</td><td>[Nombre]</td><td>[Fecha]</td></tr></table><h2>Recursos y presupuesto</h2><p>[Detalla los recursos necesarios y su coste.]</p><h2>Resultados</h2><p>[Añade datos, tablas o imágenes que respalden los resultados.]</p><h2>Conclusiones y próximos pasos</h2><p>[Conclusión principal y acciones pendientes.]</p><h2>Referencias</h2><p>[Fuente, autor, fecha y enlace.]</p>' : '<h1>Acta de reunión</h1><p><strong>Fecha:</strong> [Fecha] · <strong>Lugar:</strong> [Lugar]</p><h2>Asistentes</h2><p>[Nombres y funciones]</p><h2>Agenda</h2><ol><li>[Tema 1]</li><li>[Tema 2]</li></ol><h2>Acuerdos</h2><p>[Decisión y motivos]</p><h2>Tareas pendientes</h2><table><tr><th>Tarea</th><th>Responsable</th><th>Plazo</th></tr><tr><td>[Acción]</td><td>[Nombre]</td><td>[Fecha]</td></tr></table><h2>Próxima reunión</h2><p>[Fecha y temas pendientes]</p>';
    return window.mdDocxExport.buildHtmlBase64(html);
  }
  if (id === 'budget' || id === 'calendar') {
    await window.mdLoadLib('excel'); const book = new window.ExcelJS.Workbook();
    if (id === 'budget') {
      const sheet = book.addWorksheet('Presupuesto'); sheet.addRow(['Concepto','Cantidad','Precio unitario','IVA','Importe']);
      for (let r=2;r<=11;r++) sheet.addRow([`[Concepto ${r-1}]`,0,0,0.21,{ formula:`B${r}*C${r}*(1+D${r})`, result:0 }]);
      sheet.addRow(['TOTAL','','','',{ formula:'SUM(E2:E11)', result:0 }]);
      sheet.getColumn(1).width=32; for (const c of [2,3,4,5]) sheet.getColumn(c).width=20;
      sheet.getColumn(3).numFmt='#,##0.00 "€"'; sheet.getColumn(5).numFmt='#,##0.00 "€"'; sheet.getColumn(4).numFmt='0%'; sheet.autoFilter='A1:E11';
    } else {
      const sheet = book.addWorksheet('Calendario'); const now = new Date(); const y=now.getFullYear(), m=now.getMonth();
      sheet.addRow([now.toLocaleDateString('es',{month:'long',year:'numeric'})]); sheet.mergeCells('A1:G1'); sheet.addRow(['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']);
      const offset=(new Date(y,m,1).getDay()+6)%7, days=new Date(y,m+1,0).getDate();
      for (let week=0;week<6;week++) { const row=sheet.addRow(Array.from({length:7},(_,d)=>{ const day=week*7+d-offset+1; return day>0 && day<=days ? `${day}\n[Actividad]` : ''; })); row.height=65; row.alignment={wrapText:true,vertical:'top'}; }
      for(let c=1;c<=7;c++) sheet.getColumn(c).width=19;
      const tasks=book.addWorksheet('Tareas'); tasks.addRow(['Fecha','Actividad','Responsable','Estado']); tasks.addRow(['[Fecha]','[Actividad]','[Nombre]','Pendiente']); tasks.columns.forEach(c=>{c.width=25;});
    }
    for (const sheet of book.worksheets) { sheet.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; sheet.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF234E70'}}; sheet.views=[{state:'frozen',ySplit:1}]; }
    return base64(await book.xlsx.writeBuffer());
  }
  await window.mdLoadLib('pptx'); const deck = new window.PptxGenJS(); deck.layout='LAYOUT_WIDE';
  for (const [title,text] of [['[Título del proyecto]','[Autor / equipo]\n[Fecha]'],['Contexto','[Problema que queremos resolver]\n[Datos que lo justifican]'],['Objetivos','[Objetivo 1]\n[Objetivo 2]\n[Cómo mediremos el éxito]'],['Plan de trabajo','[Fase 1 · Responsable · Fecha]\n[Fase 2 · Responsable · Fecha]\n[Fase 3 · Responsable · Fecha]'],['Recursos y presupuesto','[Recursos necesarios]\n[Coste estimado]\n[Fuentes de financiación]'],['Conclusiones','[Resultado esperado]\n[Próximos pasos]\n[Contacto]']]) {
    const slide=deck.addSlide(); slide.background={color:'F5F8FC'}; slide.addText(title,{x:0.7,y:0.6,w:11.8,h:0.9,fontSize:32,bold:true,color:'234E70'}); slide.addText(text,{x:0.8,y:2,w:11.5,h:3.5,fontSize:23,color:'243247'});
  }
  return deck.write({outputType:'base64'});
}
function templates() {
  document.getElementById('new-menu').hidden=true;
  const node=dialog('Plantillas listas para rellenar');
  for(const item of catalog) {
    const button=document.createElement('button'); button.className='office-template'; const strong=document.createElement('strong'); strong.textContent=`${item.name} · ${item.kind.toUpperCase()}`; const text=document.createElement('span'); text.textContent=item.detail; button.append(strong,text);
    button.addEventListener('click',async()=>{ node.querySelectorAll('button').forEach(b=>{b.disabled=true;}); progress('Creando plantilla…'); try { const source=await sourceFor(item.id); await window.mdOffice.create(item.kind,source); node.close(); } catch(error) { window.mdErrorToast.show({message:'No se pudo crear la plantilla',detail:error.message}); } finally { progress(null); node.querySelectorAll('button').forEach(b=>{b.disabled=false;}); } }); node.append(button);
  }
}
function context() {
  const kind=window.mdTabs.getActiveState()?.kind; document.body.classList.toggle('office-context', ['docx','xlsx','pptx'].includes(kind));
}
document.addEventListener('mk:active-file-changed',context);
document.getElementById('btn-office-templates').addEventListener('click',templates);
document.getElementById('btn-integrated-help').addEventListener('click',()=>help());
document.addEventListener('keydown',event=>{if(event.key==='F1'){event.preventDefault();help();}});
window.mdOfficeTools={task,progress,help,templates,sourceFor,catalog,confirmSave,ready,isCollapsed:kind=>collapsed.has(kind),setCollapsed,describe:text=>descriptions[text] || text};
})();
