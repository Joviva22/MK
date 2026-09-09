// pdfjs-dist solo se distribuye como módulo ES (build/pdf.mjs) — el resto de
// la app carga sus librerías como <script> clásico (window.X global), así que
// este archivo hace de puente: importa el módulo y expone window.pdfjsLib
// para que pdfhighlight.js (script normal, no módulo) lo use igual que
// window.mermaid o window.PDFLib.
import './pdfjs-polyfills.mjs';
import * as pdfjsLib from '../node_modules/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-worker-entry.mjs', import.meta.url).href;

window.pdfjsLib = pdfjsLib;
window.dispatchEvent(new Event('pdfjs-ready'));
