(function (root) {
'use strict';
function parse(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x1f]/.test(value)) return null;
  const parts = value.trim().split('|');
  if (parts.length > 2) return null;
  const match = parts[0].trim().match(/^([^#]+\.(pdf|excalidraw))(?:#page=([1-9]\d{0,5}))?$/i);
  if (!match || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(match[1]) || (match[2].toLowerCase() !== 'pdf' && match[3])) return null;
  return { path: match[1], kind: match[2].toLowerCase(), page: Number(match[3] || 1), label: (parts[1] || match[1].split(/[\\/]/).pop()).trim() };
}
function escape(value) { return String(value || '').replace(/[&<>"'#=\[\]]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '#': '&#35;', '=': '&#61;', '[': '&#91;', ']': '&#93;' })[c]); }
const api = { parse, escape };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.mdEmbedLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
