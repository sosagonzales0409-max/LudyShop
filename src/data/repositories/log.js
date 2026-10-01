import { getDB } from '../db';
import { insertar } from './comunes';

// ─── Repositorio del registro de actividad ────────────────────────────────────
// Forma para las pantallas: { id, tipo, fecha, desc }
// Ya NO vive en memoria: ActivityLogView lo consulta por páginas (bajo
// demanda). En SQLite se guarda TODO el historial.
// La columna se llama `descr` porque DESC es palabra reservada de SQL.

// Condiciones comunes: vivos + (opcional) solo ciertos tipos.
const filtro = tipos => {
  const condiciones = ['deleted_at IS NULL'];
  const params = [];
  if (tipos?.length) {
    condiciones.push(`tipo IN (${tipos.map(() => '?').join(', ')})`);
    params.push(...tipos);
  }
  return { condiciones, params };
};

/**
 * Una página de eventos, los más recientes primero.
 *   limite: cuántos
 *   antesDe: el ÚLTIMO evento ya cargado ({ fecha, id }) para pedir la página
 *            siguiente. Es un cursor COMPUESTO: con solo la fecha, los eventos
 *            que comparten fecha exacta con el último se saltarían.
 *   tipos:   solo esos tipos (filtro de la pantalla); null = todos
 */
export const cargarLog = async ({ limite = 50, antesDe = null, tipos = null } = {}) => {
  const { condiciones, params } = filtro(tipos);
  if (antesDe) {
    condiciones.push('(fecha < ? OR (fecha = ? AND id < ?))');
    params.push(antesDe.fecha, antesDe.fecha, antesDe.id);
  }
  const { rows } = await getDB().execute(
    `SELECT id, tipo, fecha, descr FROM activity_log
     WHERE ${condiciones.join(' AND ')}
     ORDER BY fecha DESC, id DESC LIMIT ?`,
    [...params, limite],
  );
  return rows.map(fila => ({ id: fila.id, tipo: fila.tipo, fecha: fila.fecha, desc: fila.descr }));
};

// Total de eventos (con el mismo filtro), para el contador de la pantalla.
export const contarLog = async ({ tipos = null } = {}) => {
  const { condiciones, params } = filtro(tipos);
  const { rows } = await getDB().execute(
    `SELECT COUNT(*) AS total FROM activity_log WHERE ${condiciones.join(' AND ')}`,
    params,
  );
  return Number(rows[0]?.total ?? 0);
};

// Recibe `tx` para poder guardarse en la MISMA transacción que la acción
// que lo originó (una venta y su evento se guardan juntos o ninguno).
export const crearEvento = (tx, evento) =>
  insertar(tx, 'activity_log', {
    id:    evento.id,
    tipo:  evento.tipo,
    fecha: evento.fecha,
    descr: evento.desc,
  });
