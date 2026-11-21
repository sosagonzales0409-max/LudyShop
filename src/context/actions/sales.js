// Acciones de ventas, abonos, condonaciones, eliminación y devoluciones.
// Fábrica: recibe la tienda (el StoreProvider) y devuelve sus acciones; el
// constructor de StoreProvider las copia a la instancia (ver StoreContext.js).
// Dentro de cada acción, `tienda` es lo que en la clase sería `this`.
import { persistir } from '../../data/db';
import { newId, nowIso } from '../../data/ids';
import { nombreProducto, formatoCantidad } from '../../config/formatting';
import { registrarMovimiento, leerPresentaciones } from '../../data/repositories/products';
import { crearCliente, limpiarNombre, normalizarNombre } from '../../data/repositories/customers';
import { crearVenta, actualizarTotalesVenta, obtenerVenta, ventasCreditoConSaldo, eliminarVenta as eliminarVentaBD, actualizarItemVenta, eliminarItemVenta, crearAbono, actualizarMontoAbono } from '../../data/repositories/sales';
import { crearEvento } from '../../data/repositories/log';
import { nuevoEvento, LOG_TIPOS } from '../activityLog';
import { textoStock, redondearStock, existeEn, aplicarEfecto } from '../stockEffects';

export const accionesVentas = tienda => ({
  // ─── Ventas ───────────────────────────────────────────────────────────────
  // addSale sigue el patrón "calcular primero, aplicar después": todo lo que
  // necesita está en memoria (catálogo y clientes), así que calcula una vez y
  // aplica ese resultado en memoria (setState) y en disco (persistir).
  // Las acciones sobre ventas YA registradas (abonar, corregir, condonar,
  // eliminar, devolver) leen la venta de la BD dentro de su transacción
  // (decidirEnBD) y son asíncronas.

  /**
   * Resuelve el nombre escrito a un cliente existente (misma normalización
   * que la BD) o prepara uno nuevo con id ya generado.
   * Devuelve { cliente, clienteNuevo } — clienteNuevo solo si hay que crearlo.
   */
  resolverCliente: nombre => {
    const limpio = limpiarNombre(nombre);
    if (!limpio) return { cliente: null, clienteNuevo: null };
    const norm = normalizarNombre(limpio);
    const existente = tienda.state.clientes.find(c => normalizarNombre(c.nombre) === norm);
    if (existente) return { cliente: existente, clienteNuevo: null };
    const nuevo = { id: newId(), nombre: limpio };
    return { cliente: nuevo, clienteNuevo: nuevo };
  },

  // ¿Existe (viva) esta presentación en el catálogo en memoria? Si no, no
  // hay a dónde mover stock. (Las acciones que deciden en la BD usan
  // existeEn con leerPresentaciones.)
  existePresentacion: (productId, presentacionId) => {
    const producto = tienda.state.products.find(p => p.id === productId);
    return !!producto?.presentaciones.find(pr => pr.id === presentacionId);
  },

  /**
   * Registra una venta Y descuenta su stock, todo en una transacción
   * (antes NewSaleScreen.js llamaba a decreaseStock por separado: si la app se cerraba
   * entre las dos, quedaba stock descontado sin venta).
   */
  addSale: sale => {
    const fecha = nowIso();
    const esCredito = sale.tipoPago === 'Credito';
    const { cliente, clienteNuevo } = esCredito ? tienda.resolverCliente(sale.cliente) : { cliente: null, clienteNuevo: null };

    const newSale = {
      totalAbonado: 0, condonado: 0, ...sale,
      id:        newId(),
      fecha,
      cliente:   cliente?.nombre ?? null,
      clienteId: cliente?.id ?? null,
      // Solo la "foto" del producto; lo demás del carrito (stock,
      // cantidadTexto…) no es parte de la venta.
      productos: (sale.productos ?? []).map(p => ({
        id:             newId(),
        productId:      p.productId,
        presentacionId: p.presentacionId,
        nombre:         p.nombre,
        marca:          p.marca ?? '',
        tamano:         p.tamano ?? '',
        precio:         p.precio,
        precioCompra:   p.precioCompra ?? null,
        esGranel:       !!p.esGranel,
        unidadGranel:   p.unidadGranel ?? null,
        numProducts:    p.numProducts,
        totalPrice:     p.totalPrice,
      })),
    };

    const abonoInicial = newSale.totalAbonado > 0.009
      ? { id: newId(), fecha, clienteId: newSale.clienteId, ventaId: newSale.id, monto: newSale.totalAbonado, tipo: 'abono' }
      : null;

    const salidas = newSale.productos
      .filter(p => tienda.existePresentacion(p.productId, p.presentacionId))
      .map(p => ({ productId: p.productId, presentacionId: p.presentacionId, cantidad: -p.numProducts }));

    const numProd = newSale.productos.length;
    const evento = esCredito
      ? nuevoEvento(
          LOG_TIPOS.VENTA_CREDITO,
          abonoInicial
            ? `Venta ${tienda.dinero(newSale.total)} a crédito · ${newSale.cliente} · abono inicial ${tienda.dinero(newSale.totalAbonado)}`
            : `Venta ${tienda.dinero(newSale.total)} a crédito · ${newSale.cliente}`,
        )
      : nuevoEvento(LOG_TIPOS.VENTA, `Venta ${tienda.dinero(newSale.total)} · ${numProd} ${numProd === 1 ? 'producto' : 'productos'} (Contado)`);

    tienda.setState(prev => ({
      clientes:    clienteNuevo ? [...prev.clientes, clienteNuevo] : prev.clientes,
      products:    aplicarEfecto(prev.products, { movimientos: salidas }),
    }));

    persistir(async tx => {
      if (clienteNuevo) await crearCliente(tx, clienteNuevo);
      await crearVenta(tx, newSale);
      if (abonoInicial) await crearAbono(tx, abonoInicial);
      for (const s of salidas) {
        await registrarMovimiento(tx, { presentacionId: s.presentacionId, cantidad: s.cantidad, tipo: 'venta', refId: newSale.id, fecha });
      }
      await crearEvento(tx, evento);
    }, 'addSale');

    return newSale;
  },

  /**
   * Abono de un cliente: se reparte entre sus ventas a crédito pendientes,
   * liquidando primero las más antiguas (aging real de la deuda).
   * Asíncrona: las ventas con saldo se leen de la BD en la transacción.
   * El cliente se identifica por id (el nombre se resuelve con la misma
   * normalización que la BD); nombre vacío = ventas a crédito sin cliente.
   */
  registrarAbono: (clienteNombre, monto) => {
    const limpio = limpiarNombre(clienteNombre ?? '');
    const cliente = limpio
      ? tienda.state.clientes.find(c => normalizarNombre(c.nombre) === normalizarNombre(limpio))
      : null;
    if (limpio && !cliente) {
      console.warn('registrarAbono: cliente no encontrado', limpio);
      return Promise.resolve(null);
    }
    const evento = nuevoEvento(LOG_TIPOS.ABONO, `Abono ${tienda.dinero(monto)} · ${clienteNombre}`);

    return tienda.decidirEnBD('registrarAbono', async tx => {
      const fecha = nowIso();
      let restante = monto;
      const ventas = await ventasCreditoConSaldo(tx, cliente?.id ?? null);
      for (const sale of ventas) {
        if (restante <= 0) break;
        const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
        if (pendiente <= 0) continue;
        const aplicar = Math.min(pendiente, restante);
        restante -= aplicar;
        await actualizarTotalesVenta(tx, sale.id, { totalAbonado: (sale.totalAbonado ?? 0) + aplicar });
        await crearAbono(tx, { id: newId(), fecha, clienteId: sale.clienteId ?? null, ventaId: sale.id, monto: aplicar, tipo: 'abono' });
      }
      await crearEvento(tx, evento);
      return { resultado: true };
    });
  },

  ajustarAbonoVenta: (saleId, nuevoAbonado) => tienda.decidirEnBD('ajustarAbonoVenta', async tx => {
    const sale = await obtenerVenta(tx, saleId);
    if (!sale) return { resultado: null };
    const abonoAnterior = sale.totalAbonado ?? 0;

    const techo  = Math.max(0, sale.total - (sale.condonado ?? 0));
    const nuevo  = Math.max(0, Math.min(nuevoAbonado, techo));
    const delta  = nuevo - abonoAnterior;
    if (Math.abs(delta) < 0.0005) return { resultado: true }; // sin cambio real: nada que guardar

    // "Editar abono" es CORREGIR un error de captura (decisión de negocio,
    // sep 2026): la diferencia se aplica a los abonos existentes, del más
    // reciente al más viejo, CONSERVANDO su fecha — el corte de ese día
    // cambia. Solo si la venta no tenía ningún abono se crea uno con fecha de hoy.
    const eventosDeVenta = sale.abonos
      .filter(a => a.tipo === 'abono')
      .sort((x, y) => (x.fecha > y.fecha ? -1 : x.fecha < y.fecha ? 1 : x.id > y.id ? -1 : 1));
    const montosCorregidos = {}; // abonoId -> monto nuevo
    let pendiente = delta;
    for (const a of eventosDeVenta) {
      if (Math.abs(pendiente) < 0.0005) break;
      const cambio = pendiente > 0 ? pendiente : Math.max(pendiente, -a.monto);
      montosCorregidos[a.id] = a.monto + cambio;
      pendiente -= cambio;
    }
    // Sin abonos previos: el dinero se registra hoy (fecha de HOY, no la de
    // la venta), y así lo cuenta el corte de caja del día en que se captura.
    const abonoNuevo = eventosDeVenta.length === 0 && nuevo > 0.0005
      ? { id: newId(), fecha: nowIso(), clienteId: sale.clienteId ?? null, ventaId: sale.id, monto: nuevo, tipo: 'abono' }
      : null;

    const sumaEventos = eventosDeVenta.reduce((s, a) => s + (montosCorregidos[a.id] ?? a.monto), 0) + (abonoNuevo?.monto ?? 0);
    const totalFinal  = sumaEventos >= nuevo - 0.0005 ? nuevo : sumaEventos;

    const evento = nuevoEvento(LOG_TIPOS.ABONO_EDITADO, `Abono corregido ${tienda.dinero(abonoAnterior)} → ${tienda.dinero(nuevoAbonado)} · ${sale.cliente ?? 'cliente'}`);

    await actualizarTotalesVenta(tx, sale.id, { totalAbonado: totalFinal });
    for (const [abonoId, monto] of Object.entries(montosCorregidos)) await actualizarMontoAbono(tx, abonoId, monto);
    if (abonoNuevo) await crearAbono(tx, abonoNuevo);
    await crearEvento(tx, evento);
    return { resultado: true };
  }),

  condonarVenta: saleId => tienda.decidirEnBD('condonarVenta', async tx => {
    const sale = await obtenerVenta(tx, saleId);
    if (!sale) return { resultado: null };
    const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
    if (pendiente <= 0.009) return { resultado: true };

    const condonado = (sale.condonado ?? 0) + pendiente;
    const condonacion = { id: newId(), fecha: nowIso(), clienteId: sale.clienteId ?? null, ventaId: sale.id, monto: pendiente, tipo: 'condonacion' };
    const evento = nuevoEvento(LOG_TIPOS.CONDONACION, `Deuda condonada ${tienda.dinero(pendiente)} · ${sale.cliente ?? 'cliente'}`);

    await actualizarTotalesVenta(tx, sale.id, { condonado });
    await crearAbono(tx, condonacion);
    await crearEvento(tx, evento);
    return { resultado: true };
  }),

  /**
   * Elimina una venta (cascada: ítems y abonos) y, si se pide, devuelve su
   * stock. Asíncrona: la venta se lee de la BD en la transacción.
   * Devuelve (promesa) { itemsNoEncontrados }, o null si ya no existe o falló.
   */
  eliminarVenta: (saleId, devolverStock) => tienda.decidirEnBD('eliminarVenta', async tx => {
    const sale = await obtenerVenta(tx, saleId);
    if (!sale) return { resultado: null };
    const productos = sale.productos ?? [];
    const actuales = devolverStock ? await leerPresentaciones(tx, productos.map(p => p.presentacionId)) : {};

    // Si algún producto de la venta ya no existe en el inventario (se borró
    // la presentación), no hay dónde devolverle el stock — se detecta para
    // avisar en vez de fallar en silencio, igual que en eliminarCompra.
    const itemsNoEncontrados = devolverStock ? productos.filter(item => !existeEn(actuales, item)) : [];
    const entradas = devolverStock
      ? productos
          .filter(item => existeEn(actuales, item))
          .map(item => ({ presentacionId: item.presentacionId, cantidad: item.numProducts || 1 }))
      : [];

    const tipo  = sale.tipoPago === 'Credito' ? 'crédito' : 'contado';
    const stock = textoStock(devolverStock, entradas, itemsNoEncontrados);
    const evento = nuevoEvento(LOG_TIPOS.VENTA_ELIMINADA, `Venta ${tienda.dinero(sale.total)} eliminada (${tipo})${stock}`);

    await eliminarVentaBD(tx, sale.id); // cascada: venta + ítems + abonos
    for (const e of entradas) {
      await registrarMovimiento(tx, { presentacionId: e.presentacionId, cantidad: e.cantidad, tipo: 'reversion_venta', refId: sale.id });
    }
    await crearEvento(tx, evento);
    return { resultado: { itemsNoEncontrados }, efecto: { movimientos: entradas } };
  }),

  /**
   * Devolución parcial o total de una venta. Asíncrona (lee la venta en la
   * transacción). Devuelve (promesa)
   * { valorDevuelto, excedente, itemsNoEncontrados, ventaEliminada },
   * o null si la venta ya no existe o falló.
   */
  registrarDevolucion: (saleId, items, devolverStock) => {
    if (!items.length) return Promise.resolve(null);
    return tienda.decidirEnBD('registrarDevolucion', async tx => {
      const sale = await obtenerVenta(tx, saleId);
      if (!sale) return { resultado: null };

      const valorDevuelto = Math.round(items.reduce((sum, item) => {
        const prod = (sale.productos ?? []).find(p => p.productId === item.productId && p.presentacionId === item.presentacionId);
        return sum + (prod ? prod.precio * item.cantidad : 0);
      }, 0) * 100) / 100; // a granel: 0.5 kg × $28 — redondeo a centavos

      // Si el cliente ya había pagado más de lo que debe después de esta
      // devolución, ese excedente no se puede "guardar" en la venta (su deuda
      // ya no puede ser negativa) — hay que devolverle ese dinero en efectivo.
      // No hay módulo de nota de crédito todavía, así que al menos avisamos.
      const nuevoTotal     = Math.max(0, sale.total - valorDevuelto);
      const excedente      = Math.max(0, (sale.totalAbonado ?? 0) - nuevoTotal);
      const nuevoAbonado   = Math.min(sale.totalAbonado ?? 0, nuevoTotal);
      const nuevoCondonado = Math.min(sale.condonado ?? 0, Math.max(0, nuevoTotal - nuevoAbonado));

      // Mismo chequeo que en eliminarCompra/eliminarVenta: ítems cuya
      // presentación ya no existe no tienen dónde devolver el stock.
      const actuales = devolverStock ? await leerPresentaciones(tx, items.map(i => i.presentacionId)) : {};
      const itemsNoEncontrados = devolverStock ? items.filter(item => !existeEn(actuales, item)) : [];
      const entradas = devolverStock
        ? items
            .filter(item => existeEn(actuales, item))
            .map(item => ({ presentacionId: item.presentacionId, cantidad: item.cantidad }))
        : [];

      // Ítems de la venta: los que quedan en 0 se borran, los demás se reducen.
      const itemsActualizados = [];
      const itemsBorrados = [];
      const productos = (sale.productos ?? []).map(p => {
        const devuelto = items.find(i => i.productId === p.productId && i.presentacionId === p.presentacionId);
        if (!devuelto) return p;
        // redondearStock: a granel 1.5 − 0.4 no debe quedar en 1.0999999.
        const nuevaCantidad = redondearStock(Math.max(0, p.numProducts - devuelto.cantidad));
        const actualizado = { ...p, numProducts: nuevaCantidad, totalPrice: Math.round(p.precio * nuevaCantidad * 100) / 100 };
        (nuevaCantidad > 0 ? itemsActualizados : itemsBorrados).push(actualizado);
        return actualizado;
      }).filter(p => p.numProducts > 0);

      // Devolución TOTAL (no queda ningún producto): la venta se elimina, igual
      // que eliminarVenta — cascada de venta, ítems y abonos (decisión de
      // negocio, sep 2026). Si no, solo se actualiza.
      const ventaEliminada = productos.length === 0;

      const resumen = items.map(i => `${formatoCantidad(i.cantidad, i.esGranel, i.unidadGranel)} × ${nombreProducto(i.nombre, i.tamano)}`).join(', ');
      const stock   = textoStock(devolverStock, entradas, itemsNoEncontrados);
      const evento  = nuevoEvento(
        LOG_TIPOS.DEVOLUCION,
        `Devolución${ventaEliminada ? ' total' : ''} ${tienda.dinero(valorDevuelto)} · ${resumen}${stock}${ventaEliminada ? ' · venta eliminada' : ''}`,
      );

      if (ventaEliminada) {
        await eliminarVentaBD(tx, sale.id); // cascada: venta + ítems + abonos
      } else {
        await actualizarTotalesVenta(tx, sale.id, { total: nuevoTotal, totalAbonado: nuevoAbonado, condonado: nuevoCondonado });
        for (const item of itemsActualizados) await actualizarItemVenta(tx, item.id, item);
        for (const item of itemsBorrados) await eliminarItemVenta(tx, item.id);
      }
      for (const e of entradas) {
        await registrarMovimiento(tx, { presentacionId: e.presentacionId, cantidad: e.cantidad, tipo: 'devolucion', refId: sale.id });
      }
      await crearEvento(tx, evento);
      return {
        resultado: { valorDevuelto, excedente, itemsNoEncontrados, ventaEliminada },
        efecto:    { movimientos: entradas },
      };
    });
  },
});
