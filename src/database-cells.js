import { state, root, parseOptions, parseJsonArray, findChoice, displayText, COLUMN_TYPES, CHOICE_COLORS, AGGREGATIONS } from './database-state.js';
import { cellDisplayValue, relatedRowTitle, loadRelatedData, openPopover } from './database-helpers.js';
import { renderView } from './database-views.js';

'use strict';

// Una celda por tipo de columna (texto, número, fecha, casilla, selección,
// multiselección, relación), el editor de fila completa y el editor de
// columnas (tipo + configuración según el tipo).

// Editor simple de fila completa, usado desde tablero/galería (la vista
// tabla ya edita celda por celda inline).
export function openRowEditor(row) {
  if (!row) return;
  const previousFocus = document.activeElement;
  const modal = document.createElement('div');
  modal.className = 'modal-overlay palette-overlay';
  const box = document.createElement('div');
  box.className = 'command-palette database-row-modal';
  const heading = document.createElement('h2'); heading.id = 'database-row-title'; heading.textContent = 'Datos de la fila';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-labelledby', heading.id);
  const hint = document.createElement('p'); hint.className = 'database-muted'; hint.textContent = 'Completa los datos. Los cambios se guardan automáticamente al salir de cada campo.';
  box.append(heading, hint);
  modal.appendChild(box);

  state.columns.forEach((col) => {
    const field = document.createElement('div');
    field.className = 'database-row-modal-field';
    const label = document.createElement('label');
    label.textContent = col.name;
    field.appendChild(label);
    const cellHost = document.createElement('div');
    cellHost.className = 'database-td database-row-modal-cell';
    renderCell(cellHost, col, row, () => renderView());
    field.appendChild(cellHost);
    box.appendChild(field);
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toolbar-button database-row-modal-close';
  closeBtn.textContent = 'Cerrar';
  function finish() { modal.remove(); renderView(); if (previousFocus?.isConnected) previousFocus.focus(); }
  closeBtn.addEventListener('click', finish);
  box.appendChild(closeBtn);

  modal.addEventListener('mousedown', (e) => { if (e.target === modal) finish(); });
  modal.addEventListener('keydown', e => { if (e.key !== 'Tab') e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); finish(); } });
  document.body.appendChild(modal);
  box.querySelector('input, button')?.focus();
}

export function renderCell(host, column, row, onChange) {
  host.innerHTML = '';
  const refresh = async () => {
    state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
    if (state.relatedData[state.databaseId]) state.relatedData[state.databaseId].rows = state.rows;
    if (onChange) onChange(); else renderView();
  };

  switch (column.type) {
    case 'text':
      renderTextCell(host, column, row, refresh);
      return;
    case 'number':
      renderNumberCell(host, column, row, refresh);
      return;
    case 'date':
      renderDateCell(host, column, row, refresh);
      return;
    case 'checkbox':
      renderCheckboxCell(host, column, row, refresh);
      return;
    case 'select':
      renderSelectCell(host, column, row, refresh);
      return;
    case 'multiselect':
      renderMultiselectCell(host, column, row, refresh);
      return;
    case 'relation':
      renderRelationCell(host, column, row, refresh);
      return;
    default: {
      const span = document.createElement('span');
      span.className = 'database-cell-readonly';
      span.textContent = displayText(cellDisplayValue(column, row, state.columns));
      host.appendChild(span);
    }
  }
}

export function renderTextCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.className = 'database-cell-input';
  input.type = 'text';
  input.setAttribute('aria-label', column.name);
  input.value = row.cells[column.id] || '';
  input.addEventListener('change', async () => {
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.value);
    await refresh();
  });
  host.appendChild(input);
}

export function renderNumberCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.className = 'database-cell-input';
  input.type = 'number';
  input.setAttribute('aria-label', column.name);
  input.value = row.cells[column.id] != null ? row.cells[column.id] : '';
  input.addEventListener('change', async () => {
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.value === '' ? null : input.value);
    await refresh();
  });
  host.appendChild(input);
}

export function renderDateCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.className = 'database-cell-input';
  input.type = 'date';
  input.setAttribute('aria-label', column.name);
  input.value = row.cells[column.id] || '';
  input.addEventListener('change', async () => {
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.value || null);
    await refresh();
  });
  host.appendChild(input);
}

// Tildar una casilla de una fila le da experiencia a las mascotas, como una
// tarea del Home (una vez por fila, columna y día: destildar y tildar no suma).
export function petXpForCheck(row, column, checked) {
  if (!checked || !window.mdPet) return;
  window.mdPet.gain('task', `db:${row.id}:${column.id}|${new Date().toISOString().slice(0, 10)}`);
}

