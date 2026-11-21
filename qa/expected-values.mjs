// Hoja de VALORES ESPERADOS para el QA manual, calculada desde una copia de
// la base de datos del teléfono.
//
//   node qa/expected-values.mjs [bd] [salida.md]
//     bd       por defecto qa/data/mitienda.db (ver qa/pull-db.cmd)
//     salida   por defecto qa/data/VALORES_ESPERADOS.md
//
// Es un ORÁCULO INDEPENDIENTE: lee las filas crudas y calcula todo en
// JavaScript recorriéndolas (como hacía la app cuando tenía todo en memoria),
// SIN usar las consultas SQL de la app. Si una pantalla no coincide con esta
// hoja, el error está en la app (o en esta hoja: revisar la fórmula).
//
// Importante: "hoy", "7 días", "semana"… se calculan con la fecha y la zona
// horaria de ESTA computadora al momento de ejecutarlo. Ejecútalo el mismo
// día en que revisas el teléfono, con la PC en la misma zona horaria, y sin
// hacer cambios en la app entre la extracción y la revisión.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RUTA_BD = process.argv[2] ?? join(AQUI, 'data', 'mitienda.db');
const SALIDA = process.argv[3] ?? join(AQUI, 'data', 'VALORES_ESPERADOS.md');
if (!existsSync(RUTA_BD)) {
  console.error(`No existe ${RUTA_BD}. Extrae la base del teléfono con qa\\pull-db.cmd`);
  process.exit(1);
}
const db = new DatabaseSync(RUTA_BD);
const q = (sql, ...p) => db.prepare(sql).all(...p);

// ─── Datos crudos (solo filas vivas) ─────────────────────────────────────────
const tiendaId = q("SELECT valor FROM meta WHERE clave = 'tienda_id_actual'")[0]?.valor;
const tienda = q('SELECT * FROM tienda WHERE id = ?', tiendaId)[0] ?? { nombre: 'Mi Tienda', moneda: '$', umbral_stock: 5 };
const M = tienda.moneda;
const UMBRAL = tienda.umbral_stock;
const categorias = q('SELECT * FROM categorias WHERE deleted_at IS NULL');
const productos = q('SELECT * FROM productos WHERE deleted_at IS NULL');
const presentaciones = q('SELECT * FROM presentaciones WHERE deleted_at IS NULL');
const clientes = q('SELECT * FROM clientes');
const ventas = q('SELECT * FROM ventas WHERE deleted_at IS NULL');
const items = q('SELECT * FROM venta_items WHERE deleted_at IS NULL');
const abonos = q('SELECT * FROM abonos WHERE deleted_at IS NULL');
const compras = q('SELECT * FROM compras WHERE deleted_at IS NULL');
const itemsCompra = q('SELECT * FROM compra_items WHERE deleted_at IS NULL');
const eventos = q('SELECT tipo, fecha, descr, id FROM activity_log WHERE deleted_at IS NULL');

const nombreCliente = id => clientes.find(c => c.id === id)?.nombre ?? 'Sin nombre';
const itemsDe = new Map(); items.forEach(i => { if (!itemsDe.has(i.venta_id)) itemsDe.set(i.venta_id, []); itemsDe.get(i.venta_id).push(i); });
itemsDe.forEach(l => l.sort((a, b) => a.orden - b.orden));
const itemsDeCompra = new Map(); itemsCompra.forEach(i => { if (!itemsDeCompra.has(i.compra_id)) itemsDeCompra.set(i.compra_id, []); itemsDeCompra.get(i.compra_id).push(i); });
const productoDe = new Map(productos.map(p => [p.id, p]));
// Catálogo como lo ve la app: presentaciones vivas de productos vivos.
const catalogo = presentaciones.filter(p => productoDe.has(p.producto_id)).map(p => ({ ...p, prod: productoDe.get(p.producto_id) }));
const productosVisibles = productos.filter(p => catalogo.some(x => x.producto_id === p.id));

