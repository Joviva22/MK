import { root, emptyEl, overlay } from './database-state.js';

export function renderWelcome(onCreate, onOpenFolder) {
  emptyEl.replaceChildren();
  const title = document.createElement('h2'); title.textContent = root() ? 'Organiza tus datos con una tabla' : 'Abre una carpeta para empezar';
  const description = document.createElement('p'); description.textContent = root() ? 'Cada fila es un libro, proyecto o tema. Las columnas guardan sus datos: título, estado, fecha…' : 'Cada carpeta tiene sus propias bases de datos. Elige dónde quieres guardar las tuyas.';
  const button = document.createElement('button'); button.type = 'button'; button.className = 'toolbar-button database-primary'; button.textContent = root() ? 'Crear mi primera base' : 'Abrir carpeta'; button.addEventListener('click', root() ? onCreate : onOpenFolder);
  const note = document.createElement('p'); note.className = 'database-muted'; note.textContent = root() ? 'Elige una plantilla de Lecturas, Proyectos o Estudio, o empieza con una base vacía.' : 'Las bases se guardan junto a tus notas y se conservan al cerrar MK.';
  emptyEl.append(title, description, button, note);
}

export function chooseDatabase() {
  return new Promise(resolve => {
    const folder = root();
    const previousFocus = document.activeElement;
    let selected = window.mdDatabaseTemplates.find(t => t.id === 'reading');
    let busy = false;
    const backdrop = document.createElement('div'); backdrop.className = 'modal-overlay database-create-overlay';
    const box = document.createElement('form'); box.noValidate = true; box.className = 'modal database-create-dialog'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-labelledby', 'database-create-title');
    const title = document.createElement('h2'); title.id = 'database-create-title'; title.textContent = 'Crea tu base de datos';
    const intro = document.createElement('p'); intro.className = 'database-muted'; intro.textContent = 'Elige qué quieres organizar. Podrás cambiar columnas, filas y vistas después.';
    const cards = document.createElement('div'); cards.className = 'database-template-grid'; cards.setAttribute('aria-label', 'Plantillas disponibles');
    const nameLabel = document.createElement('label'); nameLabel.htmlFor = 'database-create-name'; nameLabel.textContent = 'Nombre de la base';
    const name = document.createElement('input'); name.id = nameLabel.htmlFor; name.className = 'database-cell-input'; name.value = selected.name; name.maxLength = 120; name.autocomplete = 'off';
    const preview = document.createElement('div'); preview.className = 'database-template-preview';
    const examplesLabel = document.createElement('label'); examplesLabel.className = 'database-example-toggle';
    const examples = document.createElement('input'); examples.type = 'checkbox'; examples.id = 'database-create-examples'; examples.checked = true;
    const examplesText = document.createElement('span'); examplesText.textContent = 'Incluir dos filas de ejemplo para aprender (puedes editarlas o borrarlas).'; examplesLabel.append(examples, examplesText);
    const context = document.createElement('p'); context.className = 'database-folder-context'; context.textContent = `Se guardará en: ${folder}`;
    const error = document.createElement('p'); error.className = 'ask-error'; error.hidden = true; error.setAttribute('role', 'alert');
    const actions = document.createElement('div'); actions.className = 'modal-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'toolbar-button'; cancel.textContent = 'Cancelar';
    const create = document.createElement('button'); create.type = 'submit'; create.id = 'database-create-submit'; create.className = 'toolbar-button database-primary'; create.textContent = 'Crear base';
    actions.append(cancel, create); box.append(title, intro, cards, nameLabel, name, preview, examplesLabel, context, error, actions); backdrop.appendChild(box);
    function finish(result) { backdrop.remove(); if (previousFocus?.isConnected) previousFocus.focus(); resolve(result); }
    function renderPreview() {
      preview.replaceChildren();
      const heading = document.createElement('strong'); heading.textContent = 'Así será tu tabla';
      const wrap = document.createElement('div'); wrap.className = 'database-template-table-wrap';
      const table = document.createElement('table'); const head = document.createElement('thead'); const headers = document.createElement('tr');
      selected.columns.forEach(col => { const th = document.createElement('th'); th.textContent = col.name; headers.appendChild(th); }); head.appendChild(headers); table.appendChild(head);
      const body = document.createElement('tbody');
      if (examples.checked) selected.examples.forEach(row => {
        const tr = document.createElement('tr'); selected.columns.forEach(col => { const td = document.createElement('td'); const value = row[col.key]; td.textContent = col.type === 'select' ? col.options.choices.find(c => c.id === value)?.label || '—' : value == null ? '—' : String(value); tr.appendChild(td); }); body.appendChild(tr);
      });
      table.appendChild(body); wrap.appendChild(table);
      const hint = document.createElement('small'); hint.textContent = `Vistas incluidas: ${selected.views.map(v => v.name).join(', ')}. Son distintas formas de ver las mismas filas.`;
      preview.append(heading, wrap, hint);
    }
    window.mdDatabaseTemplates.forEach(template => {
      const card = document.createElement('button'); card.type = 'button'; card.className = 'database-template-card'; card.dataset.template = template.id; card.setAttribute('aria-pressed', String(template.id === selected.id));
      const icon = document.createElement('span'); window.mdIcons.button(icon, template.icon); icon.setAttribute('aria-hidden', 'true');
      const heading = document.createElement('strong'); heading.textContent = template.name;
      const description = document.createElement('small'); description.textContent = template.description;
      card.append(icon, heading, description);
      card.addEventListener('click', () => {
        if (name.value === selected.name || !name.value.trim()) name.value = template.name;
        selected = template;
        cards.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === card)));
        examplesLabel.hidden = !template.examples.length; renderPreview();
      }); cards.appendChild(card);
    });
    examples.addEventListener('change', renderPreview);
    cancel.addEventListener('click', () => { if (!busy) finish(null); });
    backdrop.addEventListener('mousedown', e => { if (e.target === backdrop && !busy) finish(null); });
    backdrop.addEventListener('keydown', e => { if (e.key !== 'Tab') e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); if (!busy) finish(null); } });
    box.addEventListener('submit', async e => {
      e.preventDefault(); if (busy) return;
      if (!name.value.trim()) { error.textContent = 'Escribe un nombre para la base.'; error.hidden = false; name.focus(); return; }
      if (root() !== folder || overlay.hidden) { error.textContent = 'La carpeta cambió. Cierra este diálogo y vuelve a crear la base.'; error.hidden = false; return; }
      busy = true; box.setAttribute('aria-busy', 'true'); box.querySelectorAll('button, input').forEach(el => el.disabled = true); create.textContent = 'Creando…';
      try { const db = await window.mdEditor.db.createDatabase(folder, name.value.trim(), { template: selected.id, includeExamples: !!selected.examples.length && examples.checked }); finish(db); }
      catch (failure) { error.textContent = `No se pudo crear la base. ${failure.message}`; error.hidden = false; }
      finally { busy = false; box.setAttribute('aria-busy', 'false'); box.querySelectorAll('button, input').forEach(el => el.disabled = false); create.textContent = 'Crear base'; }
    });
    renderPreview(); document.body.appendChild(backdrop); name.focus(); name.select();
  });
}
