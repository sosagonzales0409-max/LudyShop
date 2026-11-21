import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { cargarVentasPagina } from '../data/repositories/ventas';
import { resumenPeriodo } from '../data/consultas/historial';
import { crearConsultaViva } from '../data/consultaViva';
import EndOfDayModal from '../modals/EndOfDayModal';
import ReturnModal from '../modals/ReturnModal';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { formatoDinero, nombreProducto } from '../config/formato';
import { IconReceipt, IconTrendingUp, IconTrash, IconCornerUp, IconChevronUp, IconChevronDown, IconInbox } from '../ui/Icon';
import Header from '../ui/Header';
import { ChipEstado, EstadoVacio, AvisoPrimeraVez, Resaltar } from '../ui/StatusViews';

const TIPOS_PAGO = ['Todos', 'Contado', 'Credito'];
const PERIODOS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes',    label: 'Mes' },
  { key: 'todo',   label: 'Todo' },
];

// Ventas por página (se piden más al llegar al final de la lista).
const PAGINA = 30;

/**
 * SalesHistoryScreen — ventas del período con filtros y resumen.
 *
 * Datos BAJO DEMANDA: la lista se consulta por páginas y el resumen lo
 * calcula SQLite (antes se filtraban todas las ventas en memoria en cada
 * dibujado). Se refresca sola cuando cambian ventas, sus ítems, abonos o
 * clientes (p. ej. al eliminar una venta o registrar una devolución aquí).
 */
export default class SalesHistoryScreen extends Component {
  static contextType = StoreContext;

  state = {
    pago: 'Todos',
    periodo: 'hoy',
    expandidoId: null,
    showCorteModal: false,
    showDevolucionModal: false,
    ventaDevolucion: null,
    // Datos consultados
    ventas: [],
    resumen: null,     // { contado, credito, pendiente, numVentas, abonos }
    cargando: true,
    cargandoMas: false,
    hayMas: true,
    error: null,
  };

  // Cambia en cada recarga desde arriba: una página que llegue tarde de una
  // carga anterior se descarta.
  versionLista = 0;

  componentDidMount() {
    this.reportarRender();
    this.consulta = crearConsultaViva({
      tablas: ['ventas', 'venta_items', 'abonos', 'clientes'],
      cargar: this.cargarDesdeArriba,
      alCargar: ({ ventas, resumen }) => this.setState({
        ventas, resumen, cargando: false, error: null,
        hayMas: ventas.length < resumen.numVentas,
      }),
      alFallar: error => this.setState({ error: error?.message ?? String(error), cargando: false }),
    });
  }

  componentWillUnmount() {
    this.consulta?.detener();
  }

  filtroActual() {
    const inicio = this.inicioPeriodo(this.state.periodo);
    return { desde: inicio ? inicio.toISOString() : null, tipoPago: this.state.pago === 'Todos' ? null : this.state.pago };
  }

  // Primera página (o la misma cantidad ya cargada, para que un refresco no
  // "encoja" la lista mientras se lee) + resumen del período.
  cargarDesdeArriba = async () => {
    this.versionLista++;
    const filtro = this.filtroActual();
    const limite = Math.max(PAGINA, this.state.ventas.length);
    const [ventas, resumen] = await Promise.all([
      cargarVentasPagina({ ...filtro, limite }),
      resumenPeriodo(filtro),
    ]);
    return { ventas, resumen };
  };

  cargarMas = async () => {
    const { ventas, hayMas, cargandoMas, cargando } = this.state;
    if (!hayMas || cargandoMas || cargando || !ventas.length) return;
    const version = this.versionLista;
    this.setState({ cargandoMas: true });
    try {
      const ultima = ventas[ventas.length - 1];
      const pagina = await cargarVentasPagina({ ...this.filtroActual(), limite: PAGINA, antesDe: { fecha: ultima.fecha, id: ultima.id } });
      if (version !== this.versionLista) return; // la lista se recargó mientras tanto
      this.setState(prev => ({
        ventas: [...prev.ventas, ...pagina],
        hayMas: pagina.length === PAGINA && prev.ventas.length + pagina.length < (prev.resumen?.numVentas ?? 0),
      }));
    } catch (error) {
      console.error('HistorialView.cargarMas', error);
    } finally {
      this.setState({ cargandoMas: false });
    }
  };

  cambiarFiltro = cambios => {
    this.setState({ ...cambios, ventas: [], cargando: true, hayMas: true, expandidoId: null }, () => this.consulta?.recargar());
  };