// ─── Formato (igual que src/config/formatting.js) ───────────────────────────────
const dinero = n => `${n < 0 ? '-' : ''}${M}${Math.abs(Number(n) || 0).toFixed(2)}`;
const cantidad = n => String(Math.round((Number(n) || 0) * 1000) / 1000);
const nombreProd = (n, t) => [n, t].map(s => (s || '').trim()).filter(Boolean).join(' ');
const dd = n => String(n).padStart(2, '0');
const fecha = iso => { const d = new Date(iso); return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}`; };
const hora = iso => { const d = new Date(iso); return `${dd(d.getHours())}:${dd(d.getMinutes())}`; };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const pct0 = n => `${Math.round(n)}%`;
const esGranel = p => p.es_granel === 1;
const unidades = n => (n === 0 ? 1 : n); // una cantidad 0 cuenta como 1 (como numProducts || 1)

// ─── Fechas locales ──────────────────────────────────────────────────────────
const ahora = new Date();
const medianoche = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const hoy0 = medianoche(ahora);
const diasAtras = n => { const d = new Date(hoy0); d.setDate(d.getDate() - n); return d; };
const iso = d => d.toISOString();
const desdeISO = d => (d ? iso(d) : null);
const claveDia = f => { const d = new Date(f); return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`; };

const out = [];
const L = (...lineas) => out.push(...lineas);
const tabla = (cab, filas) => { L(`| ${cab.join(' | ')} |`, `|${cab.map(() => '---').join('|')}|`); filas.forEach(f => L(`| ${f.join(' | ')} |`)); L(''); };

L(`# Valores esperados — ${tienda.nombre}`, '');
L(`Generado el **${fecha(iso(ahora))} ${hora(iso(ahora))}** (hora de esta PC) desde \`${RUTA_BD.replace(/\\/g, '/')}\`.`,
  `Moneda: **${M}** · Umbral de stock bajo: **${UMBRAL}**.`, '',
  '> Revisa el teléfono **hoy**, sin hacer ventas ni cambios desde que extrajiste la base. Todo se calculó en JavaScript recorriendo las filas (independiente de las consultas de la app).', '');

// ─── 0. Integridad ───────────────────────────────────────────────────────────
const integridad = q(readFileSync(join(AQUI, 'integrity.sql'), 'utf8'));
const malos = integridad.filter(f => f.problemas);
L('## 0. Integridad de la base', '', malos.length
  ? `❌ **${malos.length} verificaciones con problemas** (de ${integridad.length}):`
  : `✅ Las ${integridad.length} verificaciones dan 0 problemas.`, '');
if (malos.length) tabla(['Verificación', 'Problemas'], malos.map(f => [f.verificacion, f.problemas]));
tabla(['Tabla', 'Filas vivas'], [
  ['categorías', categorias.length], ['productos (visibles)', productosVisibles.length], ['presentaciones', catalogo.length],
  ['clientes', clientes.length], ['ventas', ventas.length], ['ítems de venta', items.length], ['abonos + condonaciones', abonos.length],
  ['compras', compras.length], ['eventos del registro', eventos.length],
]);

// ─── 1. Créditos (se usa en varias pantallas) ────────────────────────────────
const credito = ventas.filter(v => v.tipo_pago === 'Credito');
const porCliente = new Map();
credito.forEach(v => {
  const k = v.cliente_id ?? null;
  if (!porCliente.has(k)) porCliente.set(k, []);
  porCliente.get(k).push(v);
});
const deudores = [...porCliente.entries()].map(([id, vs]) => {
  const total = vs.reduce((s, v) => s + v.total, 0);
  const abonado = vs.reduce((s, v) => s + v.total_abonado, 0);
  const condonado = vs.reduce((s, v) => s + v.condonado, 0);
  const pendientes = vs.filter(v => v.total - v.total_abonado - v.condonado > 0.009).map(v => v.fecha).sort();
  const fechaUltima = vs.map(v => v.fecha).sort().at(-1);
  return { id, nombre: nombreCliente(id), total, abonado, condonado, saldo: total - abonado - condonado, num: vs.length, fechaUltima, fechaDeuda: pendientes[0] ?? fechaUltima, ventas: vs };
}).filter(c => c.saldo > 0.009);
const diasDesde = f => Math.max(0, Math.round((hoy0 - medianoche(f)) / 86400000));
const chip = f => { const d = diasDesde(f); return d === 0 ? 'Hoy' : d === 1 ? '1 día' : d <= 7 ? `${d} días` : `+${d} días`; };

