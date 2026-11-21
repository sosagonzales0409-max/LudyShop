import { getDB } from '../db';
import { nowIso } from '../ids';
import { insertar, actualizar, borrarLogico, aBooleano } from './comunes';

// ─── Repositorio de ventas, sus ítems y abonos ────────────────────────────────
// Formas en memoria (las que ya usan las pantallas):
//   venta: { id, fecha, tipoPago, cliente (nombre|null), clienteId, total,
//            totalAbonado, condonado,
//            productos: [{ id, productId, presentacionId, nombre, marca, tamano,
//                          precio, precioCompra, esGranel, unidadGranel,
//                          numProducts, totalPrice }] }
//   abono: { id, fecha, cliente (nombre), clienteId, ventaId, monto, tipo }
//
// La lógica (repartir abonos, topes, devoluciones) la calcula StoreContext;
// este repositorio solo guarda las filas que cambiaron. El stock NO se toca
// aquí: StoreContext llama a registrarMovimiento() en la misma transacción.

// ─── Lectura ──────────────────────────────────────────────────────────────────

const itemDesdeFila = fila => ({
  id:             fila.id,
  productId:      fila.producto_id,
  presentacionId: fila.presentacion_id,
  nombre:         fila.nombre,
  marca:          fila.marca,
  tamano:         fila.tamano,
  precio:         fila.precio,
  precioCompra:   fila.precio_compra ?? null,
  esGranel:       aBooleano(fila.es_granel),
  unidadGranel:   fila.unidad_granel ?? null,
  numProducts:    fila.cantidad,
  totalPrice:     fila.total,
});

// Columnas de una venta con el nombre de su cliente. Se usa con
// `FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id` (LEFT JOIN
// para no perder las ventas de contado, que no tienen cliente).
const COLUMNAS_VENTA = `v.id, v.fecha, v.tipo_pago, v.cliente_id, v.total, v.total_abonado, v.condonado,
       c.nombre AS cliente_nombre`;
const COLUMNAS_ITEM = `id, venta_id, producto_id, presentacion_id, nombre, marca, tamano,
       precio, precio_compra, es_granel, unidad_granel, cantidad, total`;

// Fila de SQLite → venta con la forma que usan las pantallas (sin ítems aún).
const ventaDesdeFila = fila => ({
  id:           fila.id,
  fecha:        fila.fecha,
  tipoPago:     fila.tipo_pago,
  cliente:      fila.cliente_nombre ?? null,
  clienteId:    fila.cliente_id ?? null,
  total:        fila.total,
  totalAbonado: fila.total_abonado,
  condonado:    fila.condonado,
  productos:    [],
});

// Carga los ítems de ESTAS ventas y los anida en su venta (en su orden).
// En lotes: SQLite limita cuántos `?` caben en una sentencia.
// `ejecutor`: la BD (pantallas) o la transacción en curso (acciones).
const anidarItems = async (ventas, ejecutor = getDB()) => {
  const porId = new Map(ventas.map(v => [v.id, v]));
  const ids = [...porId.keys()];
  for (let i = 0; i < ids.length; i += 500) {
    const lote = ids.slice(i, i + 500);
    const { rows } = await ejecutor.execute(
      `SELECT ${COLUMNAS_ITEM} FROM venta_items
       WHERE deleted_at IS NULL AND venta_id IN (${lote.map(() => '?').join(', ')})
       ORDER BY venta_id, orden`,
      lote,
    );
    rows.forEach(fila => porId.get(fila.venta_id)?.productos.push(itemDesdeFila(fila)));
  }
  return ventas;
};

/**
 * TODAS las ventas vivas, más recientes primero, con sus ítems y el nombre
 * del cliente. Ya no la usa la app (fase 6): queda, igual que cargarAbonos,
 * como referencia para el arnés de verificación en Node; se retirará después
 * del QA final.
 */
export const cargarVentas = async () => {
  const db = getDB();
  const [{ rows: filasVentas }, { rows: filasItems }] = await Promise.all([
    db.execute(
      `SELECT ${COLUMNAS_VENTA}
       FROM ventas v
       LEFT JOIN clientes c ON c.id = v.cliente_id
       WHERE v.deleted_at IS NULL
       ORDER BY v.fecha DESC`,
    ),
    db.execute(`SELECT ${COLUMNAS_ITEM} FROM venta_items WHERE deleted_at IS NULL ORDER BY venta_id, orden`),
  ]);

  const porId = new Map();
  filasVentas.forEach(fila => porId.set(fila.id, ventaDesdeFila(fila)));
  filasItems.forEach(fila => {
    porId.get(fila.venta_id)?.productos.push(itemDesdeFila(fila));
  });
  return [...porId.values()];
};

