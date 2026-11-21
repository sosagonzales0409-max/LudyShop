// Ayudantes de stock compartidos por el núcleo y las acciones: aplicar a
// memoria el efecto ya guardado en la BD, con el mismo redondeo que SQLite.
import { nombreProducto } from '../config/formatting';

// Parte final del evento de una venta eliminada o devuelta: dice "stock
// devuelto" solo si de verdad volvió algo al inventario, y nombra los
// productos que no tenían a dónde volver (presentación eliminada).
export const textoStock = (devolverStock, entradas, itemsNoEncontrados) => {
  if (!devolverStock) return '';
  const partes = [];
  if (entradas.length) partes.push('stock devuelto');
  if (itemsNoEncontrados.length) {
    partes.push(`sin stock que devolver: ${itemsNoEncontrados.map(i => nombreProducto(i.nombre, i.tamano)).join(', ')} (producto eliminado)`);
  }
  return partes.map(p => ` · ${p}`).join('');
};

// Misma regla que la BD (ROUND(stock, 3) en registrarMovimiento): memoria y
// disco deben calcular igual o divergen con los decimales del granel.
export const redondearStock = n => Math.round(n * 1000) / 1000;

// Garantiza retrocompatibilidad: presentaciones viejas sin precioCompra/esGranel
// funcionan igual que antes.

export const normalizarPresentacion = pres => ({
  precioCompra: null,
  esGranel: false,
  unidadGranel: null,
  ...pres,
});

// ¿Sigue viva la presentación de este ítem? `actuales` es el mapa
// { presentacionId: { productId, stock, precioCompra } } que da
// leerPresentaciones (BD) o presentacionesEnMemoria.
export const existeEn = (actuales, item) => actuales[item.presentacionId]?.productId === item.productId;

/**
 * Aplica al catálogo en memoria el efecto que ya se guardó en la BD:
 *   movimientos: [{ presentacionId, cantidad(±) }]  → se SUMAN al stock
 *   precios:     [{ presentacionId, precioCompra }] → valor final
 * Diferencias y no valores absolutos: si entre la decisión y este setState
 * se vendió algo, las dos cosas se suman bien (igual que ROUND(stock + ?) en
 * registrarMovimiento).
 */
export const aplicarEfecto = (products, { movimientos = [], precios = [] }) => products.map(p => ({
  ...p,
  presentaciones: p.presentaciones.map(pres => {
    const delta = movimientos
      .filter(m => m.presentacionId === pres.id)
      .reduce((suma, m) => suma + m.cantidad, 0);
    const precio = precios.find(x => x.presentacionId === pres.id);
    if (!delta && !precio) return pres;
    return normalizarPresentacion({
      ...pres,
      stock: redondearStock(pres.stock + delta),
      ...(precio ? { precioCompra: precio.precioCompra } : {}),
    });
  }),
}));