// ─── 2. Pestaña Ventas ───────────────────────────────────────────────────────
L('## 1. Ventas (pestaña principal)', '');
L(`- Badge rojo del ícono de **Créditos**: **${deudores.length || 'sin badge'}**.`,
  '- Tipo de pago **Crédito** → selector "Selecciona un cliente" (mayor deuda primero):', '');
tabla(['#', 'Cliente', 'Saldo (rojo)'], [...deudores].sort((a, b) => b.saldo - a.saldo).map((c, i) => [i + 1, c.nombre, `${dinero(c.saldo)} 💳`]));

// ─── 3. Inventario ───────────────────────────────────────────────────────────
const valorTotal = catalogo.reduce((s, p) => s + p.precio * p.stock, 0);
const bajos = catalogo.filter(p => p.stock < UMBRAL).sort((a, b) => a.stock - b.stock);
L('## 2. Inventario', '');
L(`- Encabezado: **Valor total: ${M}${valorTotal.toFixed(2)}** (precio de VENTA × stock).`,
  `- Badge del ícono ⚠️ (stock bajo): **${bajos.length || 'sin badge'}**.`,
  `- Productos en la lista (chip "Todos"): **${productosVisibles.length}**, en orden alfabético.`, '');
const nombreCat = id => categorias.find(c => c.id === id)?.nombre ?? 'Sin categoría';
tabla(['Chip de categoría', 'Productos'], [['Todos', productosVisibles.length], ...[...categorias].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  .map(c => [c.nombre, productosVisibles.filter(p => p.categoria_id === c.id).length])]);

// ─── 4. Stock bajo ───────────────────────────────────────────────────────────
L('## 3. Stock bajo', '', `- Encabezado: **${bajos.length} ${bajos.length === 1 ? 'Producto' : 'Productos'}** · "Productos con menos de ${UMBRAL} unidades…".`, '');
if (bajos.length) {
  tabla(['#', 'Chip', 'Producto', 'Marca', 'Precio'], bajos.map((p, i) => [i + 1,
    p.stock === 0 ? '🔴 Sin stock' : `${p.stock <= 2 ? '🔴' : '🟠'} ${esGranel(p) ? `${cantidad(p.stock)} ${p.unidad_granel || 'kg'}` : `${cantidad(p.stock)} uds`}`,
    nombreProd(p.prod.nombre, p.tamano), p.prod.marca, `${dinero(p.precio)} c/u`]));
} else L('Lista vacía: "¡Todo en orden!".', '');

// ─── 5. Detalle de producto ──────────────────────────────────────────────────
const desde30 = diasAtras(29);
const ventaDe = new Map(ventas.map(v => [v.id, v]));
const compraDe = new Map(compras.map(c => [c.id, c]));
L('## 4. Detalle de producto (Inventario → tocar un producto)', '',
  'Cada tarjeta de presentación. "Ganancia" = precio − costo; su % es sobre el **precio de venta**. Vendidas = últimos 30 días (hoy incluido).', '');
tabla(['Producto · marca · categoría', 'Presentación', 'Precio', 'Badge stock', 'Precio de compra', 'Ganancia', 'Valor a costo', 'Última compra', 'Vendidas 30 d'],
  [...catalogo].sort((a, b) => a.prod.nombre.localeCompare(b.prod.nombre, 'es') || a.id.localeCompare(b.id)).map(p => {
    const u = esGranel(p) ? (p.unidad_granel || 'ud') : 'unidad';
    const cant = n => (esGranel(p) && p.unidad_granel ? `${cantidad(n)} ${p.unidad_granel}` : `${cantidad(n)} uds`);
    const tieneCosto = p.precio_compra != null;
    const g = tieneCosto ? p.precio - p.precio_compra : null;
    let ultima = null;
    itemsCompra.filter(i => i.presentacion_id === p.id && compraDe.has(i.compra_id)).forEach(i => {
      const c = compraDe.get(i.compra_id);
      if (!ultima || c.fecha > ultima.fecha) ultima = { proveedor: c.proveedor, costo: i.costo_unitario, fecha: c.fecha };
    });
    const vendidas = items.filter(i => i.presentacion_id === p.id && ventaDe.get(i.venta_id)?.fecha >= iso(desde30)).reduce((s, i) => s + i.cantidad, 0);
    const badge = p.stock === 0 ? '🔴' : p.stock < UMBRAL ? '🟠' : '🟢';
    return [`${p.prod.nombre} · ${p.prod.marca} · ${nombreCat(p.prod.categoria_id)}`, p.tamano || '*Presentación única*', `${dinero(p.precio)} por ${u}`,
      `${badge} ${cant(p.stock)}`, tieneCosto ? `${dinero(p.precio_compra)} por ${u}` : 'Sin registrar',
      tieneCosto ? `${dinero(g)} (${p.precio > 0 ? pct0((g / p.precio) * 100) : '—'})` : '—',
      tieneCosto ? dinero(p.stock * p.precio_compra) : '—',
      ultima ? `${ultima.proveedor || 'Sin proveedor'} · ${dinero(ultima.costo)} · ${fecha(ultima.fecha)}` : 'Sin compras registradas',
      cant(vendidas)];
  }));

