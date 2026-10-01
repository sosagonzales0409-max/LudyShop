import { getDB } from '../db';

// ─── Consultas del Historial de ventas (bajo demanda) ─────────────────────────
// Los totales los calcula SQLite (SUM/COUNT sobre índices) en vez de recorrer
// todas las ventas en JS en cada dibujado. Cada fórmula replica EXACTAMENTE
// la que tenía HistorialView cuando leía de memoria.

/**
 * Resumen del período.
 *   desde:    ISO; solo ventas/abonos con fecha >= desde (null = todo)
 *   tipoPago: 'Contado' | 'Credito' | null (Todos)
 * Devuelve { contado, credito, pendiente, numVentas, abonos }:
 *   contado   = Σ total de ventas de contado
 *   credito   = Σ total de ventas a crédito ("Vendido a crédito")
 *   pendiente = Σ max(0, total − abonado − condonado) de esas ventas a crédito
 *               ("POR COBRAR (de esas ventas)", misma fórmula que pendienteDe)
 *   abonos    = Σ abonos reales (tipo 'abono') del período; 0 con el filtro
 *               "Contado" (los abonos solo existen para ventas a crédito)
 */
export const resumenPeriodo = async ({ desde = null, tipoPago = null } = {}) => {
  const db = getDB();
  const condiciones = ['deleted_at IS NULL'];
  const params = [];
  if (desde) { condiciones.push('fecha >= ?'); params.push(desde); }
  if (tipoPago) { condiciones.push('tipo_pago = ?'); params.push(tipoPago); }

  const [{ rows: [ventas] }, abonos] = await Promise.all([
    db.execute(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo_pago != 'Credito' THEN total END), 0) AS contado,
         COALESCE(SUM(CASE WHEN tipo_pago = 'Credito' THEN total END), 0)  AS credito,
         COALESCE(SUM(CASE WHEN tipo_pago = 'Credito'
                           THEN MAX(0, total - total_abonado - condonado) END), 0) AS pendiente,
         COUNT(*) AS num_ventas
       FROM ventas WHERE ${condiciones.join(' AND ')}`,
      params,
    ),
    tipoPago === 'Contado' ? Promise.resolve(0) : sumaAbonos({ desde }),
  ]);

  return {
    contado:   ventas.contado,
    credito:   ventas.credito,
    pendiente: ventas.pendiente,
    numVentas: Number(ventas.num_ventas),
    abonos,
  };
};

// Σ de abonos reales (no condonaciones) con fecha >= desde (null = todos).
export const sumaAbonos = async ({ desde = null } = {}) => {
  const { rows } = await getDB().execute(
    `SELECT COALESCE(SUM(monto), 0) AS total FROM abonos
     WHERE deleted_at IS NULL AND tipo = 'abono'${desde ? ' AND fecha >= ?' : ''}`,
    desde ? [desde] : [],
  );
  return rows[0].total;
};
