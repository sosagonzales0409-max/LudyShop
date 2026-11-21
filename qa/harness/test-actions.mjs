// Pruebas de las ACCIONES de dinero con un año de datos: siembra una BD nueva
// con la semilla real de la app (src/data/seed.js) y ejecuta las acciones
// reales de StoreContext (persistir, cola y transacciones reales).
// Después de cada acción compara memoria vs BD, y al final corre la batería
// de integridad.
//   node qa/harness/test-actions.mjs
// Deja la BD sembrada (antes de las pruebas) en qa/data/semilla-node.db.
import { readFileSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construir, montarTienda } from './build.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const DATOS = join(AQUI, '..', 'data');
const BD = join(DATOS, 'acciones.db');
mkdirSync(DATOS, { recursive: true });
for (const s of ['', '-wal', '-shm']) rmSync(BD + s, { force: true });

construir();
console.log('Sembrando un año de datos (≈10 s)…');
const { store, esperarEscrituras, crudo: db } = await montarTienda({ bd: BD, dev: true, sembrar: true });
db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
copyFileSync(BD, join(DATOS, 'semilla-node.db'));
globalThis.__DEV__ = false; // de aquí en adelante, sin registros de rendimiento
const { suscribirCambios } = await import('./app/data/changes.mjs');

let fallos = 0;
const reporta = (ok, texto) => { if (!ok) fallos++; console.log(`${ok ? '✅' : '❌'} ${texto}`); };
const cerca = (a, b) => Math.abs(a - b) < 0.0051;
const q = (sql, ...p) => db.prepare(sql).all(...p);
const q1 = (sql, ...p) => db.prepare(sql).get(...p);

reporta(!store.state.errorCarga && !('sales' in store.state) && !('abonos' in store.state) && !('compras' in store.state),
  `Arranque: en memoria ${store.state.products.length} productos, ${store.state.clientes.length} clientes; sin sales/abonos/compras`);

// Memoria vs BD: stock y precio de compra de TODAS las presentaciones.
const memoriaIgualBD = etiqueta => {
  const bd = new Map(q('SELECT id, stock, precio_compra FROM presentaciones WHERE deleted_at IS NULL').map(f => [f.id, f]));
  const malas = [];
  store.state.products.forEach(p => p.presentaciones.forEach(pr => {
    const f = bd.get(pr.id);
    if (!f || !cerca(f.stock, pr.stock) || (f.precio_compra ?? null) !== (pr.precioCompra ?? null)) malas.push({ id: pr.id, mem: [pr.stock, pr.precioCompra], bd: f && [f.stock, f.precio_compra] });
  }));
  reporta(!malas.length, `   memoria = BD tras ${etiqueta}${malas.length ? ' → ' + JSON.stringify(malas.slice(0, 3)) : ''}`);
};
const stockDe = id => q1('SELECT stock FROM presentaciones WHERE id = ?', id).stock;
const venta = id => q1('SELECT * FROM ventas WHERE id = ?', id);
const abonosVivos = id => q('SELECT * FROM abonos WHERE venta_id = ? AND deleted_at IS NULL ORDER BY fecha, id', id);
const nombreCliente = id => q1('SELECT nombre FROM clientes WHERE id = ?', id).nombre;

// Notificaciones (las pantallas se refrescan con esto)
const avisadas = [];
suscribirCambios(['ventas', 'abonos', 'compras', 'presentaciones'], () => avisadas.push(1));

