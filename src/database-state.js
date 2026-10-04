'use strict';

// Base compartida de las bases de datos (ver database.js y sus
// database-*.js hermanos): elementos del DOM, constantes, el estado en
// memoria del panel y los parseos/comparaciones sin dependencias propias.

export const overlay = document.getElementById('database-panel');
export const listEl = document.getElementById('database-list');
export const newBtn = document.getElementById('database-new-btn');
export const emptyEl = document.getElementById('database-empty');
export const contentEl = document.getElementById('database-content');
export const nameInput = document.getElementById('database-name-input');
export const deleteBtn = document.getElementById('database-delete-btn');
export const viewTabsEl = document.getElementById('database-view-tabs');
export const filterInput = document.getElementById('database-filter-input');
export const addColumnBtn = document.getElementById('database-add-column-btn');
export const addRowBtn = document.getElementById('database-add-row-btn');
export const viewBodyEl = document.getElementById('database-view-body');
export const filtersBtn = document.getElementById('database-filters-btn');

export const COLUMN_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'checkbox', label: 'Casilla' },
  { value: 'select', label: 'Selección única' },
  { value: 'multiselect', label: 'Selección múltiple' },
  { value: 'relation', label: 'Relación' },
  { value: 'formula', label: 'Fórmula' },
  { value: 'rollup', label: 'Rollup' },
  { value: 'created_time', label: 'Fecha de creación' }
];

export const CHOICE_COLORS = ['#e07a5f', '#81b29a', '#3d5a80', '#f2cc8f', '#9d8189', '#118ab2', '#ef476f', '#6d597a'];

export const AGGREGATIONS = [
  { value: 'count', label: 'Cantidad' },
  { value: 'sum', label: 'Suma' },
  { value: 'avg', label: 'Promedio' },
  { value: 'min', label: 'Mínimo' },
  { value: 'max', label: 'Máximo' },
  { value: 'unique', label: 'Valores únicos' }
];

export const state = {
  databases: [],
  databaseId: null,
  columns: [],
  rows: [],
  views: [],
  viewId: null,
  relatedData: {}, // databaseId -> { columns, rows }
  filter: ''
};

export function root() {
  return window.mdState.rootFolder;
}

export function parseOptions(column) {
  try {
    return column && column.options ? JSON.parse(column.options) : {};
  } catch {
    return {};
  }
}

export function parseView(view) {
  try {
    return view && view.config ? JSON.parse(view.config) : {};
  } catch {
    return {};
  }
}

export function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function findChoice(column, choiceId) {
  const opts = parseOptions(column);
  return (opts.choices || []).find((c) => c.id === choiceId) || null;
}

export function findColumn(columns, id) {
  return columns.find((c) => c.id === id) || null;
}

export function displayText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  if (typeof value === 'number') return String(Math.round(value * 1000) / 1000);
  return String(value);
}

export function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
