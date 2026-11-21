// Escenario "App desde 0" (el mismo que se recorre a mano en el teléfono),
// ejecutado con las ACCIONES REALES de StoreContext sobre una BD vacía.
// Comprueba que cada valor esperado del escenario es exactamente lo que
// calcula la app.
//   node qa/harness/scenario-from-scratch.mjs
// Deja la BD final en qa/data/desde-cero.db (se puede revisar con
// expected-values.mjs para comparar con el teléfono).
import { rmSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construir, montarTienda } from './build.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BD = join(AQUI, '..', 'data', 'desde-cero.db');
mkdirSync(dirname(BD), { recursive: true });
for (const s of ['', '-wal', '-shm']) rmSync(BD + s, { force: true });

construir();
const { store, esperarEscrituras, crudo } = await montarTienda({ bd: BD, dev: false });
const { resumenPeriodo } = await import('./app/data/queries/salesHistory.mjs');
const { resumenCorte } = await import('./app/data/queries/endOfDay.mjs');
const { clientesConSaldo, detalleCliente } = await import('./app/data/queries/credits.mjs');
const { cargarReportes, ordenarTop } = await import('./app/data/queries/reports.mjs');
const { resumenCompras, vendidasDespuesDe } = await import('./app/data/queries/purchases.mjs');
const { infoPresentaciones } = await import('./app/data/queries/product.mjs');
const { contarLog } = await import('./app/data/repositories/log.mjs');
const { obtenerCompra } = await import('./app/data/repositories/purchases.mjs');
const { LOG_META } = await import('./app/context/StoreContext.mjs');

let fallos = 0;
const cerca = (a, b) => Math.abs(a - b) < 0.0051;
const ok = (cond, texto) => { if (!cond) fallos++; console.log(`${cond ? '✅' : '❌'} ${texto}`); };
const igual = (valor, esperado, texto) => ok(
  typeof esperado === 'number' ? cerca(valor, esperado) : JSON.stringify(valor) === JSON.stringify(esperado),
  `${texto}: ${JSON.stringify(valor)}${(typeof esperado === 'number' ? cerca(valor, esperado) : JSON.stringify(valor) === JSON.stringify(esperado)) ? '' : `  (esperado ${JSON.stringify(esperado)})`}`,
);
const paso = t => console.log(`\n── ${t} ──`);

// ─── Ayudantes que imitan lo que hace cada pantalla ──────────────────────────
const prod = nombre => store.state.products.find(p => p.nombre === nombre);
const pres = (nombre, tamano) => prod(nombre)?.presentaciones.find(p => p.tamano === tamano);
const cat = nombre => store.state.categories.find(c => c.nombre === nombre);
const vendible = (nombre, tamano) => store.getSellableItems().find(i => i.nombre === nombre && i.tamano === tamano);
const carrito = lineas => lineas.map(([nombre, tamano, n]) => { const i = vendible(nombre, tamano); return { ...i, numProducts: n, totalPrice: i.precio * n }; });
const vender = (lineas, tipoPago = 'Contado', cliente = null, abono = 0) => {
  const productos = carrito(lineas);
  return store.addSale({ productos, total: Number(productos.reduce((s, p) => s + p.totalPrice, 0).toFixed(2)), tipoPago, cliente, totalAbonado: abono });
};
const inicioHoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const valorInventario = () => store.state.products.reduce((s, p) => s + p.presentaciones.reduce((t, x) => t + x.precio * x.stock, 0), 0);
const stockBajo = () => store.state.products.flatMap(p => p.presentaciones).filter(x => x.stock < store.state.config.umbralStock).length;
const historial = () => resumenPeriodo({ desde: inicioHoy().toISOString() });
const saldos = async () => Object.fromEntries((await clientesConSaldo()).map(c => [c.cliente, [Number(c.saldo.toFixed(2)), c.numVentas]]));
const reportes7d = async () => {
  const inicio = inicioHoy(); inicio.setDate(inicio.getDate() - 6);
  const fin = new Date(); fin.setHours(23, 59, 59, 999);
  const ia = new Date(inicio); ia.setDate(ia.getDate() - 7);
  return cargarReportes({ inicio: inicio.toISOString(), fin: fin.toISOString(), inicioAnterior: ia.toISOString(), finAnterior: new Date(inicio.getTime() - 1).toISOString() });
};
const stocks = () => Object.fromEntries(store.state.products.flatMap(p => p.presentaciones.map(x => [`${p.nombre} ${x.tamano}`.trim(), x.stock])));
const ventaDe = id => crudo.prepare('SELECT * FROM ventas WHERE id = ?').get(id);

