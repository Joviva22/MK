'use strict';

// Config plano de ESLint: solo no-undef/no-unused-vars, la
// red de seguridad barata que hubiera atrapado varios bugs reales de este
// proyecto (colisión de globals entre scripts del renderer, variables sin
// declarar) sin requerir TypeScript ni pruebas manuales.

const nodeGlobals = {
  require: 'readonly',
  module: 'writable',
  exports: 'writable',
  process: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  Response: 'readonly' // fetch API global de Node/Electron (protocol.handle)
};

// El renderer no usa bundler ni módulos: cada src/*.js es un <script> suelto
// que comparte el scope global del navegador (más las libs cargadas antes
// por <script> y el puente window.mdEditor de preload.js).
const browserGlobals = {
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  console: 'readonly',
  alert: 'readonly',
  confirm: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  Notification: 'readonly',
  requestAnimationFrame: 'readonly',
  performance: 'readonly',
  getComputedStyle: 'readonly',
  Event: 'readonly',
  MouseEvent: 'readonly',
  DragEvent: 'readonly',
  DataTransfer: 'readonly',
  KeyboardEvent: 'readonly',
  CustomEvent: 'readonly',
  WheelEvent: 'readonly',
  URLSearchParams: 'readonly',
  // Librerías cargadas como <script> antes de los archivos de la app.
  CodeMirror: 'readonly',
  marked: 'readonly',
  katex: 'readonly',
  DOMPurify: 'readonly',
  lucide: 'readonly',
  Diff: 'readonly',
  mermaid: 'readonly',
  Worker: 'readonly',
  self: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  PDFLib: 'readonly',
  mammoth: 'readonly',
  TurndownService: 'readonly',
  turndownPluginGfm: 'readonly',
  docx: 'readonly',
  Image: 'readonly',
  Node: 'readonly',
  NodeFilter: 'readonly',
  crypto: 'readonly',
  ResizeObserver: 'readonly',
  MutationObserver: 'readonly',
  IntersectionObserver: 'readonly',
  Terminal: 'readonly',
  FitAddon: 'readonly',
  SearchAddon: 'readonly'
};

// Módulos compartidos (src/shared/): script en la ventana y módulo en Node.
const sharedGlobals = { ...browserGlobals, module: 'writable', self: 'readonly' };

module.exports = [
  {
    // cm6-bundle.js: generado por esbuild (npm run build:cm6), no se edita a mano.
    ignores: ['node_modules/**', 'dist/**', 'build/**', 'src/cm6-bundle.js', 'src/drawing-bundle.js']
  },
  {
    files: ['src/atomicwrite.js', 'src/main.js', 'src/preload.js', 'src/dbengine.js', 'src/ptyhost.js', 'src/traymode.js', 'src/folderwatch.js', 'src/folderindex.js', 'src/mainctx.js', 'src/errlog.js', 'src/pathguard.js', 'src/petcatalog.js', 'src/spellchecker.js', 'src/backupbundle.js', 'src/problemreport.js', 'src/datamigrate.js', 'src/khslice.js', 'src/khsprites.js', 'src/ipc-*.js', 'scripts/*.js', 'test/run.js', 'test/run-cm6-shim.js', 'test/bench.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['src/shared/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: sharedGlobals },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] }
  },
  {
    files: ['test/unit/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...nodeGlobals, setImmediate: 'readonly' } },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] }
  },
  {
    // src/*.js son <script> del renderer; test/renderer-checks.js corre
    // dentro de esa misma ventana vía executeJavaScript (no es Node).
    files: ['src/*.js', 'test/renderer-checks.js', 'test/bench-checks.js', 'test/cm6-shim-checks.js'],
    ignores: ['src/atomicwrite.js', 'src/main.js', 'src/preload.js', 'src/dbengine.js', 'src/ptyhost.js', 'src/folderwatch.js', 'src/folderindex.js', 'src/mainctx.js', 'src/errlog.js', 'src/pathguard.js', 'src/petcatalog.js', 'src/spellchecker.js', 'src/backupbundle.js', 'src/problemreport.js', 'src/datamigrate.js', 'src/khslice.js', 'src/khsprites.js', 'src/ipc-*.js', 'src/database.js', 'src/database-state.js', 'src/database-helpers.js', 'src/database-views.js', 'src/database-cells.js', 'src/database-csv.js', 'src/database-embed.js', 'src/home.js', 'src/home-*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Electron no soporta prompt(): rompía plantillas, "Insertar tabla" y el
      // sidebar sin que se notara. Usar window.mdAsk (askdialog.js).
      'no-restricted-properties': ['error', { object: 'window', property: 'prompt', message: 'Electron no soporta prompt(): usá window.mdAsk().' }],
      'no-restricted-globals': ['error', { name: 'prompt', message: 'Electron no soporta prompt(): usá window.mdAsk().' }]
    }
  },
  {
    // Bases de datos y Home: partidos en módulos ES (ver OBJETIVOS.md) —
    // cargan con <script type="module">, import/export real en vez de window.mdX.
    files: ['src/database.js', 'src/database-state.js', 'src/database-helpers.js', 'src/database-views.js', 'src/database-cells.js', 'src/database-csv.js', 'src/database-embed.js', 'src/home.js', 'src/home-*.js', 'src/cm6-entry.js', 'src/drawing-entry.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: browserGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // Un módulo solo puede reasignar sus propios `let`: reasignar uno
      // importado de otro módulo es un TypeError en tiempo de ejecución que
      // ESLint no marcaría como error de sintaxis si no fuera por esta regla
      // (ya atajó dos bugs reales al partir home.js en módulos).
      'no-import-assign': 'error',
      'no-restricted-properties': ['error', { object: 'window', property: 'prompt', message: 'Electron no soporta prompt(): usá window.mdAsk().' }],
      'no-restricted-globals': ['error', { name: 'prompt', message: 'Electron no soporta prompt(): usá window.mdAsk().' }]
    }
  }
];
