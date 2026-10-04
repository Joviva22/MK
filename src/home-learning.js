import { data, dataRoot, saveTimer } from './home-data.js';

const L = window.mdStudyLogic;
let panel = null, profile, selectedId = '', busy = false, errorText = '', editor = null, session = null, pending = null, previousFocus;
function el(tag, text, cls) { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; }
function state() { data.study = L.normalize(data.study); return data.study.learning; }
function category() { return data.categories.find((c) => c.id === selectedId); }
function assertScope() { if (profile !== dataRoot || !category()) throw new Error('Cambió el Home o la asignatura. Cierra y abre de nuevo este panel.'); }
function status() { const n = panel?.querySelector('[role="alert"]'); if (n) n.textContent = errorText; }
async function persist() {
  if (!pending) assertScope(); clearTimeout(saveTimer);
  const target = pending?.target || data, root = pending ? pending.root : dataRoot, expected = pending?.expected || JSON.stringify(L.normalize(data.study));
  if (!await window.mdEditor.homeSave(target, root)) throw new Error('No se pudo guardar. Conservamos el cambio en memoria: pulsa Reintentar guardado.');
  const stored = await window.mdEditor.homeLoad(root);
  if (JSON.stringify(L.normalize(stored?.study)) !== expected) throw new Error('No se confirmó el guardado. Reintenta antes de cerrar.');
}
async function run(action) {
  if (busy) return; busy = true; errorText = '';
  panel?.querySelectorAll('button,input,select,textarea').forEach((n) => { n.disabled = true; });
  try { if (!pending) assertScope(); await action(); } catch (error) { errorText = error.message; }
  finally { busy = false; if (panel) render(); }
}
function button(label, action, id) { const n = el('button', label, 'toolbar-button'); n.type = 'button'; if (id) n.id = id; n.addEventListener('click', () => run(action)); return n; }
function closeButton() { const n = el('button', 'Cerrar', 'toolbar-button'); n.id = 'learning-close'; n.addEventListener('click', close); return n; }
function field(label, value, onInput, id) { const row = el('label', label); const input = el('textarea'); input.id = id; input.value = value; input.maxLength = id === 'learning-question' ? 8000 : 16000; input.rows = 4; input.style.width = '100%'; input.addEventListener('input', () => onInput(input.value)); row.append(input); return row; }
function hasDraft() { return !!editor || !!session?.attempt.trim(); }
function close() {
  if (busy) return false;
  if (pending) { errorText = 'Hay un cambio pendiente de guardado. Reintenta antes de cerrar.'; status(); return false; }
  if (hasDraft() && !confirm('¿Cerrar y descartar esta edición o las respuestas todavía sin valorar? Los resultados ya guardados se conservan.')) return false;
  panel?.remove(); panel = null; editor = session = null; previousFocus?.focus(); window.mdStudy?.refresh(); return true;
}
async function retry() { await persist(); const done = pending?.done; pending = null; done?.(); }
async function commit(change, done) {
  if (pending) throw new Error('Reintenta primero el guardado pendiente.');
  change(); pending = { done, target: data, root: dataRoot, expected: JSON.stringify(L.normalize(data.study)) }; await retry();
}
function begin(mode, mistakes = false) {
  const learning = state();
  const cards = mode === 'review' ? L.dueCards(learning.cards, selectedId) : mistakes ? L.examMistakes(learning.cards, learning.reviews, selectedId) : learning.cards.filter((c) => c.category === selectedId);
  const ids = cards.map((c) => c.id);
  if (mode === 'exam') for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  session = { mode, ids, index: 0, revealed: false, attempt: '', submittedAttempt: null, scored: 0, correct: 0 }; editor = null;
}
function currentCard() { return state().cards.find((c) => c.id === session?.ids[session.index]); }
async function grade(quality) {
  const card = currentCard(); if (!card || !session.revealed) return;
  const mode = session.mode;
  const now = new Date();
  const review = { id: window.crypto.randomUUID(), cardId: card.id, category: card.category, question: card.question, mode, grade: quality, date: now.toISOString(), attempt: (session.submittedAttempt ?? session.attempt).slice(0, 16000) };
  await commit(() => {
    const learning = state();
    if (mode === 'review') learning.cards = learning.cards.map((c) => c.id === card.id ? L.scheduleCard(c, quality, now) : c);
    learning.reviews.push(review);
  }, () => { session.index++; session.scored++; if (quality >= 2) session.correct++; session.revealed = false; session.attempt = ''; session.submittedAttempt = null; });
}
function render() {
  if (!panel) return;
  const box = panel.querySelector('.study-dialog'); box.replaceChildren();
  box.append(el('h2', 'Repaso y modo examen'));
  const error = el('p', errorText, 'study-error'); error.setAttribute('role', 'alert'); box.append(error);
  if (pending) { box.append(el('p', 'El cambio está en memoria, pero aún no está confirmado en disco.'), button('Reintentar guardado', retry, 'learning-retry')); return; }
  const cat = category();
  if (!cat || profile !== dataRoot) { box.append(el('p', 'Cambió el Home o desapareció la asignatura.'), closeButton()); return; }
  box.append(el('h3', cat.name));
  const learning = state();
  if (editor) {
    box.append(field('Pregunta', editor.question, (v) => { editor.question = v; }, 'learning-question'));
    box.append(field('Respuesta de referencia', editor.answer, (v) => { editor.answer = v; }, 'learning-answer'));
    box.append(el('p', editor.notePath ? `Nota de origen: ${editor.notePath}` : 'Tarjeta sin nota de origen.', 'study-hint'));
    box.append(button('Guardar tarjeta', async () => {
      const question = editor.question.trim(), answer = editor.answer.trim();
      if (!question || !answer || question.length > 8000 || answer.length > 16000) throw new Error('Escribe pregunta y respuesta (máximo 8000 y 16000 caracteres).');
      const value = { ...editor, question, answer };
      await commit(() => {
        const current = state(); const index = current.cards.findIndex((c) => c.id === value.id);
        if (index < 0) current.cards.push(value); else current.cards[index] = value;
      }, () => { editor = null; });
    }, 'learning-save-card'), button('Cancelar edición', () => { editor = null; }, 'learning-cancel-edit'));
  } else if (session) {
    const card = currentCard();
    if (!card) {
      box.append(el('p', `Sesión terminada: ${session.scored} respuestas valoradas · ${session.correct} correctas según tu autoevaluación.`), button('Volver a tarjetas', () => { session = null; }, 'learning-finish'));
    } else {
      box.append(el('p', `${session.mode === 'exam' ? 'Examen' : 'Repaso'} · ${session.index + 1}/${session.ids.length}`));
      const question = el('p', card.question); question.id = 'learning-prompt'; question.style.whiteSpace = 'pre-wrap'; box.append(question);
      const attempt = field('Tu respuesta (opcional en repaso)', session.attempt, (v) => { session.attempt = v; }, 'learning-attempt');
      attempt.querySelector('textarea').readOnly = session.revealed; box.append(attempt);
      if (!session.revealed) box.append(button('Mostrar respuesta', () => {
        if (session.mode === 'exam' && !session.attempt.trim()) throw new Error('Intenta responder antes de ver la solución.');
        session.submittedAttempt = session.attempt; session.revealed = true;
      }, 'learning-reveal'));
      else {
        const answer = el('p', card.answer); answer.id = 'learning-solution'; answer.style.whiteSpace = 'pre-wrap'; box.append(answer);
        box.append(el('p', 'Compara con la referencia y valora tu respuesta. No hay corrección automática.', 'study-hint'));
        if (session.mode === 'exam') box.append(button('Incorrecta', () => grade(0), 'learning-wrong'), button('Correcta', () => grade(2), 'learning-correct'));
        else for (const [label, quality, id] of [['Otra vez · 10 min', 0, 'again'], ['Difícil · 1 día', 1, 'hard'], ['Bien', 2, 'good'], ['Fácil', 3, 'easy']]) {
          const days = L.scheduleCard(card, quality).interval;
          box.append(button(quality >= 2 ? `${label} · ${days} ${days === 1 ? 'día' : 'días'}` : label, () => grade(quality), `learning-${id}`));
        }
      }
    }
  } else {
    const cards = learning.cards.filter((c) => c.category === selectedId);
    const due = L.dueCards(cards, selectedId), mistakes = L.examMistakes(cards, learning.reviews, selectedId);
    box.append(el('p', `${cards.length} tarjetas · ${due.length} repasos pendientes · ${mistakes.length} errores de examen pendientes`, 'study-hint'));
    box.append(button('Nueva tarjeta', () => editNew(false), 'learning-new'), button('Crear desde selección de nota', () => editNew(true), 'learning-from-note'));
    const review = button('Repasar pendientes', () => begin('review'), 'learning-review'); review.disabled = !due.length;
    const exam = button('Modo examen', () => begin('exam'), 'learning-exam'); exam.disabled = !cards.length;
    const errors = button('Practicar errores', () => begin('exam', true), 'learning-errors'); errors.disabled = !mistakes.length; box.append(review, exam, errors);
    box.append(el('p', 'Los repasos programan la próxima fecha. El examen guarda intentos y errores, pero no cambia el calendario de repaso. Una sesión usa las tarjetas presentes al empezar.', 'study-hint'));
    for (const card of cards) {
      const row = el('div', null, 'study-row'); row.dataset.cardId = card.id;
      row.append(el('span', `${card.question.slice(0, 100)} · Próximo repaso: ${new Date(card.due).toLocaleString()}`));
      row.append(button('Editar', () => { editor = { ...card }; }));
      if (card.notePath) row.append(button('Abrir nota de origen', async () => {
        const file = await window.mdEditor.readFile(card.notePath);
        if (!file || file.binary) throw new Error('No se pudo abrir la nota. Autoriza su carpeta o elige el archivo de nuevo.');
        await window.openFileAtPath(card.notePath);
      }));
      row.append(button('Eliminar tarjeta', async () => {
        if (!confirm('¿Eliminar esta tarjeta? La nota original y el historial de resultados se conservan.')) return;
        await commit(() => { const current = state(); current.cards = current.cards.filter((c) => c.id !== card.id); }, () => {});
      })); box.append(row);
    }
    const records = learning.reviews.filter((r) => r.category === selectedId).slice(-20).reverse();
    const history = el('details'); history.append(el('summary', 'Últimos resultados (20)'));
    for (const record of records) {
      const item = el('p', `${new Date(record.date).toLocaleString()} · ${record.question} · ${record.mode === 'exam' ? 'Examen' : 'Repaso'} · ${record.grade >= 2 ? 'Correcta' : 'A reforzar'} · ${record.attempt || 'Sin respuesta escrita'}`); item.style.whiteSpace = 'pre-wrap'; history.append(item);
    } box.append(history);
  }
  box.append(closeButton());
  panel.querySelector('textarea,button')?.focus();
}
function editNew(fromNote) {
  const path = fromNote ? window.mdPomodoro.activeNotePath() : '';
  const selection = fromNote ? window.mdCodeMirror.getSelection() : '';
  if (fromNote && (!path || !selection.trim())) throw new Error('Selecciona un fragmento de una nota Markdown guardada antes de crear la tarjeta.');
  if (selection.length > 16000) throw new Error('Selecciona un fragmento más corto (máximo 16000 caracteres).');
  editor = { id: window.crypto.randomUUID(), category: selectedId, question: '', answer: selection.slice(0, 16000), notePath: path, due: new Date().toISOString(), interval: 0, repetitions: 0 };
}
function open(categoryId) {
  if (panel) return;
  selectedId = categoryId || data.categories[0]?.id || ''; profile = dataRoot; errorText = ''; editor = session = pending = null; previousFocus = document.activeElement;
  panel = el('div', null, 'modal-overlay'); panel.id = 'learning-panel'; panel.style.zIndex = '1300';
  const box = el('div', null, 'modal study-dialog'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Repaso y modo examen'); panel.append(box); document.body.append(panel);
  panel.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key === 'Tab') {
      const controls = [...panel.querySelectorAll('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)')];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }); render();
}
window.addEventListener('beforeunload', (event) => { if (pending || hasDraft()) { event.preventDefault(); event.returnValue = false; } });
window.mdLearning = { open, close, getState: () => L.normalize(data.study).learning };