// ═══ 1. registrarAbono: reparte de la venta más antigua a la más reciente ═══
{
  const c = q1(`SELECT cliente_id, COUNT(*) n FROM ventas WHERE deleted_at IS NULL AND tipo_pago='Credito'
                AND total-total_abonado-condonado > 0 GROUP BY cliente_id HAVING n >= 3 ORDER BY n DESC LIMIT 1`);
  const antes = q(`SELECT id, total, total_abonado, condonado FROM ventas WHERE deleted_at IS NULL AND tipo_pago='Credito'
                   AND cliente_id = ? AND total-total_abonado-condonado > 0 ORDER BY fecha, id`, c.cliente_id);
  const pend = v => v.total - v.total_abonado - v.condonado;
  const monto = Math.round((pend(antes[0]) + pend(antes[1]) / 2) * 100) / 100;
  // Esperado con la regla vieja
  let resto = monto; const esperado = {};
  for (const v of antes) { if (resto <= 0) break; const a = Math.min(pend(v), resto); resto -= a; esperado[v.id] = v.total_abonado + a; }
  const nAbonos = q1("SELECT COUNT(*) n FROM abonos WHERE deleted_at IS NULL").n;
  // Nombre con otra capitalización y sin acento: debe resolver al mismo cliente
  const nombre = nombreCliente(c.cliente_id);
  const escrito = nombre.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, (m, i, s) => (s[i - 1] === 'N' ? m : ''));
  await store.registrarAbono(escrito, monto);
  const ok = Object.entries(esperado).every(([id, ab]) => cerca(venta(id).total_abonado, ab));
  const nuevos = q1("SELECT COUNT(*) n FROM abonos WHERE deleted_at IS NULL").n - nAbonos;
  reporta(ok && nuevos === Object.keys(esperado).length && antes.slice(2).every(v => cerca(venta(v.id).total_abonado, v.total_abonado)),
    `registrarAbono("${escrito}", ${monto}) → ${nuevos} abonos: liquida la más antigua, abona a la 2ª, no toca las demás`);
  // Abono mayor que toda la deuda: queda en 0 y no se pasa
  const deuda = q1(`SELECT SUM(total-total_abonado-condonado) d FROM ventas WHERE deleted_at IS NULL AND tipo_pago='Credito' AND cliente_id=?`, c.cliente_id).d;
  await store.registrarAbono(nombre, deuda + 500);
  const deudaDespues = q1(`SELECT SUM(total-total_abonado-condonado) d FROM ventas WHERE deleted_at IS NULL AND tipo_pago='Credito' AND cliente_id=?`, c.cliente_id).d;
  const pasadas = q1(`SELECT COUNT(*) n FROM ventas WHERE cliente_id=? AND total_abonado > total + 0.001`, c.cliente_id).n;
  reporta(cerca(deudaDespues, 0) && pasadas === 0, `registrarAbono mayor que la deuda (${deuda.toFixed(2)} + 500) → deuda 0, ninguna venta sobrepagada`);
  reporta((await store.registrarAbono('Cliente Que No Existe', 10)) === null, 'registrarAbono a cliente inexistente → null, nada escrito');
}

// ═══ 2. ajustarAbonoVenta: corrige los abonos existentes, conserva fechas ═══
{
  const v = q1(`SELECT v.* FROM ventas v WHERE v.deleted_at IS NULL AND v.tipo_pago='Credito' AND v.condonado = 0
                AND (SELECT COUNT(*) FROM abonos a WHERE a.venta_id=v.id AND a.deleted_at IS NULL AND a.tipo='abono') >= 2
                LIMIT 1`); // (bajar y luego subir +1 siempre cabe: lo bajado es > 1)
  const previos = abonosVivos(v.id);
  const ultimo = previos[previos.length - 1];
  // Bajar: quitar más que el último abono → el último queda en 0 y el resto sale del penúltimo
  const quitar = Math.round((ultimo.monto + 0.5) * 100) / 100;
  const nuevo = Math.round((v.total_abonado - quitar) * 100) / 100;
  await store.ajustarAbonoVenta(v.id, nuevo);
  const despues = abonosVivos(v.id);
  const suma = despues.reduce((s, a) => s + a.monto, 0);
  const fechasIguales = despues.every((a, i) => a.fecha === previos[i].fecha) && despues.length === previos.length;
  reporta(cerca(venta(v.id).total_abonado, nuevo) && cerca(suma, nuevo) && cerca(despues[despues.length - 1].monto, 0)
    && cerca(despues[despues.length - 2].monto, previos[previos.length - 2].monto - 0.5) && fechasIguales,
    `ajustarAbonoVenta bajar ${v.total_abonado.toFixed(2)} → ${nuevo}: último abono a 0, penúltimo −0.50, mismas fechas, suma = total abonado`);
  // Subir: la diferencia va al más reciente
  await store.ajustarAbonoVenta(v.id, nuevo + 1);
  const d2 = abonosVivos(v.id);
  reporta(cerca(venta(v.id).total_abonado, nuevo + 1) && cerca(d2[d2.length - 1].monto, 1), 'ajustarAbonoVenta subir +1 → el abono más reciente recibe la diferencia');
  // Venta sin abonos: se crea uno con fecha de hoy
  const sin = q1(`SELECT v.* FROM ventas v WHERE v.deleted_at IS NULL AND v.tipo_pago='Credito' AND v.total_abonado = 0 AND v.condonado = 0
                  AND NOT EXISTS (SELECT 1 FROM abonos a WHERE a.venta_id=v.id AND a.deleted_at IS NULL) LIMIT 1`);
  await store.ajustarAbonoVenta(sin.id, 5);
  const creado = abonosVivos(sin.id);
  reporta(creado.length === 1 && cerca(creado[0].monto, 5) && creado[0].fecha.slice(0, 10) === new Date().toISOString().slice(0, 10) && cerca(venta(sin.id).total_abonado, 5),
    'ajustarAbonoVenta en venta sin abonos → crea uno de 5 con fecha de hoy');
  const evs = q1("SELECT COUNT(*) n FROM activity_log WHERE tipo='abono_editado'").n;
  await store.ajustarAbonoVenta(sin.id, 5);
  reporta(q1("SELECT COUNT(*) n FROM activity_log WHERE tipo='abono_editado'").n === evs, 'ajustarAbonoVenta sin cambio real → no escribe ni registra evento');
  // Tope: no más que total − condonado
  await store.ajustarAbonoVenta(sin.id, sin.total + 100);
  reporta(cerca(venta(sin.id).total_abonado, sin.total), `ajustarAbonoVenta por encima del total → topado a ${sin.total}`);
}