  inicioPeriodo(key) {
    const hoy = new Date();
    if (key === 'hoy')    { hoy.setHours(0, 0, 0, 0); return hoy; }
    if (key === 'semana') {
      const dia = hoy.getDay();
      const diff = dia === 0 ? -6 : 1 - dia;
      const lunes = new Date(hoy);
      lunes.setDate(hoy.getDate() + diff);
      lunes.setHours(0, 0, 0, 0);
      return lunes;
    }
    if (key === 'mes') return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    return null;
  }

  formatFecha(iso) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  formatHora(iso) {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  pendienteDe(venta) {
    return Math.max(0, venta.total - (venta.totalAbonado ?? 0) - (venta.condonado ?? 0));
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────

  confirmarEliminar(venta) {
    const moneda = this.context.config?.moneda ?? '$';
    const esCredito = venta.tipoPago === 'Credito';
    const abonado = venta.totalAbonado ?? 0;
    const advertencia = abonado > 0.009
      ? `\n\n⚠️ Esta venta ya tiene ${formatoDinero(abonado, moneda)} abonados. Al eliminarla, ese registro de pago también desaparece del historial.`
      : '';
    Alert.alert(
      'Eliminar venta',
      `¿Seguro que quieres eliminar esta venta de ${formatoDinero(venta.total, moneda)} del ${this.formatFecha(venta.fecha)}?${advertencia}\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: esCredito ? 'Eliminar (no devolver stock)' : 'Eliminar sin devolver mercancía',
          onPress: () => this.context.eliminarVenta(venta.id, false),
        },
        {
          text: 'Eliminar y devolver al inventario',
          style: 'destructive',
          onPress: () => this.eliminarVentaYAvisarSiFalta(venta),
        },
      ],
    );
  }

  // Elimina la venta y, si algún producto ya no existe en el inventario,
  // avisa que ese stock no se pudo devolver (en vez de fallar en silencio).
  // eliminarVenta es asíncrona: lee la venta de la BD dentro de su transacción.
  async eliminarVentaYAvisarSiFalta(venta) {
    const resultado = await this.context.eliminarVenta(venta.id, true);
    if (resultado?.itemsNoEncontrados?.length > 0) {
      const detalle = resultado.itemsNoEncontrados.map(i => `• ${nombreProducto(i.nombre, i.tamano)}`).join('\n');
      Alert.alert(
        'Stock no devuelto para algunos productos',
        `Estos productos ya no existen en el inventario, así que su stock no se pudo devolver:\n\n${detalle}`,
      );
    }
  }

  // ─── Chips de filtro ──────────────────────────────────────────────────────

  renderChips(opciones, valor, onSelect) {
    return (
      <View style={{ flexDirection: 'row' }}>
        {opciones.map(op => {
          const key   = typeof op === 'object' ? op.key   : op;
          const label = typeof op === 'object' ? op.label : op;
          const activo = valor === key;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => onSelect(key)}
              style={{
                flex: 1, height: buttonHeight.chip,
                backgroundColor: activo ? colors.primary : colors.chipInactive,
                borderRadius: radius.lg, marginHorizontal: spacing.xs,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: activo ? colors.white : colors.textPrimary }}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // ─── Tarjeta de venta ─────────────────────────────────────────────────────

  renderVenta({ item: venta }) {
    const moneda = this.context.config?.moneda ?? '$';
    const expandido  = this.state.expandidoId === venta.id;
    const pendiente  = this.pendienteDe(venta);
    const esCredito  = venta.tipoPago === 'Credito';

    return (
      <View
        style={{
          ...tarjeta,
          marginHorizontal: spacing.lg, marginBottom: spacing.sm,
        }}
      >
        {/* Fila principal — toca para expandir */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => this.setState({ expandidoId: expandido ? null : venta.id })}
          style={{ padding: spacing.lg }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                {this.formatFecha(venta.fecha)}
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, fontWeight: 'normal' }}>
                  {' '}{this.formatHora(venta.fecha)}
                </Text>
              </Text>
              <View style={{ alignSelf: 'flex-start', marginTop: spacing.xs }}>
                <ChipEstado tono={esCredito ? 'warn' : 'ok'} texto={esCredito ? 'Crédito' : 'Contado'} />
              </View>
            </View>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              {formatoDinero(venta.total, moneda)}
            </Text>
            <View style={{ marginLeft: spacing.sm }}>
              {expandido
                ? <IconChevronUp size={fontSize.itemTitle} color={colors.placeholder} />
                : <IconChevronDown size={fontSize.itemTitle} color={colors.placeholder} />}
            </View>
          </View>
        </TouchableOpacity>

        {/* Detalle expandible */}
        {expandido && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>

            {/* Productos */}
            {Array.isArray(venta.productos) && venta.productos.length > 0 ? (
              <View style={{ paddingTop: spacing.md }}>
                {venta.productos.map((p, i) => (
                  <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, flex: 1 }}>
                      {p.numProducts} × {p.nombre} {p.tamano}
                    </Text>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textPrimary, fontWeight: 'bold' }}>
                      {formatoDinero(p.precio * p.numProducts, moneda)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, paddingTop: spacing.md }}>
                Sin productos registrados
              </Text>
            )}

            {/* Info crédito */}
            {esCredito && (
              <View style={{ marginTop: spacing.sm }}>
                {venta.cliente && (
                  <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
                    Cliente: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{venta.cliente}</Text>
                  </Text>
                )}
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 }}>
                  Abonado: {formatoDinero(venta.totalAbonado ?? 0, moneda)} · Pendiente:{' '}
                  <Text style={{ fontWeight: 'bold', color: pendiente > 0.009 ? colors.danger : colors.success }}>
                    {formatoDinero(pendiente, moneda)}
                  </Text>
                </Text>
                {(venta.condonado ?? 0) > 0.009 && (
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 }}>
                    Condonado: {formatoDinero(venta.condonado ?? 0, moneda)}
                  </Text>
                )}
              </View>
            )}

            {/* Acciones */}
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              {/* Devolución — disponible para cualquier tipo de venta */}
              <TouchableOpacity
                onPress={() => this.setState({ showDevolucionModal: true, ventaDevolucion: venta })}
                style={{
                  flex: 1, height: buttonHeight.chip,
                  backgroundColor: colors.chipInactive,
                  borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                  flexDirection: 'row', gap: spacing.xs,
                }}
              >
                <IconCornerUp size={fontSize.label} color={colors.textPrimary} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>
                  Devolución
                </Text>
              </TouchableOpacity>

              {/* Eliminar venta */}
              <TouchableOpacity
                onPress={() => this.confirmarEliminar(venta)}
                style={{
                  height: buttonHeight.chip,
                  paddingHorizontal: spacing.lg,
                  backgroundColor: colors.dangerSoft,
                  borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                  flexDirection: 'row', gap: spacing.xs,
                }}
              >
                <IconTrash size={fontSize.body} color={colors.dangerDark} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.dangerDark }}>
                  Eliminar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  }

  // ─── Header de la FlatList ────────────────────────────────────────────────

  renderListHeader = () => {
    const moneda = this.context.config?.moneda ?? '$';
    // Totales calculados en SQLite (consultas/historial.js). "POR COBRAR" es
    // lo que falta cobrar de las ventas a crédito de ESTE período (antes se
    // mostraba el crédito otorgado con esa etiqueta, que no es lo mismo).
    const r = this.state.resumen;
    const totalContado   = r?.contado ?? 0;
    const totalCredito   = r?.credito ?? 0;
    const totalPendiente = r?.pendiente ?? 0;
    const totalAbonos    = r?.abonos ?? 0;
    const totalIngresos  = totalContado + totalAbonos;

    return (
      <View>
        <AvisoPrimeraVez
          clave="pista_historial"
          titulo="Tus ventas y el corte"
          texto={<>Toca <Resaltar>Corte</Resaltar> arriba para ver cuánto entró hoy. Con el ícono de gráfica ves tus reportes.</>}
          style={{ marginHorizontal: spacing.lg }}
        />
        {/* Filtros */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.sm }}>Tipo de pago</Text>
          {this.renderChips(TIPOS_PAGO, this.state.pago, op => op !== this.state.pago && this.cambiarFiltro({ pago: op }))}
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm }}>Período</Text>
          {this.renderChips(PERIODOS, this.state.periodo, op => op !== this.state.periodo && this.cambiarFiltro({ periodo: op }))}
        </View>

        {this.state.error && (
          <Text style={{ fontSize: fontSize.body, color: colors.danger, textAlign: 'center', marginHorizontal: spacing.lg, marginBottom: spacing.md }}>
            No se pudo cargar el historial: {this.state.error}
          </Text>
        )}

        {/* Resumen del período */}
        <View style={{ ...tarjeta, marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center' }}>INGRESOS DEL PERÍODO (contado + abonos)</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.success, textAlign: 'center', marginVertical: spacing.xs }}>{formatoDinero(totalIngresos, moneda)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Contado</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>{formatoDinero(totalContado, moneda)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Abonos recibidos</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.success }}>{formatoDinero(totalAbonos, moneda)}</Text>
          </View>
          {totalCredito > 0.009 && (
            <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm }}>
                <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Vendido a crédito</Text>
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>{formatoDinero(totalCredito, moneda)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing.xs }}>
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>POR COBRAR (de esas ventas)</Text>
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.warningDark }}>{formatoDinero(totalPendiente, moneda)}</Text>
              </View>
            </>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Ventas</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>{r?.numVentas ?? 0}</Text>
          </View>
        </View>
      </View>
    );
  };

  renderPie = () => {
    const { cargandoMas, hayMas, ventas } = this.state;
    if (cargandoMas) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />;
    if (!hayMas && ventas.length > PAGINA) {
      return <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg }}>Fin del período</Text>;
    }
    return null;
  };

  // ─── Medición de rendimiento (solo desarrollo) ────────────────────────────
  // Tiempo de cada dibujado (ya sin cálculos: los totales vienen de SQLite).

  componentDidUpdate() { this.reportarRender(); }
  reportarRender() {
    if (!__DEV__ || this.tRender == null) return;
    const ms = Math.round(global.performance.now() - this.tRender);
    console.log(`[rendimiento] Historial (${this.state.periodo}/${this.state.pago}, ${this.state.ventas.length} ventas cargadas de ${this.state.resumen?.numVentas ?? '?'}): ${ms} ms por dibujado`);
    this.tRender = null;
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  render() {
    if (__DEV__) this.tRender = global.performance.now();
    const moneda = this.context.config?.moneda ?? '$';
    const { ventas, cargando } = this.state;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        <EndOfDayModal
          visible={this.state.showCorteModal}
          onCancel={() => this.setState({ showCorteModal: false })}
        />

        <ReturnModal
          visible={this.state.showDevolucionModal}
          venta={this.state.ventaDevolucion}
          onCancel={() => this.setState({ showDevolucionModal: false, ventaDevolucion: null })}
          onConfirmar={async ({ items, devolverStock }) => {
            // El modal se cierra al momento; los avisos llegan cuando la
            // devolución (asíncrona) termina de guardarse.
            const ventaId = this.state.ventaDevolucion.id;
            this.setState({ showDevolucionModal: false, ventaDevolucion: null });
            const resultado = await this.context.registrarDevolucion(ventaId, items, devolverStock);
            if (resultado?.excedente > 0.009) {
              Alert.alert(
                'Hay que devolver dinero',
                `El cliente ya había pagado ${formatoDinero(resultado.excedente, moneda)} más de lo que ahora debe por esta venta. Recuerda devolvérselo en efectivo — la app todavía no lleva notas de crédito.`,
              );
            }
            if (resultado?.itemsNoEncontrados?.length > 0) {
              const detalle = resultado.itemsNoEncontrados.map(i => `• ${nombreProducto(i.nombre, i.tamano)}`).join('\n');
              Alert.alert(
                'Stock no devuelto para algunos productos',
                `Estos productos ya no existen en el inventario, así que su stock no se pudo devolver:\n\n${detalle}`,
              );
            }
          }}
        />

        {/* Encabezado azul: "Corte" como etiqueta blanca tocable y Reportes como ícono */}
        <Header
          titulo="Historial"
          onBack={() => this.props.navigation.goBack()}
          derecha={(
            <TouchableOpacity
              onPress={() => this.setState({ showCorteModal: true })}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Corte del día"
              style={{ height: 36, paddingHorizontal: spacing.md, marginHorizontal: spacing.xs, backgroundColor: colors.white, borderRadius: radius.lg, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}
            >
              <IconReceipt size={15} color={colors.primaryDark} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.primaryDark, marginLeft: spacing.xs }}>Corte</Text>
            </TouchableOpacity>
          )}
          acciones={[{ Icono: IconTrendingUp, etiqueta: 'Reportes', onPress: () => this.props.navigation.navigate('Reportes') }]}
        />

        <FlatList
          data={ventas}
          keyExtractor={v => String(v.id)}
          renderItem={item => this.renderVenta(item)}
          ListHeaderComponent={this.renderListHeader}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          onEndReached={this.cargarMas}
          onEndReachedThreshold={0.5}
          ListFooterComponent={this.renderPie}
          ListEmptyComponent={() => (cargando ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <EstadoVacio
              Icono={IconInbox}
              tono="info"
              titulo="Sin ventas"
              texto="No hay ventas en el período seleccionado."
            />
          ))}
        />
      </View>
    );
  }
}
