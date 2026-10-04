import React from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw, MainMenu, serializeAsJSON, exportToCanvas, restoreElements } from '@excalidraw/excalidraw';

window.mdDrawingEngine = {
  thumbnail: (scene) => exportToCanvas({ elements: restoreElements(scene.elements, null).filter((e) => !e.isDeleted), appState: { ...scene.appState, exportBackground: true, exportWithDarkMode: false }, files: scene.files || {}, maxWidthOrHeight: 1000 }),
  mount(container, initialData, onChange) {
    const root = createRoot(container);
    let api;
    const render = () => root.render(React.createElement(Excalidraw, {
      theme: getComputedStyle(document.documentElement).colorScheme === 'dark' ? 'dark' : 'light',
      initialData, langCode: 'es-ES', aiEnabled: false, validateEmbeddable: false,
      handleKeyboardGlobally: false, autoFocus: true,
      UIOptions: { canvasActions: { loadScene: false, saveToActiveFile: false, export: false } },
      excalidrawAPI: (value) => { api = value; },
      onChange,
      onLinkOpen: (_element, event) => event.preventDefault()
    }, React.createElement(MainMenu, null,
      React.createElement(MainMenu.DefaultItems.ClearCanvas),
      React.createElement(MainMenu.DefaultItems.ChangeCanvasBackground))));
    render();
    const observer = new MutationObserver(render);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    return { unmount: () => { observer.disconnect(); root.unmount(); }, getAPI: () => api };
  },
  serialize: (elements, appState, files) => serializeAsJSON(elements, appState, files, 'local')
};