// ═══ 3. condonarVenta ═══
{
  const v = q1(`SELECT * FROM ventas WHERE deleted_at IS NULL AND tipo_pago='Credito' AND total-total_abonado-condonado > 1 LIMIT 1`);
  const pendiente = v.total - v.total_abonado - v.condonado;
  await store.condonarVenta(v.id);
  const d = venta(v.id);
  const cond = q("SELECT * FROM abonos WHERE venta_id=? AND tipo='condonacion' AND deleted_at IS NULL", v.id);
  reporta(cerca(d.condonado, v.condonado + pendiente) && cerca(d.total - d.total_abonado - d.condonado, 0) && cond.length === 1 && cerca(cond[0].monto, pendiente),
    `condonarVenta → condona ${pendiente.toFixed(2)}, saldo 0, 1 fila 'condonacion'`);
  const n = q1('SELECT COUNT(*) n FROM abonos').n;
  await store.condonarVenta(v.id);
  reporta(q1('SELECT COUNT(*) n FROM abonos').n === n, 'condonarVenta otra vez (ya en 0) → no hace nada');
}

// ═══ 4. eliminarVenta con devolución de stock ═══
{
  const v = q1(`SELECT v.* FROM ventas v WHERE v.deleted_at IS NULL AND v.tipo_pago='Credito'
                AND (SELECT COUNT(*) FROM venta_items i WHERE i.venta_id=v.id AND i.deleted_at IS NULL) >= 2
                AND EXISTS (SELECT 1 FROM abonos a WHERE a.venta_id=v.id AND a.deleted_at IS NULL) LIMIT 1`);
  const items = q('SELECT * FROM venta_items WHERE venta_id=? AND deleted_at IS NULL', v.id);
  const stockAntes = Object.fromEntries(items.map(i => [i.presentacion_id, stockDe(i.presentacion_id)]));
  const r = await store.eliminarVenta(v.id, true);
  const sumaPorPres = {}; items.forEach(i => { sumaPorPres[i.presentacion_id] = (sumaPorPres[i.presentacion_id] ?? 0) + i.cantidad; });
  const okStock = Object.entries(sumaPorPres).every(([p, c]) => cerca(stockDe(p), stockAntes[p] + c));
  const vivos = q1('SELECT (SELECT COUNT(*) FROM venta_items WHERE venta_id=? AND deleted_at IS NULL) + (SELECT COUNT(*) FROM abonos WHERE venta_id=? AND deleted_at IS NULL) n', v.id, v.id).n;
  reporta(r && r.itemsNoEncontrados.length === 0 && venta(v.id).deleted_at && vivos === 0 && okStock,
    `eliminarVenta(devolver) → venta, ${items.length} ítems y abonos borrados; stock devuelto`);
  memoriaIgualBD('eliminarVenta');
  reporta((await store.eliminarVenta(v.id, true)) === null && (await store.eliminarVenta('no-existe', true)) === null, 'eliminarVenta de una venta ya borrada / inexistente → null');
  // Sin devolver stock
  const v2 = q1(`SELECT * FROM ventas WHERE deleted_at IS NULL AND tipo_pago='Contado' LIMIT 1`);
  const it2 = q('SELECT * FROM venta_items WHERE venta_id=? AND deleted_at IS NULL', v2.id);
  const s2 = it2.map(i => stockDe(i.presentacion_id));
  await store.eliminarVenta(v2.id, false);
  reporta(venta(v2.id).deleted_at && it2.every((i, k) => cerca(stockDe(i.presentacion_id), s2[k])), 'eliminarVenta(sin devolver) → borrada, stock intacto');
}

