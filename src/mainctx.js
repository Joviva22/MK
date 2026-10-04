'use strict';

// Estado compartido entre main.js y los módulos ipc-*.js del proceso
// principal: la ventana (se asigna al crearla), la config y el modo test.
// Un objeto mutable en vez de parámetros: los módulos lo leen en el momento
// de cada llamada, cuando la ventana ya existe.

module.exports = {
  mainWindow: null,
  isTestMode: process.env.MK_TEST === '1',
  loadConfig: null,
  saveConfig: null,
  logError: () => {},
  reportError: () => {},
  // Carpeta abierta en el sidebar (config.lastFolder): los diálogos nativos
  // de guardar/abrir la usan como punto de partida en vez de la última
  // carpeta del sistema.
  getOpenFolder() {
    try {
      const f = this.loadConfig && this.loadConfig().lastFolder;
      return typeof f === 'string' && f ? f : undefined;
    } catch {
      return undefined;
    }
  }
};