export function renderCheckboxCell(host, column, row, refresh) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('aria-label', column.name);
  input.checked = row.cells[column.id] === '1';
  input.addEventListener('change', async () => {
    petXpForCheck(row, column, input.checked);
    await window.mdEditor.db.setCell(root(), row.id, column.id, input.checked ? '1' : '0');
    await refresh();
  });
  host.appendChild(input);
}

export function renderSelectCell(host, column, row, refresh) {
  const chip = document.createElement('button');
  chip.className = 'database-select-chip-btn';
  const choice = findChoice(column, row.cells[column.id]);
  chip.appendChild(makeChip(choice));
  chip.addEventListener('click', () => {
    openPopover(chip, 'database-choice-popover', (pop, close) => {
      const opts = parseOptions(column);
      (opts.choices || []).forEach((c) => {
        const btn = document.createElement('button');
        btn.className = 'toolbar-button database-popover-row';
        btn.appendChild(makeChip(c));
        btn.addEventListener('click', async () => {
          close();
          await window.mdEditor.db.setCell(root(), row.id, column.id, c.id);
          await refresh();
        });
        pop.appendChild(btn);
      });
      const clear = document.createElement('button');
      clear.className = 'toolbar-button database-popover-row';
      clear.textContent = 'Vaciar';
      clear.addEventListener('click', async () => {
        close();
        await window.mdEditor.db.setCell(root(), row.id, column.id, null);
        await refresh();
      });
      pop.appendChild(clear);
    });
  });
  host.appendChild(chip);
}

export function renderMultiselectCell(host, column, row, refresh) {
  const opts = parseOptions(column);

  function currentIds() {
    return parseJsonArray(row.cells[column.id]);
  }

  function renderChip() {
    host.innerHTML = '';
    const wrap = document.createElement('button');
    wrap.className = 'database-select-chip-btn';
    const ids = currentIds();
    ids.forEach((id) => {
      const c = (opts.choices || []).find((ch) => ch.id === id);
      if (c) wrap.appendChild(makeChip(c));
    });
    if (!ids.length) wrap.appendChild(makeChip(null));
    wrap.addEventListener('click', () => {
      openPopover(wrap, 'database-choice-popover', (pop) => renderChoiceList(pop));
    });
    host.appendChild(wrap);
  }

  function renderChoiceList(pop) {
    pop.innerHTML = '';
    const ids = currentIds();
    (opts.choices || []).forEach((c) => {
      const btn = document.createElement('button');
      btn.className = 'toolbar-button database-popover-row';
      const active = ids.includes(c.id);
      btn.appendChild(makeChip(c));
      if (active) btn.classList.add('database-popover-row-active');
      btn.addEventListener('click', async () => {
        const next = active ? ids.filter((id) => id !== c.id) : ids.concat([c.id]);
        row.cells[column.id] = JSON.stringify(next);
        await window.mdEditor.db.setCell(root(), row.id, column.id, row.cells[column.id]);
        await refresh();
        renderChip();
        renderChoiceList(pop);
      });
      pop.appendChild(btn);
    });
  }

  renderChip();
}

export function makeChip(choice) {
  const chip = document.createElement('span');
  chip.className = 'database-chip';
  if (choice) {
    chip.textContent = choice.label;
    chip.style.background = choice.color;
  } else {
    chip.textContent = 'Vacío';
    chip.classList.add('database-chip-empty');
  }
  return chip;
}

export function renderRelationCell(host, column, row, refresh) {
  const opts = parseOptions(column);
  const target = state.relatedData[opts.targetDatabaseId];
  const wrap = document.createElement('button');
  wrap.className = 'database-select-chip-btn';
  const ids = row.relations[column.id] || [];
  if (!target) {
    wrap.textContent = '(sin base destino)';
  } else if (!ids.length) {
    wrap.appendChild(makeChip(null));
  } else {
    ids.forEach((id) => {
      const chip = document.createElement('span');
      chip.className = 'database-chip database-chip-relation';
      chip.textContent = relatedRowTitle(target, id);
      wrap.appendChild(chip);
    });
  }
  if (target) {
    wrap.addEventListener('click', () => openRelationPicker(wrap, column, row, target, refresh));
  }
  host.appendChild(wrap);
}