// ─── 6. Créditos ─────────────────────────────────────────────────────────────
const totalDeuda = deudores.reduce((s, c) => s + c.saldo, 0);
L('## 5. Créditos', '', deudores.length ? `- Encabezado: **${dinero(totalDeuda)} total**.` : '- "Sin deudas pendientes".', '');
const orden = {
  'Más antiguo': (a, b) => (a.fechaDeuda !== b.fechaDeuda ? (a.fechaDeuda < b.fechaDeuda ? -1 : 1) : b.saldo - a.saldo),
  'Más reciente': (a, b) => (a.fechaUltima !== b.fechaUltima ? (a.fechaUltima > b.fechaUltima ? -1 : 1) : b.saldo - a.saldo),
  'Mayor deuda': (a, b) => b.saldo - a.saldo,
  'A-Z': (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
};
if (deudores.length) {
  tabla(['Cliente', 'Subtítulo', 'Chip (días desde su última venta a crédito)', 'Saldo'],
    [...deudores].sort(orden['Más antiguo']).map(c => [c.nombre, `${c.num} ${c.num === 1 ? 'venta' : 'ventas'} a crédito`, chip(c.fechaUltima), dinero(c.saldo)]));
  tabla(['Orden', 'Clientes en pantalla (de arriba a abajo)'], Object.entries(orden).map(([k, f]) => [k, [...deudores].sort(f).map(c => c.nombre).join(' → ')]));
}

// ─── 7. Detalle del cliente ──────────────────────────────────────────────────
L('## 6. Detalle del cliente (Créditos → tocar un cliente)', '');
if (deudores.length) {
  tabla(['Cliente', 'Deuda total', 'Total abonado', 'Condonado', 'Saldo pendiente', 'Encabezado de la lista', 'Primera tarjeta (más reciente)'],
    [...deudores].sort(orden['A-Z']).map(c => {
      const v = [...c.ventas].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.id < b.id ? 1 : -1)))[0];
      const pend = Math.max(0, v.total - v.total_abonado - v.condonado);
      return [c.nombre, dinero(c.total), dinero(c.abonado), c.condonado > 0.009 ? dinero(c.condonado) : '(no se muestra)', dinero(c.saldo),
        `Ventas a crédito (${c.num})`, `${fecha(v.fecha)} · Total ${dinero(v.total)} · ${pend <= 0.009 ? 'Saldada' : `Pendiente ${dinero(pend)} · Abonado ${dinero(v.total_abonado)}`}`];
    }));
} else L('Sin clientes con deuda.', '');

// ─── 8. Historial ────────────────────────────────────────────────────────────
const lunes = (() => { const d = new Date(hoy0); const dia = d.getDay(); d.setDate(d.getDate() + (dia === 0 ? -6 : 1 - dia)); return d; })();
const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
const PERIODOS_H = [['Hoy', hoy0], ['Semana', lunes], ['Mes', inicioMes], ['Todo', null]];
const resumen = (desde, pago) => {
  const vs = ventas.filter(v => (!desde || v.fecha >= iso(desde)) && (!pago || v.tipo_pago === pago));
  const contado = vs.filter(v => v.tipo_pago !== 'Credito').reduce((s, v) => s + v.total, 0);
  const cred = vs.filter(v => v.tipo_pago === 'Credito');
  const ab = pago === 'Contado' ? 0 : abonos.filter(a => a.tipo === 'abono' && (!desde || a.fecha >= iso(desde))).reduce((s, a) => s + a.monto, 0);
  return {
    contado, abonos: ab, credito: cred.reduce((s, v) => s + v.total, 0),
    pendiente: cred.reduce((s, v) => s + Math.max(0, v.total - v.total_abonado - v.condonado), 0), num: vs.length, vs,
  };
};
L('## 7. Historial (Ventas → 📋)', '',
  '"INGRESOS DEL PERÍODO" = contado + abonos. "Vendido a crédito" y "POR COBRAR" solo aparecen si hubo crédito (> 0). Con el filtro **Contado** los abonos son $0.00.', '');
