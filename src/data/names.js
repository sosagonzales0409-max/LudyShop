// ─── Limpieza y comparación de nombres de clientes ────────────────────────────
// Módulo sin dependencias a propósito: lo usan repositories/customers.js y
// StoreContext, y una futura migración de datos podría necesitarlo. Si
// viviera en customers.js, migrations.js formaría un ciclo de imports
// (customers → db → migrations → customers).

/**
 * Limpieza para MOSTRAR: sin espacios al inicio/fin y espacios repetidos
 * colapsados. Respeta mayúsculas y acentos tal como los escribió el usuario.
 *
 *   limpiarNombre('  Doña   Rosa ') → 'Doña Rosa'
 */
export const limpiarNombre = nombre =>
  (nombre || '').trim().replace(/\s+/g, ' ');

// Vocales acentuadas → vocal simple. La ñ NO está: en español 'Peña' y
// 'Pena' son nombres distintos (decisión de negocio, sep 2026).
// Tabla explícita en vez de String.normalize('NFD'): mismo resultado en
// cualquier motor JS y la regla queda a la vista.
const SIN_ACENTO = {
  á: 'a', à: 'a', ä: 'a', â: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
};

/**
 * Única definición de "mismo cliente", para COMPARAR (nunca se muestra):
 * nombre limpio, en minúsculas y sin acentos, conservando la ñ.
 *
 *   normalizarNombre('  JUAN   Pérez ') → 'juan perez'
 *   normalizarNombre('Doña Rosa')       → 'doña rosa'
 *
 * ⚠️ Si cambias esta regla DESPUÉS de publicar la app, agrega una migración
 * de datos (`js` en migrations.js) que recalcule clientes.nombre_norm, o los
 * datos guardados quedarán calculados con la regla vieja. Ojo: con la regla
 * nueva pueden aparecer duplicados entre clientes vivos (resolver en dos
 * fases y renombrar "Nombre (2)", nunca borrar ni fusionar).
 */
export const normalizarNombre = nombre =>
  limpiarNombre(nombre)
    .toLocaleLowerCase('es')
    .replace(/[áàäâéèëêíìïîóòöôúùüû]/g, letra => SIN_ACENTO[letra]);
