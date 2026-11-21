import React, { Component } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StoreContext } from '../context/StoreContext';
import { cargarReportes, armarBarras, ordenarTop, verificarZonaHoraria } from '../data/queries/reports';
import { crearConsultaViva } from '../data/liveQuery';
import { colors, spacing, radius, fontSize, tarjeta } from '../config/theme';
import { formatoDinero, formatoCantidad } from '../config/formatting';
import {
  IconMoney, IconReceipt, IconWarning, IconShoppingBag, IconChart, IconShoppingCart,
  IconCreditCard, IconInbox, IconPackage,
} from '../ui/Icon';
import Header from '../ui/Header';

const _window = Dimensions.get('window');

// Ancho disponible para la gráfica dentro de la tarjeta.
// ScrollView tiene padding:spacing.lg en cada lado,
// la tarjeta tiene padding:spacing.lg en cada lado.
// Total descuento: spacing.lg * 4. El eje Y (YAXIS_LABEL_WIDTH) ocupa el resto.
//
// Bug fix: gifted-charts reserva por default solo 35px para las etiquetas
// del eje Y (yAxisLabelWidth). Con el prefijo de moneda, un valor de 4+
// dígitos (ej. "$1500") no cabe ahí y se recorta visualmente a "150" — la
// barra se dibuja con la altura correcta, solo la etiqueta se veía mal.
const YAXIS_LABEL_WIDTH = 55;
const CHART_INNER_WIDTH = _window.width - spacing.lg * 4 - YAXIS_LABEL_WIDTH;

// Barras del año: ancho y espaciado fijos para que los 12 meses quepan con
// scroll horizontal y los labels no se encimen.
const BAR_WIDTH_ANUAL  = 28;
const SPACING_ANUAL    = 12;

const PERIODOS = [
  { key: '7d',  label: '7 días'   },
  { key: '30d', label: '30 días'  },
  { key: 'año', label: 'Este año' },
];

