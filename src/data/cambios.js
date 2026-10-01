// ─── Aviso de cambios en la BD ────────────────────────────────────────────────
// Las pantallas que consultan la BD bajo demanda (ver consultaViva.js) se
// suscriben a las tablas que muestran; persistir() (db.js) avisa qué tablas
// escribió cada transacción, DESPUÉS de confirmarla. Así una pantalla abierta
// se refresca sola cuando otra acción cambia sus datos (p. ej. el historial
// de actividad al registrar una venta desde la pestaña de Ventas).
//
// Sin dependencias a propósito: sirve igual cuando en V2 los cambios lleguen
// de la sincronización.

const suscriptores = new Set();

/**
 * Llama a `fn(tablasEscritas)` cada vez que una transacción escribe en
 * alguna de `tablas`. Devuelve la función para desuscribirse.
 */
export const suscribirCambios = (tablas, fn) => {
  const suscriptor = { tablas: new Set(tablas), fn };
  suscriptores.add(suscriptor);
  return () => suscriptores.delete(suscriptor);
};

export const notificarCambios = tablasEscritas => {
  if (!tablasEscritas.size) return;
  suscriptores.forEach(s => {
    if (![...tablasEscritas].some(t => s.tablas.has(t))) return;
    try {
      s.fn(tablasEscritas);
    } catch (error) {
      console.error('notificarCambios', error); // un suscriptor roto no frena a los demás
    }
  });
};

// Tabla que escribe una sentencia (INSERT INTO x / UPDATE x / DELETE FROM x),
// o null si es una lectura.
const RE_ESCRITURA = /^\s*(?:INSERT\s+(?:OR\s+\w+\s+)?INTO|UPDATE|DELETE\s+FROM)\s+([A-Za-z_]\w*)/i;
export const tablaEscrita = sql => sql.match(RE_ESCRITURA)?.[1] ?? null;