tabla(['Período', 'Pago', 'INGRESOS', 'Contado', 'Abonos recibidos', 'Vendido a crédito', 'POR COBRAR', 'Ventas'],
  PERIODOS_H.flatMap(([nombre, desde]) => [['Todos', null], ['Contado', 'Contado'], ['Crédito', 'Credito']].map(([et, pago]) => {
    const r = resumen(desde, pago);
    return [nombre, et, dinero(r.contado + r.abonos), dinero(r.contado), dinero(r.abonos),
      r.credito > 0.009 ? dinero(r.credito) : '(oculto)', r.credito > 0.009 ? dinero(r.pendiente) : '(oculto)', r.num];
  })));
const primeras = [...resumen(hoy0, null).vs].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.id < b.id ? 1 : -1))).slice(0, 5);
L('Primeras tarjetas con **Hoy / Todos** (más reciente arriba):', '');
if (primeras.length) {
  tabla(['#', 'Fecha y hora', 'Tipo', 'Total', 'Productos (al expandir)'], primeras.map((v, i) => [i + 1, `${fecha(v.fecha)} ${hora(v.fecha)}`,
    v.tipo_pago === 'Credito' ? `Crédito (${nombreCliente(v.cliente_id)})` : 'Contado', dinero(v.total),
    (itemsDe.get(v.id) ?? []).map(it => `${cantidad(it.cantidad)} × ${nombreProd(it.nombre, it.tamano)}`).join(', ')]));
} else L('"Sin ventas" — No hay ventas en el período seleccionado.', '');
const totalHist = ventas.length;
L(`- Con **Todo / Todos** hay ${totalHist} ventas: se cargan de 30 en 30 al bajar${totalHist > 30 ? '; al final aparece "Fin del período"' : ''}.`, '');

// ─── 9. Corte ────────────────────────────────────────────────────────────────
const rHoy = resumen(hoy0, null);
const abonosHoy = abonos.filter(a => a.tipo === 'abono' && a.fecha >= iso(hoy0)).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
const pendienteSinTope = credito.reduce((s, v) => s + (v.total - v.total_abonado - v.condonado), 0);
const tops = new Map();
items.filter(i => ventaDe.get(i.venta_id)?.fecha >= iso(hoy0)).forEach(i => {
  const v = ventaDe.get(i.venta_id);
  const t = tops.get(i.presentacion_id) ?? { cantidad: 0, ventas: new Set(), ultima: '', foto: i };
  t.cantidad += unidades(i.cantidad);
  t.ventas.add(i.venta_id);
  if (v.fecha >= t.ultima) { t.ultima = v.fecha; t.foto = i; }
  tops.set(i.presentacion_id, t);
});
const masVendido = [...tops.values()].sort((a, b) => b.cantidad - a.cantidad || (a.ultima < b.ultima ? 1 : -1))[0];
L('## 8. Corte del día (Historial → Corte)', '');
tabla(['Campo', 'Valor esperado'], [
  ['Fecha', fecha(iso(ahora))],
  ['INGRESOS DEL DÍA (contado + abonos)', dinero(rHoy.contado + rHoy.abonos)],
  ['Contado vendido', dinero(rHoy.contado)],
  ['Abonos recibidos', dinero(rHoy.abonos)],
  ['Ventas del día', rHoy.num],
  ['Abonos del día (lista, más reciente arriba)', abonosHoy.length ? abonosHoy.map(a => `${nombreCliente(a.cliente_id)} ${dinero(a.monto)}`).join(' · ') : '(no aparece la sección)'],
  ['Ventas a crédito (hoy)', dinero(rHoy.credito)],
  ['Pendiente por cobrar (total)', dinero(pendienteSinTope)],
  ['Producto más vendido del día', masVendido
    ? `${nombreProd(masVendido.foto.nombre, masVendido.foto.tamano)} — ${esGranel(masVendido.foto) ? `${cantidad(masVendido.cantidad)} ${masVendido.foto.unidad_granel}` : `${cantidad(masVendido.cantidad)} unidades`} · en ${masVendido.ventas.size} ${masVendido.ventas.size === 1 ? 'venta' : 'ventas'}`
    : 'Sin ventas registradas hoy.'],
]);

