import { getDB } from '../db';

// ─── Consultas del detalle de producto (bajo demanda) ─────────────────────────
// Antes ProductDetailScreen recorría todas las ventas y compras en memoria en
// cada dibujado. Cada fórmula replica la anterior.

/**
 * Información de cada presentación de un producto.
 *   presentacionIds: ids de sus presentaciones
 *   desde30:         ISO de la medianoche local de hace 29 días (30 días con hoy)
 * Devuelve { [presentacionId]: { ultimaCompra, vendidas30, tieneHistorial } }:
 *   ultimaCompra   = { proveedor, costoUnitario, fecha } de la compra más
 *                    reciente que la incluyó, o null
 *   vendidas30     = Σ unidades vendidas con fecha >= desde30
 *   tieneHistorial = aparece en alguna venta o compra viva (para el aviso al
 *                    eliminar: "el historial no se ve afectado")
 */
export const infoPresentaciones = async ({ presentacionIds, desde30 }) => {
  const ids = [...new Set(presentacionIds)].filter(Boolean);
  if (!ids.length) return {};
  const lista = ids.map(() => '?').join(', ');
  const db = getDB();

  const [{ rows: ultimas }, { rows: vendidas }, { rows: conVentas }, { rows: conCompras }] = await Promise.all([
    // Compra más reciente de cada presentación (función de ventana: son pocas filas).
    db.execute(
      `SELECT presentacion_id, proveedor, costo_unitario, fecha FROM (
         SELECT i.presentacion_id, c.proveedor, i.costo_unitario, c.fecha,
                ROW_NUMBER() OVER (PARTITION BY i.presentacion_id ORDER BY c.fecha DESC) AS n
         FROM compra_items i JOIN compras c ON c.id = i.compra_id
         WHERE i.deleted_at IS NULL AND c.deleted_at IS NULL AND i.presentacion_id IN (${lista})
       ) WHERE n = 1`,
      ids,
    ),
    db.execute(
      `SELECT i.presentacion_id, SUM(i.cantidad) AS vendidas
       FROM venta_items i JOIN ventas v ON v.id = i.venta_id
       WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL AND v.fecha >= ? AND i.presentacion_id IN (${lista})
       GROUP BY i.presentacion_id`,
      [desde30, ...ids],
    ),
    db.execute(
      `SELECT DISTINCT i.presentacion_id FROM venta_items i JOIN ventas v ON v.id = i.venta_id
       WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL AND i.presentacion_id IN (${lista})`,
      ids,
    ),
    db.execute(
      `SELECT DISTINCT i.presentacion_id FROM compra_items i JOIN compras c ON c.id = i.compra_id
       WHERE i.deleted_at IS NULL AND c.deleted_at IS NULL AND i.presentacion_id IN (${lista})`,
      ids,
    ),
  ]);

  const conHistorial = new Set([...conVentas, ...conCompras].map(r => r.presentacion_id));
  const info = {};
  ids.forEach(id => {
    const u = ultimas.find(r => r.presentacion_id === id);
    info[id] = {
      ultimaCompra:   u ? { proveedor: u.proveedor, costoUnitario: u.costo_unitario, fecha: u.fecha } : null,
      vendidas30:     vendidas.find(r => r.presentacion_id === id)?.vendidas ?? 0,
      tieneHistorial: conHistorial.has(id),
    };
  });
  return info;
};
