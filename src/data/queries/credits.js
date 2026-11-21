import { getDB } from '../db';
import { cargarVentasCreditoCliente } from '../repositories/sales';

// ─── Consultas de Créditos (bajo demanda) ─────────────────────────────────────
// Antes CreditsScreen, CustomerDebtScreen, NewSaleScreen (selector de clientes con
// deuda) y StoreContext (badge) recorrían TODAS las ventas en cada dibujado;
// NewSaleScreen incluso al escribir en el carrito. Ahora SQLite agrupa por cliente.
// Cada fórmula replica la que tenían esas pantallas.

/**
 * Clientes con saldo pendiente (> $0.009), agrupados por cliente. Las ventas
 * a crédito sin cliente forman el grupo "Sin nombre" (clienteId null).
 * Devuelve [{ cliente, clienteId, totalDeuda, totalAbonado, totalCondonado,
 *             saldo, numVentas, fechaUltima, fechaDeuda }]:
 *   saldo      = Σ total − Σ abonado − Σ condonado
 *   fechaDeuda = la venta con pendiente (> $0.009) más antigua; si no hay,
 *                la última venta (inicio de la deuda, para ordenar)
 * Sin orden: cada pantalla ordena a su manera (son pocos clientes).
 */
export const clientesConSaldo = async () => {
  const { rows } = await getDB().execute(
    `SELECT v.cliente_id,
            COALESCE(c.nombre, 'Sin nombre') AS cliente,
            SUM(v.total) AS total_deuda,
            SUM(v.total_abonado) AS total_abonado,
            SUM(v.condonado) AS total_condonado,
            COUNT(*) AS num_ventas,
            MAX(v.fecha) AS fecha_ultima,
            MIN(CASE WHEN v.total - v.total_abonado - v.condonado > 0.009 THEN v.fecha END) AS fecha_deuda_pendiente
     FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
     WHERE v.deleted_at IS NULL AND v.tipo_pago = 'Credito'
     GROUP BY v.cliente_id`,
  );
  return rows
    .map(r => ({
      cliente:        r.cliente,
      clienteId:      r.cliente_id ?? null,
      totalDeuda:     r.total_deuda,
      totalAbonado:   r.total_abonado,
      totalCondonado: r.total_condonado,
      saldo:          r.total_deuda - r.total_abonado - r.total_condonado,
      numVentas:      Number(r.num_ventas),
      fechaUltima:    r.fecha_ultima,
      fechaDeuda:     r.fecha_deuda_pendiente ?? r.fecha_ultima,
    }))
    .filter(c => c.saldo > 0.009);
};

/**
 * Detalle de UN cliente: totales y todas sus ventas a crédito (también las
 * ya saldadas), más recientes primero, con sus productos.
 * Devuelve null si no tiene ventas a crédito (la pantalla muestra
 * "¡Deuda saldada!", igual que antes).
 */
export const detalleCliente = async ({ clienteId }) => {
  const ventas = await cargarVentasCreditoCliente({ clienteId });
  if (!ventas.length) return null;
  const totalDeuda     = ventas.reduce((s, v) => s + v.total, 0);
  const totalAbonado   = ventas.reduce((s, v) => s + (v.totalAbonado ?? 0), 0);
  const totalCondonado = ventas.reduce((s, v) => s + (v.condonado ?? 0), 0);
  return {
    cliente:     ventas[0].cliente ?? 'Sin nombre',
    clienteId,
    totalDeuda, totalAbonado, totalCondonado,
    saldo:       totalDeuda - totalAbonado - totalCondonado,
    ventas,
    fechaUltima: ventas[0].fecha,
  };
};
