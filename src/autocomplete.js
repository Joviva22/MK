(function () {
'use strict';

const cm = window.mdCodeMirror;

function showHints() {
  cm.showHint({ hint: CodeMirror.hint.anyword, completeSingle: false });
}

cm.setOption('extraKeys', Object.assign({}, cm.getOption('extraKeys'), {
  'Ctrl-Space': showHints
}));

// Autocompletado "mientras escribís": tras cada letra que compone una
// palabra de 2+ caracteres, se sugieren coincidencias ya usadas en el
// documento (típico de editores tipo Obsidian/VSCode).
cm.on('inputRead', (instance, change) => {
  if (instance.state.completionActive) return;
  if (change.origin !== '+input') return;
  const cursor = instance.getCursor();
  const line = instance.getLine(cursor.line);
  const before = line.slice(0, cursor.ch);
  if (/\w{2,}$/.test(before)) {
    showHints();
  }
});

window.mdAutocomplete = { show: showHints };

})();
