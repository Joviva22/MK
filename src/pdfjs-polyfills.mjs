// pdfjs-dist (build 6.x) asume varias propuestas de JS demasiado nuevas para
// Chromium 128 (el que trae Electron 32): Uint8Array.prototype.toHex/toBase64
// + Uint8Array.fromBase64 ("hashOriginal.toHex is not a function" al abrir
// cualquier PDF) y Map.prototype.getOrInsertComputed/getOrInsert (usado por
// todo el pipeline de render en canvas: "...getOrInsertComputed is not a
// function"). Polyfill mínimo, solo lo que pdfjs llama de verdad (ver
// node_modules/pdfjs-dist/build/pdf.mjs y pdf.worker.mjs). Se importa tanto
// en el hilo principal (pdfjs-loader.mjs) como en el worker
// (pdfjs-worker-entry.mjs), cada uno con su propio scope global.
if (!Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function toHex() {
    return Array.from(this, (b) => b.toString(16).padStart(2, '0')).join('');
  };
}

if (!Uint8Array.prototype.toBase64) {
  Uint8Array.prototype.toBase64 = function toBase64() {
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < this.length; i += chunk) {
      binary += String.fromCharCode.apply(null, this.subarray(i, i + chunk));
    }
    return btoa(binary);
  };
}

if (!Uint8Array.fromBase64) {
  Uint8Array.fromBase64 = function fromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  };
}

[Map, WeakMap].forEach((Ctor) => {
  if (!Ctor.prototype.getOrInsert) {
    Ctor.prototype.getOrInsert = function getOrInsert(key, defaultValue) {
      if (!this.has(key)) this.set(key, defaultValue);
      return this.get(key);
    };
  }
  if (!Ctor.prototype.getOrInsertComputed) {
    Ctor.prototype.getOrInsertComputed = function getOrInsertComputed(key, callbackFn) {
      if (!this.has(key)) this.set(key, callbackFn(key));
      return this.get(key);
    };
  }
});
