// Primer script de la página: anota cada violación de la Content Security
// Policy (ver <meta> en index.html). La suite de tests revisa que no haya
// ninguna, así una función que la CSP rompe no pasa desapercibida.
window.__mkCspViolations = [];
document.addEventListener('securitypolicyviolation', (e) => {
  window.__mkCspViolations.push(`${e.violatedDirective} ${e.blockedURI || '(inline)'} @ ${e.sourceFile || ''}:${e.lineNumber || ''}`);
});
