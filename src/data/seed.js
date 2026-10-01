import { getMeta, setMeta } from './db';
import { newId } from './ids';
import { getTiendaId } from './repositories/comunes';
import { normalizarNombre } from './nombres';
import { formatoDinero } from '../config/formato';

// ─── Datos de ejemplo: "un año de tienda" (solo desarrollo) ───────────────────
// Cuándo se cargan:
//   • Automático: en __DEV__, UNA vez por instalación (nota `semilla_auto_hecha`
//     en meta). Así "Vaciar datos" + reiniciar deja la app vacía de verdad.
//   • Manual: botones de la sección "Desarrollo" en Configuración.
//   • En release: nunca.
//
// Qué genera: un año de operación simulada día por día, con volumen realista
// para probar rendimiento y cálculos (≈ 30 000 ventas con 80 ventas/día):
//   catálogo con casos a probar (mismas presentaciones de marcas distintas,
//   granel, "presentación única"), ventas de contado y a crédito, abonos,
//   condonaciones, compras de reposición (algunas por paquete/reja y algunas
//   "sin proveedor" de emergencia) y el registro de actividad.
//
// El STOCK se simula: parte de un stock inicial, cada venta lo baja y cada
// compra lo sube (con movimientos reales), así SUM(movimientos) = stock y
// nunca hay stock negativo.
//
// DETERMINISTA: generador aleatorio con semilla fija → cada reinicio produce
// las mismas ventas (solo cambian las fechas, que son relativas a hoy).
//
// Se inserta con INSERT de muchas filas por sentencia (no fila por fila):
// cada llamada JS → nativo es cara; agrupar ~miles de filas por llamada lo
// hace cientos de veces más rápido. Va dentro de la transacción de persistir().

// Cambiar a false para que la app de desarrollo arranque vacía.
export const SEED_AUTOMATICO = true;

// Volumen de la simulación (ajustables para pruebas de carga).
export const DIAS_SEMILLA = 365;
export const VENTAS_POR_DIA = 80;

// Semilla del generador aleatorio: mismo número = mismos datos.
const SEMILLA_ALEATORIA = 20260926;

// Tablas con datos de la tienda (no incluye `tienda` ni `meta`).
// También la usa respaldo.js: son las tablas que viajan en una copia.
export const TABLAS_DE_DATOS = [
  'categorias', 'productos', 'presentaciones', 'movimientos_inventario', 'clientes',
  'ventas', 'venta_items', 'abonos', 'compras', 'compra_items', 'activity_log',
];