export function openRelationPicker(anchorEl, column, row, target, refresh) {
  openPopover(anchorEl, 'database-relation-popover', (pop) => {
    const search = document.createElement('input');
    search.className = 'database-cell-input';
    search.placeholder = 'Buscar fila...';
    pop.appendChild(search);

    const list = document.createElement('div');
    list.className = 'database-relation-list';
    pop.appendChild(list);

    const selected = new Set(row.relations[column.id] || []);

    function renderList() {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      target.rows
        .filter((r) => relatedRowTitle(target, r.id).toLowerCase().includes(q))
        .forEach((r) => {
          const btn = document.createElement('button');
          btn.className = 'toolbar-button database-popover-row' + (selected.has(r.id) ? ' database-popover-row-active' : '');
          btn.textContent = (selected.has(r.id) ? '✓ ' : '') + relatedRowTitle(target, r.id);
          btn.addEventListener('click', async () => {
            if (selected.has(r.id)) selected.delete(r.id); else selected.add(r.id);
            await window.mdEditor.db.setRelations(root(), column.id, row.id, Array.from(selected));
            renderList();
            await refresh();
          });
          list.appendChild(btn);
        });
    }
    search.addEventListener('input', renderList);
    renderList();
    search.focus();
  });
}

export function openColumnEditor(anchorEl, column) {
  const isNew = !column;
  openPopover(anchorEl, 'database-column-popover', (pop, close) => {
    const title = document.createElement('div');
    title.className = 'database-popover-title';
    title.textContent = isNew ? 'Nueva columna' : 'Editar columna';
    pop.appendChild(title);

    const nameField = document.createElement('input');
    nameField.className = 'database-cell-input';
    nameField.placeholder = 'Nombre';
    nameField.setAttribute('aria-label', 'Nombre de la columna');
    nameField.value = column ? column.name : '';
    pop.appendChild(nameField);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'database-cell-input';
    typeSelect.setAttribute('aria-label', 'Tipo de columna');
    const basic = document.createElement('optgroup'); basic.label = 'Datos básicos';
    const advanced = document.createElement('optgroup'); advanced.label = 'Avanzado: relaciones y cálculos';
    COLUMN_TYPES.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t.value;
      opt.textContent = t.label;
      (['relation', 'formula', 'rollup'].includes(t.value) ? advanced : basic).appendChild(opt);
    });
    typeSelect.append(basic, advanced);
    typeSelect.value = column ? column.type : 'text';
    pop.appendChild(typeSelect);
    const typeHelp = document.createElement('p'); typeHelp.className = 'database-popover-hint'; typeHelp.id = 'database-column-type-help'; typeSelect.setAttribute('aria-describedby', typeHelp.id); pop.appendChild(typeHelp);

    const configHost = document.createElement('div');
    configHost.className = 'database-column-config';
    pop.appendChild(configHost);

    let getConfig = () => ({});
    function renderConfig() {
      const tips = { text: 'Texto libre, como un título, autor o comentario.', number: 'Una cantidad: minutos, precio, puntuación… Se puede ordenar y sumar.', date: 'Un día concreto, como una entrega o un repaso. Se puede usar en una vista Calendario.', checkbox: 'Sí o no: hecho, pagado, revisado…', select: 'Una opción por fila. Por ejemplo: Pendiente, En curso o Terminado.', multiselect: 'Varias opciones por fila, como etiquetas o temas.', relation: 'Enlaza esta fila con elementos de otra base. Úsala cuando ya tengas dos bases organizadas.', formula: 'Calcula un valor a partir de otras columnas. No se escribe manualmente en las filas.', rollup: 'Resume datos de las filas enlazadas mediante una Relación, por ejemplo su suma o cantidad.', created_time: 'Registra automáticamente cuándo se creó cada fila.' };
      typeHelp.textContent = tips[typeSelect.value] || '';
      configHost.innerHTML = '';
      getConfig = buildColumnConfigEditor(configHost, typeSelect.value, column);
    }
    typeSelect.addEventListener('change', renderConfig);
    renderConfig();

    const actions = document.createElement('div');
    actions.className = 'database-popover-actions';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'toolbar-button';
    saveBtn.textContent = 'Guardar';
    saveBtn.addEventListener('click', async () => {
      const payload = { name: nameField.value.trim() || 'Columna', type: typeSelect.value, options: getConfig() };
      if (isNew) {
        await window.mdEditor.db.createColumn(root(), state.databaseId, payload);
      } else {
        await window.mdEditor.db.updateColumn(root(), column.id, payload);
      }
      close();
      await reloadColumnsAndRows();
    });
    actions.appendChild(saveBtn);

    if (!isNew) {
      const delBtn = document.createElement('button');
      delBtn.className = 'toolbar-button database-popover-danger';
      delBtn.textContent = 'Eliminar';
      delBtn.addEventListener('click', async () => {
        if (state.columns.length <= 1) { alert('Tiene que quedar al menos una columna.'); return; }
        await window.mdEditor.db.deleteColumn(root(), column.id);
        close();
        await reloadColumnsAndRows();
      });
      actions.appendChild(delBtn);
    }
    pop.appendChild(actions);
    nameField.focus();
  });
}

