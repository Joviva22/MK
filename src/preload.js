const { contextBridge, ipcRenderer, webUtils } = require('electron');

// La ventana corre con sandbox: este preload solo puede usar módulos de
// Electron (nada de require('path')). Rutas POSIX (MK es para Linux) con un
// helper propio que se comporta como path de Node en lo que usa la app —
// un test de la suite lo compara con resultados de Node.
const posix = (() => {
  function parts(p) {
    const abs = p.startsWith('/');
    const out = [];
    for (const seg of p.split('/')) {
      if (!seg || seg === '.') continue;
      if (seg === '..') {
        if (out.length && out[out.length - 1] !== '..') out.pop();
        else if (!abs) out.push('..');
      } else {
        out.push(seg);
      }
    }
    return { abs, out };
  }
  function normalize(p) {
    const { abs, out } = parts(p);
    const s = out.join('/');
    return abs ? '/' + s : (s || '.');
  }
  const isAbsolute = (p) => p.startsWith('/');
  function join(...segs) {
    const joined = segs.filter((x) => x !== '').join('/');
    return joined ? normalize(joined) : '.';
  }
  function resolve(...segs) {
    let r = '';
    for (let i = segs.length - 1; i >= 0 && !isAbsolute(r); i--) {
      if (segs[i]) r = segs[i] + (r ? '/' + r : '');
    }
    return normalize(isAbsolute(r) ? r : '/' + r);
  }
  function dirname(p) {
    if (!p) return '.';
    const n = p.length > 1 ? p.replace(/\/+$/, '') : p;
    const i = n.lastIndexOf('/');
    if (i < 0) return '.';
    return i === 0 ? '/' : n.slice(0, i);
  }
  function relative(from, to) {
    const a = parts(resolve(from)).out;
    const b = parts(resolve(to)).out;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return [...Array(a.length - i).fill('..'), ...b.slice(i)].join('/');
  }
  return { normalize, isAbsolute, join, resolve, dirname, relative };
})();
const path = posix;

contextBridge.exposeInMainWorld('mdEditor', {
  openFile: () => ipcRenderer.invoke('file:open'),
  saveFile: (content, filePath, forceDialog = false) => ipcRenderer.invoke('file:save', { content, filePath, forceDialog }),
  readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
  openFolder: () => ipcRenderer.invoke('folder:open'),
  replacePreview: (root, find, replacement, opts) => ipcRenderer.invoke('replace:preview', { root, find, replacement, opts }),
  replaceApply: (root, find, replacement, opts, files, skip) => ipcRenderer.invoke('replace:apply', { root, find, replacement, opts, files, skip }),
  createStarterFolder: () => ipcRenderer.invoke('folder:createStarter'),
  getLastFolder: () => ipcRenderer.invoke('folder:getLast'),
  readFolder: (rootPath) => ipcRenderer.invoke('folder:read', rootPath),
  watchFolder: (rootPath) => ipcRenderer.invoke('folder:watch', rootPath),
  indexStats: () => ipcRenderer.invoke('index:stats'),
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
  appVersion: () => ipcRenderer.invoke('app:version'),
  backupExport: (testPath) => ipcRenderer.invoke('backup:export', testPath),
  backupPick: (testPath) => ipcRenderer.invoke('backup:pick', testPath),
  backupImport: (file) => ipcRenderer.invoke('backup:import', file),
  checkUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  problemReport: () => ipcRenderer.invoke('app:problemReport'),
  openWithSystem: (filePath) => ipcRenderer.invoke('shell:openPath', filePath),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  loadSession: () => ipcRenderer.invoke('session:load'),
  homeLoad: (root) => ipcRenderer.invoke('home:load', root || null),
  homeSave: (data, root) => ipcRenderer.invoke('home:save', data, root || null),
  terminal: {
    create: (opts) => ipcRenderer.invoke('term:create', opts),
    listShells: () => ipcRenderer.invoke('term:listShells'),
    write: (id, data) => ipcRenderer.send('term:write', { id, data }),
    resize: (id, cols, rows) => ipcRenderer.send('term:resize', { id, cols, rows }),
    kill: (id) => ipcRenderer.invoke('term:kill', { id }),
    onData: (callback) => ipcRenderer.on('term:data', (event, msg) => callback(msg)),
    onExit: (callback) => ipcRenderer.on('term:exit', (event, msg) => callback(msg))
  },
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
  copyAsset: (srcPath, targetDir) => ipcRenderer.invoke('asset:copy', { srcPath, targetDir }),
  saveImageAsset: (targetDir, baseName, ext, bytes) => ipcRenderer.invoke('asset:saveImage', { targetDir, baseName, ext, bytes }),
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
  gitBranch: (root) => ipcRenderer.invoke('git:branch', root),
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
  getPathForFile: (file) => {
    const p = webUtils.getPathForFile(file);
    if (p) ipcRenderer.sendSync('pathguard:dropped', p); // arrastrado por el usuario: autorizar
    return p;
  },
  // El módulo clipboard ya no existe en el preload (Electron 40+): pasa por
  // el proceso principal. Leer devuelve una promesa.
  clipboardWriteText: (text) => ipcRenderer.invoke('clipboard:writeText', text),
  clipboardReadText: () => ipcRenderer.invoke('clipboard:readText'),
  logError: (where, message) => ipcRenderer.invoke('log:error', where, message),
  onAppError: (callback) => ipcRenderer.on('app:error', (event, info) => callback(info)),
  // Correo (ver ipc-mail.js): la contraseña va de acá al proceso principal
  // y nunca vuelve; los correos van siempre a tu propia dirección.
  pet: {
    sprites: (petId) => ipcRenderer.invoke('pet:sprites', petId),
    pickSprite: (petId, stage, testPath) => ipcRenderer.invoke('pet:pickSprite', petId, stage, testPath),
    clearSprites: (petId) => ipcRenderer.invoke('pet:clearSprites', petId),
    findCharDirs: () => ipcRenderer.invoke('pet:findCharDirs'),
    pickCharDir: () => ipcRenderer.invoke('pet:pickCharDir'),
    charCatalog: (dir) => ipcRenderer.invoke('pet:charCatalog', dir),
    useChars: (petId, dir, ids, names) => ipcRenderer.invoke('pet:useChars', petId, dir, ids, names)
  },
  mail: {
    status: () => ipcRenderer.invoke('mail:status'),
    setSettings: (s) => ipcRenderer.invoke('mail:setSettings', s),
    setPassword: (pw) => ipcRenderer.invoke('mail:setPassword', pw),
    clearPassword: () => ipcRenderer.invoke('mail:clearPassword'),
    send: (subject, text) => ipcRenderer.invoke('mail:send', { subject, text }),
    test: () => ipcRenderer.invoke('mail:test'),
    lastTestMessage: () => ipcRenderer.invoke('mail:lastTestMessage')
  },
  db: {
    writeStats: () => ipcRenderer.invoke('db:writeStats'),
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
  // Resaltado de bloques de código: highlight.js corre en el proceso
  // principal (el preload con sandbox no puede cargarlo). Lote de
  // [{ code, lang }] -> [html | null].
  highlightCodeBatch: (blocks) => ipcRenderer.invoke('highlight:batch', blocks),
  pathSelfTest: (cases) => cases.map(([fn, args]) => path[fn](...args))
});
