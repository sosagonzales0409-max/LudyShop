import { nowIso } from '../ids';

// ─── Ayudantes compartidos por todos los repositorios ─────────────────────────
// Se encargan de las columnas comunes (tienda_id, created_at, updated_at,
// deleted_at) para que cada repositorio solo escriba sus columnas propias.
//
// Seguridad: los nombres de tabla/columna vienen SIEMPRE de nuestro código
// (nunca del usuario); los valores van siempre como parámetros `?`.

// Tienda activa. Se fija una vez al arrancar (ver repositories/store.js) y
// se estampa en cada fila nueva.
let tiendaIdActual = null;

export const setTiendaId = id => { tiendaIdActual = id; };

export const getTiendaId = () => {
  if (!tiendaIdActual) throw new Error('No hay tienda activa: falta cargar la tienda al arrancar.');
  return tiendaIdActual;
};

/**
 * INSERT de una fila nueva. `columnas` es un objeto { columna_sql: valor }
 * que DEBE incluir `id` (generado antes con newId()). Agrega solas
 * tienda_id, created_at y updated_at.
 *
 *   insertar(tx, 'categorias', { id, nombre: 'Granos' })
 *   → INSERT INTO categorias (id, nombre, tienda_id, created_at, updated_at)
 *     VALUES (?, ?, ?, ?, ?)
 */
export const insertar = (tx, tabla, columnas) => {
  const ahora = nowIso();
  const fila = { ...columnas, tienda_id: getTiendaId(), created_at: ahora, updated_at: ahora };
  const nombres = Object.keys(fila);
  const signos = nombres.map(() => '?').join(', ');
  return tx.execute(
    `INSERT INTO ${tabla} (${nombres.join(', ')}) VALUES (${signos})`,
    nombres.map(n => aValorSQL(fila[n])),
  );
};

/**
 * UPDATE de columnas de una fila existente. Siempre actualiza updated_at
 * (en V2 decide qué cambio gana al sincronizar).
 *
 *   actualizar(tx, 'categorias', id, { nombre: 'Abarrotes' })
 *   → UPDATE categorias SET nombre = ?, updated_at = ? WHERE id = ?
 */
export const actualizar = (tx, tabla, id, cambios) => {
  const fila = { ...cambios, updated_at: nowIso() };
  const nombres = Object.keys(fila);
  return tx.execute(
    `UPDATE ${tabla} SET ${nombres.map(n => `${n} = ?`).join(', ')} WHERE id = ?`,
    [...nombres.map(n => aValorSQL(fila[n])), id],
  );
};

/**
 * Soft delete: no borra la fila, la marca con deleted_at. Las lecturas
 * filtran con `WHERE deleted_at IS NULL`.
 */
export const borrarLogico = (tx, tabla, id) => {
  const ahora = nowIso();
  return tx.execute(
    `UPDATE ${tabla} SET deleted_at = ?, updated_at = ? WHERE id = ?`,
    [ahora, ahora, id],
  );
};

// SQLite no tiene booleanos ni undefined: true/false → 1/0, undefined → NULL.
const aValorSQL = valor => {
  if (valor === undefined) return null;
  if (typeof valor === 'boolean') return valor ? 1 : 0;
  return valor;
};

// Lectura: SQLite devuelve 1/0; lo convertimos de vuelta a booleano.
export const aBooleano = valor => valor === 1 || valor === true;
