const { contextBridge, ipcRenderer, webUtils, clipboard } = require('electron');
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
  startFileDrag: (filePath) => ipcRenderer.send('sidebar:startFileDrag', filePath),
  createFile: (dirPath, name) => ipcRenderer.invoke('fs:createFile', { dirPath, name }),
  createFolder: (dirPath, name) => ipcRenderer.invoke('fs:createFolder', { dirPath, name }),
  renamePath: (targetPath, newName) => ipcRenderer.invoke('fs:rename', { targetPath, newName }),
  deletePath: (targetPath, isFolder) => ipcRenderer.invoke('fs:delete', { targetPath, isFolder }),
  movePath: (sourcePath, destDir) => ipcRenderer.invoke('fs:move', { sourcePath, destDir }),
  listBackups: (filePath) => ipcRenderer.invoke('backups:list', filePath),
  readBackup: (backupPath) => ipcRenderer.invoke('backups:read', backupPath),
  toggleFullscreen: () => ipcRenderer.invoke('window:toggleFullscreen'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  saveSession: (data) => ipcRenderer.invoke('session:save', data),
  loadSession: () => ipcRenderer.invoke('session:load'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),
  copyAsset: (srcPath, targetDir) => ipcRenderer.invoke('asset:copy', { srcPath, targetDir }),
  searchInFolder: (root, query) => ipcRenderer.invoke('search:inFolder', { root, query }),
  kanbanReadFolderFiles: (root) => ipcRenderer.invoke('kanban:readFolderFiles', root),
  listTags: (root) => ipcRenderer.invoke('tags:list', root),
  resolveWikilink: (root, target) => ipcRenderer.invoke('wikilink:resolve', { root, target }),
  listBacklinks: (root, target) => ipcRenderer.invoke('backlinks:list', { root, target }),
  exportHtml: (html, defaultName) => ipcRenderer.invoke('export:html', { html, defaultName }),
  exportPdf: (html, defaultName) => ipcRenderer.invoke('export:pdf', { html, defaultName }),
  exportEpub: (html, title, defaultName) => ipcRenderer.invoke('export:epub', { html, title, defaultName }),
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
  gitCommitSelected: (root, files, message) => ipcRenderer.invoke('git:commitSelected', { root, files, message }),
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
  clipboardWriteText: (text) => clipboard.writeText(text),
  clipboardReadText: () => clipboard.readText(),
  highlightCode: (code, language) => {
    try {
      const result = language && hljs.getLanguage(language) ? hljs.highlight(code, { language }) : hljs.highlightAuto(code);
      return result.value;
    } catch (e) {
      return null;
    }
  }
});
