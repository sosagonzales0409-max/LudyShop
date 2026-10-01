import { open } from '@op-engineering/op-sqlite';
import { aplicarMigraciones } from './migrations';
import { notificarCambios, tablaEscrita } from './cambios';

// ─── Conexión a SQLite ────────────────────────────────────────────────────────
// Un solo archivo `mitienda.db` en la carpeta privada de la app.
// Uso:
//   await initDB()               — una vez al arrancar (StoreProvider)
//   getDB().execute(sql, params) — lecturas
//   persistir(async tx => {...}) — TODAS las escrituras (ver abajo); al
//                                  confirmarse avisa qué tablas cambió (cambios.js)

const NOMBRE_BD = 'mitienda.db';

let db = null;

export const initDB = async () => {
  if (db) return db;
  db = open({ name: NOMBRE_BD });
  // WAL: las escrituras van primero a un archivo aparte; lecturas y
  // escrituras no se bloquean entre sí y los commits son más rápidos.
  // Debe ejecutarse fuera de cualquier transacción.
  await db.execute('PRAGMA journal_mode = WAL');
  await aplicarMigraciones(db);
  return db;
};

export const getDB = () => {
  if (!db) throw new Error('La BD no está inicializada: llama a initDB() primero.');
  return db;
};

// ─── Cola serial de escrituras ────────────────────────────────────────────────
// Las acciones de StoreContext actualizan la memoria al instante y encolan
// aquí su escritura. La cola garantiza que se apliquen en el mismo orden en
// que ocurrieron (una venta se guarda antes que el abono que la referencia),
// y cada una va en su propia transacción: si algo falla, se deshace completa.

let cola = Promise.resolve();
let alFallar = null;

// StoreContext registra aquí qué hacer si una escritura falla (avisar al
// usuario y recargar desde la BD, que es la fuente de verdad).
export const onErrorPersistencia = fn => { alFallar = fn; };

// Envuelve el `tx` para anotar qué tablas escribe (INSERT/UPDATE/DELETE), sin
// que cada acción tenga que declararlas (imposible olvidarse de una).
const rastrearTablas = (tx, tablas) => {
  const envuelto = Object.create(tx);
  envuelto.execute = (sql, params) => {
    const tabla = tablaEscrita(sql);
    if (tabla) tablas.add(tabla);
    return tx.execute(sql, params);
  };
  return envuelto;
};

export const persistir = (escritura, etiqueta = 'escritura') => {
  const tablas = new Set();
  const tarea = cola
    .then(() => getDB().transaction(tx => escritura(rastrearTablas(tx, tablas))))
    // Solo si la transacción se confirmó: avisar a las pantallas suscritas.
    .then(resultado => { notificarCambios(tablas); return resultado; });
  // La cola sigue aunque esta tarea falle; el error se reporta aparte.
  cola = tarea.catch(error => {
    console.error(`persistir(${etiqueta}) falló`, error);
    alFallar?.(error, etiqueta);
  });
  return tarea;
};

// Espera a que se vacíe la cola (útil antes de exportar un respaldo).
export const esperarEscrituras = () => cola;

// ─── Tabla meta (datos locales del dispositivo) ───────────────────────────────

export const getMeta = async clave => {
  const { rows } = await getDB().execute('SELECT valor FROM meta WHERE clave = ?', [clave]);
  return rows.length ? rows[0].valor : null;
};

// Recibe un `tx` porque siempre se escribe dentro de persistir().
export const setMeta = (tx, clave, valor) =>
  tx.execute(
    'INSERT INTO meta (clave, valor) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor',
    [clave, valor == null ? null : String(valor)],
  );