// (Los nombres de día/mes de las barras viven en queries/reports.js.)
const MESES =['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const COLORES_PUESTO = [colors.success, colors.primary, colors.warning, colors.textSecondary, colors.textMuted];
// Mismo orden, pero para TEXTO (el % de cada puesto): warning no se lee como
// texto, así que se usa su versión oscura.
const TINTAS_PUESTO = [colors.successDark, colors.primaryDark, colors.warningDark, colors.textSecondary, colors.textMuted];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt      = (moneda, v) => formatoDinero(v, moneda); // formato único (config/formatting.js)

/**
 * Calcula maxValue y stepValue para el eje Y de gifted-charts.
 *
 * Garantiza que:
 * 1. maxValue esté justo por encima del valor máximo de una barra (+20% margen)
 * 2. stepValue sea un número "redondo" legible (1, 2, 5, 10, 20, 50, 100...)
 * 3. Las barras nunca se vean aplastadas ni se salgan del área de la gráfica
 */
function calcYAxis(maxValor) {
  if (maxValor <= 0) return { maxValue: 100, stepValue: 25 };

  // Paso 1: objetivo con margen visual
  const objetivo = maxValor * 1.20;

  // Paso 2: encontrar la magnitud del step ideal para 4 secciones
  const stepIdeal = objetivo / 4;
  const magnitud  = Math.pow(10, Math.floor(Math.log10(stepIdeal)));

  // Paso 3: redondear el step al múltiplo "nice" más cercano: 1, 2, 2.5, 5, 10
  const niceMultiplos = [1, 2, 2.5, 5, 10];
  const stepNice = niceMultiplos
    .map(m => m * magnitud)
    .find(s => s >= stepIdeal) ?? (10 * magnitud);

  // Paso 4: maxValue = múltiplo de stepNice justo por encima del objetivo
  const maxValue  = Math.ceil(objetivo / stepNice) * stepNice;
  const stepValue = stepNice;

  return { maxValue, stepValue };
}

function variacion(actual, anterior) {
  if (anterior === 0) return null;
  const pct = ((actual - anterior) / anterior) * 100;
  return { pct: Math.abs(pct).toFixed(1), sube: pct >= 0 };
}

function fmtFecha(date) {
  return `${date.getDate()} ${MESES[date.getMonth()]}`;
}

function horaActual() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

/**
 * ReportsScreen — KPIs, gráfica, top productos y flujo de dinero del período.
 *
 * Datos BAJO DEMANDA: al entrar y al cambiar de período se consulta todo a
 * SQLite de una vez (queries/reports.js, incluye los dos modos de la
 * gráfica y los dos criterios del top). Tocar barras, cambiar de modo o de
 * criterio ya no calcula nada (antes: ~7 s por toque con "año").
 * Se refresca sola si cambian ventas, abonos o compras.
 */
export default class ReportsScreen extends Component {
  static contextType = StoreContext;

  state = {
    periodo: '7d', tooltipIdx: null, modoVentas: 'ingresoReal', ordenTop: 'unidades',
    datos: null,   // resultado de cargarReportes para el período actual
    error: null,
  };

  componentDidMount() {
    this.reportarRender();
    if (__DEV__) verificarZonaHoraria().catch(() => {});
    this.consulta = crearConsultaViva({
      tablas: ['ventas', 'venta_items', 'abonos', 'compras'],
      cargar: () => {
        const t0 = global.performance?.now?.() ?? Date.now();
        return cargarReportes(this.rangos()).then(datos => {
          if (__DEV__) console.log(`[rendimiento] Reportes (${this.state.periodo}): consulta ${Math.round((global.performance?.now?.() ?? Date.now()) - t0)} ms`);
          return datos;
        });
      },
      alCargar: datos => this.setState({ datos, error: null }),
      alFallar: error => this.setState({ error: error?.message ?? String(error) }),
    });
  }

  componentWillUnmount() {
    this.consulta?.detener();
  }

  cambiarPeriodo = periodo => {
    if (periodo === this.state.periodo) return;
    this.setState({ periodo, tooltipIdx: null, datos: null, error: null }, () => this.consulta?.recargar());
  };

  // Fechas del período actual (medianoches locales) para la consulta.
  rangos() {
    const inicio = this.inicioPeriodo(this.state.periodo);
    const dias = this.diasEnRango(inicio);
    const fin = new Date(); fin.setHours(23, 59, 59, 999);
    const inicioAnterior = new Date(inicio); inicioAnterior.setDate(inicioAnterior.getDate() - dias.length);
    const finAnterior = new Date(inicio.getTime() - 1);
    return {
      inicio: inicio.toISOString(), fin: fin.toISOString(),
      inicioAnterior: inicioAnterior.toISOString(), finAnterior: finAnterior.toISOString(),
    };
  }

  // ─── Fechas ────────────────────────────────────────────────────────────────

  inicioPeriodo(key) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    if (key === '7d')  { const d = new Date(hoy); d.setDate(d.getDate()-6); return d; }
    if (key === '30d') { const d = new Date(hoy); d.setDate(d.getDate()-29); return d; }
    if (key === 'año') { return new Date(hoy.getFullYear(), 0, 1); }
    return hoy;
  }

  diasEnRango(inicio) {
    const dias = [], fin = new Date(); fin.setHours(23,59,59,999);
    const c = new Date(inicio);
    while (c <= fin) { dias.push(new Date(c)); c.setDate(c.getDate()+1); }
    return dias;
  }

  // ─── Datos para las secciones (desde lo consultado, sin recorrer ventas) ──
  // Devuelven la MISMA forma que cuando se calculaban en memoria, así las
  // secciones de dibujo no cambian. Las fórmulas viven en queries/reports.js.

  getDatosGrafica() {
    const { datos, periodo, modoVentas: modo } = this.state;
    const inicio = this.inicioPeriodo(periodo);
    const dias   = this.diasEnRango(inicio);
    const buckets = armarBarras({ porDia: datos.porDia, dias, periodo, modo });

    const total     = buckets.reduce((s,b) => s+b.valor, 0);
    const maxValor  = Math.max(...buckets.map(b => b.valor), 1);
    const sinVentas = total === 0;
    const totalAnt  = datos.totalAnterior[modo];

    return {
      data: buckets.map(b => ({
        value:      Math.round(b.valor),  // altura de la barra
        valorExacto: b.valor,             // lo que muestra el tooltip (con centavos)
        label:      b.label,
        // Bug fix: se quitó topLabelComponent porque "$360.00" no cabía en
        // el ancho de la barra y gifted-charts lo partía en 2 líneas.
        // El tooltip al tocar muestra el valor exacto.
        frontColor: b.valor === maxValor && !sinVentas ? colors.success
                  : b.tieneVentas ? colors.primary
                  : colors.border,
      })),
      total, maxValor, sinVentas,
      desde: inicio, hasta: new Date(),
      totalAnt,
      variacion: variacion(total, totalAnt),
      agrupado: periodo === '30d' ? 'semana' : periodo === 'año' ? 'mes' : null,
    };
  }

  // Número de ventas y ticket promedio del período (contado + crédito).
  getVentasStats() {
    const { numVentas, ticketPromedio } = this.state.datos;
    return { numVentas, ticketPromedio };
  }

  // Top productos por unidades o por margen (solo con costo registrado).
  getTopProductos() {
    return ordenarTop(this.state.datos.top, this.state.ordenTop);
  }

  getFlujoDinero() {
    const f = this.state.datos.flujo;
    return {
      contado:          f.contado,
      creditoGenerado:  f.creditoGenerado,
      abonosRecibidos:  f.abonosRecibidos,
      pendienteGlobal:  f.pendienteGlobal,
      invertidoCompras: f.invertidoCompras,
      // Período anterior (misma duración): ¿se compra más o menos que antes?
      variacionCompras: variacion(f.invertidoCompras, f.invertidoComprasAnterior),
    };
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  renderCard(children, key) {
    return (
      <View key={key} style={{ ...tarjeta, padding: spacing.lg, marginBottom: spacing.lg }}>
        {children}
      </View>
    );
  }

  // Mini tarjeta de color del flujo de dinero: ícono + etiqueta, monto y explicación.
  // t = { Icono, label, sub, valor, color (tinta del título), bg (fondo suave) }
  renderMiniTarjeta(t, moneda) {
    const { Icono } = t;
    return (
      <View key={t.label} style={{ flex:1, backgroundColor:t.bg, borderRadius:radius.md, padding:spacing.md, marginHorizontal:spacing.xs/2 }}>
        <View style={{ flexDirection:'row', alignItems:'center', gap:spacing.xs }}>
          <Icono size={14} color={t.color} />
          <Text style={{ flex:1, fontSize:fontSize.small, fontWeight:'bold', color:t.color }} numberOfLines={1}>{t.label}</Text>
        </View>
        <Text style={{ fontSize:fontSize.itemTitle, fontWeight:'bold', color:colors.textPrimary, marginTop:spacing.xs }}>{fmt(moneda, t.valor)}</Text>
        <Text style={{ fontSize:fontSize.small, color:colors.textSecondary, marginTop:2 }} numberOfLines={2}>{t.sub}</Text>
      </View>
    );
  }

  renderTitulo(t) {
    return <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.md }}>{t}</Text>;
  }

  renderSelectorPeriodo() {
    return (
      <View style={{ flexDirection: 'row', marginBottom: spacing.lg }}>
        {PERIODOS.map(p => {
          const activo = this.state.periodo === p.key;
          return (
            <TouchableOpacity key={p.key} onPress={() => this.cambiarPeriodo(p.key)}
              style={{ flex:1, height:40, backgroundColor: activo?colors.primary:colors.chipInactive, borderRadius:radius.lg, marginHorizontal:spacing.xs, justifyContent:'center', alignItems:'center' }}>
              <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color: activo?colors.white:colors.textPrimary }}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ─── Sección 1: Gráfica ────────────────────────────────────────────────────

  renderGraficaVentas() {
    const moneda   = this.context.config?.moneda ?? '$';
    const datos    = this.getDatosGrafica();
    const esAnual  = this.state.periodo === 'año';
    const { tooltipIdx } = this.state;
    const CHART_HEIGHT = 220;

    const { maxValue, stepValue } = calcYAxis(datos.maxValor);

    const varComp = datos.variacion;
    const labAnt  = this.state.periodo==='7d' ? 'semana anterior' : this.state.periodo==='30d' ? 'mes anterior' : 'año anterior';

    // "Este año": ancho suficiente para 12 barras con scroll horizontal
    const chartWidthAnual = datos.data.length * (BAR_WIDTH_ANUAL + SPACING_ANUAL) + 64;

    const barChart = (
      <BarChart
        key={`barchart-${this.state.periodo}-${this.state.modoVentas}`}
        data={datos.data}
        width={esAnual ? chartWidthAnual : CHART_INNER_WIDTH}
        height={CHART_HEIGHT}
        barWidth={esAnual ? BAR_WIDTH_ANUAL : undefined}
        spacing={esAnual ? SPACING_ANUAL : undefined}
        barBorderRadius={4}
        noOfSections={4}
        stepValue={stepValue}
        maxValue={maxValue}
        yAxisThickness={0}
        xAxisThickness={1}
        xAxisColor={colors.border}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: fontSize.small }}
        yAxisLabelWidth={YAXIS_LABEL_WIDTH}
        yAxisLabelPrefix={moneda}
        roundToDigits={0}
        xAxisLabelTextStyle={{ color: colors.textSecondary, fontSize: fontSize.small }}
        rulesColor={colors.border}
        rulesType="solid"
        isAnimated
        animationDuration={400}
        initialSpacing={spacing.sm}
        onPress={(_item, idx) => this.setState(prev => ({ tooltipIdx: prev.tooltipIdx===idx ? null : idx }))}
      />
    );

    const modoVentas = this.state.modoVentas;

    return this.renderCard(
      <View>
        {/* Cabecera + toggle Ingreso real/Ventas totales */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
          <Text style={{ fontSize:fontSize.label, fontWeight:'bold', color:colors.textPrimary }}>
            {modoVentas === 'todas' ? 'Ventas totales' : 'Ingreso real'}
          </Text>
          <View style={{ flexDirection:'row', backgroundColor:colors.background, borderRadius:radius.lg, padding:2 }}>
            {[{ key:'ingresoReal', label:'Ingreso real' }, { key:'todas', label:'Ventas totales' }].map(o => {
              const activo = modoVentas === o.key;
              return (
                <TouchableOpacity key={o.key} onPress={() => this.setState({ modoVentas: o.key, tooltipIdx: null })}
                  style={{ paddingHorizontal:spacing.sm, paddingVertical:4, borderRadius:radius.lg, backgroundColor: activo?colors.primary:'transparent' }}>
                  <Text style={{ fontSize:fontSize.small, fontWeight:'bold', color: activo?colors.white:colors.textSecondary }}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <Text style={{ fontSize:fontSize.small, color:colors.textMuted, marginBottom:spacing.sm }}>
          {fmtFecha(datos.desde)} – {fmtFecha(datos.hasta)}{datos.agrupado ? ` · por ${datos.agrupado}` : ''}
          {modoVentas === 'ingresoReal' ? ' · contado + abonos, no incluye crédito pendiente de cobro' : ' · incluye crédito aunque no se haya cobrado'}
        </Text>

        {/* Total + comparativa */}
        <View style={{ flexDirection:'row', alignItems:'baseline', marginBottom:spacing.lg }}>
          <Text style={{ fontSize:28, fontWeight:'bold', color:colors.primary }}>{fmt(moneda, datos.total)}</Text>
          {varComp && (
            <View style={{ flexDirection:'row', alignItems:'center', marginLeft:spacing.sm, backgroundColor:varComp.sube?colors.successSoft:colors.dangerSoft, borderRadius:radius.sm, paddingHorizontal:spacing.sm, paddingVertical:2 }}>
              <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:varComp.sube?colors.successDark:colors.dangerDark }}>{varComp.sube?'▲':'▼'} {varComp.pct}%</Text>
              <Text style={{ fontSize:fontSize.small, color:colors.textMuted, marginLeft:spacing.xs }}>vs {labAnt}</Text>
            </View>
          )}
        </View>

        {/* Tooltip */}
        {tooltipIdx !== null && datos.data[tooltipIdx] && (
          <View style={{ backgroundColor:colors.textPrimary, borderRadius:radius.sm, paddingVertical:spacing.xs, paddingHorizontal:spacing.md, alignSelf:'center', marginBottom:spacing.sm }}>
            <Text style={{ fontSize:fontSize.caption, color:colors.white, fontWeight:'bold' }}>
              {datos.data[tooltipIdx].label} · {fmt(moneda, datos.data[tooltipIdx].valorExacto)}
            </Text>
          </View>
        )}

        {/* Gráfica o vacío */}
        {datos.sinVentas ? (
          <View style={{ height:CHART_HEIGHT, backgroundColor:colors.background, borderRadius:radius.sm, justifyContent:'center', alignItems:'center' }}>
            <IconInbox size={36} color={colors.textMuted} />
            <Text style={{ fontSize:fontSize.body, color:colors.textMuted, marginTop:spacing.sm, textAlign:'center' }}>Sin {modoVentas==='ingresoReal' ? 'ingresos' : 'ventas'}{'\n'}en este período</Text>
          </View>
        ) : esAnual ? (
          // Bug fix: scroll horizontal para que los 12 meses no se encimen
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: spacing.md }}>
            {barChart}
          </ScrollView>
        ) : (
          barChart
        )}

        {/* Leyenda */}
        {!datos.sinVentas && (
          <View style={{ flexDirection:'row', marginTop:spacing.md, gap:spacing.lg }}>
            {[{ color:colors.success, label:'Más alto' }, { color:colors.primary, label:modoVentas==='ingresoReal' ? 'Con ingreso' : 'Con ventas' }, { color:colors.border, label:modoVentas==='ingresoReal' ? 'Sin ingreso' : 'Sin ventas' }].map(l => (
              <View key={l.label} style={{ flexDirection:'row', alignItems:'center' }}>
                <View style={{ width:10, height:10, borderRadius:2, backgroundColor:l.color, marginRight:spacing.xs }} />
                <Text style={{ fontSize:fontSize.small, color:colors.textSecondary }}>{l.label}</Text>
              </View>
            ))}
          </View>
        )}
        {esAnual && !datos.sinVentas && (
          <Text style={{ fontSize:fontSize.small, color:colors.textMuted, marginTop:spacing.xs }}>← Desliza para ver todos los meses</Text>
        )}
      </View>,
      `grafica-${this.state.periodo}-${modoVentas}`,
    );
  }

  // ─── Sección 2: Top productos ──────────────────────────────────────────────

  renderTopProductos() {
    const moneda   = this.context.config?.moneda ?? '$';
    const criterio = this.state.ordenTop;
    const top      = this.getTopProductos();
    // "2.5 kg" a granel; "6 uds" en piezas
    const cantidadTop = item => (item.esGranel ? formatoCantidad(item.unidades, true, item.unidadGranel || 'kg') : `${formatoCantidad(item.unidades)} uds`);

    return this.renderCard(
      <View>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:spacing.md }}>
          <Text style={{ fontSize:fontSize.label, fontWeight:'bold', color:colors.textPrimary }}>Top productos</Text>
          <View style={{ flexDirection:'row', backgroundColor:colors.background, borderRadius:radius.lg, padding:2 }}>
            {[{ key:'unidades', label:'Más vendidos' }, { key:'margen', label:'Más rentables' }].map(o => {
              const activo = criterio === o.key;
              return (
                <TouchableOpacity key={o.key} onPress={() => this.setState({ ordenTop: o.key })}
                  style={{ paddingHorizontal:spacing.sm, paddingVertical:4, borderRadius:radius.lg, backgroundColor: activo?colors.primary:'transparent' }}>
                  <Text style={{ fontSize:fontSize.small, fontWeight:'bold', color: activo?colors.white:colors.textSecondary }}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {top.length === 0 ? (
          <View style={{ alignItems:'center', paddingVertical:spacing.xl }}>
            <IconPackage size={36} color={colors.textMuted} />
            <Text style={{ fontSize:fontSize.body, color:colors.textMuted, marginTop:spacing.sm, textAlign:'center' }}>
              {criterio === 'margen' ? 'Sin datos de costo registrados\nen las ventas de este período' : 'Sin ventas en este período'}
            </Text>
          </View>
        ) : top.map((item, idx) => (
          <View key={item.key} style={{ marginBottom: idx < top.length-1 ? spacing.lg : 0 }}>
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:spacing.xs }}>
              <View style={{ width:26, height:26, borderRadius:13, backgroundColor:COLORES_PUESTO[idx], justifyContent:'center', alignItems:'center', marginRight:spacing.sm }}>
                <Text style={{ color:colors.white, fontSize:fontSize.small, fontWeight:'bold' }}>{idx+1}</Text>
              </View>
              <View style={{ flex:1, flexDirection:'row', alignItems:'center', flexWrap:'wrap' }}>
                <Text style={{ fontSize:fontSize.body, fontWeight:'bold', color:colors.textPrimary, marginRight:spacing.xs }} numberOfLines={1}>{item.nombre}</Text>
                {!!item.tamano && (
                  <View style={{ backgroundColor:colors.chipInactive, borderRadius:6, paddingHorizontal:spacing.sm, paddingVertical:2, marginRight:spacing.xs }}>
                    <Text style={{ fontSize:fontSize.small, color:colors.textSecondary }}>{item.tamano}</Text>
                  </View>
                )}
                {/* La marca distingue productos iguales de marcas distintas */}
                {!!item.marca && (
                  <Text style={{ fontSize:fontSize.small, color:colors.textMuted, fontStyle:'italic' }} numberOfLines={1}>{item.marca}</Text>
                )}
              </View>
              <View style={{ alignItems:'flex-end', marginLeft:spacing.sm }}>
                <Text style={{ fontSize:fontSize.body, fontWeight:'bold', color:colors.textPrimary }}>
                  {criterio === 'margen' ? fmt(moneda, item.margen) : cantidadTop(item)}
                </Text>
                <Text style={{ fontSize:fontSize.small, color:colors.textSecondary }}>
                  {criterio === 'margen' ? cantidadTop(item) : fmt(moneda, item.monto)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <View style={{ flex:1, height:8, backgroundColor:colors.chipInactive, borderRadius:4, overflow:'hidden', marginRight:spacing.sm }}>
                <View style={{ height:8, width:`${Math.min(100,Math.round(item.porcentaje))}%`, backgroundColor:COLORES_PUESTO[idx], borderRadius:4 }} />
              </View>
              <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:TINTAS_PUESTO[idx], minWidth:36, textAlign:'right' }}>
                {item.porcentaje < 1 ? '<1' : Math.round(item.porcentaje)}%
              </Text>
            </View>
            {idx === 0 && (
              <Text style={{ fontSize:fontSize.small, color:colors.textMuted, marginTop:2 }}>
                {criterio === 'margen' ? '% del margen total generado en el período' : '% del total vendido (en dinero) en el período'}
              </Text>
            )}
          </View>
        ))}
      </View>,
    );
  }

  // ─── Sección 3: Flujo de dinero ────────────────────────────────────────────

  renderFlujoDinero() {
    const moneda = this.context.config?.moneda ?? '$';
    const { contado, creditoGenerado, abonosRecibidos, pendienteGlobal, invertidoCompras, variacionCompras } = this.getFlujoDinero();
    const ingresoReal  = contado + abonosRecibidos;
    const margenBruto  = ingresoReal - invertidoCompras;
    const hayCompras   = invertidoCompras > 0;
    const subCompras   = variacionCompras
      ? `${variacionCompras.sube ? '▲' : '▼'} ${variacionCompras.pct}% vs período anterior`
      : 'Compras a proveedores en el período';

    return this.renderCard(
      <View>
        {this.renderTitulo('Flujo de dinero')}

        {/* Ingreso real — protagonista */}
        <View style={{ backgroundColor:colors.successSoft, borderRadius:radius.md, padding:spacing.lg, marginBottom:spacing.lg, borderLeftWidth:4, borderLeftColor:colors.success }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:spacing.xs }}>
            <IconMoney size={14} color={colors.successDark} />
            <Text style={{ fontSize:fontSize.small, fontWeight:'bold', color:colors.successDark, letterSpacing:0.5 }}>INGRESO REAL</Text>
          </View>
          <Text style={{ fontSize:28, fontWeight:'bold', color:colors.successDark, marginTop:spacing.xs }}>{fmt(moneda, ingresoReal)}</Text>
          <Text style={{ fontSize:fontSize.caption, color:colors.textSecondary, marginTop:spacing.xs }}>Contado cobrado + abonos recibidos</Text>
        </View>

        {/* Dinero que entró */}
        <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:colors.textMuted, marginBottom:spacing.sm, letterSpacing:0.4 }}>DINERO QUE ENTRÓ</Text>
        <View style={{ flexDirection:'row', marginBottom:spacing.lg }}>
          {[
            { Icono:IconMoney,      label:'Contado cobrado',  sub:'Ventas pagadas al momento', valor:contado,          color:colors.primaryDark, bg:colors.primarySoft },
            { Icono:IconCreditCard, label:'Abonos recibidos', sub:'Pagos de deudas',           valor:abonosRecibidos,  color:colors.successDark, bg:colors.successSoft },
          ].map(t => this.renderMiniTarjeta(t, moneda))}
        </View>

        <View style={{ height:1, backgroundColor:colors.border, marginBottom:spacing.lg }} />

        {/* Dinero que se debe */}
        <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:colors.textMuted, marginBottom:spacing.sm, letterSpacing:0.4 }}>DINERO QUE SE DEBE</Text>
        <View style={{ flexDirection:'row' }}>
          {[
            { Icono:IconReceipt, label:'Crédito otorgado', sub:'Ventas a crédito en el período', valor:creditoGenerado,  color:colors.warningDark, bg:colors.warningSoft },
            { Icono:IconWarning, label:'Pendiente total',  sub:'Todas las deudas sin saldar',     valor:pendienteGlobal, color:colors.dangerDark,  bg:colors.dangerSoft },
          ].map(t => this.renderMiniTarjeta(t, moneda))}
        </View>

        {hayCompras && (
          <React.Fragment>
            <View style={{ height:1, backgroundColor:colors.border, marginTop:spacing.lg, marginBottom:spacing.lg }} />
            <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:colors.textMuted, marginBottom:spacing.sm, letterSpacing:0.4 }}>INVERSIÓN EN COMPRAS</Text>
            <View style={{ flexDirection:'row' }}>
              {[
                { Icono:IconShoppingBag, label:'Invertido en compras',  sub:subCompras,                              valor:invertidoCompras, color:colors.warningDark, bg:colors.warningSoft },
                { Icono:IconChart,       label:'Balance del período',    sub:'Cobrado − gastado en compras',         valor:margenBruto,      color: margenBruto >= 0 ? colors.successDark : colors.dangerDark, bg: margenBruto >= 0 ? colors.successSoft : colors.dangerSoft },
              ].map(t => this.renderMiniTarjeta(t, moneda))}
            </View>
          </React.Fragment>
        )}
      </View>,
    );
  }

  // ─── Sección 0: Resumen de KPIs ─────────────────────────────────────────────

  renderResumenKPIs() {
    const moneda = this.context.config?.moneda ?? '$';
    const { contado, abonosRecibidos, invertidoCompras } = this.getFlujoDinero();
    const ingresoReal = contado + abonosRecibidos;
    const margenBruto = ingresoReal - invertidoCompras;
    const { numVentas, ticketPromedio } = this.getVentasStats();

    const kpis = [
      { Icono:IconMoney,        label:'Ingreso real',    sub:'Dinero que ya cobraste',        valor: fmt(moneda, ingresoReal) },
      { Icono:IconReceipt,      label:'Venta promedio',  sub:'Monto promedio por venta',      valor: fmt(moneda, ticketPromedio) },
      { Icono:IconShoppingCart, label:'Ventas',          sub:'Número de ventas del período',  valor: `${numVentas}` },
      // No es "margen bruto" (precio − costo de lo vendido): es flujo de caja,
      // lo cobrado menos lo gastado en compras. Puede ser negativo si se compró
      // mercancía que aún no se vende. El margen real está en "Más rentables".
      { Icono:IconChart,        label:'Balance',         sub:'Cobrado − gastado en compras',  valor: fmt(moneda, margenBruto) },
    ];

    return (
      <View style={{ flexDirection:'row', flexWrap:'wrap', marginBottom:spacing.lg, gap:spacing.sm }}>
        {kpis.map(({ Icono, ...k }) => (
          <View key={k.label} style={{ flexBasis:'48%', flexGrow:1, ...tarjeta, padding:spacing.md }}>
            <View style={{ flexDirection:'row', alignItems:'center', gap:spacing.xs }}>
              <Icono size={14} color={colors.primaryDark} />
              <Text style={{ flex:1, fontSize:fontSize.small, color:colors.textMuted, fontWeight:'bold' }} numberOfLines={1}>{k.label}</Text>
            </View>
            <Text style={{ fontSize:fontSize.itemTitle, fontWeight:'bold', color:colors.textPrimary, marginTop:2 }}>{k.valor}</Text>
            <Text style={{ fontSize:fontSize.small, color:colors.textSecondary, marginTop:1 }} numberOfLines={1}>{k.sub}</Text>
          </View>
        ))}
      </View>
    );
  }

  // ─── Medición de rendimiento (solo desarrollo) ─────────────────────────────
  // Tiempo de cada dibujado (ya sin cálculos sobre ventas: vienen de SQLite).
  // El tiempo de la consulta se reporta aparte al cargar.

  componentDidUpdate() { this.reportarRender(); }
  reportarRender() {
    if (!__DEV__ || this.tRender == null || !this.state.datos) return;
    const ms = Math.round(global.performance.now() - this.tRender);
    console.log(`[rendimiento] Reportes (${this.state.periodo}): ${ms} ms por dibujado`);
    this.tRender = null;
  }

  // ─── Render principal ──────────────────────────────────────────────────────

  render() {
    if (__DEV__) this.tRender = global.performance.now();
    const { datos, error } = this.state;
    return (
      <View style={{ flex:1, backgroundColor:colors.background }}>
        <Header
          titulo="Reportes"
          subtitulo={`Actualizado ${horaActual()}`}
          onBack={() => this.props.navigation.goBack()}
        />

        <ScrollView contentContainerStyle={{ padding:spacing.lg, paddingBottom:spacing.xxl }} showsVerticalScrollIndicator={false}>
          {this.renderSelectorPeriodo()}
          {error ? (
            <Text style={{ fontSize:fontSize.body, color:colors.danger, textAlign:'center', marginTop:spacing.xl }}>
              No se pudieron calcular los reportes: {error}
            </Text>
          ) : !datos ? (
            <View style={{ alignItems:'center', marginTop:spacing.xxl }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ fontSize:fontSize.caption, color:colors.textMuted, marginTop:spacing.sm }}>Calculando…</Text>
            </View>
          ) : (
            <>
              {this.renderResumenKPIs()}
              {this.renderGraficaVentas()}
              {this.renderTopProductos()}
              {this.renderFlujoDinero()}
            </>
          )}
        </ScrollView>
      </View>
    );
  }
}
