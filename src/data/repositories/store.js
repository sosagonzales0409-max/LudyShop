import { getDB, getMeta, setMeta, persistir } from '../db';
import { newId, nowIso } from '../ids';
import { actualizar, setTiendaId } from './common';

// ─── Repositorio de la tienda (antes `config` en StoreContext) ────────────────
// Forma en memoria: { nombreTienda, nombreDueno, moneda, umbralStock }

export const CONFIG_POR_DEFECTO = {
  nombreTienda: 'Mi Tienda',
  nombreDueno:  '',
  moneda:       '$',
  umbralStock:  5,
};

// Campo en memoria → columna SQL. También sirve de lista blanca: claves que
// no estén aquí se ignoran al guardar.
const COLUMNAS = {
  nombreTienda: 'nombre',
  nombreDueno:  'nombre_dueno',
  moneda:       'moneda',
  umbralStock:  'umbral_stock',
};

/**
 * Se llama una vez al arrancar, después de initDB(). En el primer arranque
 * crea la tienda y el device_id; después solo los lee. Al terminar, fija la
 * tienda activa para que insertar() pueda sellar las filas nuevas.
 * Devuelve el id de la tienda.
 */
export const prepararTienda = async () => {
  let tiendaId = await getMeta('tienda_id_actual');

  if (!tiendaId) {
    tiendaId = newId();
    const ahora = nowIso();
    // Lecturas ANTES de abrir la transacción: dentro de ella todo debe ir
    // por `tx` (getMeta usa la conexión directa y podría bloquearse).
    const tieneDeviceId = !!(await getMeta('device_id'));
    // Tienda + meta en la misma transacción: si la app se cierra a la
    // mitad, no queda una tienda "huérfana" sin registrar en meta.
    await persistir(async tx => {
      await tx.execute(
        `INSERT INTO tienda (id, created_at, updated_at, nombre, nombre_dueno, moneda, umbral_stock)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tiendaId, ahora, ahora, CONFIG_POR_DEFECTO.nombreTienda, CONFIG_POR_DEFECTO.nombreDueno,
         CONFIG_POR_DEFECTO.moneda, CONFIG_POR_DEFECTO.umbralStock],
      );
      await setMeta(tx, 'tienda_id_actual', tiendaId);
      // Identidad de ESTE teléfono (V2: saber de qué dispositivo vino cada cambio).
      if (!tieneDeviceId) await setMeta(tx, 'device_id', newId());
    }, 'prepararTienda');
  }

  setTiendaId(tiendaId);
  return tiendaId;
};

export const cargarConfig = async tiendaId => {
  const { rows } = await getDB().execute(
    'SELECT nombre, nombre_dueno, moneda, umbral_stock FROM tienda WHERE id = ?',
    [tiendaId],
  );
  if (!rows.length) return { ...CONFIG_POR_DEFECTO };
  const fila = rows[0];
  return {
    nombreTienda: fila.nombre,
    nombreDueno:  fila.nombre_dueno,
    moneda:       fila.moneda,
    umbralStock:  fila.umbral_stock,
  };
};

// cambios: parcial de la config en memoria, p. ej. { moneda: '€' }
export const guardarConfig = (tx, tiendaId, cambios) => {
  const columnas = {};
  Object.entries(cambios).forEach(([campo, valor]) => {
    if (COLUMNAS[campo]) columnas[COLUMNAS[campo]] = valor;
  });
  if (!Object.keys(columnas).length) return Promise.resolve();
  return actualizar(tx, 'tienda', tiendaId, columnas);
};
