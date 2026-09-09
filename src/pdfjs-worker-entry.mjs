// Entry real del Worker de pdfjs-dist (ver pdfjs-loader.mjs y
// pdfjs-polyfills.mjs): el worker corre en su propio scope global,
// separado del hilo principal, así que necesita el mismo polyfill aplicado
// de nuevo acá antes de cargar pdf.worker.mjs.
import './pdfjs-polyfills.mjs';
import '../node_modules/pdfjs-dist/build/pdf.worker.mjs';