/**
 * Una PÁGINA de ventas, más recientes primero, con sus ítems y cliente
 * (bajo demanda, para SalesHistoryScreen).
 *   desde:    ISO; solo ventas con fecha >= desde (null = todas)
 *   tipoPago: 'Contado' | 'Credito' | null (todas)
 *   antesDe:  la ÚLTIMA venta ya cargada ({ fecha, id }): cursor compuesto,
 *             igual que en el registro de actividad
 */
export const cargarVentasPagina = async ({ desde = null, tipoPago = null, limite = 30, antesDe = null } = {}) => {
  const condiciones = ['v.deleted_at IS NULL'];
  const params = [];
  if (desde) { condiciones.push('v.fecha >= ?'); params.push(desde); }
  if (tipoPago) { condiciones.push('v.tipo_pago = ?'); params.push(tipoPago); }
  if (antesDe) {
    condiciones.push('(v.fecha < ? OR (v.fecha = ? AND v.id < ?))');
    params.push(antesDe.fecha, antesDe.fecha, antesDe.id);
  }
  const { rows } = await getDB().execute(
    `SELECT ${COLUMNAS_VENTA}
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE ${condiciones.join(' AND ')}
     ORDER BY v.fecha DESC, v.id DESC LIMIT ?`,
    [...params, limite],
  );
  return anidarItems(rows.map(ventaDesdeFila));
};

/**
 * Ventas a crédito de UN cliente, más recientes primero, con sus ítems
 * (bajo demanda, para CustomerDebtScreen). clienteId null = las ventas a
 * crédito sin cliente (el grupo "Sin nombre").
 */
export const cargarVentasCreditoCliente = async ({ clienteId }) => {
  const { rows } = await getDB().execute(
    `SELECT ${COLUMNAS_VENTA}
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.deleted_at IS NULL AND v.tipo_pago = 'Credito'
       AND ${clienteId ? 'v.cliente_id = ?' : 'v.cliente_id IS NULL'}
     ORDER BY v.fecha DESC, v.id DESC`,
    clienteId ? [clienteId] : [],
  );
  return anidarItems(rows.map(ventaDesdeFila));
};

// ─── Lectura DENTRO de una transacción (acciones de StoreContext) ─────────────
// Las acciones leen con `tx.execute`, no con getDB(): leer fuera de la
// transacción mientras está abierta puede bloquearse (como pasó con getMeta).
// Y como la cola de escritura es serial, lo que leen es exactamente el estado
// que dejaron las escrituras anteriores.

/**
 * Una venta viva con sus ítems y sus abonos/condonaciones (cronológicos), o
 * null si ya no existe.
 *   abonos: [{ id, fecha, monto, tipo }]
 */
export const obtenerVenta = async (tx, id) => {
  const { rows } = await tx.execute(
    `SELECT ${COLUMNAS_VENTA}
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.deleted_at IS NULL AND v.id = ?`,
    [id],
  );
  if (!rows.length) return null;
  const [venta] = await anidarItems([ventaDesdeFila(rows[0])], tx);
  const { rows: filasAbonos } = await tx.execute(
    `SELECT id, fecha, monto, tipo FROM abonos
     WHERE deleted_at IS NULL AND venta_id = ?
     ORDER BY fecha, id`,
    [id],
  );
  venta.abonos = filasAbonos.map(f => ({ id: f.id, fecha: f.fecha, monto: f.monto, tipo: f.tipo }));
  return venta;
};

/**
 * Ventas a crédito de un cliente que aún deben algo, de la MÁS ANTIGUA a la
 * más reciente (orden en que registrarAbono liquida la deuda). Sin ítems:
 * para repartir un abono solo hacen falta los totales. clienteId null = las
 * ventas a crédito sin cliente (como en cargarVentasCreditoCliente).
 */
export const ventasCreditoConSaldo = async (tx, clienteId) => {
  const { rows } = await tx.execute(
    `SELECT ${COLUMNAS_VENTA}
     FROM ventas v
     LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.deleted_at IS NULL AND v.tipo_pago = 'Credito'
       AND ${clienteId ? 'v.cliente_id = ?' : 'v.cliente_id IS NULL'}
       AND v.total - v.total_abonado - v.condonado > 0
     ORDER BY v.fecha, v.id`,
    clienteId ? [clienteId] : [],
  );
  return rows.map(ventaDesdeFila);
};

