import React, { Component } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize } from '../config/theme';
import { IconBack } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

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

const NOMBRES_DIA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const COLORES_PUESTO = [colors.success, colors.primary, colors.warning, colors.textSecondary, colors.textMuted];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt      = (moneda, v) => `${moneda}${v.toFixed(2)}`;

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

export default class ReportesView extends Component {
  static contextType = StoreContext;

  state = { periodo: '7d', tooltipIdx: null, modoVentas: 'ingresoReal', ordenTop: 'unidades' };

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

  // ─── Cálculos ──────────────────────────────────────────────────────────────

  // modo: 'ingresoReal' (contado cobrado + abonos recibidos, dinero que de
  // verdad entró) o 'todas' (valor de venta de contado + crédito, se haya
  // cobrado o no).
  totalVentasEnRango(ini, fin, modo) {
    const ventas = this.context.sales
      .filter(s => (modo === 'todas' || s.tipoPago !== 'Credito') && new Date(s.fecha).getTime() >= ini && new Date(s.fecha).getTime() <= fin)
      .reduce((sum, s) => sum + s.total, 0);
    if (modo === 'todas') return ventas;
    const abonos = (this.context.abonos ?? [])
      .filter(a => a.tipo === 'abono' && new Date(a.fecha).getTime() >= ini && new Date(a.fecha).getTime() <= fin)
      .reduce((sum, a) => sum + a.monto, 0);
    return ventas + abonos;
  }

