// ─── Formato de datos para mostrar en pantalla ────────────────────────────────
// Una sola definición de "cómo se ve" el dinero y las cantidades. Si mañana
// se quiere separador de miles o cambiar el número de decimales, se cambia
// aquí y aplica a todas las pantallas.

/**
 * Dinero con el símbolo de la moneda configurada (config.moneda).
 *   formatoDinero(1981, '$')  → '$1981.00'
 *   formatoDinero(-448.5)     → '-$448.50'
 */
export const formatoDinero = (monto, moneda = '$') => {
  const n = Number(monto) || 0;
  const signo = n < 0 ? '-' : '';
  return `${signo}${moneda}${Math.abs(n).toFixed(2)}`;
};

/**
 * Nombre de un producto con su presentación, sin espacios sobrantes cuando
 * no tiene presentación (productos de una sola, p. ej. "Gansito").
 *   nombreProducto('Coca-Cola', '600 ml') → 'Coca-Cola 600 ml'
 *   nombreProducto('Gansito', '')         → 'Gansito'
 */
export const nombreProducto = (nombre, tamano) =>
  [nombre, tamano].map(s => (s || '').trim()).filter(Boolean).join(' ');

// Hasta 3 decimales (gramos), sin ceros de sobra: 8.5 → '8.5', 2 → '2'.
const numeroCantidad = n => String(Math.round((Number(n) || 0) * 1000) / 1000);

/**
 * Cantidad de un producto: a granel lleva su unidad, si no es un número de
 * piezas.
 *   formatoCantidad(8.5, true, 'kg') → '8.5 kg'
 *   formatoCantidad(3, false)        → '3'
 */
export const formatoCantidad = (cantidad, esGranel = false, unidadGranel = null) =>
  esGranel && unidadGranel ? `${numeroCantidad(cantidad)} ${unidadGranel}` : numeroCantidad(cantidad);