// Abonos vivos en orden cronológico (el orden en que addSale/registrarAbono
// los agregan al final del arreglo).
export const cargarAbonos = async () => {
  const { rows } = await getDB().execute(
    `SELECT a.id, a.fecha, a.venta_id, a.cliente_id, a.monto, a.tipo,
            c.nombre AS cliente_nombre
     FROM abonos a
     LEFT JOIN clientes c ON c.id = a.cliente_id
     WHERE a.deleted_at IS NULL
     ORDER BY a.fecha`,
  );
  return rows.map(fila => ({
    id:        fila.id,
    fecha:     fila.fecha,
    cliente:   fila.cliente_nombre ?? '',
    clienteId: fila.cliente_id ?? null,
    ventaId:   fila.venta_id,
    monto:     fila.monto,
    tipo:      fila.tipo,
  }));
};

// ─── Escritura: ventas ────────────────────────────────────────────────────────

/**
 * Venta nueva con sus ítems (ids ya generados por StoreContext).
 * Solo guarda los campos de la "foto" del producto; lo demás que traiga el
 * carrito (stock, categoriaId, cantidadTexto…) se descarta a propósito.
 */
export const crearVenta = async (tx, venta) => {
  await insertar(tx, 'ventas', {
    id:            venta.id,
    fecha:         venta.fecha,
    tipo_pago:     venta.tipoPago,
    cliente_id:    venta.clienteId ?? null,
    total:         venta.total,
    total_abonado: venta.totalAbonado ?? 0,
    condonado:     venta.condonado ?? 0,
  });
  for (const [orden, item] of (venta.productos ?? []).entries()) {
    await insertar(tx, 'venta_items', {
      id:              item.id,
      venta_id:        venta.id,
      producto_id:     item.productId ?? null,
      presentacion_id: item.presentacionId ?? null,
      nombre:          item.nombre,
      marca:           item.marca ?? '',
      tamano:          item.tamano ?? '',
      precio:          item.precio,
      precio_compra:   item.precioCompra ?? null,
      es_granel:       !!item.esGranel,
      unidad_granel:   item.unidadGranel ?? null,
      cantidad:        item.numProducts,
      total:           item.totalPrice,
      orden,
    });
  }
};

// Totales de la cabecera tras un abono, condonación o devolución.
// cambios: parcial de { total, totalAbonado, condonado }
export const actualizarTotalesVenta = (tx, ventaId, cambios) => {
  const columnas = {};
  if (cambios.total !== undefined)        columnas.total = cambios.total;
  if (cambios.totalAbonado !== undefined) columnas.total_abonado = cambios.totalAbonado;
  if (cambios.condonado !== undefined)    columnas.condonado = cambios.condonado;
  if (!Object.keys(columnas).length) return Promise.resolve();
  return actualizar(tx, 'ventas', ventaId, columnas);
};

/**
 * Borrado lógico en cascada: la venta, sus ítems y sus abonos. Un UPDATE
 * por tabla, filtrando por venta_id (solo las filas aún vivas, para no
 * pisar la fecha de algo que ya se había borrado antes).
 */
export const eliminarVenta = async (tx, ventaId) => {
  const ahora = nowIso();
  await borrarLogico(tx, 'ventas', ventaId);
  for (const tabla of ['venta_items', 'abonos']) {
    await tx.execute(
      `UPDATE ${tabla} SET deleted_at = ?, updated_at = ? WHERE venta_id = ? AND deleted_at IS NULL`,
      [ahora, ahora, ventaId],
    );
  }
};

// ─── Escritura: ítems (devoluciones) ──────────────────────────────────────────

export const actualizarItemVenta = (tx, itemId, { numProducts, totalPrice }) =>
  actualizar(tx, 'venta_items', itemId, { cantidad: numProducts, total: totalPrice });

export const eliminarItemVenta = (tx, itemId) =>
  borrarLogico(tx, 'venta_items', itemId);

// ─── Escritura: abonos ────────────────────────────────────────────────────────

export const crearAbono = (tx, abono) =>
  insertar(tx, 'abonos', {
    id:         abono.id,
    venta_id:   abono.ventaId,
    cliente_id: abono.clienteId ?? null,
    fecha:      abono.fecha,
    monto:      abono.monto,
    tipo:       abono.tipo,
  });

// ajustarAbonoVenta corrige el monto de abonos que ya existen.
export const actualizarMontoAbono = (tx, abonoId, monto) =>
  actualizar(tx, 'abonos', abonoId, { monto });
