const { contextBridge, ipcRenderer, webUtils } = require('electron');
const path = require('path');
// El paquete npm de highlight.js no trae un build listo para <script>: su
// carpeta "es/" reexporta la build CommonJS, que un <script type="module">
// no puede resolver (rompe con "require is not defined"). Como preload.js
// sí corre en contexto Node, lo cargamos acá y lo exponemos ya resuelto.
const hljs = require('highlight.js/lib/common');

contextBridge.exposeInMainWorld('mdEditor', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content, filePath, forceDialog = false) => ipcRenderer.invoke('file:save', { content, filePath, forceDialog }),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  openFolder: () => ipcRenderer.invoke('folder:open'),
  getLastFolder: () => ipcRenderer.invoke('folder:getLast'),
  readFolder: (rootPath) => ipcRenderer.invoke('folder:read', rootPath),
  watchFolder: (rootPath) => ipcRenderer.invoke('folder:watch', rootPath),
  onFolderChanged: (callback) => ipcRenderer.on('folder:changed', (event, payload) => callback(payload)),
  startFileDrag: (filePath) => ipcRenderer.send('sidebar:startFileDrag', filePath),
  createFile: (dirPath, name) => ipcRenderer.invoke('fs:createFile', { dirPath, name }),
  createFolder: (dirPath, name) => ipcRenderer.invoke('fs:createFolder', { dirPath, name }),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('fs:rename', { targetPath, newName }),
  deletePath: (targetPath, isFolder) => ipcRenderer.invoke('fs:delete', { targetPath, isFolder }),
  movePath: (sourcePath, destDir) => ipcRenderer.invoke('fs:move', { sourcePath, destDir }),
  listBackups: (filePath) => ipcRenderer.invoke('backups:list', filePath),
  readBackup: (backupPath) => ipcRenderer.invoke('backups:read', backupPath),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  focusWindow: () => ipcRenderer.invoke('window:focus'),
  quitApp: () => ipcRenderer.invoke('app:quit'),
  getAutostart: () => ipcRenderer.invoke('app:getAutostart'),
  setAutostart: (enabled) => ipcRenderer.invoke('app:setAutostart', enabled),
  onTrayOpenHome: (callback) => ipcRenderer.on('tray:openHome', () => callback()),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  openWithSystem: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  loadSession: () => ipcRenderer.invoke('session:load'),
  homeLoad: (root) => ipcRenderer.invoke('home:load', root || null),
  homeSave: (data, root) => ipcRenderer.invoke('home:save', data, root || null),
  terminal: {
    create: (opts) => ipcRenderer.invoke('term:create', opts),
    write: (id, data) => ipcRenderer.send('term:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('term:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.invoke('term:kill', { id }),
    onData: (callback) => ipcRenderer.on('term:data', (event, msg) => callback(msg)),
    onExit: (callback) => ipcRenderer.on('term:exit', (event, msg) => callback(msg))
  },
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
  copyAsset: (srcPath, targetDir) => ipcRenderer.invoke('asset:copy', { srcPath, targetDir }),
  searchInFolder: (root, query) => ipcRenderer.invoke('search:inFolder', { root, query }),
  kanbanReadFolderFiles: (root) => ipcRenderer.invoke('kanban:readFolderFiles', root),
  listTags: (root) => ipcRenderer.invoke('tags:list', root),
  resolveWikilink: (root, target) => ipcRenderer.invoke('wikilink:resolve', { root, target }),
  listBacklinks: (root, target) => ipcRenderer.invoke('backlinks:list', { root, target }),
  getKatexCss: () => ipcRenderer.invoke('katex:getCss'),
  exportHtml: (html, defaultName) => ipcRenderer.invoke('export:html', { html, defaultName }),
  exportPdf: (html, defaultName) => ipcRenderer.invoke('export:pdf', { html, defaultName }),
  exportEpub: (payload, defaultName) => ipcRenderer.invoke('export:epub', { ...payload, defaultName }),
  pickEpubCover: () => ipcRenderer.invoke('epub:pickCover'),
  exportAnki: (cards, defaultName) => ipcRenderer.invoke('export:anki', { cards, defaultName }),
  pdfPickFiles: (multi = false) => ipcRenderer.invoke('pdf:pickFiles', { multi }),
  pdfReadBytes: (filePath) => ipcRenderer.invoke('pdf:readBytes', filePath),
  pdfSaveBytes: (base64, defaultName) => ipcRenderer.invoke('pdf:saveBytes', { base64, defaultName }),
  docxReadBytes: (filePath) => ipcRenderer.invoke('docx:readBytes', filePath),
  assetReadBytes: (filePath) => ipcRenderer.invoke('asset:readBytes', filePath),
  exportDocx: (base64, defaultName) => ipcRenderer.invoke('export:docx', { base64, defaultName }),
  isGitRepo: (root) => ipcRenderer.invoke('git:isRepo', root),
  gitSync: (root) => ipcRenderer.invoke('git:sync', root),
  gitStatus: (root) => ipcRenderer.invoke('git:status', root),
  gitDiffFile: (root, file) => ipcRenderer.invoke('git:diffFile', { root, file }),
  gitAddFiles: (root, files) => ipcRenderer.invoke('git:addFiles', { root, files }),
  gitStageHunks: (root, patch) => ipcRenderer.invoke('git:stageHunks', { root, patch }),
  gitCommitStaged: (root, message) => ipcRenderer.invoke('git:commitStaged', { root, message }),
  mediaPlayPause: () => ipcRenderer.invoke('media:playPause'),
  mediaNext: () => ipcRenderer.invoke('media:next'),
  mediaPrevious: () => ipcRenderer.invoke('media:previous'),
  mediaStatus: () => ipcRenderer.invoke('media:status'),
  buildGraph: (root) => ipcRenderer.invoke('graph:build', root),
  addWordToDictionary: (word) => ipcRenderer.invoke('spellcheck:addWord', word),
  onSpellcheckSuggestions: (callback) => ipcRenderer.on('spellcheck:suggestions', (event, data) => callback(data)),
  onOpenExternalFile: (callback) => ipcRenderer.on('open-external-file', (event, filePath) => callback(filePath)),
  resolveLocalPath: (baseFilePath, relativePath) => {
    if (!baseFilePath) return relativePath;
    return path.resolve(path.dirname(baseFilePath), relativePath);
  },
  toLocalUrl: (absolutePath) => 'md-local://file' + encodeURI(absolutePath),
  isPathAllowed: (root, absolutePath) => {
    if (!root) return true;
    const rel = path.relative(root, absolutePath);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  },
  dirName: (p) => path.dirname(p),
  joinPath: (...parts) => path.join(...parts),
  relativePath: (fromFile, toPath) => path.relative(path.dirname(fromFile), toPath),
  relativeToRoot: (root, filePath) => path.relative(root, filePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  // El módulo clipboard ya no existe en el preload (Electron 40+): pasa por
  // el proceso principal. Leer devuelve una promesa.
  clipboardWriteText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  clipboardReadText: () => ipcRenderer.invoke('clipboard:readText'),
  db: {
    listDatabases: (root) => ipcRenderer.invoke('db:listDatabases', { root }),
    createDatabase: (root, name) => ipcRenderer.invoke('db:createDatabase', { root, name }),
    renameDatabase: (root, id, name) => ipcRenderer.invoke('db:renameDatabase', { root, id, name }),
    setDatabaseIcon: (root, id, icon) => ipcRenderer.invoke('db:setDatabaseIcon', { root, id, icon }),
    deleteDatabase: (root, id) => ipcRenderer.invoke('db:deleteDatabase', { root, id }),
    reorderDatabases: (root, orderedIds) => ipcRenderer.invoke('db:reorderDatabases', { root, orderedIds }),
    listColumns: (root, databaseId) => ipcRenderer.invoke('db:listColumns', { root, databaseId }),
    createColumn: (root, databaseId, column) => ipcRenderer.invoke('db:createColumn', { root, databaseId, column }),
    updateColumn: (root, columnId, column) => ipcRenderer.invoke('db:updateColumn', { root, columnId, column }),
    deleteColumn: (root, columnId) => ipcRenderer.invoke('db:deleteColumn', { root, columnId }),
    reorderColumns: (root, databaseId, orderedIds) => ipcRenderer.invoke('db:reorderColumns', { root, databaseId, orderedIds }),
    listRows: (root, databaseId) => ipcRenderer.invoke('db:listRows', { root, databaseId }),
    createRow: (root, databaseId, cells) => ipcRenderer.invoke('db:createRow', { root, databaseId, cells }),
    createRows: (root, databaseId, cellsList) => ipcRenderer.invoke('db:createRows', { root, databaseId, cellsList }),
    exportCsv: (content, defaultName) => ipcRenderer.invoke('csv:save', { content, defaultName }),
    importCsv: () => ipcRenderer.invoke('csv:open'),
    deleteRow: (root, rowId) => ipcRenderer.invoke('db:deleteRow', { root, rowId }),
    reorderRows: (root, databaseId, orderedIds) => ipcRenderer.invoke('db:reorderRows', { root, databaseId, orderedIds }),
    setCell: (root, rowId, columnId, value) => ipcRenderer.invoke('db:setCell', { root, rowId, columnId, value }),
    setRelations: (root, columnId, fromRow, toRowIds) => ipcRenderer.invoke('db:setRelations', { root, columnId, fromRow, toRowIds }),
    listViews: (root, databaseId) => ipcRenderer.invoke('db:listViews', { root, databaseId }),
    createView: (root, databaseId, view) => ipcRenderer.invoke('db:createView', { root, databaseId, view }),
    updateView: (root, viewId, view) => ipcRenderer.invoke('db:updateView', { root, viewId, view }),
    deleteView: (root, viewId) => ipcRenderer.invoke('db:deleteView', { root, viewId }),
    reorderViews: (root, databaseId, orderedIds) => ipcRenderer.invoke('db:reorderViews', { root, databaseId, orderedIds })
  },
  highlightCode: (code, language) => {
    try {
      const result = language && hljs.getLanguage(language) ? hljs.highlight(code, { language }) : hljs.highlightAuto(code);
      return result.value;
    } catch {
      return null;
    }
  }
});
