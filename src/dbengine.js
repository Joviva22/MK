// Motor de "Bases de datos" relacionales (al estilo Notion), backend main-
// process. Una base SQLite real por carpeta raíz abierta, en
// <root>/.mk/databases.sqlite3 — vía sql.js (SQLite compilado a WASM) en vez
// de un módulo nativo: en este entorno better-sqlite3 (incluso recompilado a
// medida con electron-rebuild contra los headers exactos de Electron)
// SIGSEGV en el primer `new Database()` dentro del proceso main, un
// problema de ABI nativo específico de este build de Electron. sql.js corre
// como WASM puro sobre V8, sin ese riesgo, a cambio de tener que persistir a
// mano: cada operación que escribe hace `db.export()` y vuelca los bytes al
// archivo (dataset local y chico, el costo es despreciable).
//
// Modelo: cada "base de datos" (mk_databases) tiene columnas tipadas
// (mk_columns: text/number/date/checkbox/select/multiselect/relation/
// formula/rollup/created_time) y filas (mk_rows); los valores van en
// mk_cells (EAV, una fila+columna -> un valor) salvo las relaciones, que
// viven en mk_relations como filas->filas de otra base (FK real, JOIN real:
// es la parte "relacional" del asunto). Fórmulas y rollups se calculan en el
// renderer (src/database.js) a partir de los valores crudos: SQLite no sabe
// evaluar expresiones JS, y así el usuario puede referenciar columnas por
// nombre sin recompilar nada en el motor.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS mk_databases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    order_idx INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mk_columns (
    id TEXT PRIMARY KEY,
    database_id TEXT NOT NULL REFERENCES mk_databases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    options TEXT,
    order_idx INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS mk_rows (
    id TEXT PRIMARY KEY,
    database_id TEXT NOT NULL REFERENCES mk_databases(id) ON DELETE CASCADE,
    order_idx INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS mk_cells (
    row_id TEXT NOT NULL REFERENCES mk_rows(id) ON DELETE CASCADE,
    column_id TEXT NOT NULL REFERENCES mk_columns(id) ON DELETE CASCADE,
    value TEXT,
    PRIMARY KEY (row_id, column_id)
  );
  CREATE TABLE IF NOT EXISTS mk_relations (
    id TEXT PRIMARY KEY,
    column_id TEXT NOT NULL REFERENCES mk_columns(id) ON DELETE CASCADE,
    from_row TEXT NOT NULL REFERENCES mk_rows(id) ON DELETE CASCADE,
    to_row TEXT NOT NULL REFERENCES mk_rows(id) ON DELETE CASCADE,
    UNIQUE(column_id, from_row, to_row)
  );
  CREATE TABLE IF NOT EXISTS mk_views (
    id TEXT PRIMARY KEY,
    database_id TEXT NOT NULL REFERENCES mk_databases(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    config TEXT,
    order_idx INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_columns_db ON mk_columns(database_id);
  CREATE INDEX IF NOT EXISTS idx_rows_db ON mk_rows(database_id);
  CREATE INDEX IF NOT EXISTS idx_cells_row ON mk_cells(row_id);
  CREATE INDEX IF NOT EXISTS idx_cells_col ON mk_cells(column_id);
  CREATE INDEX IF NOT EXISTS idx_relations_col ON mk_relations(column_id);
  CREATE INDEX IF NOT EXISTS idx_relations_from ON mk_relations(from_row);
  CREATE INDEX IF NOT EXISTS idx_views_db ON mk_views(database_id);
`;

let sqlModulePromise = null;
function getSqlModule() {
  if (!sqlModulePromise) {
    sqlModulePromise = initSqlJs({
      locateFile: (file) => path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
    });
  }
  return sqlModulePromise;
}

const DB_CACHE = new Map(); // root -> sql.js Database instance

function dbPathFor(root) {
  return path.join(root, '.mk', 'databases.sqlite3');
}

async function getDb(root) {
  if (!root) throw new Error('Bases de datos: hace falta una carpeta abierta.');
  if (DB_CACHE.has(root)) return DB_CACHE.get(root);

  const SQL = await getSqlModule();
  const dir = path.join(root, '.mk');
  fs.mkdirSync(dir, { recursive: true });
  const file = dbPathFor(root);
  const db = fs.existsSync(file) ? new SQL.Database(fs.readFileSync(file)) : new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA_SQL);
  DB_CACHE.set(root, db);
  writeNow(root, db); // la primera vez, ya (crea el archivo)
  return db;
}

// Escritura atómica: primero a un temporal (con fsync) y después rename, que
// en el mismo disco es todo-o-nada. Antes se escribía encima del archivo
// directamente: un corte a mitad (apagón, cierre forzado) dejaba el
// .sqlite3 truncado y se perdían TODAS las bases de la carpeta.
function writeNow(root, db) {
  const target = dbPathFor(root);
  const tmp = `${target}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, 'w');
  try {
    fs.writeSync(fd, Buffer.from(db.export()));
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, target);
}

// Escrituras agrupadas: cada cambio marca la base como "sucia" y se guarda
// una sola vez PERSIST_DELAY_MS después del último (pegar 50 filas, editar
// celdas seguidas o arrastrar para reordenar ya no reescriben el archivo
// entero decenas de veces). La base en memoria siempre está al día, así que
// las lecturas no esperan. Al salir de MK, flushAll() guarda lo pendiente.
const PERSIST_DELAY_MS = 300;
const pendingWrites = new Map(); // root -> timeout
let writeCount = 0;

function flush(root) {
  const t = pendingWrites.get(root);
  if (t) clearTimeout(t);
  pendingWrites.delete(root);
  const db = DB_CACHE.get(root);
  if (!db) return;
  writeNow(root, db);
  writeCount++;
}

function persist(root) {
  const t = pendingWrites.get(root);
  if (t) clearTimeout(t);
  pendingWrites.set(root, setTimeout(() => {
    try {
      flush(root);
    } catch (e) {
      if (onPersistError) onPersistError('db:guardar', e);
    }
  }, PERSIST_DELAY_MS));
}

function flushAll() {
  Array.from(pendingWrites.keys()).forEach((root) => {
    try {
      flush(root);
    } catch (e) {
      if (onPersistError) onPersistError('db:guardar', e);
    }
  });
}

let onPersistError = null;

function all(db, sql, params) {
  const stmt = db.prepare(sql);
  try {
    if (params && params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    return rows;
  } finally {
    stmt.free();
  }
}

function one(db, sql, params) {
  return all(db, sql, params)[0] || null;
}

function uid() {
  return crypto.randomUUID();
}

function parseColumnOptions(column) {
  try {
    return column && column.options ? JSON.parse(column.options) : {};
  } catch {
    return {};
  }
}

function nextOrder(db, table, whereCol, whereVal) {
  const row = one(db, `SELECT MAX(order_idx) AS m FROM ${table} WHERE ${whereCol} = ?`, [whereVal]);
  return (row && row.m != null ? row.m : -1) + 1;
}

// ---- Bases de datos ----

async function listDatabases(root) {
  const db = await getDb(root);
  return all(db, 'SELECT * FROM mk_databases ORDER BY order_idx');
}

async function createDatabase(root, name) {
  const db = await getDb(root);
  const id = uid();
  db.run('INSERT INTO mk_databases (id, name, icon, order_idx, created_at) VALUES (?, ?, NULL, ?, ?)', [
    id, name || 'Sin título', nextOrder(db, 'mk_databases', '1', '1'), Date.now()
  ]);
  const colId = uid();
  db.run('INSERT INTO mk_columns (id, database_id, name, type, options, order_idx) VALUES (?, ?, ?, ?, NULL, 0)', [colId, id, 'Nombre', 'text']);
  db.run('INSERT INTO mk_views (id, database_id, name, type, config, order_idx) VALUES (?, ?, ?, ?, ?, 0)', [uid(), id, 'Tabla', 'table', '{}']);
  persist(root, db);
  return one(db, 'SELECT * FROM mk_databases WHERE id = ?', [id]);
}

async function renameDatabase(root, id, name) {
  const db = await getDb(root);
  db.run('UPDATE mk_databases SET name = ? WHERE id = ?', [name, id]);
  persist(root, db);
}

async function setDatabaseIcon(root, id, icon) {
  const db = await getDb(root);
  db.run('UPDATE mk_databases SET icon = ? WHERE id = ?', [icon, id]);
  persist(root, db);
}

async function deleteDatabase(root, id) {
  const db = await getDb(root);
  // Las columnas de relación de esta base pueden tener un espejo viviendo en
  // OTRA base (ver createColumn) — el CASCADE de abajo solo limpia lo que
  // cuelga de mk_databases(id), no esas columnas espejo ajenas, así que hay
  // que borrarlas a mano para no dejar un pairedColumnId apuntando a nada.
  all(db, "SELECT * FROM mk_columns WHERE database_id = ? AND type = 'relation'", [id]).forEach((c) => {
    const opts = parseColumnOptions(c);
    if (opts.pairedColumnId) db.run('DELETE FROM mk_columns WHERE id = ?', [opts.pairedColumnId]);
  });
  db.run('DELETE FROM mk_databases WHERE id = ?', [id]);
  persist(root, db);
}

async function reorderDatabases(root, orderedIds) {
  const db = await getDb(root);
  orderedIds.forEach((id, i) => db.run('UPDATE mk_databases SET order_idx = ? WHERE id = ?', [i, id]));
  persist(root, db);
}

// ---- Columnas ----

async function listColumns(root, databaseId) {
  const db = await getDb(root);
  return all(db, 'SELECT * FROM mk_columns WHERE database_id = ? ORDER BY order_idx', [databaseId]);
}

// _skipMirror: uso interno, para crear el espejo mismo sin recursión infinita.
async function createColumn(root, databaseId, { name, type, options }, _skipMirror) {
  const db = await getDb(root);
  const id = uid();
  const opts = options ? { ...options } : {};
  db.run('INSERT INTO mk_columns (id, database_id, name, type, options, order_idx) VALUES (?, ?, ?, ?, ?, ?)', [
    id, databaseId, name || 'Columna', type || 'text', JSON.stringify(opts), nextOrder(db, 'mk_columns', 'database_id', databaseId)
  ]);

  // Relación a OTRA base de datos: se crea automático la columna espejo del
  // otro lado (tipo Notion "two-way relation"), para poder ver/editar el
  // vínculo desde cualquiera de las dos bases y para que los rollups tengan
  // de dónde agarrar. Auto-relación (a la propia base) queda de un solo
  // sentido a propósito — dos columnas iguales en la misma tabla sería ruido.
  if (type === 'relation' && opts.targetDatabaseId && opts.targetDatabaseId !== databaseId && !_skipMirror) {
    const sourceDb = one(db, 'SELECT name FROM mk_databases WHERE id = ?', [databaseId]);
    const mirror = await createColumn(root, opts.targetDatabaseId, {
      name: sourceDb ? sourceDb.name : 'Relación',
      type: 'relation',
      options: { targetDatabaseId: databaseId, pairedColumnId: id }
    }, true);
    opts.pairedColumnId = mirror.id;
    db.run('UPDATE mk_columns SET options = ? WHERE id = ?', [JSON.stringify(opts), id]);
  }

  persist(root, db);
  return one(db, 'SELECT * FROM mk_columns WHERE id = ?', [id]);
}

async function updateColumn(root, columnId, { name, type, options }) {
  const db = await getDb(root);
  const current = one(db, 'SELECT * FROM mk_columns WHERE id = ?', [columnId]);
  if (!current) return;
  const currentOpts = parseColumnOptions(current);
  const nextType = type != null ? type : current.type;
  let nextOpts = options !== undefined ? (options || {}) : currentOpts;

  // Si dejó de ser relación, o apunta a otra base distinta, el espejo viejo
  // (si había) queda huérfano — se borra para no dejar un pairedColumnId
  // colgando de una columna que ya cambió de forma.
  if (currentOpts.pairedColumnId && (nextType !== 'relation' || nextOpts.targetDatabaseId !== currentOpts.targetDatabaseId)) {
    db.run('DELETE FROM mk_columns WHERE id = ?', [currentOpts.pairedColumnId]);
    nextOpts = { ...nextOpts };
    delete nextOpts.pairedColumnId;
  }

  db.run('UPDATE mk_columns SET name = ?, type = ?, options = ? WHERE id = ?', [
    name != null ? name : current.name, nextType, JSON.stringify(nextOpts), columnId
  ]);

  // Pasó a ser relación a otra base (o cambió de base destino) y todavía no
  // tiene espejo: crearlo, igual que en createColumn.
  if (nextType === 'relation' && nextOpts.targetDatabaseId && nextOpts.targetDatabaseId !== current.database_id && !nextOpts.pairedColumnId) {
    const sourceDb = one(db, 'SELECT name FROM mk_databases WHERE id = ?', [current.database_id]);
    const mirror = await createColumn(root, nextOpts.targetDatabaseId, {
      name: sourceDb ? sourceDb.name : 'Relación',
      type: 'relation',
      options: { targetDatabaseId: current.database_id, pairedColumnId: columnId }
    }, true);
    nextOpts = { ...nextOpts, pairedColumnId: mirror.id };
    db.run('UPDATE mk_columns SET options = ? WHERE id = ?', [JSON.stringify(nextOpts), columnId]);
  }

  persist(root, db);
}

async function deleteColumn(root, columnId) {
  const db = await getDb(root);
  const current = one(db, 'SELECT * FROM mk_columns WHERE id = ?', [columnId]);
  if (!current) return;
  const opts = parseColumnOptions(current);
  if (opts.pairedColumnId) db.run('DELETE FROM mk_columns WHERE id = ?', [opts.pairedColumnId]);
  db.run('DELETE FROM mk_columns WHERE id = ?', [columnId]);
  persist(root, db);
}

async function reorderColumns(root, databaseId, orderedIds) {
  const db = await getDb(root);
  orderedIds.forEach((id, i) => db.run('UPDATE mk_columns SET order_idx = ? WHERE id = ? AND database_id = ?', [i, id, databaseId]));
  persist(root, db);
}

// ---- Filas + celdas + relaciones ----

async function listRows(root, databaseId) {
  const db = await getDb(root);
  const rows = all(db, 'SELECT * FROM mk_rows WHERE database_id = ? ORDER BY order_idx', [databaseId]);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');

  const cellsByRow = new Map();
  all(db, `SELECT * FROM mk_cells WHERE row_id IN (${placeholders})`, ids).forEach((c) => {
    if (!cellsByRow.has(c.row_id)) cellsByRow.set(c.row_id, {});
    cellsByRow.get(c.row_id)[c.column_id] = c.value;
  });

  const relsByRow = new Map();
  all(db, `SELECT * FROM mk_relations WHERE from_row IN (${placeholders})`, ids).forEach((r) => {
    if (!relsByRow.has(r.from_row)) relsByRow.set(r.from_row, {});
    const byCol = relsByRow.get(r.from_row);
    if (!byCol[r.column_id]) byCol[r.column_id] = [];
    byCol[r.column_id].push(r.to_row);
  });

  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    cells: cellsByRow.get(r.id) || {},
    relations: relsByRow.get(r.id) || {}
  }));
}