// ─── Catálogo ─────────────────────────────────────────────────────────────────
// pres: [tamaño, precio venta, costo, popularidad (peso relativo), piezas por paquete?]
// Casos a probar incluidos a propósito:
//   • "Frijol 1 kg", "Leche entera 1 L" y "Aceite vegetal 1 L" de dos marcas.
//   • Granel (arroz, frijol, azúcar por kg).
//   • Presentación única (tamaño vacío): Gansito, Chocorroles.
//   • Compras por paquete/reja: refrescos y agua.
const CATALOGO = [
  { n: 'Arroz', m: 'Verde Valle', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 kg', 32, 25, 5], ['500 g', 18, 13.5, 3]] },
  { n: 'Arroz a granel', m: 'Local', c: 'Abarrotes', p: 'Mayoreo Central', granel: 'kg', pres: [['por kg', 28, 20, 4]] },
  { n: 'Frijol', m: 'La Costeña', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 kg', 38, 29, 4]] },
  { n: 'Frijol', m: 'Isadora', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 kg', 36, 28, 3]] },
  { n: 'Frijol a granel', m: 'Local', c: 'Abarrotes', p: 'Mayoreo Central', granel: 'kg', pres: [['por kg', 34, 25, 4]] },
  { n: 'Azúcar', m: 'Zulka', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 kg', 32, 25, 4]] },
  { n: 'Azúcar a granel', m: 'Local', c: 'Abarrotes', p: 'Mayoreo Central', granel: 'kg', pres: [['por kg', 28, 21, 3]] },
  { n: 'Aceite vegetal', m: '1-2-3', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 L', 45, 35, 4]] },
  { n: 'Aceite vegetal', m: 'Nutrioli', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 L', 52, 40, 2]] },
  { n: 'Harina de maíz', m: 'Maseca', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 kg', 26, 19, 3]] },
  { n: 'Sopa de pasta', m: 'La Moderna', c: 'Abarrotes', p: 'Distribuidora García', pres: [['200 g', 14, 9.5, 5]] },
  { n: 'Sal', m: 'La Fina', c: 'Abarrotes', p: 'Distribuidora García', pres: [['1 kg', 18, 12, 1]] },
  { n: 'Café soluble', m: 'Nescafé', c: 'Abarrotes', p: 'Distribuidora García', pres: [['120 g', 95, 75, 1], ['42 g', 38, 29, 2]] },
  { n: 'Leche entera', m: 'Lala', c: 'Lácteos y huevo', p: 'Lácteos del Norte', pres: [['1 L', 29, 23, 9]] },
  { n: 'Leche entera', m: 'Alpura', c: 'Lácteos y huevo', p: 'Lácteos del Norte', pres: [['1 L', 30, 24, 6]] },
  { n: 'Huevo', m: 'San Juan', c: 'Lácteos y huevo', p: 'Lácteos del Norte', pres: [['12 pzas', 48, 38, 7], ['18 pzas', 70, 56, 3]] },
  { n: 'Yogurt bebible', m: 'Danone', c: 'Lácteos y huevo', p: 'Lácteos del Norte', pres: [['1 L', 42, 32, 2]] },
  { n: 'Queso panela', m: 'Lala', c: 'Lácteos y huevo', p: 'Lácteos del Norte', pres: [['400 g', 85, 66, 2]] },
  { n: 'Crema', m: 'Lala', c: 'Lácteos y huevo', p: 'Lácteos del Norte', pres: [['450 ml', 38, 29, 2]] },
  { n: 'Coca-Cola', m: 'Coca-Cola', c: 'Bebidas', p: 'Coca-Cola FEMSA', pres: [['600 ml', 20, 14, 10, 24], ['2 L', 38, 29, 5, 8], ['3 L', 52, 40, 4, 6]] },
  { n: 'Agua natural', m: 'Ciel', c: 'Bebidas', p: 'Coca-Cola FEMSA', pres: [['1.5 L', 17, 11, 6, 12], ['600 ml', 11, 7, 4, 24]] },
  { n: 'Jugo', m: 'Jumex', c: 'Bebidas', p: 'Distribuidora García', pres: [['1 L', 30, 22, 2]] },
  { n: 'Papas fritas', m: 'Sabritas', c: 'Botanas y dulces', p: 'Sabritas', pres: [['45 g', 20, 14, 6], ['170 g', 55, 40, 1]] },
  { n: 'Doritos', m: 'Sabritas', c: 'Botanas y dulces', p: 'Sabritas', pres: [['58 g', 22, 15, 4]] },
  { n: 'Gansito', m: 'Marinela', c: 'Botanas y dulces', p: 'Grupo Bimbo', pres: [['', 18, 12, 5]] },
  { n: 'Chocorroles', m: 'Marinela', c: 'Botanas y dulces', p: 'Grupo Bimbo', pres: [['', 22, 15, 3]] },
  { n: 'Galletas Emperador', m: 'Gamesa', c: 'Botanas y dulces', p: 'Distribuidora García', pres: [['109 g', 20, 14, 3]] },
  { n: 'Galletas María', m: 'Gamesa', c: 'Botanas y dulces', p: 'Distribuidora García', pres: [['170 g', 18, 12, 3]] },
  { n: 'Pan blanco', m: 'Bimbo', c: 'Panadería', p: 'Grupo Bimbo', pres: [['Grande', 55, 44, 5], ['Chico', 38, 30, 4]] },
  { n: 'Tortillinas', m: 'Tía Rosa', c: 'Panadería', p: 'Grupo Bimbo', pres: [['10 pzas', 32, 24, 3]] },
  { n: 'Atún en agua', m: 'Dolores', c: 'Enlatados', p: 'Distribuidora García', pres: [['140 g', 22, 16, 4]] },
  { n: 'Chiles jalapeños', m: 'La Costeña', c: 'Enlatados', p: 'Distribuidora García', pres: [['220 g', 24, 17, 2]] },
  { n: 'Elote en grano', m: 'Herdez', c: 'Enlatados', p: 'Distribuidora García', pres: [['400 g', 28, 20, 1]] },
  { n: 'Detergente', m: 'Roma', c: 'Limpieza', p: 'Distribuidora García', pres: [['1 kg', 42, 32, 2], ['500 g', 24, 18, 2]] },
  { n: 'Cloro', m: 'Cloralex', c: 'Limpieza', p: 'Distribuidora García', pres: [['1 L', 22, 15, 2]] },
  { n: 'Limpiador multiusos', m: 'Fabuloso', c: 'Limpieza', p: 'Distribuidora García', pres: [['1 L', 32, 23, 1]] },
  { n: 'Papel higiénico', m: 'Pétalo', c: 'Higiene', p: 'Distribuidora García', pres: [['4 rollos', 38, 28, 3]] },
  { n: 'Jabón de barra', m: 'Zote', c: 'Higiene', p: 'Distribuidora García', pres: [['400 g', 26, 18, 2]] },
  { n: 'Pasta dental', m: 'Colgate', c: 'Higiene', p: 'Distribuidora García', pres: [['100 ml', 38, 27, 1]] },
];

// Clientes a crédito. peso: qué tan seguido compran fiado · cadaDias: cada
// cuántos días suelen abonar · paga: [mín, máx] fracción de su deuda por abono
// · moroso: casi no paga (algunas de sus deudas viejas se condonan).
// Incluye "Juan Pérez" y "Laura Peña" para probar acentos y ñ.
const CLIENTES = [
  { nombre: 'Doña Rosa', peso: 6, cadaDias: 7, paga: [0.6, 1] },
  { nombre: 'Juan Pérez', peso: 5, cadaDias: 10, paga: [0.4, 0.9] },
  { nombre: 'María García', peso: 5, cadaDias: 7, paga: [0.7, 1] },
  { nombre: 'Tienda La Esquina', peso: 4, cadaDias: 14, paga: [0.8, 1] },
  { nombre: 'Roberto Díaz', peso: 3, cadaDias: 21, paga: [0.2, 0.5], moroso: true },
  { nombre: 'Lupita Torres', peso: 3, cadaDias: 10, paga: [0.5, 1] },
  { nombre: 'Don Chuy', peso: 3, cadaDias: 15, paga: [0.5, 0.8] },
  { nombre: 'Carmen Ruiz', peso: 2, cadaDias: 7, paga: [1, 1] },
  { nombre: 'José Hernández', peso: 2, cadaDias: 12, paga: [0.5, 1] },
  { nombre: 'Ana López', peso: 2, cadaDias: 9, paga: [0.6, 1] },
  { nombre: 'Pedro Martínez', peso: 2, cadaDias: 30, paga: [0.1, 0.3], moroso: true },
  { nombre: 'Sofía Ramírez', peso: 1, cadaDias: 8, paga: [1, 1] },
  { nombre: 'Miguel Ángel Flores', peso: 1, cadaDias: 14, paga: [0.5, 1] },
  { nombre: 'Laura Peña', peso: 1, cadaDias: 10, paga: [0.7, 1] },
  { nombre: 'Luis Castillo', peso: 1, cadaDias: 20, paga: [0.4, 0.7] },
];

// Ventas por hora del día (7:00 a 20:59): más al mediodía y en la tarde.
const PESO_HORA = { 7: 2, 8: 4, 9: 5, 10: 5, 11: 5, 12: 6, 13: 7, 14: 6, 15: 5, 16: 5, 17: 6, 18: 8, 19: 8, 20: 5 };
// Domingo..sábado: más en fin de semana.
const FACTOR_DIA_SEMANA = [1.15, 0.9, 0.9, 0.95, 1.0, 1.15, 1.3];
const PROB_CREDITO = 0.15;
const PROB_ABONO_INICIAL = 0.25;
const PROB_PROVEEDOR_NO_SURTE = 0.1;
const PROB_COMPRA_EMERGENCIA = 0.15;
// En los últimos días este proveedor "se retrasa" y no surte: así al abrir la
// app hay productos en Stock bajo / agotados para probar esas pantallas.
// (12 días: con pedidos para ~1 semana más reserva, menos días no alcanza a agotar.)
const PROVEEDOR_RETRASADO = { nombre: 'Sabritas', ultimosDias: 12 };

// ─── Utilidades ───────────────────────────────────────────────────────────────

// Generador aleatorio con semilla (mulberry32): mismo `semilla` → misma secuencia.
// Los operadores de bits son parte del algoritmo (no un error).
/* eslint-disable no-bitwise */
const crearAleatorio = semilla => {
  let a = semilla >>> 0;
  const rand = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const entre = (min, max) => min + rand() * (max - min);
  const entero = (min, max) => Math.floor(entre(min, max + 1));
  const elegirPonderado = (opciones, peso) => {
    const total = opciones.reduce((s, o) => s + peso(o), 0);
    let r = rand() * total;
    for (const o of opciones) {
      r -= peso(o);
      if (r <= 0) return o;
    }
    return opciones[opciones.length - 1];
  };
  return { rand, entre, entero, elegirPonderado };
};
/* eslint-enable no-bitwise */

const r2 = n => Math.round(n * 100) / 100;
const r3 = n => Math.round(n * 1000) / 1000;
const dinero = n => formatoDinero(n, '$');

// SQLite no tiene booleanos ni undefined.
const aSQL = v => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);

/**
 * INSERT de muchas filas por sentencia. Todas las filas de una tabla deben
 * tener las mismas claves (en el mismo orden). Lotes de ~10 000 variables,
 * lejos del límite de SQLite (32 766 `?` por sentencia).
 */
const insertarLote = async (tx, tabla, filas) => {
  if (!filas.length) return;
  const columnas = Object.keys(filas[0]);
  const porLote = Math.max(1, Math.floor(10000 / columnas.length));
  const grupo = `(${columnas.map(() => '?').join(', ')})`;
  for (let i = 0; i < filas.length; i += porLote) {
    const lote = filas.slice(i, i + porLote);
    const params = [];
    lote.forEach(f => columnas.forEach(c => params.push(aSQL(f[c]))));
    await tx.execute(
      `INSERT INTO ${tabla} (${columnas.join(', ')}) VALUES ${lote.map(() => grupo).join(', ')}`,
      params,
    );
  }
};

// ─── Simulación ───────────────────────────────────────────────────────────────

/**
 * Simula DIAS_SEMILLA días de operación y devuelve las filas de cada tabla,
 * listas para insertar (mismas columnas que migrations.js).
 */
const simular = () => {
  const al = crearAleatorio(SEMILLA_ALEATORIA);
  const tiendaId = getTiendaId();
  const ahora = new Date();
  const ahoraISO = ahora.toISOString();
  const inicio = new Date(ahora);
  inicio.setDate(inicio.getDate() - DIAS_SEMILLA);
  inicio.setHours(6, 0, 0, 0);
  const inicioISO = inicio.toISOString();

  const comunes = fecha => ({ tienda_id: tiendaId, created_at: fecha, updated_at: fecha, deleted_at: null });
  const filas = Object.fromEntries(TABLAS_DE_DATOS.map(t => [t, []]));
  const evento = (tipo, fecha, descr) =>
    filas.activity_log.push({ id: newId(), ...comunes(fecha), tipo, fecha, descr });
  const movimiento = (pres, cantidad, tipo, refId, fecha) => {
    if (!cantidad) return;
    pres.stock = r3(pres.stock + cantidad);
    filas.movimientos_inventario.push({ id: newId(), ...comunes(fecha), presentacion_id: pres.id, cantidad, tipo, ref_id: refId, fecha });
  };

  // Categorías, productos y presentaciones (con su política de reposición).
  const categoriaId = {};
  [...new Set(CATALOGO.map(p => p.c))].forEach(nombre => {
    categoriaId[nombre] = newId();
    filas.categorias.push({ id: categoriaId[nombre], ...comunes(inicioISO), nombre });
  });

  const presentaciones = [];
  CATALOGO.forEach(prod => {
    const productoId = newId();
    filas.productos.push({ id: productoId, ...comunes(inicioISO), nombre: prod.n, marca: prod.m, categoria_id: categoriaId[prod.c] });
    prod.pres.forEach(([tamano, precio, costo, popularidad, paquete]) => {
      presentaciones.push({
        id: newId(), productoId, nombre: prod.n, marca: prod.m, tamano, precio, costo,
        costoActual: costo, popularidad, paquete: paquete ?? null, proveedor: prod.p,
        esGranel: !!prod.granel, unidadGranel: prod.granel ?? null, stock: 0,
      });
    });
  });

  // Reposición: demanda diaria estimada → mínimo (≈3 días) y cantidad a pedir (≈7 días).
  const pesoTotal = presentaciones.reduce((s, p) => s + p.popularidad, 0);
  presentaciones.forEach(p => {
    const demandaDiaria = (VENTAS_POR_DIA * 2.4 * p.popularidad / pesoTotal) * (p.esGranel ? 0.9 : 1.4);
    p.minimo = Math.max(3, Math.ceil(demandaDiaria * 3));
    const pedido = Math.max(demandaDiaria * 7, p.minimo * 2);
    const multiplo = p.paquete ?? (p.esGranel ? 5 : 1);
    p.pedido = Math.ceil(pedido / multiplo) * multiplo;
    movimiento(p, p.pedido + p.minimo, 'inicial', null, inicioISO);
  });

  // Clientes.
  const clientes = CLIENTES.map(c => ({
    ...c, id: newId(), ventas: [], proximoAbono: al.entero(3, c.cadaDias),
  }));
  clientes.forEach(c => filas.clientes.push({ id: c.id, ...comunes(inicioISO), nombre: c.nombre, nombre_norm: normalizarNombre(c.nombre) }));

  // Compra (reposición regular o de emergencia): fila, ítems, movimientos, costo y evento.
  const registrarCompra = (fecha, proveedor, items, notas) => {
    const compraId = newId();
    let total = 0;
    items.forEach(({ pres, cantidad, costo }, orden) => {
      const subtotal = r2(cantidad * costo);
      total += subtotal;
      const conPaquete = pres.paquete && cantidad % pres.paquete === 0;
      filas.compra_items.push({
        id: newId(), ...comunes(fecha), compra_id: compraId, producto_id: pres.productoId, presentacion_id: pres.id,
        nombre: pres.nombre, tamano: pres.tamano, cantidad, costo_unitario: costo, subtotal,
        precio_compra_anterior: pres.costoActual,
        piezas_paquete: conPaquete ? pres.paquete : null,
        precio_paquete: conPaquete ? r2(costo * pres.paquete) : null,
        num_paquetes: conPaquete ? cantidad / pres.paquete : null,
        orden,
      });
      pres.costoActual = costo; // como addCompra: la compra fija el precio de compra
      movimiento(pres, cantidad, 'compra', compraId, fecha);
    });
    total = r2(total);
    filas.compras.push({ id: compraId, ...comunes(fecha), fecha, proveedor, tipo_pago: 'Contado', notas, total });
    evento('compra', fecha, `Compra ${dinero(total)} · ${items.length} ${items.length === 1 ? 'producto' : 'productos'} · ${proveedor || 'Sin proveedor'} (Contado)`);
  };

  // Abono o condonación sobre una venta (actualiza sus totales).
  const aplicarAbono = (venta, cliente, monto, tipo, fecha) => {
    filas.abonos.push({ id: newId(), ...comunes(fecha), venta_id: venta.id, cliente_id: cliente.id, fecha, monto: r2(monto), tipo });
    if (tipo === 'abono') venta.total_abonado = r2(venta.total_abonado + monto);
    else venta.condonado = r2(venta.condonado + monto);
    venta.updated_at = fecha;
  };
  const pendienteDe = v => r2(v.total - v.total_abonado - v.condonado);

  const fechaDelDia = (dia, hora, minuto) => {
    const d = new Date(dia);
    d.setHours(hora, minuto, al.entero(0, 59), 0);
    return d;
  };
  const horas = Object.keys(PESO_HORA).map(Number);
  let emergenciasHoy = new Set();

  for (let d = DIAS_SEMILLA - 1; d >= 0; d--) {
    const dia = new Date(ahora);
    dia.setDate(dia.getDate() - d);
    dia.setHours(0, 0, 0, 0);
    emergenciasHoy = new Set();

    // Eventos del día, procesados en orden cronológico: reposición, ventas y
    // abonos. (La reposición también es un evento: si se aplicara antes que
    // todo, una venta de las 7:15 vendería mercancía que llegó a las 8:00.)
    const eventos = [];
    // Reposición regular: lunes y jueves ~8:00, una compra por proveedor.
    if (dia.getDay() === 1 || dia.getDay() === 4) {
      eventos.push({ tipo: 'reposicion', fecha: fechaDelDia(dia, 8, al.entero(0, 20)) });
    }
    const factor = FACTOR_DIA_SEMANA[dia.getDay()] * (dia.getMonth() === 11 ? 1.2 : 1) * al.entre(0.85, 1.15);
    for (let i = Math.round(VENTAS_POR_DIA * factor); i > 0; i--) {
      eventos.push({ tipo: 'venta', fecha: fechaDelDia(dia, al.elegirPonderado(horas, h => PESO_HORA[h]), al.entero(0, 59)) });
    }
    clientes.forEach(c => {
      if (--c.proximoAbono <= 0) {
        eventos.push({ tipo: 'abono', cliente: c, fecha: fechaDelDia(dia, al.entero(9, 19), al.entero(0, 59)) });
        c.proximoAbono = al.entero(Math.ceil(c.cadaDias * 0.6), Math.ceil(c.cadaDias * 1.4));
      }
    });
    eventos.sort((a, b) => a.fecha - b.fecha);

    for (const ev of eventos) {
      if (ev.fecha > ahora) break; // hoy: solo lo que ya pasó
      const fecha = ev.fecha.toISOString();

      if (ev.tipo === 'reposicion') {
        const porProveedor = {};
        presentaciones.filter(p => p.stock <= p.minimo * 2).forEach(p => {
          (porProveedor[p.proveedor] ??= []).push({ pres: p, cantidad: p.pedido, costo: p.costo });
        });
        // A veces un proveedor no surte ese día: así hay agotados y stock bajo
        // reales (para probar LowStockView y las compras de emergencia).
        Object.entries(porProveedor)
          .filter(([prov]) => !(prov === PROVEEDOR_RETRASADO.nombre && d < PROVEEDOR_RETRASADO.ultimosDias))
          .filter(() => al.rand() >= PROB_PROVEEDOR_NO_SURTE)
          .forEach(([prov, items]) => registrarCompra(fecha, prov, items, ''));
        continue;
      }

      if (ev.tipo === 'abono') {
        const c = ev.cliente;
        const pendientes = c.ventas.filter(v => pendienteDe(v) > 0.009);
        const deuda = r2(pendientes.reduce((s, v) => s + pendienteDe(v), 0));
        if (deuda <= 0.009) continue;
        let monto = deuda < 20 ? deuda : Math.min(deuda, Math.max(20, Math.round(deuda * al.entre(c.paga[0], c.paga[1]) / 10) * 10));
        const totalAbono = monto;
        for (const v of pendientes) { // las más antiguas primero, como registrarAbono
          if (monto <= 0.009) break;
          const aplicar = Math.min(pendienteDe(v), monto);
          aplicarAbono(v, c, aplicar, 'abono', fecha);
          monto = r2(monto - aplicar);
        }
        evento('abono', fecha, `Abono ${dinero(totalAbono)} · ${c.nombre}`);
        continue;
      }

      // Venta: 1 a 6 productos distintos según popularidad.
      const numItems = al.elegirPonderado([1, 2, 3, 4, 5, 6], n => [30, 28, 20, 12, 6, 4][n - 1]);
      const elegidas = new Set();
      const items = [];
      for (let k = 0; k < numItems * 2 && items.length < numItems; k++) {
        const pres = al.elegirPonderado(presentaciones, p => p.popularidad);
        if (elegidas.has(pres)) continue;
        elegidas.add(pres);
        const cantidad = pres.esGranel
          ? al.elegirPonderado([0.25, 0.5, 1, 1.5, 2], q => ({ 0.25: 2, 0.5: 3, 1: 4, 1.5: 1, 2: 1 })[q])
          : al.elegirPonderado([1, 2, 3], q => [70, 22, 8][q - 1]);
        if (pres.stock < cantidad) {
          // Agotado: a veces se compra de urgencia en otra tienda ("Sin
          // proveedor"), fechada un minuto ANTES de esta venta ("fui y
          // regresé"), para que el historial nunca venda algo que no había.
          if (pres.stock <= 0 && !emergenciasHoy.has(pres) && pres.proveedor !== PROVEEDOR_RETRASADO.nombre && al.rand() < PROB_COMPRA_EMERGENCIA) {
            emergenciasHoy.add(pres);
            const fechaEmergencia = new Date(ev.fecha.getTime() - 60000).toISOString();
            registrarCompra(fechaEmergencia, '', [{ pres, cantidad: pres.minimo, costo: r2(pres.costo * 1.15) }], 'Compra de emergencia');
          }
          if (pres.stock < cantidad) continue;
        }
        items.push({ pres, cantidad });
      }
      if (!items.length) continue;

      const ventaId = newId();
      const cliente = al.rand() < PROB_CREDITO ? al.elegirPonderado(clientes, c => c.peso) : null;
      let total = 0;
      items.forEach(({ pres, cantidad }, orden) => {
        const totalItem = r2(pres.precio * cantidad);
        total += totalItem;
        filas.venta_items.push({
          id: newId(), ...comunes(fecha), venta_id: ventaId, producto_id: pres.productoId, presentacion_id: pres.id,
          nombre: pres.nombre, marca: pres.marca, tamano: pres.tamano, precio: pres.precio, precio_compra: pres.costoActual,
          es_granel: pres.esGranel, unidad_granel: pres.unidadGranel, cantidad, total: totalItem, orden,
        });
        movimiento(pres, -cantidad, 'venta', ventaId, fecha);
      });
      total = r2(total);
      const venta = {
        id: ventaId, ...comunes(fecha), fecha, tipo_pago: cliente ? 'Credito' : 'Contado',
        cliente_id: cliente?.id ?? null, total, total_abonado: 0, condonado: 0,
      };
      filas.ventas.push(venta);

      if (!cliente) {
        evento('venta', fecha, `Venta ${dinero(total)} · ${items.length} ${items.length === 1 ? 'producto' : 'productos'} (Contado)`);
      } else {
        cliente.ventas.push(venta);
        let descr = `Venta ${dinero(total)} a crédito · ${cliente.nombre}`;
        if (al.rand() < PROB_ABONO_INICIAL) {
          const inicial = Math.min(total, Math.max(10, Math.round(total * al.entre(0.2, 0.6) / 10) * 10));
          aplicarAbono(venta, cliente, inicial, 'abono', fecha);
          descr += ` · abono inicial ${dinero(inicial)}`;
        }
        evento('venta_credito', fecha, descr);
      }
    }

    // 3) Clientes morosos: a veces se condona una deuda de más de 120 días.
    const limite = new Date(dia);
    limite.setDate(limite.getDate() - 120);
    const limiteISO = limite.toISOString();
    clientes.filter(c => c.moroso).forEach(c => {
      const vieja = c.ventas.find(v => v.fecha < limiteISO && pendienteDe(v) > 0.009);
      if (vieja && al.rand() < 0.02) {
        const fecha = fechaDelDia(dia, 20, al.entero(0, 50));
        if (fecha > ahora) return;
        const monto = pendienteDe(vieja);
        aplicarAbono(vieja, c, monto, 'condonacion', fecha.toISOString());
        evento('condonacion', fecha.toISOString(), `Deuda condonada ${dinero(monto)} · ${c.nombre}`);
      }
    });
  }

  // Presentaciones con su stock y costo final (resultado de la simulación).
  presentaciones.forEach(p => {
    filas.presentaciones.push({
      id: p.id, ...comunes(inicioISO), updated_at: ahoraISO, producto_id: p.productoId, tamano: p.tamano,
      precio: p.precio, precio_compra: p.costoActual, stock: p.stock, es_granel: p.esGranel, unidad_granel: p.unidadGranel,
    });
  });

  return filas;
};

/**
 * Genera la simulación y la inserta dentro de la transacción `tx`.
 * Devuelve los conteos por tabla (y los tiempos, en desarrollo).
 */
const sembrar = async tx => {
  const t0 = Date.now();
  const filas = simular();
  const tGenerar = Date.now() - t0;
  // Orden de inserción: no hay FOREIGN KEY, pero así queda legible.
  for (const tabla of TABLAS_DE_DATOS) {
    await insertarLote(tx, tabla, filas[tabla]);
  }
  const conteos = Object.fromEntries(TABLAS_DE_DATOS.map(t => [t, filas[t].length]));
  if (__DEV__) {
    console.log(`[semilla] ${DIAS_SEMILLA} días · generar ${tGenerar} ms · insertar ${Date.now() - t0 - tGenerar} ms ·`, JSON.stringify(conteos));
  }
  return conteos;
};

/**
 * Borra TODOS los datos de la tienda (no la fila `tienda` ni `meta`).
 * Aquí sí es DELETE real, no soft delete: es una herramienta de desarrollo
 * para volver a cero, no un borrado que deba sincronizarse.
 */
const vaciar = async tx => {
  for (const tabla of TABLAS_DE_DATOS) {
    await tx.execute(`DELETE FROM ${tabla}`);
  }
};

// ─── API pública (la usan StoreContext y la sección "Desarrollo") ─────────────
// Todas reciben `tx`: se llaman dentro de persistir().

// Siembra automática: solo en desarrollo y una vez por instalación.
// La lectura de meta se hace ANTES de abrir la transacción (ver tienda.js).
export const debeSembrarAutomatico = async () =>
  __DEV__ && SEED_AUTOMATICO && !(await getMeta('semilla_auto_hecha'));

export const sembrarAutomatico = async tx => {
  await sembrar(tx);
  await setMeta(tx, 'semilla_auto_hecha', 1);
};

// Botón "Reiniciar con datos de ejemplo".
export const reiniciarConSemilla = async tx => {
  await vaciar(tx);
  await sembrar(tx);
};

// Botón "Vaciar datos".
export const vaciarDatos = vaciar;