// ─── 10. Reportes ────────────────────────────────────────────────────────────
const pendienteConTope = credito.reduce((s, v) => s + Math.max(0, v.total - v.total_abonado - v.condonado), 0);
const variacion = (a, b) => (b === 0 ? null : `${a - b >= 0 ? '▲' : '▼'} ${Math.abs(((a - b) / b) * 100).toFixed(1)}%`);
L('## 9. Reportes (Historial → 📈, o Configuración → Reportes)', '',
  '"Ingreso real" = contado + abonos. "Ventas totales" incluye crédito. "Balance" = ingreso real − compras del período (puede ser negativo).', '');
for (const [key, etiqueta] of [['7d', '7 días'], ['30d', '30 días'], ['año', 'Este año']]) {
  const inicio = key === '7d' ? diasAtras(6) : key === '30d' ? diasAtras(29) : new Date(ahora.getFullYear(), 0, 1);
  const fin = new Date(hoy0); fin.setHours(23, 59, 59, 999);
  const dias = []; for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) dias.push(new Date(d));
  const ia = new Date(inicio); ia.setDate(ia.getDate() - dias.length);
  const fa = new Date(inicio.getTime() - 1);
  const enRango = (f, a, b) => f >= iso(a) && f <= iso(b);
  const porDia = {};
  ventas.filter(v => enRango(v.fecha, inicio, fin)).forEach(v => {
    const k = claveDia(v.fecha); porDia[k] ??= { todas: 0, ingresoReal: 0 };
    porDia[k].todas += v.total; if (v.tipo_pago !== 'Credito') porDia[k].ingresoReal += v.total;
  });
  abonos.filter(a => a.tipo === 'abono' && enRango(a.fecha, inicio, fin)).forEach(a => { const k = claveDia(a.fecha); porDia[k] ??= { todas: 0, ingresoReal: 0 }; porDia[k].ingresoReal += a.monto; });
  const barras = modo => {
    const del = d => porDia[claveDia(d)]?.[modo] ?? 0;
    if (key === '30d') { const b = []; for (let i = 0; i < dias.length; i += 7) b.push([`Sem ${b.length + 1}`, dias.slice(i, i + 7).reduce((s, d) => s + del(d), 0)]); return b; }
    if (key === 'año') return MESES.map((m, i) => [m, dias.filter(d => d.getMonth() === i).reduce((s, d) => s + del(d), 0)]);
    return dias.map(d => [DIAS[d.getDay()], del(d)]);
  };
  const anterior = {
    todas: ventas.filter(v => enRango(v.fecha, ia, fa)).reduce((s, v) => s + v.total, 0),
    ingresoReal: ventas.filter(v => v.tipo_pago !== 'Credito' && enRango(v.fecha, ia, fa)).reduce((s, v) => s + v.total, 0)
      + abonos.filter(a => a.tipo === 'abono' && enRango(a.fecha, ia, fa)).reduce((s, a) => s + a.monto, 0),
  };
  const r = resumen(inicio, null);
  const ingreso = r.contado + r.abonos;
  const invertido = compras.filter(c => c.fecha >= iso(inicio)).reduce((s, c) => s + c.total, 0);
  const invertidoAnt = compras.filter(c => enRango(c.fecha, ia, fa)).reduce((s, c) => s + c.total, 0);
  const promedio = r.num > 0 ? (r.contado + r.credito) / r.num : 0;
  const lab = key === '7d' ? 'semana anterior' : key === '30d' ? 'mes anterior' : 'año anterior';

  L(`### ${etiqueta} (desde ${inicio.getDate()} ${MESES[inicio.getMonth()]})`, '');
  tabla(['KPI', 'Valor', 'Subtítulo'], [
    ['💰 Ingreso real', dinero(ingreso), 'Dinero que ya cobraste'],
    ['🧾 Venta promedio', dinero(promedio), 'Monto promedio por venta'],
    ['🛒 Ventas', r.num, 'Número de ventas del período'],
    ['📊 Balance', dinero(ingreso - invertido), 'Cobrado − gastado en compras'],
  ]);
  for (const [modo, titulo] of [['ingresoReal', 'Ingreso real'], ['todas', 'Ventas totales']]) {
    const b = barras(modo);
    const total = b.reduce((s, x) => s + x[1], 0);
    const max = Math.max(...b.map(x => x[1]));
    const v = variacion(total, anterior[modo]);
    L(`**Gráfica "${titulo}"**: total **${dinero(total)}** ${v ? `· chip **${v} vs ${lab}** (anterior ${dinero(anterior[modo])})` : '· sin chip de comparación (período anterior en $0)'}` +
      `${total > 0 ? ` · barra más alta (verde): **${b.find(x => x[1] === max)[0]} ${dinero(max)}**` : ' · "Sin ingresos/ventas en este período"'}.`, '');
    if (total > 0) L(`Tocar cada barra (tooltip): ${b.map(x => `${x[0]} ${dinero(x[1])}`).join(' · ')}`, '');
  }
  // Top productos, agrupado por presentación (nombre = el de la venta más reciente)
  const grupos = new Map();
  items.filter(i => ventaDe.get(i.venta_id)?.fecha >= iso(inicio)).forEach(i => {
    const k = i.presentacion_id ?? `${i.nombre}|${i.marca}|${i.tamano}`;
    const v = ventaDe.get(i.venta_id);
    const g = grupos.get(k) ?? { unidades: 0, monto: 0, margen: 0, tieneCosto: false, fecha: '', foto: i };
    const u = unidades(i.cantidad);
    g.unidades += u; g.monto += u * (i.precio ?? 0);
    if (i.precio_compra != null) { g.margen += (i.precio - i.precio_compra) * u; g.tieneCosto = true; }
    if (v.fecha >= g.fecha) { g.fecha = v.fecha; g.foto = i; }
    grupos.set(k, g);
  });
  const lista = [...grupos.values()];
  const totMonto = lista.reduce((s, g) => s + g.monto, 0);
  // "2.5 kg" a granel, "6 uds" en piezas; el % de Más vendidos es sobre el dinero
  const cantTop = g => (esGranel(g.foto) ? `${cantidad(g.unidades)} ${g.foto.unidad_granel || 'kg'}` : `${cantidad(g.unidades)} uds`);
  const totM = lista.reduce((s, g) => s + g.margen, 0);
  const nom = g => `${g.foto.nombre} ${g.foto.tamano}`;
  const pctTop = p => (p < 1 ? '<1%' : pct0(p));
  const topU = [...lista].sort((a, b) => b.unidades - a.unidades || nom(a).localeCompare(nom(b), 'es')).slice(0, 5);
  const topM = lista.filter(g => g.tieneCosto).sort((a, b) => b.margen - a.margen || nom(a).localeCompare(nom(b), 'es')).slice(0, 5);
  if (topU.length) {
    tabla(['#', 'Más vendidos (% sobre dinero)', 'Marca', 'Derecha', '%'], topU.map((g, i) => [i + 1, nombreProd(g.foto.nombre, g.foto.tamano), g.foto.marca, `${cantTop(g)} · ${dinero(g.monto)}`, pctTop(totMonto > 0 ? (g.monto / totMonto) * 100 : 0)]));
    tabla(['#', 'Más rentables', 'Marca', 'Derecha', '%'], topM.map((g, i) => [i + 1, nombreProd(g.foto.nombre, g.foto.tamano), g.foto.marca, `${dinero(g.margen)} · ${cantTop(g)}`, pctTop(totM > 0 ? (g.margen / totM) * 100 : 0)]));
  } else L('Top productos: "Sin ventas en este período".', '');
  const vc = variacion(invertido, invertidoAnt);
  tabla(['Flujo de dinero', 'Valor'], [
    ['💰 INGRESO REAL', dinero(ingreso)],
    ['💵 Contado cobrado', dinero(r.contado)],
    ['🤝 Abonos recibidos', dinero(r.abonos)],
    ['🧾 Crédito otorgado', dinero(r.credito)],
    ['⚠️ Pendiente total', dinero(pendienteConTope)],
    ['🛍️ Invertido en compras', invertido > 0 ? `${dinero(invertido)} · ${vc ? `${vc} vs período anterior` : 'Compras a proveedores en el período'}` : '(sección oculta: sin compras)'],
    ['📊 Balance del período', invertido > 0 ? dinero(ingreso - invertido) : '(sección oculta)'],
  ]);
}