async function createRow(root, databaseId, cells) {
  const db = await getDb(root);
  const id = uid();
  db.run('INSERT INTO mk_rows (id, database_id, order_idx, created_at) VALUES (?, ?, ?, ?)', [
    id, databaseId, nextOrder(db, 'mk_rows', 'database_id', databaseId), Date.now()
  ]);
  if (cells) {
    Object.entries(cells).forEach(([colId, value]) => {
      db.run('INSERT INTO mk_cells (row_id, column_id, value) VALUES (?, ?, ?)', [id, colId, value == null ? null : String(value)]);
    });
  }
  persist(root, db);
  return id;
}

// Muchas filas de una (importar CSV): una sola escritura a disco al final en
// vez de un db.export() + write por fila.
async function createRows(root, databaseId, cellsList) {
  const db = await getDb(root);
  let order = nextOrder(db, 'mk_rows', 'database_id', databaseId);
  const now = Date.now();
  (cellsList || []).forEach((cells) => {
    const id = uid();
    db.run('INSERT INTO mk_rows (id, database_id, order_idx, created_at) VALUES (?, ?, ?, ?)', [id, databaseId, order++, now]);
    Object.entries(cells || {}).forEach(([colId, value]) => {
      if (value == null || value === '') return;
      db.run('INSERT INTO mk_cells (row_id, column_id, value) VALUES (?, ?, ?)', [id, colId, String(value)]);
    });
  });
  persist(root, db);
  return (cellsList || []).length;
}