  getDatosGrafica() {
    const { sales } = this.context;
    const inicio = this.inicioPeriodo(this.state.periodo);
    const dias   = this.diasEnRango(inicio);
    const modo   = this.state.modoVentas;

    const totalDelDia = dia => {
      const ini = new Date(dia).setHours(0,0,0,0);
      const fin = new Date(dia).setHours(23,59,59,999);
      return this.totalVentasEnRango(ini, fin, modo);
    };

    let buckets;
    if (this.state.periodo === '30d') {
      buckets = [];
      for (let i = 0; i < dias.length; i += 7) {
        const chunk = dias.slice(i, i+7);
        buckets.push({
          label: `Sem ${buckets.length+1}`,
          valor: chunk.reduce((s,d) => s + totalDelDia(d), 0),
          tieneVentas: chunk.some(d => totalDelDia(d) > 0),
        });
      }
    } else if (this.state.periodo === 'año') {
      buckets = MESES.map((_,idx) => {
        const valor = dias.filter(d => d.getMonth()===idx).reduce((s,d) => s+totalDelDia(d), 0);
        return { label: MESES[idx], valor, tieneVentas: valor > 0 };
      });
    } else {
      buckets = dias.map(dia => {
        const valor = totalDelDia(dia);
        return { label: NOMBRES_DIA[dia.getDay()], valor, tieneVentas: valor > 0 };
      });
    }

    const total     = buckets.reduce((s,b) => s+b.valor, 0);
    const maxValor  = Math.max(...buckets.map(b => b.valor), 1);
    const sinVentas = total === 0;

    // Período anterior para comparativa
    const largoDias   = dias.length;
    const iniAnt      = new Date(inicio); iniAnt.setDate(iniAnt.getDate()-largoDias);
    const finAnt      = new Date(inicio); finAnt.setMilliseconds(-1);
    const totalAnt    = this.totalVentasEnRango(iniAnt.getTime(), finAnt.getTime(), modo);

    return {
      data: buckets.map(b => ({
        value:      Math.round(b.valor),
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
      agrupado: this.state.periodo === '30d' ? 'semana' : this.state.periodo === 'año' ? 'mes' : null,
    };
  }

  // Ventas totales del período (contado + crédito): número de ventas y
  // ticket promedio, dos métricas básicas de retail que faltaban del todo.
  getVentasStats() {
    const { sales } = this.context;
    const inicioISO = this.inicioPeriodo(this.state.periodo).toISOString();
    const ventasPeriodo = sales.filter(s => s.fecha >= inicioISO);
    const numVentas = ventasPeriodo.length;
    const totalVentas = ventasPeriodo.reduce((s,v) => s+v.total, 0);
    return { numVentas, ticketPromedio: numVentas > 0 ? totalVentas / numVentas : 0 };
  }

  // Top productos: por unidades vendidas (todas las ventas) o por margen
  // generado (solo productos con precioCompra registrado en la venta —
  // ventas viejas o productos sin costo capturado no entran en ese conteo).
  getTopProductos() {
    const { sales } = this.context;
    const inicio = this.inicioPeriodo(this.state.periodo);
    const mapa = {};
    let totalUnidades = 0;
    let totalMargen = 0;

    sales.filter(s => new Date(s.fecha) >= inicio).forEach(s => {
      (s.productos || []).forEach(p => {
        const key = `${p.nombre} ${p.tamano}`;
        const prev = mapa[key] || { nombre: p.nombre, tamano: p.tamano, unidades: 0, monto: 0, margen: 0, tieneCosto: false };
        const u = p.numProducts || 1;
        const tieneCosto = p.precioCompra != null;
        const margenLinea = tieneCosto ? (p.precio - p.precioCompra) * u : 0;
        mapa[key] = {
          nombre: p.nombre, tamano: p.tamano,
          unidades: prev.unidades + u,
          monto: prev.monto + u * (p.precio || 0),
          margen: prev.margen + margenLinea,
          tieneCosto: prev.tieneCosto || tieneCosto,
        };
        totalUnidades += u;
        if (tieneCosto) totalMargen += margenLinea;
      });
    });

    const criterio = this.state.ordenTop; // 'unidades' | 'margen'
    const lista = Object.values(mapa);
    const base = criterio === 'margen' ? lista.filter(p => p.tieneCosto) : lista;

    return [...base]
      .sort((a,b) => criterio === 'margen' ? b.margen - a.margen : b.unidades - a.unidades)
      .slice(0, 5)
      .map(p => ({
        ...p,
        porcentaje: criterio === 'margen'
          ? (totalMargen > 0 ? (p.margen/totalMargen)*100 : 0)
          : (totalUnidades > 0 ? (p.unidades/totalUnidades)*100 : 0),
      }));
  }

  getFlujoDinero() {
    const { sales, abonos, compras } = this.context;
    const inicio    = this.inicioPeriodo(this.state.periodo);
    const inicioISO = inicio.toISOString();
    const vp        = sales.filter(s => s.fecha >= inicioISO);
    const cp        = (compras ?? []).filter(c => c.fecha >= inicioISO);
    const invertidoCompras = cp.reduce((s,c) => s+c.total, 0);

    // Período anterior (misma duración) para saber si se está comprando
    // más o menos que antes — mismo criterio que usa la gráfica de ventas.
    const largoDias = this.diasEnRango(inicio).length;
    const iniAnt = new Date(inicio); iniAnt.setDate(iniAnt.getDate()-largoDias);
    const finAntISO = new Date(new Date(inicio).getTime()-1).toISOString();
    const invertidoComprasAnt = (compras ?? [])
      .filter(c => c.fecha >= iniAnt.toISOString() && c.fecha <= finAntISO)
      .reduce((s,c) => s+c.total, 0);

    return {
      contado:          vp.filter(s => s.tipoPago !== 'Credito').reduce((s,v) => s+v.total, 0),
      creditoGenerado:  vp.filter(s => s.tipoPago === 'Credito').reduce((s,v) => s+v.total, 0),
      abonosRecibidos:  (abonos??[]).filter(a => a.tipo==='abono' && a.fecha>=inicioISO).reduce((s,a) => s+a.monto, 0),
      pendienteGlobal:  sales.filter(s => s.tipoPago==='Credito').reduce((s,v) => s+Math.max(0,v.total-(v.totalAbonado??0)-(v.condonado??0)), 0),
      invertidoCompras,
      variacionCompras: variacion(invertidoCompras, invertidoComprasAnt),
    };
  }

  // ─── Render helpers ────────────────────────────────────────────────────────

  renderCard(children, key) {
    return (
      <View key={key} style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.lg, elevation: 3, shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width:0, height:2 } }}>
        {children}
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
            <TouchableOpacity key={p.key} onPress={() => this.setState({ periodo: p.key, tooltipIdx: null })}
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
            <View style={{ flexDirection:'row', alignItems:'center', marginLeft:spacing.sm, backgroundColor:varComp.sube?'#edfaf3':'#fdf0f0', borderRadius:radius.sm, paddingHorizontal:spacing.sm, paddingVertical:2 }}>
              <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:varComp.sube?colors.success:colors.danger }}>{varComp.sube?'▲':'▼'} {varComp.pct}%</Text>
              <Text style={{ fontSize:fontSize.small, color:colors.textMuted, marginLeft:spacing.xs }}>vs {labAnt}</Text>
            </View>
          )}
        </View>

        {/* Tooltip */}
        {tooltipIdx !== null && datos.data[tooltipIdx] && (
          <View style={{ backgroundColor:colors.textPrimary, borderRadius:radius.sm, paddingVertical:spacing.xs, paddingHorizontal:spacing.md, alignSelf:'center', marginBottom:spacing.sm }}>
            <Text style={{ fontSize:fontSize.caption, color:colors.white, fontWeight:'bold' }}>
              {datos.data[tooltipIdx].label} · {fmt(moneda, datos.data[tooltipIdx].value)}
            </Text>
          </View>
        )}

        {/* Gráfica o vacío */}
        {datos.sinVentas ? (
          <View style={{ height:CHART_HEIGHT, backgroundColor:colors.background, borderRadius:radius.sm, justifyContent:'center', alignItems:'center' }}>
            <Text style={{ fontSize:36 }}>📭</Text>
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
            <Text style={{ fontSize:36 }}>📦</Text>
            <Text style={{ fontSize:fontSize.body, color:colors.textMuted, marginTop:spacing.sm, textAlign:'center' }}>
              {criterio === 'margen' ? 'Sin datos de costo registrados\nen las ventas de este período' : 'Sin ventas en este período'}
            </Text>
          </View>
        ) : top.map((item, idx) => (
          <View key={`${item.nombre}${item.tamano}`} style={{ marginBottom: idx < top.length-1 ? spacing.lg : 0 }}>
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:spacing.xs }}>
              <View style={{ width:26, height:26, borderRadius:13, backgroundColor:COLORES_PUESTO[idx], justifyContent:'center', alignItems:'center', marginRight:spacing.sm }}>
                <Text style={{ color:colors.white, fontSize:fontSize.small, fontWeight:'bold' }}>{idx+1}</Text>
              </View>
              <View style={{ flex:1, flexDirection:'row', alignItems:'center', flexWrap:'wrap' }}>
                <Text style={{ fontSize:fontSize.body, fontWeight:'bold', color:colors.textPrimary, marginRight:spacing.xs }} numberOfLines={1}>{item.nombre}</Text>
                {!!item.tamano && (
                  <View style={{ backgroundColor:colors.chipInactive, borderRadius:6, paddingHorizontal:spacing.sm, paddingVertical:2 }}>
                    <Text style={{ fontSize:fontSize.small, color:colors.textSecondary }}>{item.tamano}</Text>
                  </View>
                )}
              </View>
              <View style={{ alignItems:'flex-end', marginLeft:spacing.sm }}>
                <Text style={{ fontSize:fontSize.body, fontWeight:'bold', color:colors.textPrimary }}>
                  {criterio === 'margen' ? fmt(moneda, item.margen) : `${item.unidades} uds`}
                </Text>
                <Text style={{ fontSize:fontSize.small, color:colors.textSecondary }}>
                  {criterio === 'margen' ? `${item.unidades} uds` : fmt(moneda, item.monto)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <View style={{ flex:1, height:8, backgroundColor:colors.chipInactive, borderRadius:4, overflow:'hidden', marginRight:spacing.sm }}>
                <View style={{ height:8, width:`${Math.min(100,Math.round(item.porcentaje))}%`, backgroundColor:COLORES_PUESTO[idx], borderRadius:4 }} />
              </View>
              <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:COLORES_PUESTO[idx], minWidth:36, textAlign:'right' }}>
                {item.porcentaje < 1 ? '<1' : Math.round(item.porcentaje)}%
              </Text>
            </View>
            {idx === 0 && (
              <Text style={{ fontSize:fontSize.small, color:colors.textMuted, marginTop:2 }}>
                {criterio === 'margen' ? '% del margen total generado en el período' : '% del total de unidades vendidas en el período'}
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
        <View style={{ backgroundColor:'#edfaf3', borderRadius:radius.md, padding:spacing.lg, marginBottom:spacing.lg, borderLeftWidth:4, borderLeftColor:colors.success }}>
          <Text style={{ fontSize:fontSize.small, fontWeight:'bold', color:colors.success, letterSpacing:0.5 }}>💰 INGRESO REAL</Text>
          <Text style={{ fontSize:28, fontWeight:'bold', color:colors.success, marginTop:spacing.xs }}>{fmt(moneda, ingresoReal)}</Text>
          <Text style={{ fontSize:fontSize.caption, color:colors.textSecondary, marginTop:spacing.xs }}>Contado cobrado + abonos recibidos</Text>
        </View>

        {/* Dinero que entró */}
        <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:colors.textMuted, marginBottom:spacing.sm, letterSpacing:0.4 }}>DINERO QUE ENTRÓ</Text>
        <View style={{ flexDirection:'row', marginBottom:spacing.lg }}>
          {[
            { icono:'💵', label:'Contado cobrado',  sub:'Ventas pagadas al momento', valor:contado,          color:colors.primary, bg:'#e8f4ff' },
            { icono:'🤝', label:'Abonos recibidos', sub:'Pagos de deudas',           valor:abonosRecibidos,  color:colors.success, bg:'#edfaf3' },
          ].map(t => (
            <View key={t.label} style={{ flex:1, backgroundColor:t.bg, borderRadius:radius.md, padding:spacing.md, marginHorizontal:spacing.xs/2 }}>
              <Text style={{ fontSize:fontSize.small, fontWeight:'bold', color:t.color }} numberOfLines={1}>{t.icono} {t.label}</Text>
              <Text style={{ fontSize:fontSize.itemTitle, fontWeight:'bold', color:colors.textPrimary, marginTop:spacing.xs }}>{fmt(moneda, t.valor)}</Text>
              <Text style={{ fontSize:fontSize.small, color:colors.textSecondary, marginTop:2 }} numberOfLines={2}>{t.sub}</Text>
            </View>
          ))}
        </View>

        <View style={{ height:1, backgroundColor:colors.border, marginBottom:spacing.lg }} />

        {/* Dinero que se debe */}
        <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:colors.textMuted, marginBottom:spacing.sm, letterSpacing:0.4 }}>DINERO QUE SE DEBE</Text>
        <View style={{ flexDirection:'row' }}>
          {[
            { icono:'🧾', label:'Crédito otorgado', sub:'Ventas a crédito en el período', valor:creditoGenerado,  color:colors.warning, bg:'#fff8ed' },
            { icono:'⚠️', label:'Pendiente total',  sub:'Todas las deudas sin saldar',     valor:pendienteGlobal, color:colors.danger,  bg:'#fdf0f0' },
          ].map(t => (
            <View key={t.label} style={{ flex:1, backgroundColor:t.bg, borderRadius:radius.md, padding:spacing.md, marginHorizontal:spacing.xs/2 }}>
              <Text style={{ fontSize:fontSize.small, fontWeight:'bold', color:t.color }} numberOfLines={1}>{t.icono} {t.label}</Text>
              <Text style={{ fontSize:fontSize.itemTitle, fontWeight:'bold', color:colors.textPrimary, marginTop:spacing.xs }}>{fmt(moneda, t.valor)}</Text>
              <Text style={{ fontSize:fontSize.small, color:colors.textSecondary, marginTop:2 }} numberOfLines={2}>{t.sub}</Text>
            </View>
          ))}
        </View>

        {hayCompras && (
          <React.Fragment>
            <View style={{ height:1, backgroundColor:colors.border, marginTop:spacing.lg, marginBottom:spacing.lg }} />
            <Text style={{ fontSize:fontSize.caption, fontWeight:'bold', color:colors.textMuted, marginBottom:spacing.sm, letterSpacing:0.4 }}>INVERSIÓN EN COMPRAS</Text>
            <View style={{ flexDirection:'row' }}>
              {[
                { icono:'🛍️', label:'Invertido en compras',  sub:subCompras,                              valor:invertidoCompras, color:colors.warning, bg:'#fff8ed' },
                { icono:'📊', label:'Margen bruto estimado',  sub:'Ingreso real − inversión en compras',  valor:margenBruto,      color: margenBruto >= 0 ? colors.success : colors.danger, bg: margenBruto >= 0 ? '#edfaf3' : '#fdf0f0' },
              ].map(t => (
                <View key={t.label} style={{ flex:1, backgroundColor:t.bg, borderRadius:radius.md, padding:spacing.md, marginHorizontal:spacing.xs/2 }}>
                  <Text style={{ fontSize:fontSize.small, fontWeight:'bold', color:t.color }} numberOfLines={1}>{t.icono} {t.label}</Text>
                  <Text style={{ fontSize:fontSize.itemTitle, fontWeight:'bold', color:colors.textPrimary, marginTop:spacing.xs }}>{fmt(moneda, t.valor)}</Text>
                  <Text style={{ fontSize:fontSize.small, color:colors.textSecondary, marginTop:2 }} numberOfLines={2}>{t.sub}</Text>
                </View>
              ))}
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
      { icono:'💰', label:'Ingreso real',    sub:'Dinero que ya cobraste',        valor: fmt(moneda, ingresoReal) },
      { icono:'🧾', label:'Venta promedio',  sub:'Lo que deja cada venta',        valor: fmt(moneda, ticketPromedio) },
      { icono:'🛒', label:'Ventas',          sub:'Número de ventas del período',  valor: `${numVentas}` },
      { icono:'📊', label:'Margen bruto',    sub:'Ingreso real − compras',        valor: fmt(moneda, margenBruto) },
    ];

    return (
      <View style={{ flexDirection:'row', flexWrap:'wrap', marginBottom:spacing.lg, gap:spacing.sm }}>
        {kpis.map(k => (
          <View key={k.label} style={{ flexBasis:'48%', flexGrow:1, backgroundColor:colors.card, borderRadius:radius.md, padding:spacing.md, elevation:2, shadowOpacity:0.06, shadowOffset:{ width:0, height:1 } }}>
            <Text style={{ fontSize:fontSize.small, color:colors.textMuted, fontWeight:'bold' }} numberOfLines={1}>{k.icono} {k.label}</Text>
            <Text style={{ fontSize:fontSize.itemTitle, fontWeight:'bold', color:colors.textPrimary, marginTop:2 }}>{k.valor}</Text>
            <Text style={{ fontSize:fontSize.small, color:colors.textSecondary, marginTop:1 }} numberOfLines={1}>{k.sub}</Text>
          </View>
        ))}
      </View>
    );
  }

  // ─── Render principal ──────────────────────────────────────────────────────

  render() {
    return (
      <SafeAreaView style={{ flex:1, backgroundColor:colors.background }}>
        <View style={{ width:_window.width, height:GREEN_BAR_HEIGHT, backgroundColor:'green' }} />

        <View style={{ height:60, paddingHorizontal:spacing.lg, flexDirection:'row', alignItems:'center', backgroundColor:colors.card, elevation:4, shadowOpacity:0.1, shadowOffset:{ width:0, height:2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width:44, height:44, justifyContent:'center', alignItems:'center', marginRight:spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize:fontSize.heading, fontWeight:'bold', color:colors.textPrimary, flex:1 }}>Reportes</Text>
          <Text style={{ fontSize:fontSize.small, color:colors.textMuted }}>Actualizado {horaActual()}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding:spacing.lg, paddingBottom:spacing.xxl }} showsVerticalScrollIndicator={false}>
          {this.renderSelectorPeriodo()}
          {this.renderResumenKPIs()}
          {this.renderGraficaVentas()}
          {this.renderTopProductos()}
          {this.renderFlujoDinero()}
        </ScrollView>
      </SafeAreaView>
    );
  }
}
