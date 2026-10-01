// Cruza la hoja del oráculo (qa/valores-esperados.mjs, JS independiente)
// contra las consultas REALES de la app sobre la MISMA base. Si ambos
// coinciden, la hoja es confiable para validar las pantallas del teléfono.
//   node qa/arnes/cruzar-oraculo.mjs [bd] [hoja.md]
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { construir } from './construir.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const BD = process.argv[2] ?? join(AQUI, '..', 'datos', 'mitienda.db');
const HOJA = readFileSync(process.argv[3] ?? join(AQUI, '..', 'datos', 'VALORES_ESPERADOS.md'), 'utf8');

construir();
globalThis.__DEV__ = false;
const { ruta } = await import('./stubs/op-sqlite.mjs');
ruta.bd = BD;
const { initDB } = await import('./app/data/db.mjs');
await initDB();
const { resumenPeriodo } = await import('./app/data/consultas/historial.mjs');
const { resumenCorte } = await import('./app/data/consultas/corte.mjs');
const { clientesConSaldo } = await import('./app/data/consultas/creditos.mjs');
const { cargarReportes, ordenarTop } = await import('./app/data/consultas/reportes.mjs');
const { resumenCompras } = await import('./app/data/consultas/compras.mjs');
const { contarLog } = await import('./app/data/repositories/log.mjs');

const moneda = HOJA.match(/Moneda: \*\*(.+?)\*\*/)[1];
const d = n => `${n < 0 ? '-' : ''}${moneda}${Math.abs(n).toFixed(2)}`;
let fallos = 0;
const esta = (texto, etiqueta) => { const ok = HOJA.includes(texto); if (!ok) fallos++; console.log(`${ok ? '✅' : '❌'} ${etiqueta}: ${texto}`); };

const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
const lunes = new Date(hoy0); lunes.setDate(lunes.getDate() + (hoy0.getDay() === 0 ? -6 : 1 - hoy0.getDay()));
const mes = new Date(hoy0.getFullYear(), hoy0.getMonth(), 1);
for (const [nombre, desde] of [['Hoy', hoy0], ['Semana', lunes], ['Mes', mes], ['Todo', null]]) {
  for (const [et, pago] of [['Todos', null], ['Contado', 'Contado'], ['Crédito', 'Credito']]) {
    const r = await resumenPeriodo({ desde: desde?.toISOString() ?? null, tipoPago: pago });
    esta(`| ${nombre} | ${et} | ${d(r.contado + r.abonos)} | ${d(r.contado)} | ${d(r.abonos)} | ${r.credito > 0.009 ? d(r.credito) : '(oculto)'} | ${r.credito > 0.009 ? d(r.pendiente) : '(oculto)'} | ${r.numVentas} |`, `Historial ${nombre}/${et}`);
  }
}
const c = await resumenCorte({ inicioHoy: hoy0.toISOString() });
esta(`| INGRESOS DEL DÍA (contado + abonos) | ${d(c.contado + c.abonos)} |`, 'Corte ingresos');
esta(`| Pendiente por cobrar (total) | ${d(c.pendienteTotal)} |`, 'Corte pendiente');
if (c.masVendido) esta(` · en ${c.masVendido.numVentas} ${c.masVendido.numVentas === 1 ? 'venta' : 'ventas'} |`, 'Corte más vendido (en N ventas)');
esta(`| Ventas del día | ${c.numVentas} |`, 'Corte ventas del día');
const clientes = await clientesConSaldo();
if (clientes.length) esta(`Encabezado: **${d(clientes.reduce((s, x) => s + x.saldo, 0))} total**`, 'Créditos total');
for (const x of clientes) esta(`| ${x.cliente} | ${x.numVentas} ${x.numVentas === 1 ? 'venta' : 'ventas'} a crédito |`, 'Créditos cliente');
for (const periodo of ['7d', '30d', 'año']) {
  const inicio = periodo === '7d' ? new Date(hoy0.getTime()) : periodo === '30d' ? new Date(hoy0.getTime()) : new Date(hoy0.getFullYear(), 0, 1);
  if (periodo === '7d') inicio.setDate(inicio.getDate() - 6);
  if (periodo === '30d') inicio.setDate(inicio.getDate() - 29);
  const fin = new Date(hoy0); fin.setHours(23, 59, 59, 999);
  const dias = Math.round((hoy0 - inicio) / 86400000) + 1;
  const ia = new Date(inicio); ia.setDate(ia.getDate() - dias);
  const r = await cargarReportes({ inicio: inicio.toISOString(), fin: fin.toISOString(), inicioAnterior: ia.toISOString(), finAnterior: new Date(inicio.getTime() - 1).toISOString() });
  const ingreso = r.flujo.contado + r.flujo.abonosRecibidos;
  esta(`| 💰 Ingreso real | ${d(ingreso)} |`, `Reportes ${periodo} ingreso`);
  esta(`| 🧾 Venta promedio | ${d(r.ticketPromedio)} |`, `Reportes ${periodo} promedio`);
  esta(`| 🛒 Ventas | ${r.numVentas} |`, `Reportes ${periodo} ventas`);
  esta(`| 📊 Balance | ${d(ingreso - r.flujo.invertidoCompras)} |`, `Reportes ${periodo} balance`);
  esta(`| ⚠️ Pendiente total | ${d(r.flujo.pendienteGlobal)} |`, `Reportes ${periodo} pendiente`);
  const t = ordenarTop(r.top, 'unidades')[0];
  if (t) esta(`| 1 | ${[t.nombre, t.tamano].filter(Boolean).join(' ')} | ${t.marca} |`, `Reportes ${periodo} top 1`);
}
const rc = await resumenCompras();
if (rc.count) esta(`**Total invertido ${moneda}${rc.total.toFixed(2)}** · **Compras registradas ${rc.count}**`, 'Compras');
esta(`| Todos | ${await contarLog()} eventos |`, 'Registro de actividad');

console.log(fallos ? `\n❌ ${fallos} diferencias entre el oráculo y la app` : '\n✅ El oráculo coincide con las consultas de la app');
process.exit(fallos ? 1 : 0);
