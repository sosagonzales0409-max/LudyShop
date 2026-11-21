import { getDB } from '../db';
import { nowIso } from '../ids';
import { insertar, actualizar, borrarLogico } from './common';

// ─── Repositorio de compras y sus ítems ───────────────────────────────────────
// Forma en memoria (la que ya usan las pantallas):
//   { id, fecha, proveedor, tipoPago, notas, total,
//     items: [{ id, productId, presentacionId, nombre, tamano, cantidad,
//               costoUnitario, subtotal, precioCompraAnterior,
//               piezasPaquete?, precioPaquete?, numPaquetes? }] }
//
// Igual que en ventas: el stock y el precioCompra de las presentaciones los
// mueve StoreContext (registrarMovimiento / editarPresentacion) en la misma
// transacción; aquí solo se guardan las filas de la compra.

// ─── Lectura ──────────────────────────────────────────────────────────────────

const itemDesdeFila = fila => {
  const item = {
    id:                   fila.id,
    productId:            fila.producto_id,
    presentacionId:       fila.presentacion_id,
    nombre:               fila.nombre,
    tamano:               fila.tamano,
    cantidad:             fila.cantidad,
    costoUnitario:        fila.costo_unitario,
    subtotal:             fila.subtotal,
    precioCompraAnterior: fila.precio_compra_anterior ?? null,
  };
  // Opcionales: solo existen en compras por paquete/reja.
  if (fila.piezas_paquete != null) item.piezasPaquete = fila.piezas_paquete;
  if (fila.precio_paquete != null) item.precioPaquete = fila.precio_paquete;
  if (fila.num_paquetes != null)   item.numPaquetes = fila.num_paquetes;
  return item;
};

const COLUMNAS_COMPRA = 'id, fecha, proveedor, tipo_pago, notas, total';
const COLUMNAS_ITEM = `id, compra_id, producto_id, presentacion_id, nombre, tamano, cantidad,
       costo_unitario, subtotal, precio_compra_anterior, piezas_paquete, precio_paquete, num_paquetes`;

// Fila → compra con la forma que usan las pantallas (sin ítems aún).
const compraDesdeFila = fila => ({
  id:        fila.id,
  fecha:     fila.fecha,
  proveedor: fila.proveedor,
  tipoPago:  fila.tipo_pago,
  notas:     fila.notas,
  total:     fila.total,
  items:     [],
});

// Carga los ítems de ESTAS compras y los anida (en lotes, por el límite de `?`).
// `ejecutor`: la BD (pantallas) o la transacción en curso (acciones).
const anidarItems = async (compras, ejecutor = getDB()) => {
  const porId = new Map(compras.map(c => [c.id, c]));
  const ids = [...porId.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const lote = ids.slice(i, i + 500);
    const { rows } = await ejecutor.execute(
      `SELECT ${COLUMNAS_ITEM} FROM compra_items
       WHERE deleted_at IS NULL AND compra_id IN (${lote.map(() => '?').join(', ')})
       ORDER BY compra_id, orden`,
      lote,
    );
    rows.forEach(fila => porId.get(fila.compra_id)?.items.push(itemDesdeFila(fila)));
  }
  return compras;
};

// TODAS las compras vivas, más recientes primero, con sus ítems. Ya no la usa
// la app (fase 6): queda como referencia para el arnés de verificación en
// Node; se retirará después del QA final.
export const cargarCompras = async () => {
  const db = getDB();
  const [{ rows: filasCompras }, { rows: filasItems }] = await Promise.all([
    db.execute(`SELECT ${COLUMNAS_COMPRA} FROM compras WHERE deleted_at IS NULL ORDER BY fecha DESC`),
    db.execute(`SELECT ${COLUMNAS_ITEM} FROM compra_items WHERE deleted_at IS NULL ORDER BY compra_id, orden`),
  ]);

  const porId = new Map();
  filasCompras.forEach(fila => porId.set(fila.id, compraDesdeFila(fila)));
  filasItems.forEach(fila => {
    porId.get(fila.compra_id)?.items.push(itemDesdeFila(fila));
  });
  return [...porId.values()];
};