export async function reloadColumnsAndRows() {
  state.columns = await window.mdEditor.db.listColumns(root(), state.databaseId);
  state.rows = await window.mdEditor.db.listRows(root(), state.databaseId);
  await loadRelatedData();
  renderView();
}

export function buildColumnConfigEditor(host, type, column) {
  const opts = column ? parseOptions(column) : {};

  // Columna Fecha: avisos para todas sus filas ("Faltan 3 días para …"),
  // los hace sonar el motor de recordatorios del Home (home.js).
  if (type === 'date') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Avisos (para cada fila con fecha; no avisa si la fila tiene una casilla marcada):';
    host.appendChild(hint);
    const getReminders = window.mdReminderUI.build(host, opts.reminders || []);
    return () => ({ reminders: getReminders() });
  }

  if (type === 'select' || type === 'multiselect') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Opciones, una por línea:';
    host.appendChild(hint);
    const textarea = document.createElement('textarea');
    textarea.className = 'database-cell-input database-choices-textarea';
    textarea.rows = 4;
    textarea.value = (opts.choices || []).map((c) => c.label).join('\n');
    host.appendChild(textarea);
    return () => {
      const existingByLabel = new Map((opts.choices || []).map((c) => [c.label, c]));
      const labels = textarea.value.split('\n').map((l) => l.trim()).filter(Boolean);
      const choices = labels.map((label, i) => existingByLabel.get(label) || { id: crypto.randomUUID(), label, color: CHOICE_COLORS[i % CHOICE_COLORS.length] });
      return { choices };
    };
  }

  if (type === 'relation') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Base de datos destino:';
    host.appendChild(hint);
    const select = document.createElement('select');
    select.className = 'database-cell-input';
    state.databases.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.name;
      select.appendChild(opt);
    });
    if (opts.targetDatabaseId) select.value = opts.targetDatabaseId;
    host.appendChild(select);
    return () => ({ targetDatabaseId: select.value });
  }

  if (type === 'formula') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Expresión JS: prop("Columna") para leer otra columna. Ej: prop("Precio") * prop("Cantidad")';
    host.appendChild(hint);
    const textarea = document.createElement('textarea');
    textarea.className = 'database-cell-input';
    textarea.rows = 3;
    textarea.value = opts.expr || '';
    host.appendChild(textarea);
    return () => ({ expr: textarea.value });
  }

  if (type === 'rollup') {
    const hint = document.createElement('div');
    hint.className = 'database-popover-hint';
    hint.textContent = 'Columna de relación:';
    host.appendChild(hint);
    const relSelect = document.createElement('select');
    relSelect.className = 'database-cell-input';
    const relationColumns = state.columns.filter((c) => c.type === 'relation');
    relationColumns.forEach((c) => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      relSelect.appendChild(opt);
    });
    host.appendChild(relSelect);

    const targetHint = document.createElement('div');
    targetHint.className = 'database-popover-hint';
    targetHint.textContent = 'Columna a agregar (de la base destino):';
    host.appendChild(targetHint);
    const targetSelect = document.createElement('select');
    targetSelect.className = 'database-cell-input';
    host.appendChild(targetSelect);

    function refreshTargetOptions() {
      const relCol = relationColumns.find((c) => c.id === relSelect.value);
      const relOpts = relCol ? parseOptions(relCol) : {};
      const targetCols = (state.relatedData[relOpts.targetDatabaseId] || { columns: [] }).columns
        .filter((c) => c.type !== 'formula' && c.type !== 'rollup');
      targetSelect.innerHTML = '';
      targetCols.forEach((c) => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name;
        targetSelect.appendChild(opt);
      });
      if (opts.targetColumnId) targetSelect.value = opts.targetColumnId;
    }
    relSelect.addEventListener('change', refreshTargetOptions);
    if (opts.relationColumnId) relSelect.value = opts.relationColumnId;
    refreshTargetOptions();

    const aggHint = document.createElement('div');
    aggHint.className = 'database-popover-hint';
    aggHint.textContent = 'Agregación:';
    host.appendChild(aggHint);
    const aggSelect = document.createElement('select');
    aggSelect.className = 'database-cell-input';
    AGGREGATIONS.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.value;
      opt.textContent = a.label;
      aggSelect.appendChild(opt);
    });
    if (opts.aggregation) aggSelect.value = opts.aggregation;
    host.appendChild(aggSelect);

    if (!relationColumns.length) {
      const warn = document.createElement('div');
      warn.className = 'database-popover-hint';
      warn.textContent = 'Necesitás al menos una columna de tipo Relación en esta base de datos.';
      host.appendChild(warn);
    }

    return () => ({ relationColumnId: relSelect.value, targetColumnId: targetSelect.value, aggregation: aggSelect.value });
  }

  return () => ({});
}
