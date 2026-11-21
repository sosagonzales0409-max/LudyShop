import { getDB } from '../db';

// ─── Consultas de Compras (bajo demanda) ──────────────────────────────────────
// Reemplazan cálculos que recorrían todas las compras (o todas las VENTAS)
// en memoria. Cada fórmula replica la anterior.

// Número de compras y total invertido (resumen de PurchaseHistoryScreen).
export const resumenCompras = async () => {
  const { rows: [r] } = await getDB().execute(
    'SELECT COUNT(*) AS total_compras, COALESCE(SUM(total), 0) AS invertido FROM compras WHERE deleted_at IS NULL',
  );
  return { count: Number(r.total_compras), total: r.invertido };
};

/**
 * Proveedores usados, del más reciente al más antiguo (sin repetir y sin el
 * vacío de "Sin proveedor"). Misma regla que el getProveedores anterior:
 * se comparan tal cual (sensible a mayúsculas), ordenados por su compra más
 * reciente. Empates (varios proveedores surtidos en el mismo momento):
 * alfabético — antes el orden de los empates era impredecible (el
 * comparador de sort no devolvía 0 con fechas iguales).
 */
export const proveedoresRecientes = async () => {
  const { rows } = await getDB().execute(
    `SELECT proveedor FROM compras
     WHERE deleted_at IS NULL AND proveedor != ''
     GROUP BY proveedor
     ORDER BY MAX(fecha) DESC, proveedor`,
  );
  return rows.map(r => r.proveedor);
};

/**
 * Unidades vendidas DESPUÉS de la compra de cada uno de sus productos (para
 * avisar antes de revertir stock). Devuelve { presentacionId: unidades }
 * solo con los que tuvieron ventas. Unidades = Σ cantidad (0 no suma), como
 * `numProducts || 0`.
 */
export const vendidasDespuesDe = async compra => {
  const presentaciones = [...new Set((compra.items ?? []).map(i => i.presentacionId).filter(Boolean))];
  if (!presentaciones.length) return {};
  const { rows } = await getDB().execute(
    `SELECT i.presentacion_id, SUM(i.cantidad) AS vendidas
     FROM venta_items i JOIN ventas v ON v.id = i.venta_id
     WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL AND v.fecha > ?
       AND i.presentacion_id IN (${presentaciones.map(() => '?').join(', ')})
     GROUP BY i.presentacion_id
     HAVING SUM(i.cantidad) > 0`,
    [compra.fecha, ...presentaciones],
  );
  return Object.fromEntries(rows.map(r => [r.presentacion_id, r.vendidas]));
};
