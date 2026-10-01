import { getDB } from '../db';
import { aBooleano } from '../repositories/comunes';
import { resumenPeriodo } from './historial';

// ─── Consulta del Corte del día (bajo demanda) ────────────────────────────────
// Replica las fórmulas que tenía CorteModal cuando leía de memoria.

/**
 * Todo lo que muestra el Corte, con "hoy" = desde la medianoche local.
 *   inicioHoy: ISO de la medianoche local de hoy
 * Devuelve { contado, credito, abonos, numVentas, pendienteTotal,
 *            abonosHoy: [{ id, fecha, cliente, monto }], masVendido }
 *   pendienteTotal = Σ (total − abonado − condonado) de TODAS las ventas a
 *                    crédito, sin tope en 0 (igual que el Corte original)
 *   masVendido     = { nombre, tamano, cantidad, numVentas, esGranel, unidadGranel } | null
 *                    (numVentas = ventas del día en las que apareció)
 */
export const resumenCorte = async ({ inicioHoy }) => {
  const db = getDB();
  const [periodo, { rows: [pend] }, { rows: abonosHoy }, { rows: [top] }] = await Promise.all([
    resumenPeriodo({ desde: inicioHoy }),
    db.execute(
      `SELECT COALESCE(SUM(total - total_abonado - condonado), 0) AS pendiente
       FROM ventas WHERE deleted_at IS NULL AND tipo_pago = 'Credito'`,
    ),
    db.execute(
      `SELECT a.id, a.fecha, a.monto, c.nombre AS cliente
       FROM abonos a LEFT JOIN clientes c ON c.id = a.cliente_id
       WHERE a.deleted_at IS NULL AND a.tipo = 'abono' AND a.fecha >= ?
       ORDER BY a.fecha DESC`,
      [inicioHoy],
    ),
    // Más vendido del día por presentación. Unidades = Σ cantidad (una
    // cantidad 0 cuenta como 1, como `numProducts || 1`). Empate: gana la
    // que se vendió más recientemente. num_ventas = en cuántas ventas
    // distintas apareció (antes la pantalla mostraba el total de ventas del
    // día junto al producto y parecía que eran suyas).
    db.execute(
      `SELECT i.presentacion_id,
              SUM(CASE WHEN i.cantidad = 0 THEN 1 ELSE i.cantidad END) AS cantidad,
              COUNT(DISTINCT i.venta_id) AS num_ventas,
              MAX(v.fecha) AS ultima
       FROM venta_items i JOIN ventas v ON v.id = i.venta_id
       WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL AND v.fecha >= ?
       GROUP BY i.presentacion_id
       ORDER BY cantidad DESC, ultima DESC
       LIMIT 1`,
      [inicioHoy],
    ),
  ]);

  // Nombre/unidad: la "foto" de la venta más reciente de esa presentación hoy.
  let masVendido = null;
  if (top) {
    const { rows: [foto] } = await db.execute(
      `SELECT i.nombre, i.tamano, i.es_granel, i.unidad_granel
       FROM venta_items i JOIN ventas v ON v.id = i.venta_id
       WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL AND i.presentacion_id = ? AND v.fecha >= ?
       ORDER BY v.fecha DESC LIMIT 1`,
      [top.presentacion_id, inicioHoy],
    );
    masVendido = {
      nombre:       foto?.nombre ?? '',
      tamano:       foto?.tamano ?? '',
      cantidad:     top.cantidad,
      numVentas:    Number(top.num_ventas),
      esGranel:     aBooleano(foto?.es_granel),
      unidadGranel: foto?.unidad_granel ?? null,
    };
  }

  return {
    contado:        periodo.contado,
    credito:        periodo.credito,
    abonos:         periodo.abonos,
    numVentas:      periodo.numVentas,
    pendienteTotal: pend.pendiente,
    abonosHoy:      abonosHoy.map(a => ({ id: a.id, fecha: a.fecha, cliente: a.cliente ?? '', monto: a.monto })),
    masVendido,
  };
};
