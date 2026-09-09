(function () {
'use strict';

// Controlar el reproductor multimedia del sistema (Spotify, navegador, VLC,
// cualquiera con soporte MPRIS) sin salir de MK — vía playerctl, solo Linux.
// playerctl no viene con la app; si falta o no hay nada sonando, se avisa
// con un mensaje claro en vez de fallar en silencio.

const prevBtn = document.getElementById('btn-media-prev');
const playPauseBtn = document.getElementById('btn-media-playpause');
const nextBtn = document.getElementById('btn-media-next');

function explainError(result) {
  if (result.reason === 'not-installed') {
    return 'playerctl no está instalado — hace falta para controlar el reproductor desde MK (solo Linux). Instalalo con tu gestor de paquetes, ej. "sudo apt install playerctl", y probá de nuevo.';
  }
  return 'No se pudo controlar el reproductor: ¿hay algo sonando con soporte MPRIS (Spotify, navegador, VLC...)?';
}

async function afterAction(action) {
  const result = await action();
  if (!result.ok) {
    alert(explainError(result));
    return;
  }
  const status = await window.mdEditor.mediaStatus();
  if (status.ok && status.title) {
    playPauseBtn.title = `Reproductor multimedia: play/pausa — ${status.title} (${status.status})`;
  }
}

prevBtn.addEventListener('click', () => afterAction(window.mdEditor.mediaPrevious));
playPauseBtn.addEventListener('click', () => afterAction(window.mdEditor.mediaPlayPause));
nextBtn.addEventListener('click', () => afterAction(window.mdEditor.mediaNext));

window.mdMediaPlayer = {
  playPause: () => afterAction(window.mdEditor.mediaPlayPause),
  next: () => afterAction(window.mdEditor.mediaNext),
  previous: () => afterAction(window.mdEditor.mediaPrevious)
};

})();
