// Acciones de compras.
// Fábrica: recibe la tienda (el StoreProvider) y devuelve sus acciones; el
// constructor de StoreProvider las copia a la instancia (ver StoreContext.js).
// Dentro de cada acción, `tienda` es lo que en la clase sería `this`.
import { persistir } from '../../data/db';
import { newId, nowIso } from '../../data/ids';
import { editarPresentacion, registrarMovimiento, leerPresentaciones } from '../../data/repositories/products';
import { crearCompra, obtenerCompra, editarCompra as editarCompraBD, eliminarCompra as eliminarCompraBD } from '../../data/repositories/purchases';
import { crearEvento } from '../../data/repositories/log';
import { nuevoEvento, LOG_TIPOS } from '../activityLog';
import { redondearStock, existeEn, aplicarEfecto } from '../stockEffects';

export const accionesCompras = tienda => ({
  // ─── Compras ──────────────────────────────────────────────────────────────

  /**
   * Cálculo único que usan addCompra, editarCompra y eliminarCompra.
   * Función pura: no toca el estado, solo devuelve lo que hay que aplicar.
   *
   *   revertir: ítems de una compra ya registrada cuyo efecto se deshace
   *             (stock − cantidad, sin bajar de 0; precioCompra restaurado si
   *             nadie lo cambió después de esa compra)
   *   aplicar:  ítems cuyo efecto se aplica (stock + cantidad, precioCompra =
   *             costoUnitario). Se les agrega id y precioCompraAnterior.
   *
   *   actuales: { presentacionId: { productId, stock, precioCompra } } —
   *             de la BD (leerPresentaciones, dentro de la transacción) o de
   *             memoria (presentacionesEnMemoria, en addCompra)
   *
   * Devuelve { movimientos, precios, itemsAplicados }:
   *   movimientos: [{ presentacionId, cantidad, tipo }] con la diferencia REAL
   *                de stock (si el tope de 0 recortó la reversión, se registra
   *                lo que de verdad bajó, para que SUM(movimientos) = stock)
   *   precios:     [{ presentacionId, precioCompra }] final de cada presentación tocada
   * (El catálogo en memoria se actualiza aparte con aplicarEfecto.)
   * Como antes, si una presentación aparece dos veces en la misma lista,
   * solo cuenta la primera.
   */
  calcularEfectoCompra: (actuales, revertir = [], aplicar = []) => {
    // Copia de trabajo: la reversión cambia stock/precio antes de aplicar.
    const pres = {};
    Object.entries(actuales).forEach(([id, p]) => { pres[id] = { ...p }; });
    const movimientos = [];
    const tocadas = new Set();

    // 1. Revertir los ítems anteriores
    const revertidas = new Set();
    revertir.forEach(item => {
      if (!existeEn(pres, item) || revertidas.has(item.presentacionId)) return;
      revertidas.add(item.presentacionId);
      const p = pres[item.presentacionId];
      const stock = redondearStock(Math.max(0, p.stock - item.cantidad));
      if (p.precioCompra === item.costoUnitario) p.precioCompra = item.precioCompraAnterior ?? p.precioCompra;
      movimientos.push({ presentacionId: item.presentacionId, cantidad: redondearStock(stock - p.stock), tipo: 'reversion_compra' });
      p.stock = stock;
      tocadas.add(item.presentacionId);
    });

    // 2. Capturar precioCompraAnterior (post-reversión) y aplicar los ítems nuevos
    const itemsAplicados = aplicar.map(item => ({
      ...item,
      id: newId(),
      precioCompraAnterior: existeEn(pres, item) ? pres[item.presentacionId].precioCompra : null,
    }));

    const aplicadas = new Set();
    itemsAplicados.forEach(item => {
      if (!existeEn(pres, item) || aplicadas.has(item.presentacionId)) return;
      aplicadas.add(item.presentacionId);
      const p = pres[item.presentacionId];
      movimientos.push({ presentacionId: item.presentacionId, cantidad: item.cantidad, tipo: 'compra' });
      p.stock = redondearStock(p.stock + item.cantidad);
      p.precioCompra = item.costoUnitario;
      tocadas.add(item.presentacionId);
    });

    const precios = [...tocadas].map(presentacionId => ({
      presentacionId,
      precioCompra: pres[presentacionId].precioCompra ?? null,
    }));

    return { movimientos, precios, itemsAplicados };
  },

  // Guarda en la transacción los movimientos y precios que calculó calcularEfectoCompra.
  persistirEfectoCompra: async (tx, { movimientos, precios }, compraId, fecha) => {
    for (const m of movimientos) {
      await registrarMovimiento(tx, { presentacionId: m.presentacionId, cantidad: m.cantidad, tipo: m.tipo, refId: compraId, fecha });
    }
    for (const p of precios) {
      await editarPresentacion(tx, p.presentacionId, { precioCompra: p.precioCompra });
    }
  },

  /**
   * Registra una compra de mercancía.
   *
   * compra: {
   *   proveedor: string,
   *   tipoPago: 'Contado' | 'Credito',
   *   notas: string,
   *   total: number,
   *   items: [{ productId, presentacionId, nombre, tamano, cantidad, costoUnitario, subtotal,
   *              piezasPaquete?, precioPaquete? }]
   * }
   *
   * `precioCompraAnterior` se agrega internamente a cada ítem guardado (no se
   * espera en el `compra` de entrada) para que `editarCompra` pueda restaurar
   * el precio de compra previo si esta compra se corrige más adelante.
   *
   * Efectos colaterales (memoria y BD, todo o nada):
   *   1. Suma stock a cada presentación involucrada (movimientos 'compra').
   *   2. Actualiza precioCompra de cada presentación con el costoUnitario de esta compra.
   *   3. Registra el evento 'compra'.
   *
   * Si algún ítem referencia un producto/presentación que ya no existe, la
   * función no cambia nada y devuelve null, en vez de guardar la compra a
   * medias con el inventario desincronizado.
   */
  addCompra: compra => {
    // Validar ANTES de tocar cualquier estado.
    const sinPresentacion = compra.items.find(item => !tienda.existePresentacion(item.productId, item.presentacionId));
    if (sinPresentacion) {
      console.warn('addCompra: presentación no encontrada, compra cancelada', sinPresentacion);
      return null;
    }

    // Una compra nueva no necesita historial: se calcula con el catálogo en
    // memoria y se aplica al momento (como addSale).
    const fecha = nowIso();
    const efecto = tienda.calcularEfectoCompra(tienda.presentacionesEnMemoria(), [], compra.items);
    const nuevaCompra = { ...compra, id: newId(), fecha, items: efecto.itemsAplicados };

    const nProd = nuevaCompra.items.length;
    const moneda = tienda.state.config?.moneda ?? '$';
    const evento = nuevoEvento(
      LOG_TIPOS.COMPRA,
      `Compra ${moneda}${compra.total.toFixed(2)} · ${nProd} ${nProd === 1 ? 'producto' : 'productos'} · ${compra.proveedor || 'Sin proveedor'} (${compra.tipoPago})`,
    );

    tienda.setState(prev => ({
      products:    aplicarEfecto(prev.products, efecto),
    }));

    persistir(async tx => {
      await crearCompra(tx, nuevaCompra);
      await tienda.persistirEfectoCompra(tx, efecto, nuevaCompra.id, fecha);
      await crearEvento(tx, evento);
    }, 'addCompra');

    return nuevaCompra;
  },

  /**
   * Edita una compra ya registrada: revierte el efecto en stock/precioCompra
   * de los ítems anteriores y vuelve a aplicar los ítems nuevos, en una sola
   * transacción. En la BD los ítems se REEMPLAZAN (ver repositories/purchases.js).
   *
   * El precioCompra solo se restaura al valor anterior si nadie más lo
   * cambió después de esta compra (si ya no coincide con el costoUnitario
   * que esta compra fijó, lo dejamos como está para no pisar un dato más
   * reciente).
   *
   * Asíncrona: la compra y el stock/precio actuales se leen de la BD dentro
   * de la transacción. Devuelve (promesa) true si se guardó, false si la
   * compra o algún producto ya no existe (no se cambia nada), o null si
   * falló la escritura (ya se avisó).
   */
  editarCompra: (compraId, cambios) => tienda.decidirEnBD('editarCompra', async tx => {
    const compraAnterior = await obtenerCompra(compraId, tx);
    if (!compraAnterior) return { resultado: false };

    const itemsAnteriores = compraAnterior.items ?? [];
    const itemsNuevos = cambios.items ?? [];
    const actuales = await leerPresentaciones(tx, [...itemsAnteriores, ...itemsNuevos].map(i => i.presentacionId));

    // Validar ANTES de escribir — mismo criterio que addCompra: si un ítem
    // nuevo ya no tiene producto/presentación, no se aplica nada.
    const itemInvalido = itemsNuevos.find(item => !existeEn(actuales, item));
    if (itemInvalido) {
      console.warn('editarCompra: presentación no encontrada, edición cancelada', itemInvalido);
      return { resultado: false };
    }

    const efecto = tienda.calcularEfectoCompra(actuales, itemsAnteriores, itemsNuevos);
    const compraActualizada = { ...compraAnterior, ...cambios, id: compraAnterior.id, items: efecto.itemsAplicados };

    const moneda = tienda.state.config?.moneda ?? '$';
    const evento = nuevoEvento(
      LOG_TIPOS.COMPRA_EDITADA,
      `Compra editada · ${moneda}${compraActualizada.total.toFixed(2)} · ${compraActualizada.proveedor || 'Sin proveedor'}`,
    );

    await editarCompraBD(tx, compraActualizada); // cabecera + reemplazo de ítems
    await tienda.persistirEfectoCompra(tx, efecto, compraId, nowIso());
    await crearEvento(tx, evento);
    return { resultado: true, efecto };
  }),

  /**
   * Elimina una compra del historial.
   * Si revertirStock es true, descuenta del inventario las cantidades que entró la compra
   * y, cuando es seguro (nadie cambió el precio desde entonces), restaura el
   * precioCompra que tenía la presentación antes de esta compra — misma lógica que
   * usa editarCompra (calcularEfectoCompra).
   * Asíncrona (lee la compra en la transacción). Devuelve (promesa)
   * { itemsNoEncontrados }, o null si la compra ya no existe o falló.
   */
  eliminarCompra: (compraId, revertirStock) => tienda.decidirEnBD('eliminarCompra', async tx => {
    const compra = await obtenerCompra(compraId, tx);
    if (!compra) return { resultado: null };

    const items = compra.items ?? [];
    const actuales = revertirStock ? await leerPresentaciones(tx, items.map(i => i.presentacionId)) : {};

    // Detectar (sin bloquear el borrado) ítems cuya presentación ya no
    // existe — para esos no hay nada que revertir; se avisa en vez de
    // fallar en silencio.
    const itemsNoEncontrados = revertirStock ? items.filter(item => !existeEn(actuales, item)) : [];

    const efecto = revertirStock
      ? tienda.calcularEfectoCompra(actuales, items, [])
      : { movimientos: [], precios: [] };

    const moneda = tienda.state.config?.moneda ?? '$';
    const stock = revertirStock ? ' · stock revertido' : '';
    const evento = nuevoEvento(
      LOG_TIPOS.COMPRA_ELIMINADA,
      `Compra ${moneda}${compra.total.toFixed(2)} eliminada · ${compra.proveedor || 'Sin proveedor'}${stock}`,
    );

    await eliminarCompraBD(tx, compraId); // cascada: compra + ítems
    await tienda.persistirEfectoCompra(tx, efecto, compraId, nowIso());
    await crearEvento(tx, evento);
    return { resultado: { itemsNoEncontrados }, efecto };
  }),
});