/**
 * Una PÁGINA de compras, más recientes primero, con sus ítems (bajo demanda,
 * para PurchaseHistoryScreen). antesDe: la última compra ya cargada
 * ({ fecha, id }), cursor compuesto como en ventas.
 */
export const cargarComprasPagina = async ({ limite = 30, antesDe = null } = {}) => {
  const condiciones = ['deleted_at IS NULL'];
  const params = [];
  if (antesDe) {
    condiciones.push('(fecha < ? OR (fecha = ? AND id < ?))');
    params.push(antesDe.fecha, antesDe.fecha, antesDe.id);
  }
  const { rows } = await getDB().execute(
    `SELECT ${COLUMNAS_COMPRA} FROM compras WHERE ${condiciones.join(' AND ')}
     ORDER BY fecha DESC, id DESC LIMIT ?`,
    [...params, limite],
  );
  return anidarItems(rows.map(compraDesdeFila));
};

// Una compra por id con sus ítems, o null si no existe. La usan la pantalla
// (para editarla) y las acciones editarCompra/eliminarCompra, que pasan su
// transacción como `ejecutor` (ver obtenerVenta en sales.js).
export const obtenerCompra = async (id, ejecutor = getDB()) => {
  const { rows } = await ejecutor.execute(
    `SELECT ${COLUMNAS_COMPRA} FROM compras WHERE deleted_at IS NULL AND id = ?`,
    [id],
  );
  if (!rows.length) return null;
  const [compra] = await anidarItems([compraDesdeFila(rows[0])], ejecutor);
  return compra;
};

// ─── Escritura ────────────────────────────────────────────────────────────────

const insertarItems = async (tx, compraId, items) => {
  for (const [orden, item] of items.entries()) {
    await insertar(tx, 'compra_items', {
      id:                     item.id,
      compra_id:              compraId,
      producto_id:            item.productId ?? null,
      presentacion_id:        item.presentacionId ?? null,
      nombre:                 item.nombre,
      tamano:                 item.tamano ?? '',
      cantidad:               item.cantidad,
      costo_unitario:         item.costoUnitario,
      subtotal:               item.subtotal,
      precio_compra_anterior: item.precioCompraAnterior ?? null,
      piezas_paquete:         item.piezasPaquete ?? null,
      precio_paquete:         item.precioPaquete ?? null,
      num_paquetes:           item.numPaquetes ?? null,
      orden,
    });
  }
};

// Soft delete de todos los ítems vivos de una compra.
const borrarItems = (tx, compraId) => {
  const ahora = nowIso();
  return tx.execute(
    'UPDATE compra_items SET deleted_at = ?, updated_at = ? WHERE compra_id = ? AND deleted_at IS NULL',
    [ahora, ahora, compraId],
  );
};

const columnasCabecera = compra => ({
  fecha:     compra.fecha,
  proveedor: compra.proveedor ?? '',
  tipo_pago: compra.tipoPago,
  notas:     compra.notas ?? '',
  total:     compra.total,
});

// Compra nueva con sus ítems (ids ya generados por StoreContext).
export const crearCompra = async (tx, compra) => {
  await insertar(tx, 'compras', { id: compra.id, ...columnasCabecera(compra) });
  await insertarItems(tx, compra.id, compra.items ?? []);
};

/**
 * Edición: actualiza la cabecera y REEMPLAZA los ítems (soft delete de los
 * viejos + insert de los nuevos). Más simple y seguro que comparar ítem por
 * ítem; una compra tiene pocos ítems y se edita rara vez.
 * `compra` es la compra completa ya actualizada (con ids nuevos en sus ítems).
 */
export const editarCompra = async (tx, compra) => {
  await actualizar(tx, 'compras', compra.id, columnasCabecera(compra));
  await borrarItems(tx, compra.id);
  await insertarItems(tx, compra.id, compra.items ?? []);
};

// Borrado lógico en cascada: la compra y sus ítems.
export const eliminarCompra = async (tx, compraId) => {
  await borrarLogico(tx, 'compras', compraId);
  await borrarItems(tx, compraId);
};