// ═══ 5. registrarDevolucion: parcial, con excedente y total ═══
{
  const v = q1(`SELECT v.* FROM ventas v WHERE v.deleted_at IS NULL AND v.tipo_pago='Contado'
                AND (SELECT COUNT(*) FROM venta_items i WHERE i.venta_id=v.id AND i.deleted_at IS NULL AND i.cantidad >= 2) >= 1
                AND (SELECT COUNT(*) FROM venta_items i WHERE i.venta_id=v.id AND i.deleted_at IS NULL) >= 2 LIMIT 1`);
  const it = q1('SELECT * FROM venta_items WHERE venta_id=? AND deleted_at IS NULL AND cantidad >= 2', v.id);
  const s0 = stockDe(it.presentacion_id);
  const r = await store.registrarDevolucion(v.id, [{ productId: it.producto_id, presentacionId: it.presentacion_id, cantidad: 1, nombre: it.nombre, tamano: it.tamano }], true);
  const itD = q1('SELECT * FROM venta_items WHERE id=?', it.id);
  reporta(r && !r.ventaEliminada && cerca(r.valorDevuelto, it.precio) && cerca(venta(v.id).total, v.total - it.precio) && itD.cantidad === it.cantidad - 1 && cerca(stockDe(it.presentacion_id), s0 + 1),
    `registrarDevolucion parcial (1 × ${it.nombre}) → total −${it.precio}, ítem ${it.cantidad}→${itD.cantidad}, stock +1`);
  memoriaIgualBD('devolución parcial');

  // Crédito con abono mayor que el nuevo total → excedente
  const c = q1(`SELECT v.* FROM ventas v WHERE v.deleted_at IS NULL AND v.tipo_pago='Credito' AND v.total_abonado > 0
                AND (SELECT COUNT(*) FROM venta_items i WHERE i.venta_id=v.id AND i.deleted_at IS NULL) >= 2 LIMIT 1`);
  const itc = q('SELECT * FROM venta_items WHERE venta_id=? AND deleted_at IS NULL ORDER BY total DESC', c.id);
  const devolver = itc.slice(0, itc.length - 1); // todo menos el último
  const valor = devolver.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const nuevoTotal = Math.max(0, c.total - valor);
  const excedenteEsperado = Math.max(0, c.total_abonado - nuevoTotal);
  const rc = await store.registrarDevolucion(c.id, devolver.map(i => ({ productId: i.producto_id, presentacionId: i.presentacion_id, cantidad: i.cantidad, nombre: i.nombre, tamano: i.tamano })), false);
  const dc = venta(c.id);
  reporta(rc && !rc.ventaEliminada && cerca(rc.excedente, excedenteEsperado) && cerca(dc.total, nuevoTotal) && dc.total_abonado <= dc.total + 0.001,
    `registrarDevolucion en crédito → nuevo total ${nuevoTotal.toFixed(2)}, excedente ${rc?.excedente.toFixed(2)} (esperado ${excedenteEsperado.toFixed(2)}), abonado topado`);

  // Total → la venta se elimina en cascada
  const t = q('SELECT * FROM venta_items WHERE venta_id=? AND deleted_at IS NULL', v.id);
  const rt = await store.registrarDevolucion(v.id, t.map(i => ({ productId: i.producto_id, presentacionId: i.presentacion_id, cantidad: i.cantidad, nombre: i.nombre, tamano: i.tamano })), true);
  reporta(rt?.ventaEliminada && venta(v.id).deleted_at && q1('SELECT COUNT(*) n FROM venta_items WHERE venta_id=? AND deleted_at IS NULL', v.id).n === 0,
    'registrarDevolucion total → ventaEliminada, venta e ítems borrados');
  memoriaIgualBD('devolución total');
  reporta((await store.registrarDevolucion(v.id, [{ productId: 'x', presentacionId: 'y', cantidad: 1 }], true)) === null, 'registrarDevolucion de venta ya eliminada → null');
}

