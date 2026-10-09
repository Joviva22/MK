(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.mdOfficeCompat = factory();
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : {}, function () {
  'use strict';
  // Detectar riesgos, sin afirmar que una conversión HTML sea sin pérdidas.
  function inspect(kind, paths, xml = '') {
    const warnings = [];
    const add = (condition, label) => { if (condition) warnings.push(label); };
    if (kind === 'docx') {
      add(paths.some(p => /^word\/(header|footer)\d+\.xml$/.test(p)), 'encabezados o pies de página');
      add(paths.some(p => /^word\/(footnotes|endnotes)\.xml$/.test(p)), 'notas al pie');
      for (const [tag, label] of [['ins|del', 'control de cambios'], ['commentRangeStart', 'comentarios'], ['oMath', 'ecuaciones'], ['fldChar|fldSimple|instrText', 'campos automáticos'], ['sdt', 'controles de contenido'], ['bookmarkStart', 'marcadores'], ['anchor', 'imágenes flotantes']]) {
        add(new RegExp('<(?:[\\w.-]+:)?(?:' + tag + ')(?:\\s|>)').test(xml), label);
      }
    } else if (kind === 'xlsx') {
      for (const [pattern, label] of [[/^xl\/charts\//, 'gráficos'], [/^xl\/pivot/, 'tablas dinámicas'], [/vbaProject\.bin$/, 'macros'], [/^xl\/externalLinks\//, 'vínculos a otros libros'], [/^xl\/slicer|^xl\/timeline/, 'segmentaciones de datos'], [/^xl\/queryTables|^xl\/connections\.xml$/, 'conexiones de datos'], [/^xl\/threadedComments\//, 'comentarios modernos'], [/^xl\/embeddings\//, 'objetos incrustados']]) add(paths.some(p => pattern.test(p)), label);
    } else if (kind === 'pptx') {
      add(paths.some(p => /^ppt\/(charts|diagrams)\//.test(p)), 'gráficos o SmartArt (vista simplificada)');
      add(/<(?:[\w.-]+:)?(?:timing|transition)(?:\s|>)/.test(xml), 'animaciones o transiciones (no se reproducen)');
      add(paths.some(p => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(p)), 'notas del presentador');
      add([...xml.matchAll(/<(?:[\w.-]+:)?p(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?p>/g)].some(m => (m[1].match(/<(?:[\w.-]+:)?r(?:\s|>)/g) || []).length > 1), 'texto con estilos mezclados');
    }
    return warnings;
  }
  function saveRisk(kind, warnings = []) {
    if (kind === 'docx') return 'Word se reconstruye desde el contenido editable. La maquetación, los estilos y las propiedades no compatibles pueden cambiar.' + (warnings.length ? ' Elementos detectados que pueden perderse: ' + warnings.join(', ') + '.' : '');
    if (kind === 'xlsx' && warnings.length) return 'Al guardar Excel pueden perderse o modificarse: ' + warnings.join(', ') + '.';
    if (kind === 'pptx' && warnings.some(w => ['notas del presentador', 'texto con estilos mezclados'].includes(w))) return 'Al editar el texto de un cuadro pueden unificarse sus estilos mezclados. Al duplicar diapositivas no se copian sus notas del presentador. Los elementos ajenos a la edición se conservan en el paquete.';
    return '';
  }
  return { inspect, saveRisk };
});