async function deleteRow(root, rowId) {
  const db = await getDb(root);
  db.run('DELETE FROM mk_rows WHERE id = ?', [rowId]);
  persist(root, db);
}

async function reorderRows(root, databaseId, orderedIds) {
  const db = await getDb(root);
  orderedIds.forEach((id, i) => db.run('UPDATE mk_rows SET order_idx = ? WHERE id = ? AND database_id = ?', [i, id, databaseId]));
  persist(root, db);
}

async function setCell(root, rowId, columnId, value) {
  const db = await getDb(root);
  db.run(`
    INSERT INTO mk_cells (row_id, column_id, value) VALUES (?, ?, ?)
    ON CONFLICT(row_id, column_id) DO UPDATE SET value = excluded.value
  `, [rowId, columnId, value == null ? null : String(value)]);
  persist(root, db);
}

async function setRelations(root, columnId, fromRow, toRowIds) {
  const db = await getDb(root);
  const column = one(db, 'SELECT * FROM mk_columns WHERE id = ?', [columnId]);
  const opts = parseColumnOptions(column);
  const nextIds = new Set(toRowIds || []);
  const existingIds = all(db, 'SELECT to_row FROM mk_relations WHERE column_id = ? AND from_row = ?', [columnId, fromRow]).map((r) => r.to_row);
  const existingSet = new Set(existingIds);

  db.run('DELETE FROM mk_relations WHERE column_id = ? AND from_row = ?', [columnId, fromRow]);
  nextIds.forEach((toRow) => {
    db.run('INSERT OR IGNORE INTO mk_relations (id, column_id, from_row, to_row) VALUES (?, ?, ?, ?)', [uid(), columnId, fromRow, toRow]);
  });

  // Relación de dos vías: lo que se agrega/saca de este lado también se
  // agrega/saca del lado espejo (from/to invertidos), para que ambas bases
  // queden consistentes sin importar desde cuál se edite.
  if (opts.pairedColumnId) {
    existingIds.filter((id) => !nextIds.has(id)).forEach((toRow) => {
      db.run('DELETE FROM mk_relations WHERE column_id = ? AND from_row = ? AND to_row = ?', [opts.pairedColumnId, toRow, fromRow]);
    });
    [...nextIds].filter((id) => !existingSet.has(id)).forEach((toRow) => {
      db.run('INSERT OR IGNORE INTO mk_relations (id, column_id, from_row, to_row) VALUES (?, ?, ?, ?)', [uid(), opts.pairedColumnId, toRow, fromRow]);
    });
  }

  persist(root, db);
}

