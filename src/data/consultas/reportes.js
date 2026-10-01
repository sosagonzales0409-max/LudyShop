import { getDB } from '../db';
import { resumenPeriodo } from './historial';

// ─── Consultas de Reportes (bajo demanda) ─────────────────────────────────────
// Antes ReportesView recorría TODAS las ventas una vez por día de la gráfica
// y en cada dibujado (≈ 8 millones de revisiones con "año": 7 s por toque).
// Ahora SQLite agrupa y suma una sola vez por período; los toques (tooltip,
// modo, criterio del top) ya no consultan nada.
// Cada fórmula replica la que tenía ReportesView cuando leía de memoria.

// Una cantidad 0 cuenta como 1 unidad (como `numProducts || 1`).
const UNIDADES = 'CASE WHEN i.cantidad = 0 THEN 1 ELSE i.cantidad END';
// Agrupación del top: por presentación; sin id (no debería pasar), por la "foto".
const CLAVE = "COALESCE(i.presentacion_id, i.nombre || '|' || i.marca || '|' || i.tamano)";

/**
 * Todo lo que muestra Reportes para un período. Las fechas las calcula la
 * pantalla (medianoches locales) y se pasan en ISO:
 *   inicio, fin:       rango de la gráfica (fin = hoy 23:59:59.999 local)
 *   inicioAnterior, finAnterior: período anterior de la misma duración
 *
 * Devuelve:
 *   porDia: { 'YYYY-MM-DD' (día local): { todas, ingresoReal } }
 *             todas       = Σ total de todas las ventas del día
 *             ingresoReal = Σ total de contado + Σ abonos reales del día
 *   totalAnterior: { todas, ingresoReal } del período anterior
 *   numVentas, ticketPromedio  (ventas con fecha >= inicio, de ambos tipos)
 *   flujo: { contado, creditoGenerado, abonosRecibidos, pendienteGlobal,
 *            invertidoCompras, invertidoComprasAnterior }
 *   top: { grupos: [{ key, nombre, marca, tamano, esGranel, unidadGranel,
 *                     unidades, monto, margen, tieneCosto }],
 *          totalUnidades, totalMonto, totalMargen }
 */