// ═══ 6. editarCompra y eliminarCompra (con reversión) ═══
{
  // La compra más reciente de una presentación: su costo es el precio vigente
  const compra = q1(`SELECT c.* FROM compras c WHERE c.deleted_at IS NULL ORDER BY c.fecha DESC, c.id DESC LIMIT 1`);
  const items = q('SELECT * FROM compra_items WHERE compra_id=? AND deleted_at IS NULL ORDER BY orden', compra.id);
  const i0 = items[0];
  const pres0 = q1('SELECT stock, precio_compra FROM presentaciones WHERE id=?', i0.presentacion_id);
  const movs0 = q1('SELECT COUNT(*) n FROM movimientos_inventario').n;
  const aItem = i => ({ productId: i.producto_id, presentacionId: i.presentacion_id, nombre: i.nombre, tamano: i.tamano, cantidad: i.cantidad, costoUnitario: i.costo_unitario, subtotal: i.subtotal });
  const nuevos = items.map(aItem);
  nuevos[0] = { ...nuevos[0], cantidad: i0.cantidad + 5, costoUnitario: i0.costo_unitario + 1, subtotal: (i0.cantidad + 5) * (i0.costo_unitario + 1) };
  const total = nuevos.reduce((s, i) => s + i.subtotal, 0);
  const ok = await store.editarCompra(compra.id, { proveedor: compra.proveedor, tipoPago: compra.tipo_pago, notas: 'editada en prueba', total, items: nuevos });
  const pres1 = q1('SELECT stock, precio_compra FROM presentaciones WHERE id=?', i0.presentacion_id);
  const itemsNuevos = q('SELECT * FROM compra_items WHERE compra_id=? AND deleted_at IS NULL ORDER BY orden', compra.id);
  // Misma regla que antes: revertir con tope en 0 (si ya se vendió parte de
  // lo comprado) y luego aplicar la cantidad nueva.
  const stockEsperado = Math.max(0, pres0.stock - i0.cantidad) + i0.cantidad + 5;
  reporta(ok === true && cerca(pres1.stock, stockEsperado) && cerca(pres1.precio_compra, i0.costo_unitario + 1)
    && itemsNuevos.length === items.length && cerca(itemsNuevos[0].cantidad, i0.cantidad + 5)
    && itemsNuevos[0].precio_compra_anterior === (pres0.precio_compra === i0.costo_unitario ? i0.precio_compra_anterior : pres0.precio_compra),
    `editarCompra (+5 uds, costo +1) → stock ${pres0.stock}→${pres1.stock}, costo ${pres0.precio_compra}→${pres1.precio_compra}, ítems reemplazados, costo anterior restaurado`);
  memoriaIgualBD('editarCompra');

  // Ítem de una presentación que no existe → false y NADA escrito
  const movs1 = q1('SELECT COUNT(*) n FROM movimientos_inventario').n;
  const malo = await store.editarCompra(compra.id, { proveedor: 'X', tipoPago: 'Contado', notas: '', total: 1, items: [...nuevos, { productId: 'p-x', presentacionId: 'no-existe', nombre: 'X', tamano: '', cantidad: 1, costoUnitario: 1, subtotal: 1 }] });
  reporta(malo === false && q1('SELECT COUNT(*) n FROM movimientos_inventario').n === movs1 && q1('SELECT proveedor FROM compras WHERE id=?', compra.id).proveedor === compra.proveedor,
    'editarCompra con producto inexistente → false, sin cambios');
  reporta((await store.editarCompra('no-existe', { items: [] })) === false, 'editarCompra de compra inexistente → false');

  // Eliminar revirtiendo: stock vuelve a como estaba ANTES de la compra editada
  const r = await store.eliminarCompra(compra.id, true);
  const pres2 = q1('SELECT stock, precio_compra FROM presentaciones WHERE id=?', i0.presentacion_id);
  const esperadoStock = Math.max(0, pres1.stock - (i0.cantidad + 5));
  reporta(r && r.itemsNoEncontrados.length === 0 && q1('SELECT deleted_at d FROM compras WHERE id=?', compra.id).d && cerca(pres2.stock, esperadoStock)
    && pres2.precio_compra === itemsNuevos[0].precio_compra_anterior,
    `eliminarCompra(revertir) → borrada, stock ${pres1.stock}→${pres2.stock}, costo restaurado a ${pres2.precio_compra}`);
  memoriaIgualBD('eliminarCompra');
  reporta((await store.eliminarCompra(compra.id, true)) === null, 'eliminarCompra de compra ya borrada → null');
  console.log(`   (movimientos nuevos en la prueba de compras: ${q1('SELECT COUNT(*) n FROM movimientos_inventario').n - movs0})`);
}