// ---- Vistas ----

async function listViews(root, databaseId) {
  const db = await getDb(root);
  return all(db, 'SELECT * FROM mk_views WHERE database_id = ? ORDER BY order_idx', [databaseId]);
}

async function createView(root, databaseId, { name, type, config }) {
  const db = await getDb(root);
  const id = uid();
  db.run('INSERT INTO mk_views (id, database_id, name, type, config, order_idx) VALUES (?, ?, ?, ?, ?, ?)', [
    id, databaseId, name || 'Vista', type || 'table', config ? JSON.stringify(config) : '{}', nextOrder(db, 'mk_views', 'database_id', databaseId)
  ]);
  persist(root, db);
  return one(db, 'SELECT * FROM mk_views WHERE id = ?', [id]);
}

async function updateView(root, viewId, { name, type, config }) {
  const db = await getDb(root);
  const current = one(db, 'SELECT * FROM mk_views WHERE id = ?', [viewId]);
  if (!current) return;
  db.run('UPDATE mk_views SET name = ?, type = ?, config = ? WHERE id = ?', [
    name != null ? name : current.name,
    type != null ? type : current.type,
    config !== undefined ? JSON.stringify(config) : current.config,
    viewId
  ]);
  persist(root, db);
}

async function deleteView(root, viewId) {
  const db = await getDb(root);
  db.run('DELETE FROM mk_views WHERE id = ?', [viewId]);
  persist(root, db);
}

