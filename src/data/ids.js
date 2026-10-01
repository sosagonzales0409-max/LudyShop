import { v7 as uuidv7 } from 'uuid';

// ─── Identificadores y fechas ─────────────────────────────────────────────────
// Todos los registros de la BD usan un UUIDv7 como id: único entre
// dispositivos (necesario para la sincronización en V2) y ordenable por
// fecha de creación (los primeros caracteres son un timestamp).
//
// Requiere el polyfill 'react-native-get-random-values' importado en index.js.

export const newId = () => uuidv7();

// Fecha actual en ISO-8601 UTC ("2026-09-24T18:30:00.000Z"). Es el mismo
// formato que ya usa la app en `fecha`, y se ordena bien como texto.
export const nowIso = () => new Date().toISOString();
