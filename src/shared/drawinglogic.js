(function (root) {
'use strict';
function validate(content) {
  if (typeof content !== 'string' || content.length > 25 * 1024 * 1024) throw new Error('La pizarra supera el límite de 25 MB.');
  const scene = JSON.parse(content);
  if (scene?.type !== 'excalidraw' || !Array.isArray(scene.elements) || scene.elements.length > 50000 || !scene.appState || typeof scene.appState !== 'object' || Array.isArray(scene.appState) || (scene.files != null && (typeof scene.files !== 'object' || Array.isArray(scene.files)))) throw new Error('El archivo no es una pizarra Excalidraw válida.');
  return scene;
}
const api = { validate };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.mdDrawingLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