// ═══ Paso 0: primer arranque ═══════════════════════════════════════════════
paso('Paso 0 · primer arranque');
igual(store.state.products.length, 0, 'productos');
igual(store.state.categories.length, 0, 'categorías (sin "Todos")');
igual(store.state.config, { nombreTienda: 'Mi Tienda', nombreDueno: '', moneda: '$', umbralStock: 5 }, 'config');
igual(await contarLog(), 0, 'eventos');

// ═══ Paso 2: categorías ════════════════════════════════════════════════════
paso('Paso 2 · categorías');
['Bebidas', 'Botanas', 'Abarrotes'].forEach(n => store.addCategory(n));
await esperarEscrituras();
igual(store.state.categories.map(c => c.nombre), ['Bebidas', 'Botanas', 'Abarrotes'], 'categorías');

// ═══ Paso 3: productos ═════════════════════════════════════════════════════
paso('Paso 3 · productos');
store.addProduct({ nombre: 'Coca-Cola', marca: 'Coca-Cola', categoriaId: cat('Bebidas').id, tamano: '600 ml', precio: 20, precioCompra: 14, stock: 24 },
  { proveedor: 'Coca-Cola FEMSA', tipoPago: 'Contado', notas: 'Alta de producto: Coca-Cola 600 ml' });
store.addPresentacion(prod('Coca-Cola').id, { tamano: '2 L', precio: 38, precioCompra: 29, stock: 8 },
  { proveedor: 'Coca-Cola FEMSA', tipoPago: 'Contado', notas: 'Alta de producto: Coca-Cola 2 L', paquete: { piezasPaquete: 8, precioPaquete: 232, numPaquetes: 1 } });
store.addProduct({ nombre: 'Gansito', marca: 'Marinela', categoriaId: cat('Botanas').id, tamano: '', precio: 18, precioCompra: 12, stock: 10 });
store.addProduct({ nombre: 'Arroz a granel', marca: 'Local', categoriaId: cat('Abarrotes').id, tamano: 'por kg', precio: 28, precioCompra: 20, stock: 10, esGranel: true, unidadGranel: 'kg' },
  { proveedor: '', tipoPago: 'Contado', notas: 'Alta de producto: Arroz a granel por kg', paquete: { piezasPaquete: 10, precioPaquete: 200, numPaquetes: 1 } });
store.addProduct({ nombre: 'Frijol', marca: 'La Costeña', categoriaId: cat('Abarrotes').id, tamano: '1 kg', precio: 38, precioCompra: null, stock: 3 });
await esperarEscrituras();
igual(valorInventario(), 1358, 'Inventario · Valor total');
igual(stockBajo(), 1, 'Inventario · badge stock bajo');
igual(await resumenCompras(), { count: 3, total: 768 }, 'Compras · resumen');
const info3 = await infoPresentaciones({ presentacionIds: store.state.products.flatMap(p => p.presentaciones.map(x => x.id)), desde30: inicioHoy().toISOString() });
igual(info3[pres('Coca-Cola', '600 ml').id].ultimaCompra?.proveedor, 'Coca-Cola FEMSA', 'Detalle Coca 600 · última compra');
igual(info3[pres('Gansito', '').id].ultimaCompra, null, 'Detalle Gansito · sin compras');
igual(info3[pres('Arroz a granel', 'por kg').id].ultimaCompra?.proveedor, '', 'Detalle Arroz · última compra sin proveedor');
igual(crudo.prepare('SELECT nombre, piezas_paquete, precio_paquete, num_paquetes FROM compra_items WHERE piezas_paquete IS NOT NULL ORDER BY nombre').all().map(f => [f.nombre, f.piezas_paquete, f.precio_paquete, f.num_paquetes]),
  [['Arroz a granel', 10, 200, 1], ['Coca-Cola', 8, 232, 1]], 'F6 · compras de alta con desglose de paquete/bulto');

// ═══ Paso 4: personalizar tienda ═══════════════════════════════════════════
store.updateConfig({ nombreTienda: 'Tienda QA', nombreDueno: 'Luis', moneda: '$', umbralStock: 5 });