// ─── 11. Compras ─────────────────────────────────────────────────────────────
const comprasOrd = [...compras].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.id < b.id ? 1 : -1)));
const provs = [];
comprasOrd.forEach(c => { if (c.proveedor && !provs.includes(c.proveedor)) provs.push(c.proveedor); });
const fechaCompra = f => { const d = new Date(f); return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`; };
L('## 10. Compras (Configuración → Compras)', '');
L(compras.length ? `- Resumen: **Total invertido ${M}${compras.reduce((s, c) => s + c.total, 0).toFixed(2)}** · **Compras registradas ${compras.length}**.` : '- "Sin compras registradas".', '');
if (compras.length) {
  tabla(['#', 'Proveedor', 'Fecha · pago', 'Total', 'Productos'], comprasOrd.slice(0, 5).map((c, i) => [i + 1, c.proveedor || '*Sin proveedor*',
    `${fechaCompra(c.fecha)} · ${c.tipo_pago === 'Credito' ? 'Crédito' : 'Contado'}`, `${M}${c.total.toFixed(2)}`,
    `${(itemsDeCompra.get(c.id) ?? []).length} ${(itemsDeCompra.get(c.id) ?? []).length === 1 ? 'producto' : 'productos'}`]));
}
L(`- Registrar compra → chips "Usados anteriormente": *Sin proveedor* (punteado) + ${provs.slice(0, 5).join(', ') || '(ninguno)'}.`,
  `- Agregar producto → "¿Registrar como compra?" → chips: *Sin proveedor* + ${provs.slice(0, 4).join(', ') || '(ninguno)'}.`, '');

// ─── 12. Registro de actividad ───────────────────────────────────────────────
const FILTRO = {
  venta: 'Ventas', devolucion: 'Ventas', venta_eliminada: 'Ventas',
  venta_credito: 'Créditos', abono: 'Créditos', abono_editado: 'Créditos', condonacion: 'Créditos',
  compra: 'Compras', compra_editada: 'Compras', compra_eliminada: 'Compras',
  precio_editado: 'Inventario', stock_agregado: 'Inventario', stock_ajustado: 'Inventario', consumo_propio: 'Inventario',
  producto_nuevo: 'Inventario', producto_editado: 'Inventario', presentacion_nueva: 'Inventario', presentacion_eliminada: 'Inventario',
  cliente_renombrado: 'Otros', categoria_creada: 'Otros', categoria_renombrada: 'Otros', categoria_eliminada: 'Otros',
};
L('## 11. Historial de actividad (Configuración → Historial de actividad)', '');
tabla(['Filtro', 'Contador del encabezado'], ['Todos', 'Ventas', 'Créditos', 'Compras', 'Inventario', 'Otros']
  .map(f => [f, `${f === 'Todos' ? eventos.length : eventos.filter(e => FILTRO[e.tipo] === f).length} eventos`]));
const ultimos = [...eventos].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (a.id < b.id ? 1 : -1))).slice(0, 5);
if (ultimos.length) tabla(['#', 'Evento (más reciente arriba)'], ultimos.map((e, i) => [i + 1, e.descr]));
L(`- Con **Todos**: se cargan de 50 en 50; al llegar al final dice "Inicio del historial" (${eventos.length} en total).`, '');

// ─── 13. Consumo propio ──────────────────────────────────────────────────────
const conStock = catalogo.filter(p => p.stock > 0).length;
L('## 12. Consumo propio (Configuración → Consumo propio)', '', `- Lista: **${conStock}** productos con stock > 0 (los ${catalogo.length - conStock} agotados no aparecen).`, '');

mkdirSync(dirname(SALIDA), { recursive: true });
writeFileSync(SALIDA, out.join('\n'));
console.log(`Hoja de valores esperados: ${SALIDA}`);
console.log(malos.length ? `❌ Integridad: ${malos.length} verificaciones con problemas` : `✅ Integridad: ${integridad.length} verificaciones en 0`);