async function reorderViews(root, databaseId, orderedIds) {
  const db = await getDb(root);
  orderedIds.forEach((id, i) => db.run('UPDATE mk_views SET order_idx = ? WHERE id = ? AND database_id = ?', [i, id, databaseId]));
  persist(root, db);
}

// onError(canal, error): cualquier fallo (disco lleno, base dañada) se
// informa y registra; el error igual sigue hasta el renderer como antes.
// allowRoot(root): la carpeta de la base tiene que estar autorizada (ver
// pathguard.js); si no, el IPC falla sin tocar el disco.
function registerDatabaseIpc(realIpcMain, allowRoot, onError) {
  onPersistError = onError;
  const ipcMain = {
    handle: (channel, fn) => realIpcMain.handle(channel, (e, args) => {
      if (args && 'root' in args && allowRoot && !allowRoot(args.root)) throw new Error('Carpeta no autorizada');
      try {
        return fn(e, args);
      } catch (err) {
        if (onError) onError(channel, err);
        throw err;
      }
    })
  };
  ipcMain.handle('db:listDatabases', (e, { root }) => listDatabases(root));
  ipcMain.handle('db:createDatabase', (e, { root, name }) => createDatabase(root, name));
  ipcMain.handle('db:renameDatabase', (e, { root, id, name }) => renameDatabase(root, id, name));
  ipcMain.handle('db:setDatabaseIcon', (e, { root, id, icon }) => setDatabaseIcon(root, id, icon));
  ipcMain.handle('db:deleteDatabase', (e, { root, id }) => deleteDatabase(root, id));
  ipcMain.handle('db:reorderDatabases', (e, { root, orderedIds }) => reorderDatabases(root, orderedIds));

  ipcMain.handle('db:listColumns', (e, { root, databaseId }) => listColumns(root, databaseId));
  ipcMain.handle('db:createColumn', (e, { root, databaseId, column }) => createColumn(root, databaseId, column));
  ipcMain.handle('db:updateColumn', (e, { root, columnId, column }) => updateColumn(root, columnId, column));
  ipcMain.handle('db:deleteColumn', (e, { root, columnId }) => deleteColumn(root, columnId));
  ipcMain.handle('db:reorderColumns', (e, { root, databaseId, orderedIds }) => reorderColumns(root, databaseId, orderedIds));

  ipcMain.handle('db:listRows', (e, { root, databaseId }) => listRows(root, databaseId));
  ipcMain.handle('db:createRow', (e, { root, databaseId, cells }) => createRow(root, databaseId, cells));
  ipcMain.handle('db:createRows', (e, { root, databaseId, cellsList }) => createRows(root, databaseId, cellsList));
  ipcMain.handle('db:deleteRow', (e, { root, rowId }) => deleteRow(root, rowId));
  ipcMain.handle('db:reorderRows', (e, { root, databaseId, orderedIds }) => reorderRows(root, databaseId, orderedIds));
  ipcMain.handle('db:setCell', (e, { root, rowId, columnId, value }) => setCell(root, rowId, columnId, value));
  ipcMain.handle('db:setRelations', (e, { root, columnId, fromRow, toRowIds }) => setRelations(root, columnId, fromRow, toRowIds));

  ipcMain.handle('db:listViews', (e, { root, databaseId }) => listViews(root, databaseId));
  ipcMain.handle('db:createView', (e, { root, databaseId, view }) => createView(root, databaseId, view));
  ipcMain.handle('db:updateView', (e, { root, viewId, view }) => updateView(root, viewId, view));
  ipcMain.handle('db:deleteView', (e, { root, viewId }) => deleteView(root, viewId));
  ipcMain.handle('db:reorderViews', (e, { root, databaseId, orderedIds }) => reorderViews(root, databaseId, orderedIds));
}

module.exports = { registerDatabaseIpc, flushAll, stats: () => ({ writes: writeCount, pending: pendingWrites.size }) };