// ═══ Paso 5: ventas ════════════════════════════════════════════════════════
paso('Paso 5 · ventas');
const V1 = vender([['Coca-Cola', '600 ml', 3], ['Gansito', '', 2]]);
const V2 = vender([['Arroz a granel', 'por kg', 2.5]]);
const V3 = vender([['Coca-Cola', '2 L', 2], ['Frijol', '1 kg', 1]], 'Credito', 'Doña Rosa');
const V4 = vender([['Gansito', '', 4]], 'Credito', 'Juan Pérez', 30);
const V5 = vender([['Coca-Cola', '600 ml', 1]], 'Credito', 'juan perez'); // mismo cliente (acentos/mayúsculas)
await esperarEscrituras();
igual([V1.total, V2.total, V3.total, V4.total, V5.total], [96, 70, 114, 72, 20], 'totales de venta');
igual(store.state.clientes.length, 2, 'clientes (juan perez = Juan Pérez)');
igual(await saldos(), { 'Doña Rosa': [114, 1], 'Juan Pérez': [62, 2] }, 'Créditos · saldo y nº ventas');
let h = await historial();
igual([h.contado, h.abonos, h.contado + h.abonos, h.credito, h.pendiente, h.numVentas], [166, 30, 196, 206, 176, 5], 'Historial Hoy · contado, abonos, ingresos, crédito, por cobrar, ventas');
let c = await resumenCorte({ inicioHoy: inicioHoy().toISOString() });
igual([c.contado + c.abonos, c.contado, c.abonos, c.credito, c.pendienteTotal], [196, 166, 30, 206, 176], 'Corte · ingresos, contado, abonos, crédito hoy, pendiente total');
igual([c.masVendido?.nombre, c.masVendido?.cantidad, c.masVendido?.numVentas, c.numVentas], ['Gansito', 6, 2, 5], 'Corte · más vendido (unidades, en N ventas) y ventas del día');
igual(valorInventario(), 986, 'Inventario · Valor total');
igual(stockBajo(), 2, 'Inventario · badge stock bajo');
let r = await reportes7d();
let ingreso = r.flujo.contado + r.flujo.abonosRecibidos;
igual([ingreso, r.flujo.contado + r.flujo.creditoGenerado, r.numVentas, Number(r.ticketPromedio.toFixed(2)), ingreso - r.flujo.invertidoCompras], [196, 372, 5, 74.4, -572], 'Reportes 7d · ingreso real, ventas totales, nº, promedio, balance');
igual(ordenarTop(r.top, 'unidades').map(t => [t.nombre, t.tamano, t.unidades, t.monto, Math.round(t.porcentaje)]),
  [['Gansito', '', 6, 108, 29], ['Coca-Cola', '600 ml', 4, 80, 22], ['Arroz a granel', 'por kg', 2.5, 70, 19], ['Coca-Cola', '2 L', 2, 76, 20], ['Frijol', '1 kg', 1, 38, 10]], 'Reportes · Más vendidos (% sobre dinero)');
igual(ordenarTop(r.top, 'margen').map(t => [t.nombre, t.tamano, t.margen, Math.round(t.porcentaje)]),
  [['Gansito', '', 36, 37], ['Coca-Cola', '600 ml', 24, 24], ['Arroz a granel', 'por kg', 20, 20], ['Coca-Cola', '2 L', 18, 18]], 'Reportes · Más rentables');

