(function () {
'use strict';

// Fotos, video y audio: una sola lista de extensiones para todo MK
// (sidebar, preview, panel secundario, arrastrar al editor) y un visor
// común. Antes cada parte tenía su propia lista (y el audio no se abría).
//
// Chromium reproduce la mayoría; los que no (TIFF, HEIC, AVI, WMV...) no
// quedan en una pantalla rota: el visor avisa y ofrece "Abrir con la
// aplicación del sistema".

const IMAGE = ['png', 'jpg', 'jpeg', 'jfif', 'pjpeg', 'pjp', 'gif', 'webp', 'avif', 'apng', 'bmp', 'svg', 'ico', 'cur', 'tif', 'tiff', 'heic', 'heif'];
const VIDEO = ['mp4', 'm4v', 'webm', 'mkv', 'mov', 'ogv', 'avi', 'wmv', 'flv', '3gp', 'mpg', 'mpeg', 'ts', 'm2ts'];
const AUDIO = ['mp3', 'wav', 'flac', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'weba', 'wma', 'aiff', 'aif', 'mid', 'midi', 'amr'];

const KIND = {};
IMAGE.forEach((e) => { KIND[e] = 'image'; });
VIDEO.forEach((e) => { KIND[e] = 'video'; });
AUDIO.forEach((e) => { KIND[e] = 'audio'; });

function extOf(filePath) {
  const m = /\.([a-z0-9]+)$/i.exec(filePath || '');
  return m ? m[1].toLowerCase() : '';
}

// 'image' | 'video' | 'audio' | null
function kindOf(filePath) {
  return KIND[extOf(filePath)] || null;
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text != null) n.textContent = text;
  return n;
}

// Arma el visor para un archivo multimedia. options.compact: versión para
// el panel secundario (sin fondo de pantalla completa).
function createViewer(filePath, options) {
  const kind = kindOf(filePath);
  const name = filePath.split(/[\\/]/).pop();
  const url = window.mdEditor.toLocalUrl(filePath);
  const wrap = el('div', 'media-viewer media-viewer-' + kind + (options && options.compact ? ' media-viewer-compact' : ''));
  if (kind === 'image') wrap.classList.add('image-preview'); // estilos (y tests) de antes

  const fail = () => {
    wrap.innerHTML = '';
    const box = el('div', 'media-unsupported');
    box.append(
      el('div', 'media-unsupported-icon', kind === 'audio' ? '🎵' : kind === 'video' ? '🎬' : '🖼'),
      el('div', 'media-unsupported-name', name),
      el('div', 'media-unsupported-text', `MK no puede mostrar este formato (.${extOf(filePath)}).`)
    );
    const btn = el('button', 'toolbar-button', 'Abrir con la aplicación del sistema');
    btn.addEventListener('click', () => window.mdEditor.openWithSystem(filePath));
    box.appendChild(btn);
    wrap.appendChild(box);
  };

  if (kind === 'image') {
    const img = el('img');
    img.src = url;
    img.alt = name;
    img.addEventListener('error', fail);
    wrap.appendChild(img);
  } else if (kind === 'video' || kind === 'audio') {
    const media = el(kind);
    media.controls = true;
    media.preload = 'metadata';
    media.src = url;
    media.addEventListener('error', fail);
    if (kind === 'audio') {
      const card = el('div', 'media-audio-card');
      card.append(el('div', 'media-audio-icon', '🎵'), el('div', 'media-audio-name', name), media);
      wrap.appendChild(card);
    } else {
      wrap.appendChild(media);
    }
  } else {
    fail();
  }
  return wrap;
}

window.mdMedia = { kindOf, extOf, createViewer, IMAGE, VIDEO, AUDIO };

})();