// ═══ 6b. Granel con decimales: devolución de 0.5 kg y consumo propio ═══
{
  const it = q1(`SELECT i.* FROM venta_items i JOIN ventas v ON v.id = i.venta_id
                 WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL AND i.es_granel = 1 AND i.cantidad >= 1
                   AND (SELECT COUNT(*) FROM venta_items x WHERE x.venta_id = v.id AND x.deleted_at IS NULL) >= 2 LIMIT 1`);
  const v0 = venta(it.venta_id);
  const s0 = stockDe(it.presentacion_id);
  const r = await store.registrarDevolucion(it.venta_id, [{ productId: it.producto_id, presentacionId: it.presentacion_id, nombre: it.nombre, tamano: it.tamano, esGranel: true, unidadGranel: it.unidad_granel, cantidad: 0.5 }], true);
  const itD = q1('SELECT * FROM venta_items WHERE id = ?', it.id);
  const ev = q1("SELECT descr FROM activity_log WHERE tipo = 'devolucion' ORDER BY fecha DESC, id DESC LIMIT 1").descr;
  reporta(r && cerca(r.valorDevuelto, it.precio * 0.5) && cerca(itD.cantidad, it.cantidad - 0.5) && cerca(itD.total, it.precio * (it.cantidad - 0.5))
    && cerca(venta(it.venta_id).total, v0.total - it.precio * 0.5) && cerca(stockDe(it.presentacion_id), s0 + 0.5) && ev.includes(`0.5 ${it.unidad_granel} ×`),
    `devolución a granel 0.5 ${it.unidad_granel} de ${it.nombre} (${it.cantidad} → ${itD.cantidad}) · evento "${ev}"`);
  memoriaIgualBD('devolución a granel');
  const granel = store.getSellableItems().find(x => x.esGranel && x.stock >= 1);
  const sg = granel.stock;
  store.decreaseStock([{ productId: granel.productId, presentacionId: granel.presentacionId, cantidad: 0.25 }], true);
  await esperarEscrituras();
  reporta(cerca(stockDe(granel.presentacionId), sg - 0.25), `consumo propio a granel 0.25 ${granel.unidadGranel}: ${sg} → ${stockDe(granel.presentacionId)}`);
  memoriaIgualBD('consumo a granel');
}

// ═══ 7. Acciones encimadas (sin esperar): la memoria suma diferencias ═══
{
  const v = q1(`SELECT v.* FROM ventas v WHERE v.deleted_at IS NULL AND v.tipo_pago='Contado' LIMIT 1`);
  const it = q1('SELECT * FROM venta_items WHERE venta_id=? AND deleted_at IS NULL LIMIT 1', v.id);
  const s0 = stockDe(it.presentacion_id);
  const item = store.getSellableItems().find(s => s.presentacionId === it.presentacion_id);
  // Eliminar (async, devuelve stock) y, sin esperar, vender 1 del mismo producto
  const p1 = store.eliminarVenta(v.id, true);
  store.addSale({ tipoPago: 'Contado', total: item.precio, productos: [{ ...item, numProducts: 1, totalPrice: item.precio }] });
  await p1; await esperarEscrituras();
  const esperado = s0 + q('SELECT cantidad FROM venta_items WHERE venta_id=? AND presentacion_id=?', v.id, it.presentacion_id).reduce((s, f) => s + f.cantidad, 0) - 1;
  reporta(cerca(stockDe(it.presentacion_id), esperado), `eliminarVenta + addSale encimadas → stock BD ${stockDe(it.presentacion_id)} (esperado ${esperado})`);
  memoriaIgualBD('acciones encimadas');
}

await esperarEscrituras();
reporta(avisadas.length > 0, `Notificaciones de cambios tras commit: ${avisadas.length} (las pantallas se refrescan solas)`);

// ═══ 8. Batería de integridad ═══
const filas = q(readFileSync(join(AQUI, '..', 'integrity.sql'), 'utf8'));
const malos = filas.filter(f => f.problemas);
reporta(!malos.length, `Integridad: ${filas.length} verificaciones · ${malos.reduce((s, f) => s + f.problemas, 0)} problemas${malos.length ? ' → ' + JSON.stringify(malos) : ''}`);

console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ ACCIONES VERIFICADAS');
process.exit(fallos ? 1 : 0);
