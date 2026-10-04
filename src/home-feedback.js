'use strict';

let timer;
export function clearUndo() {
  clearTimeout(timer);
  const host = document.getElementById('home-feedback');
  host.hidden = true;
  host.replaceChildren();
}

export function offerUndo(message, undo) {
  clearUndo();
  const host = document.getElementById('home-feedback');
  const text = document.createElement('span');
  text.textContent = message;
  const button = document.createElement('button');
  button.className = 'toolbar-button';
  button.textContent = 'Deshacer';
  button.addEventListener('click', () => {
    clearUndo();
    if (undo() === false) {
      text.textContent = 'La tarea ha cambiado desde esta acción.';
      host.appendChild(text);
      host.hidden = false;
      timer = setTimeout(clearUndo, 6000);
    }
  });
  host.append(text, button);
  host.hidden = false;
  // Do not expire the action while the user is interacting with it.
  timer = setTimeout(() => { if (!host.matches(':focus-within, :hover')) clearUndo(); }, 12000);
}
