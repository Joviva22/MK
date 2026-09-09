'use strict';

// Config plano de ESLint (ver MEJORAS.md): solo no-undef/no-unused-vars, la
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
  clearTimeout: 'readonly'
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
  prompt: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  requestAnimationFrame: 'readonly',
  getComputedStyle: 'readonly',
  Event: 'readonly',
  MouseEvent: 'readonly',
  DragEvent: 'readonly',
  DataTransfer: 'readonly',
  KeyboardEvent: 'readonly',
  URLSearchParams: 'readonly',
  // Librerías cargadas como <script> antes de los archivos de la app.
  CodeMirror: 'readonly',
  marked: 'readonly',
  katex: 'readonly',
  DOMPurify: 'readonly',
  lucide: 'readonly',
  Diff: 'readonly'
};

module.exports = [
  {
    ignores: ['node_modules/**', 'dist/**', 'build/**']
  },
  {
    files: ['src/main.js', 'src/preload.js', 'test/run.js', 'eslint.config.js'],
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
    // src/*.js son <script> del renderer; test/renderer-checks.js corre
    // dentro de esa misma ventana vía executeJavaScript (no es Node).
    files: ['src/*.js', 'test/renderer-checks.js'],
    ignores: ['src/main.js', 'src/preload.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: browserGlobals
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }]
    }
  }
];