// ═══ Paso 6: créditos ══════════════════════════════════════════════════════
paso('Paso 6 · créditos');
await store.registrarAbono('Juan Pérez', 50);                                         // A1
igual(await saldos(), { 'Doña Rosa': [114, 1], 'Juan Pérez': [12, 2] }, 'A1 · Juan $12');
let dj = await detalleCliente({ clienteId: V4.clienteId });
igual([dj.totalDeuda, dj.totalAbonado, dj.saldo, dj.ventas.length], [92, 80, 12, 2], 'A2 · detalle Juan: deuda, abonado, saldo, ventas');
igual(dj.ventas.map(v => [v.total, v.totalAbonado]), [[20, 8], [72, 72]], 'A2 · ventas (reciente primero)');
igual(store.renombrarCliente('Juan Pérez', 'DOÑA ROSA'), false, 'A2b · renombrar a nombre de otro cliente → bloqueado');
igual(store.renombrarCliente('Juan Pérez', 'Juan Pérez López'), true, 'A2b · renombrar');
await store.ajustarAbonoVenta(V5.id, 5);                                              // A3
igual(ventaDe(V5.id).total_abonado, 5, 'A3 · V5 abonado');
igual(await saldos(), { 'Doña Rosa': [114, 1], 'Juan Pérez López': [15, 2] }, 'A3 · Juan $15');
const frijol = vendible('Frijol', '1 kg');
const r4 = await store.registrarDevolucion(V3.id, [{ productId: frijol.productId, presentacionId: frijol.presentacionId, nombre: 'Frijol', tamano: '1 kg', cantidad: 1 }], true); // A4
igual([r4.valorDevuelto, r4.excedente, r4.ventaEliminada, ventaDe(V3.id).total, pres('Frijol', '1 kg').stock], [38, 0, false, 76, 3], 'A4 · devolución Frijol');
await store.registrarAbono('Doña Rosa', 26);                                          // A5
igual((await saldos())['Doña Rosa'], [50, 1], 'A5 · Doña Rosa $50');
await store.condonarVenta(V3.id);                                                     // A6
igual([ventaDe(V3.id).condonado, (await saldos())['Doña Rosa']], [50, undefined], 'A6 · condonado 50, sale de Créditos');
const dr = await detalleCliente({ clienteId: V3.clienteId });
igual([dr.totalDeuda, dr.totalAbonado, dr.totalCondonado, dr.saldo], [76, 26, 50, 0], 'A6 · detalle Doña Rosa');
const gans = vendible('Gansito', '');
const r7 = await store.registrarDevolucion(V4.id, [{ productId: gans.productId, presentacionId: gans.presentacionId, nombre: 'Gansito', tamano: '', cantidad: 2 }], false); // A7
igual([r7.valorDevuelto, r7.excedente, ventaDe(V4.id).total, ventaDe(V4.id).total_abonado, pres('Gansito', '').stock], [36, 36, 36, 36, 4], 'A7 · devolución con excedente');
const coca = vendible('Coca-Cola', '600 ml');
const r8 = await store.registrarDevolucion(V5.id, [{ productId: coca.productId, presentacionId: coca.presentacionId, nombre: 'Coca-Cola', tamano: '600 ml', cantidad: 1 }], true); // A8
igual([r8.ventaEliminada, r8.excedente, !!ventaDe(V5.id).deleted_at, pres('Coca-Cola', '600 ml').stock], [true, 5, true, 21], 'A8 · devolución total');
igual(await saldos(), {}, 'Créditos · sin deudas');
h = await historial();
igual([h.contado, h.abonos, h.contado + h.abonos, h.credito, h.pendiente, h.numVentas], [166, 98, 264, 112, 0, 4], 'Historial Hoy tras créditos');
c = await resumenCorte({ inicioHoy: inicioHoy().toISOString() });
igual(c.abonosHoy.map(a => [a.cliente, a.monto]), [['Doña Rosa', 26], ['Juan Pérez López', 42], ['Juan Pérez López', 30]], 'Corte · abonos del día');
igual([c.pendienteTotal, c.masVendido?.nombre, c.masVendido?.cantidad, c.masVendido?.numVentas, c.numVentas], [0, 'Gansito', 4, 2, 4], 'Corte · pendiente, más vendido y ventas del día');
igual(valorInventario(), 1044, 'Inventario · Valor total');

