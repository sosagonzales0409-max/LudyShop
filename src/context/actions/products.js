// Acciones de productos, presentaciones y stock.
// Fábrica: recibe la tienda (el StoreProvider) y devuelve sus acciones; el
// constructor de StoreProvider las copia a la instancia (ver StoreContext.js).
// Dentro de cada acción, `tienda` es lo que en la clase sería `this`.
import { persistir } from '../../data/db';
import { newId, nowIso } from '../../data/ids';
import { nombreProducto } from '../../config/formatting';
import { crearProducto, crearPresentacion, editarPresentacion, editarProducto, eliminarPresentacion, eliminarProducto, registrarMovimiento } from '../../data/repositories/products';
import { crearCompra } from '../../data/repositories/purchases';
import { crearEvento } from '../../data/repositories/log';
import { nuevoEvento, LOG_TIPOS } from '../activityLog';
import { redondearStock, normalizarPresentacion } from '../stockEffects';

export const accionesProductos = tienda => ({
  // ─── Productos ────────────────────────────────────────────────────────────

  /**
   * Compra que acompaña el alta de una presentación nueva ("registrar como
   * compra" en AddProductScreen). Antes la pantalla llamaba a addCompra
   * por separado y fallaba: adivinaba el id de la presentación y validaba
   * contra un estado que aún no incluía el producto recién creado.
   * Devuelve null si no aplica (sin datos de compra, stock o costo en 0).
   *   datosCompra: { proveedor, tipoPago?, notas?, paquete? }
   *     paquete: { piezasPaquete, precioPaquete, numPaquetes } si se compró
   *              por paquete/reja (o bulto, en granel): se guarda el desglose
   *              para que el historial muestre "Paquete de 8 × $232.00"
   */
  armarCompraDeAlta: (productId, pres, nombre, datosCompra) => {
    if (!datosCompra || !(pres.stock > 0) || !(pres.precioCompra > 0)) return null;
    const subtotal = Math.round(pres.stock * pres.precioCompra * 100) / 100;
    return {
      id:        newId(),
      fecha:     nowIso(),
      proveedor: datosCompra.proveedor,
      tipoPago:  datosCompra.tipoPago ?? 'Contado',
      notas:     datosCompra.notas ?? `Alta de producto: ${nombreProducto(nombre, pres.tamano)}`,
      total:     subtotal,
      items: [{
        id: newId(), productId, presentacionId: pres.id, nombre, tamano: pres.tamano,
        cantidad: pres.stock, costoUnitario: pres.precioCompra, subtotal,
        precioCompraAnterior: null, // presentación nueva: no había costo anterior
        ...(datosCompra.paquete ?? {}),
      }],
    };
  },

  eventoDeCompra: compra => {
    const moneda = tienda.state.config?.moneda ?? '$';
    const nProd = compra.items.length;
    return nuevoEvento(
      LOG_TIPOS.COMPRA,
      `Compra ${moneda}${compra.total.toFixed(2)} · ${nProd} ${nProd === 1 ? 'producto' : 'productos'} · ${compra.proveedor || 'Sin proveedor'} (${compra.tipoPago})`,
    );
  },

  /**
   * Guarda una presentación nueva. Sin compra, su stock entra como movimiento
   * 'inicial'. Con compra, se inserta con stock 0 y el stock entra UNA vez
   * como movimiento 'compra' ligado a esa compra (así no se duplica).
   */
  persistirPresentacionNueva: async (tx, productId, pres, compraAlta) => {
    await crearPresentacion(tx, productId, compraAlta ? { ...pres, stock: 0 } : pres);
    if (compraAlta) {
      await crearCompra(tx, compraAlta);
      await registrarMovimiento(tx, { presentacionId: pres.id, cantidad: pres.stock, tipo: 'compra', refId: compraAlta.id, fecha: compraAlta.fecha });
    }
  },

  /**
   * Agrega un producto nuevo con su primera presentación.
   * Campos nuevos aceptados: precioCompra, esGranel, unidadGranel.
   * datosCompra (opcional): { proveedor, tipoPago?, notas? } para registrar el
   * stock inicial como una compra, todo en la misma transacción.
   */
  addProduct: (product, datosCompra = null) => {
    const {
      nombre, marca, categoriaId,
      tamano, precio, precioCompra = null, stock,
      esGranel = false, unidadGranel = null,
    } = product;

    const pres = normalizarPresentacion({ id: newId(), tamano, precio, precioCompra, stock, esGranel, unidadGranel });
    const newProduct = { id: newId(), nombre, marca, categoriaId, presentaciones: [pres] };
    const compraAlta = tienda.armarCompraDeAlta(newProduct.id, pres, nombre, datosCompra);

    const eventos = [nuevoEvento(
      LOG_TIPOS.PRODUCTO_NUEVO,
      `Nuevo producto: ${nombreProducto(nombre, tamano)}${marca ? ` (${marca})` : ''} · stock inicial ${stock}${precioCompra ? ` · costo ${tienda.dinero(precioCompra)}` : ''}`,
    )];
    if (compraAlta) eventos.push(tienda.eventoDeCompra(compraAlta));

    tienda.setState(prev => ({
      products:    [...prev.products, newProduct],
    }));
    persistir(async tx => {
      await crearProducto(tx, { ...newProduct, presentaciones: [] });
      await tienda.persistirPresentacionNueva(tx, newProduct.id, pres, compraAlta);
      for (const evento of eventos) await crearEvento(tx, evento);
    }, 'addProduct');
    return newProduct;
  },

  /**
   * Edita los datos del PRODUCTO (nombre, marca, categoría), no de sus
   * presentaciones. Es la forma de reasignar la categoría (p. ej. para poder
   * borrar una categoría en uso). Las ventas y compras viejas conservan el
   * nombre anterior en su "foto", como debe ser.
   * Devuelve { ok: true } o { ok: false, error } para que la pantalla avise.
   */
  updateProduct: (productId, cambios) => {
    const product = tienda.state.products.find(p => p.id === productId);
    if (!product) return { ok: false, error: 'El producto ya no existe.' };

    const nombre = (cambios.nombre ?? product.nombre).trim();
    const marca = (cambios.marca ?? product.marca).trim();
    const categoriaId = cambios.categoriaId ?? product.categoriaId;

    if (!nombre) return { ok: false, error: 'El nombre no puede quedar vacío.' };
    // La marca es opcional (granel, tortillas, pan del día…).
    if (!tienda.state.categories.some(c => String(c.id) === String(categoriaId))) {
      return { ok: false, error: 'Selecciona una categoría válida.' };
    }
    // Misma regla de duplicado que el alta (AddProductScreen): nombre + marca.
    const duplicado = tienda.state.products.some(p =>
      p.id !== productId &&
      p.nombre.trim().toLowerCase() === nombre.toLowerCase() &&
      p.marca.trim().toLowerCase() === marca.toLowerCase(),
    );
    if (duplicado) return { ok: false, error: marca ? `Ya existe otro producto "${nombre}" de ${marca}.` : `Ya existe otro producto "${nombre}" sin marca.` };

    const cambiosReales = {};
    if (nombre !== product.nombre) cambiosReales.nombre = nombre;
    if (marca !== (product.marca ?? '')) cambiosReales.marca = marca;
    if (String(categoriaId) !== String(product.categoriaId)) cambiosReales.categoriaId = categoriaId;
    if (!Object.keys(cambiosReales).length) return { ok: true }; // sin cambio real: nada que guardar

    const nombreCat = id => tienda.state.categories.find(c => String(c.id) === String(id))?.nombre ?? '—';
    const detalle = [
      cambiosReales.nombre && `nombre "${product.nombre}" → "${nombre}"`,
      cambiosReales.marca !== undefined && `marca ${product.marca ? `"${product.marca}"` : '(sin marca)'} → ${marca ? `"${marca}"` : '(sin marca)'}`,
      cambiosReales.categoriaId && `categoría ${nombreCat(product.categoriaId)} → ${nombreCat(categoriaId)}`,
    ].filter(Boolean).join(' · ');
    const evento = nuevoEvento(LOG_TIPOS.PRODUCTO_EDITADO, `Producto editado: ${detalle}`);

    tienda.setState(prev => ({
      products:    prev.products.map(p => p.id === productId ? { ...p, ...cambiosReales } : p),
    }));
    persistir(async tx => {
      await editarProducto(tx, productId, cambiosReales);
      await crearEvento(tx, evento);
    }, 'updateProduct');
    return { ok: true };
  },

  /**
   * Agrega una presentación nueva a un producto existente.
   * Acepta precioCompra, esGranel, unidadGranel, y datosCompra como addProduct.
   */
  addPresentacion: (productId, presentacion, datosCompra = null) => {
    const { tamano, precio, precioCompra = null, stock, esGranel = false, unidadGranel = null } = presentacion;
    const nueva = normalizarPresentacion({ id: newId(), tamano, precio, precioCompra, stock, esGranel, unidadGranel });
    const product = tienda.state.products.find(p => p.id === productId);
    const compraAlta = tienda.armarCompraDeAlta(productId, nueva, product?.nombre ?? '', datosCompra);

    const eventos = [nuevoEvento(
      LOG_TIPOS.PRESENTACION_NUEVA,
      `Nueva presentación: ${nombreProducto(product?.nombre ?? productId, tamano)} · ${tienda.dinero(precio)}${precioCompra ? ` (costo ${tienda.dinero(precioCompra)})` : ''} · stock ${stock}`,
    )];
    if (compraAlta) eventos.push(tienda.eventoDeCompra(compraAlta));

    tienda.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId ? { ...p, presentaciones: [...p.presentaciones, nueva] } : p,
      ),
    }));
    persistir(async tx => {
      await tienda.persistirPresentacionNueva(tx, productId, nueva, compraAlta);
      for (const evento of eventos) await crearEvento(tx, evento);
    }, 'addPresentacion');
    return nueva;
  },

  /**
   * Edita campos de una presentación existente.
   * Ahora acepta precioCompra, esGranel, unidadGranel además de precio y stock.
   * Solo genera log si precio o stock cambiaron — los demás cambios son silenciosos.
   *
   * El stock llega como valor absoluto ("ahora hay 15"); en la BD se guarda
   * como movimiento 'ajuste' con la diferencia (15 − 10 = +5).
   * razonAjuste (opcional): se agrega al evento de stock ajustado, en vez de
   * registrar un segundo evento aparte.
   */
  updatePresentacion: (productId, presentacionId, cambios, razonAjuste = '') => {
    const product = tienda.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    if (!pres) return;

    const eventos = [];
    if (cambios.precio !== undefined && cambios.precio !== pres.precio) {
      eventos.push(nuevoEvento(LOG_TIPOS.PRECIO_EDITADO, `${nombreProducto(product?.nombre, pres.tamano)}: ${tienda.dinero(pres.precio)} → ${tienda.dinero(Number(cambios.precio))}`));
    }
    const delta = cambios.stock !== undefined ? redondearStock(cambios.stock - pres.stock) : 0;
    if (delta !== 0) {
      const razon = razonAjuste.trim() ? ` · Razón: ${razonAjuste.trim()}` : '';
      eventos.push(nuevoEvento(LOG_TIPOS.STOCK_AJUSTADO, `Stock ajustado: ${nombreProducto(product?.nombre, pres.tamano)} · ${pres.stock} → ${cambios.stock} uds${razon}`));
    }

    tienda.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pr => pr.id === presentacionId ? normalizarPresentacion({ ...pr, ...cambios }) : pr) }
          : p,
      ),
    }));
    persistir(async tx => {
      await editarPresentacion(tx, presentacionId, cambios); // ignora `stock` a propósito
      await registrarMovimiento(tx, { presentacionId, cantidad: delta, tipo: 'ajuste' });
      for (const evento of eventos) await crearEvento(tx, evento);
    }, 'updatePresentacion');
  },

  agregarStock: (productId, presentacionId, cantidad) => {
    const product = tienda.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    const evento = nuevoEvento(
      LOG_TIPOS.STOCK_AGREGADO,
      `+${cantidad} ${pres?.esGranel ? (pres?.unidadGranel ?? 'uds') : 'uds'} · ${nombreProducto(product?.nombre ?? productId, pres?.tamano)} (stock anterior: ${pres?.stock ?? '?'})`,
    );
    tienda.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pr => pr.id === presentacionId ? { ...pr, stock: redondearStock(pr.stock + cantidad) } : pr) }
          : p,
      ),
    }));
    persistir(async tx => {
      await registrarMovimiento(tx, { presentacionId, cantidad, tipo: 'ajuste' });
      await crearEvento(tx, evento);
    }, 'agregarStock');
  },

  deletePresentacion: (productId, presentacionId) => {
    const product = tienda.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    // Si era la última presentación, el producto también desaparece.
    const eraLaUltima = product?.presentaciones.length === 1;
    const evento = nuevoEvento(LOG_TIPOS.PRESENTACION_ELIMINADA, `Eliminada: ${nombreProducto(product?.nombre ?? productId, pres?.tamano)}`);
    tienda.setState(prev => ({
      products: prev.products
        .map(p => p.id === productId ? { ...p, presentaciones: p.presentaciones.filter(pr => pr.id !== presentacionId) } : p)
        .filter(p => p.presentaciones.length > 0),
    }));
    persistir(async tx => {
      await eliminarPresentacion(tx, presentacionId);
      if (eraLaUltima) await eliminarProducto(tx, productId);
      await crearEvento(tx, evento);
    }, 'deletePresentacion');
  },

  /**
   * Descuenta stock. Hoy solo lo usa OwnConsumptionScreen (esConsumoPropio =
   * true, registra su evento). Las ventas descuentan su stock dentro de
   * addSale, en la misma transacción que la venta.
   */
  decreaseStock: (items, esConsumoPropio = false) => {
    let evento = null;
    if (esConsumoPropio) {
      const resumen = items.map(i => {
        const product = tienda.state.products.find(p => p.id === i.productId);
        const pres = product?.presentaciones.find(pr => pr.id === i.presentacionId);
        const unidad = pres?.esGranel ? (pres?.unidadGranel ?? '') : '×';
        return `${i.cantidad}${pres?.esGranel ? ' ' + unidad : ' ×'} ${nombreProducto(product?.nombre ?? i.productId, pres?.tamano)}`;
      }).join(', ');
      evento = nuevoEvento(LOG_TIPOS.CONSUMO_PROPIO, `Consumo propio: ${resumen}`);
    }
    tienda.setState(prev => ({
      products: prev.products.map(p => ({
        ...p,
        presentaciones: p.presentaciones.map(pres => {
          const match = items.find(i => i.productId === p.id && i.presentacionId === pres.id);
          return match ? { ...pres, stock: redondearStock(pres.stock - match.cantidad) } : pres;
        }),
      })),
    }));
    persistir(async tx => {
      for (const item of items) {
        await registrarMovimiento(tx, {
          presentacionId: item.presentacionId,
          cantidad:       -item.cantidad,
          tipo:           esConsumoPropio ? 'consumo' : 'venta',
        });
      }
      if (evento) await crearEvento(tx, evento);
    }, 'decreaseStock');
  },
});
