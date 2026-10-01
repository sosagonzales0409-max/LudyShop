import { getDB } from '../db';
import { insertar, actualizar } from './comunes';
import { limpiarNombre, normalizarNombre } from '../nombres';

// ─── Repositorio de clientes ──────────────────────────────────────────────────
// Forma en memoria: { id, nombre }
// Las pantallas siguen trabajando con nombres (sales[].cliente); StoreContext
// resuelve nombre → id en memoria con normalizarNombre() y guarda cliente_id.

// La regla de "mismo cliente" vive en data/nombres.js (módulo sin
// dependencias). Se reexporta aquí por comodidad.
export { limpiarNombre, normalizarNombre } from '../nombres';

export const cargarClientes = async () => {
  const { rows } = await getDB().execute(
    'SELECT id, nombre FROM clientes WHERE deleted_at IS NULL ORDER BY nombre',
  );
  return rows.map(fila => ({ id: fila.id, nombre: fila.nombre }));
};

// cliente: { id, nombre } con id ya generado por StoreContext.
// Si ya existe otro cliente vivo con el mismo nombre normalizado, el índice
// único hace fallar el INSERT (y con él toda la transacción).
export const crearCliente = (tx, cliente) =>
  insertar(tx, 'clientes', {
    id:          cliente.id,
    nombre:      limpiarNombre(cliente.nombre),
    nombre_norm: normalizarNombre(cliente.nombre),
  });

// Antes: reescribir el nombre en cada venta y abono. Ahora: una sola fila.
export const renombrarCliente = (tx, id, nombreNuevo) =>
  actualizar(tx, 'clientes', id, {
    nombre:      limpiarNombre(nombreNuevo),
    nombre_norm: normalizarNombre(nombreNuevo),
  });