// ═══ Paso 7: inventario ════════════════════════════════════════════════════
paso('Paso 7 · inventario');
store.agregarStock(prod('Frijol').id, pres('Frijol', '1 kg').id, 5);                  // I1
const g = pres('Gansito', '');
store.updatePresentacion(prod('Gansito').id, g.id, { tamano: '', precio: 20, precioCompra: 12, stock: 3, esGranel: false, unidadGranel: null }, 'Merma'); // I2
store.decreaseStock([
  { productId: prod('Coca-Cola').id, presentacionId: pres('Coca-Cola', '600 ml').id, cantidad: 2 },
  { productId: prod('Frijol').id, presentacionId: pres('Frijol', '1 kg').id, cantidad: 1 },
], true);                                                                            // I3
igual(store.updateProduct(prod('Frijol').id, { nombre: 'Coca-Cola', marca: 'Coca-Cola' }).ok, false, 'I4 · duplicado bloqueado');
igual(store.updateProduct(prod('Arroz a granel').id, { marca: 'Granel Local' }).ok, true, 'I4 · marca editada');
store.addCategory('Temporal');
igual(store.deleteCategory(cat('Abarrotes').id), false, 'I4 · borrar categoría en uso → bloqueado');
igual(store.deleteCategory(cat('Temporal').id), true, 'I4 · borrar categoría vacía');
igual([store.renameCategory(cat('Bebidas').id, 'abarrotes'), store.renameCategory(cat('Bebidas').id, 'Todos')], [false, false], 'F9 · renombrar a un nombre de otra categoría (o "Todos") → bloqueado');
igual(store.renameCategory(cat('Botanas').id, 'Botanas y dulces'), true, 'renombrar Botanas');
store.deletePresentacion(prod('Coca-Cola').id, pres('Coca-Cola', '2 L').id);          // I5
const r9 = await store.eliminarVenta(V3.id, true);
igual(r9.itemsNoEncontrados.map(i => `${i.nombre} ${i.tamano}`), ['Coca-Cola 2 L'], 'Eliminar V3 · aviso stock no devuelto');
await esperarEscrituras();
igual(crudo.prepare("SELECT descr FROM activity_log WHERE tipo = 'venta_eliminada'").get().descr,
  'Venta $76.00 eliminada (crédito) · sin stock que devolver: Coca-Cola 2 L (producto eliminado)', 'F8 · texto del evento');
await esperarEscrituras();
igual(stocks(), { 'Coca-Cola 600 ml': 19, 'Gansito': 3, 'Arroz a granel por kg': 7.5, 'Frijol 1 kg': 7 }, 'stocks');
h = await historial();
igual([h.contado, h.abonos, h.contado + h.abonos, h.credito, h.numVentas], [166, 72, 238, 36, 3], 'Historial Hoy tras eliminar V3');

// ═══ Paso 8: compras ═══════════════════════════════════════════════════════
paso('Paso 8 · compras');
const C1 = store.addCompra({
  proveedor: 'Coca-Cola FEMSA', tipoPago: 'Contado', notas: '', total: 492,
  items: [
    { productId: gans.productId, presentacionId: gans.presentacionId, nombre: 'Gansito', tamano: '', cantidad: 12, costoUnitario: 13, subtotal: 156 },
    { productId: coca.productId, presentacionId: coca.presentacionId, nombre: 'Coca-Cola', tamano: '600 ml', cantidad: 24, costoUnitario: 14, subtotal: 336, piezasPaquete: 24, precioPaquete: 336, numPaquetes: 1 },
  ],
});
await esperarEscrituras();
igual([stocks()['Coca-Cola 600 ml'], stocks()['Gansito'], pres('Gansito', '').precioCompra], [43, 15, 13], 'C1 · stock y costo');
const c1 = await obtenerCompra(C1.id);
igual(await store.editarCompra(C1.id, { ...c1, total: 466, items: c1.items.map(i => (i.nombre === 'Gansito' ? { ...i, cantidad: 10, subtotal: 130 } : i)) }), true, 'C2 · editar');
igual([stocks()['Coca-Cola 600 ml'], stocks()['Gansito'], pres('Gansito', '').precioCompra], [43, 13, 13], 'C2 · stock y costo');
const V6 = vender([['Gansito', '', 1]]);
await esperarEscrituras();
igual([V6.total, V6.productos[0].precioCompra], [20, 13], 'V6 · total y costo en la venta');
const posteriores = await vendidasDespuesDe(await obtenerCompra(C1.id));
igual(Object.values(posteriores), [1], 'C3 · aviso "1 vendidas después" (Gansito)');
const r10 = await store.eliminarCompra(C1.id, true);
igual(r10.itemsNoEncontrados.length, 0, 'C3 · eliminar revirtiendo');
igual([stocks()['Coca-Cola 600 ml'], stocks()['Gansito'], pres('Gansito', '').precioCompra], [19, 2, 12], 'C3 · stock y costo restaurado');