export const cargarReportes = async ({ inicio, fin, inicioAnterior, finAnterior }) => {
  const db = getDB();
  const [
    { rows: ventasDia }, { rows: abonosDia }, { rows: [anterior] }, resumen,
    { rows: [pendiente] }, { rows: [compras] }, { rows: grupos },
  ] = await Promise.all([
    // Gráfica: ventas por día LOCAL (las fechas se guardan en UTC).
    db.execute(
      `SELECT date(fecha, 'localtime') AS dia,
              SUM(total) AS todas,
              SUM(CASE WHEN tipo_pago != 'Credito' THEN total ELSE 0 END) AS contado
       FROM ventas WHERE deleted_at IS NULL AND fecha >= ? AND fecha <= ?
       GROUP BY dia`,
      [inicio, fin],
    ),
    db.execute(
      `SELECT date(fecha, 'localtime') AS dia, SUM(monto) AS abonos
       FROM abonos WHERE deleted_at IS NULL AND tipo = 'abono' AND fecha >= ? AND fecha <= ?
       GROUP BY dia`,
      [inicio, fin],
    ),
    // Período anterior (comparativa de la gráfica), ambos modos.
    db.execute(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM ventas
            WHERE deleted_at IS NULL AND fecha >= ?1 AND fecha <= ?2) AS todas,
         (SELECT COALESCE(SUM(total), 0) FROM ventas
            WHERE deleted_at IS NULL AND tipo_pago != 'Credito' AND fecha >= ?1 AND fecha <= ?2)
         + (SELECT COALESCE(SUM(monto), 0) FROM abonos
            WHERE deleted_at IS NULL AND tipo = 'abono' AND fecha >= ?1 AND fecha <= ?2) AS ingreso_real`,
      [inicioAnterior, finAnterior],
    ),
    // Contado, crédito, abonos y número de ventas desde el inicio (sin tope
    // superior, como antes): la misma consulta del Historial.
    resumenPeriodo({ desde: inicio }),
    // Pendiente de TODAS las ventas a crédito, con tope en 0 por venta.
    db.execute(
      `SELECT COALESCE(SUM(MAX(0, total - total_abonado - condonado)), 0) AS total
       FROM ventas WHERE deleted_at IS NULL AND tipo_pago = 'Credito'`,
    ),
    db.execute(
      `SELECT
         (SELECT COALESCE(SUM(total), 0) FROM compras WHERE deleted_at IS NULL AND fecha >= ?1) AS periodo,
         (SELECT COALESCE(SUM(total), 0) FROM compras
            WHERE deleted_at IS NULL AND fecha >= ?2 AND fecha <= ?3) AS anterior`,
      [inicio, inicioAnterior, finAnterior],
    ),
    // Top productos: todos los grupos del período (son pocos: uno por
    // presentación), para ordenar por unidades o por margen sin consultar.
    // Nombre a mostrar: el de la venta MÁS RECIENTE del grupo (el vigente si
    // el producto se renombró), en la MISMA pasada: como la fecha ISO se
    // ordena bien como texto, MAX(fecha || datos) trae la "foto" más nueva.
    // (Con una función de ventana aparte costaba recorrer los ítems 2 veces:
    // medido con un año de datos, ~580 ms → ~325 ms.) char(31) = separador
    // de unidad ASCII, que no aparece en nombres escritos por personas.
    db.execute(
      `SELECT ${CLAVE} AS clave,
              SUM(${UNIDADES}) AS unidades,
              SUM(${UNIDADES} * COALESCE(i.precio, 0)) AS monto,
              SUM(CASE WHEN i.precio_compra IS NOT NULL
                       THEN (i.precio - i.precio_compra) * ${UNIDADES} ELSE 0 END) AS margen,
              MAX(i.precio_compra IS NOT NULL) AS tiene_costo,
              MAX(v.fecha || char(31) || i.nombre || char(31) || i.marca || char(31) || i.tamano
                  || char(31) || i.es_granel || char(31) || COALESCE(i.unidad_granel, '')) AS foto
       FROM venta_items i JOIN ventas v ON v.id = i.venta_id
       WHERE i.deleted_at IS NULL AND v.deleted_at IS NULL AND v.fecha >= ?
       GROUP BY clave`,
      [inicio],
    ),
  ]);

  const porDia = {};
  ventasDia.forEach(f => { porDia[f.dia] = { todas: f.todas, ingresoReal: f.contado }; });
  abonosDia.forEach(f => {
    porDia[f.dia] ??= { todas: 0, ingresoReal: 0 };
    porDia[f.dia].ingresoReal += f.abonos;
  });

  const listaGrupos = grupos.map(g => {
    const [, nombre = '', marca = '', tamano = '', granel = '0', unidadGranel = ''] = (g.foto ?? '').split(String.fromCharCode(31));
    return {
      key: g.clave, nombre, marca, tamano,
      esGranel: granel === '1', unidadGranel: unidadGranel || null,
      unidades: g.unidades, monto: g.monto, margen: g.margen, tieneCosto: !!g.tiene_costo,
    };
  });

  const totalVentas = resumen.contado + resumen.credito;
  return {
    porDia,
    totalAnterior: { todas: anterior.todas, ingresoReal: anterior.ingreso_real },
    numVentas: resumen.numVentas,
    ticketPromedio: resumen.numVentas > 0 ? totalVentas / resumen.numVentas : 0,
    flujo: {
      contado:                  resumen.contado,
      creditoGenerado:          resumen.credito,
      abonosRecibidos:          resumen.abonos,
      pendienteGlobal:          pendiente.total,
      invertidoCompras:         compras.periodo,
      invertidoComprasAnterior: compras.anterior,
    },
    top: {
      grupos:        listaGrupos,
      totalUnidades: listaGrupos.reduce((s, g) => s + g.unidades, 0),
      totalMonto:    listaGrupos.reduce((s, g) => s + g.monto, 0),
      totalMargen:   listaGrupos.reduce((s, g) => s + g.margen, 0),
    },
  };
};

// ─── Funciones puras que usa la pantalla con esos datos ───────────────────────
// Separadas para poder verificarlas fuera de la app con el mismo código.

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Barras de la gráfica a partir de los totales por día (mismas reglas que
 * antes): 7d = una barra por día · 30d = bloques de 7 días ("Sem N") ·
 * año = una por mes (los 12, aunque no hayan llegado).
 *   dias: fechas JS (medianoche local) desde el inicio hasta hoy
 *   modo: 'ingresoReal' | 'todas'
 * Devuelve [{ label, valor, tieneVentas }].
 */
export const armarBarras = ({ porDia, dias, periodo, modo }) => {
  const totalDelDia = dia => porDia[claveDia(dia)]?.[modo] ?? 0;
  if (periodo === '30d') {
    const barras = [];
    for (let i = 0; i < dias.length; i += 7) {
      const bloque = dias.slice(i, i + 7);
      barras.push({
        label: `Sem ${barras.length + 1}`,
        valor: bloque.reduce((s, d) => s + totalDelDia(d), 0),
        tieneVentas: bloque.some(d => totalDelDia(d) > 0),
      });
    }
    return barras;
  }
  if (periodo === 'año') {
    return MESES.map((label, mes) => {
      const valor = dias.filter(d => d.getMonth() === mes).reduce((s, d) => s + totalDelDia(d), 0);
      return { label, valor, tieneVentas: valor > 0 };
    });
  }
  return dias.map(dia => {
    const valor = totalDelDia(dia);
    return { label: NOMBRES_DIA[dia.getDay()], valor, tieneVentas: valor > 0 };
  });
};

/**
 * Top 5 según el criterio ('unidades' | 'margen'), con su porcentaje del
 * total. Por margen solo entran los productos con costo registrado.
 * "Más vendidos" se ordena por unidades, pero su % es sobre lo vendido en
 * DINERO: sumar kilos de granel con piezas no tiene sentido.
 * Empate: gana el de más unidades/margen… y luego el orden alfabético, para
 * que el resultado sea siempre el mismo.
 */
export const ordenarTop = (top, criterio) => {
  const base = criterio === 'margen' ? top.grupos.filter(g => g.tieneCosto) : top.grupos;
  return [...base]
    .sort((a, b) => (criterio === 'margen' ? b.margen - a.margen : b.unidades - a.unidades)
      || `${a.nombre} ${a.tamano}`.localeCompare(`${b.nombre} ${b.tamano}`, 'es'))
    .slice(0, 5)
    .map(g => ({
      ...g,
      porcentaje: criterio === 'margen'
        ? (top.totalMargen > 0 ? (g.margen / top.totalMargen) * 100 : 0)
        : (top.totalMonto > 0 ? (g.monto / top.totalMonto) * 100 : 0),
    }));
};

// Día local 'YYYY-MM-DD' de una fecha JS: la misma clave que produce
// date(fecha, 'localtime') en SQLite, para cruzar la gráfica con porDia.
export const claveDia = fecha => {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Solo desarrollo: ¿SQLite y JS coinciden en qué día es "hoy" en hora local?
// Si no, la gráfica agruparía mal por día (zona horaria del dispositivo).
export const verificarZonaHoraria = async () => {
  const { rows: [r] } = await getDB().execute("SELECT date(?, 'localtime') AS dia", [new Date().toISOString()]);
  const js = claveDia(new Date());
  if (r.dia !== js) console.warn(`[reportes] Zona horaria: SQLite dice ${r.dia} y JS dice ${js}; la gráfica por día podría desfasarse`);
  return r.dia === js;
};