// ═══ Estado final ══════════════════════════════════════════════════════════
paso('Estado final');
await esperarEscrituras();
igual(valorInventario(), 896, 'Inventario · Valor total');
igual(stockBajo(), 1, 'Inventario · badge stock bajo');
igual(await resumenCompras(), { count: 3, total: 768 }, 'Compras · resumen');
h = await historial();
igual([h.contado, h.abonos, h.contado + h.abonos, h.credito, h.pendiente, h.numVentas], [186, 72, 258, 36, 0, 4], 'Historial Hoy');
c = await resumenCorte({ inicioHoy: inicioHoy().toISOString() });
igual([c.contado + c.abonos, c.contado, c.abonos, c.credito, c.pendienteTotal], [258, 186, 72, 36, 0], 'Corte');
igual(c.abonosHoy.map(a => [a.cliente, a.monto]), [['Juan Pérez López', 42], ['Juan Pérez López', 30]], 'Corte · abonos del día');
igual([c.masVendido?.nombre, c.masVendido?.cantidad, c.masVendido?.numVentas, c.numVentas], ['Gansito', 5, 3, 4], 'Corte · más vendido y ventas del día');
r = await reportes7d();
ingreso = r.flujo.contado + r.flujo.abonosRecibidos;
igual([ingreso, r.flujo.contado + r.flujo.creditoGenerado, r.numVentas, Number(r.ticketPromedio.toFixed(2)), ingreso - r.flujo.invertidoCompras], [258, 222, 4, 55.5, -510], 'Reportes 7d · KPIs');
igual([r.flujo.contado, r.flujo.abonosRecibidos, r.flujo.creditoGenerado, r.flujo.pendienteGlobal, r.flujo.invertidoCompras], [186, 72, 36, 0, 768], 'Reportes · flujo');
igual(ordenarTop(r.top, 'unidades').map(t => [t.nombre, t.marca, t.unidades, t.monto, Math.round(t.porcentaje)]),
  [['Gansito', 'Marinela', 5, 92, 41], ['Coca-Cola', 'Coca-Cola', 3, 60, 27], ['Arroz a granel', 'Local', 2.5, 70, 32]], 'Reportes · Más vendidos (% sobre dinero)');
igual(ordenarTop(r.top, 'margen').map(t => [t.nombre, t.margen, Math.round(t.porcentaje)]),
  [['Gansito', 31, 45], ['Arroz a granel', 20, 29], ['Coca-Cola', 18, 26]], 'Reportes · Más rentables');
const infoF = await infoPresentaciones({ presentacionIds: store.state.products.flatMap(p => p.presentaciones.map(x => x.id)), desde30: inicioHoy().toISOString() });
igual(store.state.products.flatMap(p => p.presentaciones.map(x => [`${p.nombre} ${x.tamano}`.trim(), infoF[x.id].vendidas30, infoF[x.id].ultimaCompra?.costoUnitario ?? null])),
  [['Coca-Cola 600 ml', 3, 14], ['Gansito', 5, null], ['Arroz a granel por kg', 2.5, 20], ['Frijol 1 kg', 0, null]], 'Detalle · vendidas 30 días y costo de la última compra');
igual(prod('Arroz a granel').marca, 'Granel Local', 'Arroz · marca editada');
igual(store.state.categories.map(c => c.nombre), ['Bebidas', 'Botanas y dulces', 'Abarrotes'], 'categorías');
const porFiltro = {};
for (const f of ['ventas', 'creditos', 'compras', 'inventario', 'otros']) {
  porFiltro[f] = await contarLog({ tipos: Object.keys(LOG_META).filter(t => LOG_META[t].filtro === f) });
}
igual([await contarLog(), porFiltro], [38, { ventas: 7, creditos: 7, compras: 6, inventario: 11, otros: 7 }], 'Registro de actividad · total y por filtro');
const eventos = crudo.prepare('SELECT tipo, descr FROM activity_log ORDER BY fecha, id').all().map(e => `${e.tipo}: ${e.descr}`);
console.log('\nEventos (del más antiguo al más reciente):\n  ' + eventos.join('\n  '));

const filas = crudo.prepare(readFileSync(join(AQUI, '..', 'integrity.sql'), 'utf8')).all();
const malos = filas.filter(f => f.problemas);
ok(!malos.length, `Integridad: ${filas.length} verificaciones · ${malos.reduce((s, f) => s + f.problemas, 0)} problemas${malos.length ? ' → ' + JSON.stringify(malos) : ''}`);

console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ ESCENARIO "DESDE 0" VERIFICADO');
process.exit(fallos ? 1 : 0);
