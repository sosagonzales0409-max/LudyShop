import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import CorteModal from './CorteModal';
import DevolucionModal from './DevolucionModal';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack, IconReceipt, IconTrendingUp, IconTrash } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

const TIPOS_PAGO = ['Todos', 'Contado', 'Credito'];
const PERIODOS = [
  { key: 'hoy',    label: 'Hoy' },
  { key: 'semana', label: 'Semana' },
  { key: 'mes',    label: 'Mes' },
  { key: 'todo',   label: 'Todo' },
];

export default class HistorialView extends Component {
  static contextType = StoreContext;

  state = {
    pago: 'Todos',
    periodo: 'hoy',
    expandidoId: null,
    showCorteModal: false,
    showDevolucionModal: false,
    ventaDevolucion: null,
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

  getVentasFiltradas() {
    const { sales } = this.context;
    const inicio = this.inicioPeriodo(this.state.periodo);
    return sales
      .filter(s => {
        if (this.state.pago !== 'Todos' && s.tipoPago !== this.state.pago) return false;
        if (inicio && s.fecha < inicio.toISOString()) return false;
        return true;
      })
      .sort((a, b) => (a.fecha > b.fecha ? -1 : 1));
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

  getAbonosPeriodo() {
    const { abonos } = this.context;
    const inicio = this.inicioPeriodo(this.state.periodo);
    return (abonos ?? [])
      .filter(a => a.tipo === 'abono' && (!inicio || a.fecha >= inicio.toISOString()))
      .sort((a, b) => (a.fecha > b.fecha ? -1 : 1));
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────

  confirmarEliminar(venta) {
    const esCredito = venta.tipoPago === 'Credito';
    Alert.alert(
      'Eliminar venta',
      `¿Seguro que quieres eliminar esta venta de $${venta.total.toFixed(2)} del ${this.formatFecha(venta.fecha)}?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: esCredito ? 'Eliminar (no devolver stock)' : 'Eliminar sin devolver mercancía',
          onPress: () => this.context.eliminarVenta(venta.id, false),
        },
        {
          text: 'Eliminar y devolver al inventario',
          style: 'destructive',
          onPress: () => this.context.eliminarVenta(venta.id, true),
        },
      ],
    );
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
    const expandido  = this.state.expandidoId === venta.id;
    const pendiente  = this.pendienteDe(venta);
    const esCredito  = venta.tipoPago === 'Credito';

    return (
      <View
        style={{
          marginHorizontal: spacing.lg, marginBottom: spacing.sm,
          backgroundColor: colors.card, borderRadius: radius.md,
          elevation: 2, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 },
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
              <View style={{ alignSelf: 'flex-start', marginTop: spacing.xs, backgroundColor: esCredito ? colors.warning : colors.success, borderRadius: radius.sm, paddingVertical: 2, paddingHorizontal: spacing.sm }}>
                <Text style={{ color: colors.white, fontSize: fontSize.small, fontWeight: 'bold' }}>
                  {esCredito ? 'Crédito' : 'Contado'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              ${venta.total.toFixed(2)}
            </Text>
            <Text style={{ fontSize: fontSize.itemTitle, color: colors.textMuted, marginLeft: spacing.sm }}>
              {expandido ? '▴' : '▾'}
            </Text>
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
                      ${(p.precio * p.numProducts).toFixed(2)}
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
                  Abonado: ${(venta.totalAbonado ?? 0).toFixed(2)} · Pendiente:{' '}
                  <Text style={{ fontWeight: 'bold', color: pendiente > 0.009 ? colors.danger : colors.success }}>
                    ${pendiente.toFixed(2)}
                  </Text>
                </Text>
                {(venta.condonado ?? 0) > 0.009 && (
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 }}>
                    Condonado: ${(venta.condonado ?? 0).toFixed(2)}
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
                <Text style={{ fontSize: fontSize.body }}>↩️</Text>
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
                  backgroundColor: '#fde8e8',
                  borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                  flexDirection: 'row', gap: spacing.xs,
                }}
              >
                <IconTrash size={fontSize.body} color={colors.danger} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.danger }}>
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
    const ventas = this.getVentasFiltradas();
    const abonos = this.getAbonosPeriodo();
    const totalContado  = ventas.filter(v => v.tipoPago !== 'Credito').reduce((s, v) => s + v.total, 0);
    const totalCredito  = ventas.filter(v => v.tipoPago === 'Credito').reduce((s, v) => s + v.total, 0);
    const totalAbonos   = abonos.reduce((s, a) => s + a.monto, 0);
    const totalIngresos = totalContado + totalAbonos;

    return (
      <View>
        {/* Filtros */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.sm }}>Tipo de pago</Text>
          {this.renderChips(TIPOS_PAGO, this.state.pago, op => this.setState({ pago: op }))}
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.md, marginBottom: spacing.sm }}>Período</Text>
          {this.renderChips(PERIODOS, this.state.periodo, op => this.setState({ periodo: op }))}
        </View>

        {/* Resumen del período */}
        <View style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.md, elevation: 3, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 } }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center' }}>INGRESOS DEL PERÍODO (contado + abonos)</Text>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: colors.success, textAlign: 'center', marginVertical: spacing.xs }}>${totalIngresos.toFixed(2)}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Contado</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>${totalContado.toFixed(2)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Abonos recibidos</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.success }}>${totalAbonos.toFixed(2)}</Text>
          </View>
          {totalCredito > 0.009 && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm, paddingTop: spacing.sm }}>
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>POR COBRAR (deudas)</Text>
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.warning }}>${totalCredito.toFixed(2)}</Text>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Ventas</Text>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>{ventas.length}</Text>
          </View>
        </View>
      </View>
    );
  };

  // ─── Render principal ─────────────────────────────────────────────────────

  render() {
    const ventas = this.getVentasFiltradas();

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

        <CorteModal
          visible={this.state.showCorteModal}
          onCancel={() => this.setState({ showCorteModal: false })}
        />

        <DevolucionModal
          visible={this.state.showDevolucionModal}
          venta={this.state.ventaDevolucion}
          onCancel={() => this.setState({ showDevolucionModal: false, ventaDevolucion: null })}
          onConfirmar={({ items, devolverStock }) => {
            this.context.registrarDevolucion(this.state.ventaDevolucion.id, items, devolverStock);
            this.setState({ showDevolucionModal: false, ventaDevolucion: null });
          }}
        />

        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>Historial</Text>
          <TouchableOpacity onPress={() => this.setState({ showCorteModal: true })} style={{ height: 36, paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconReceipt size={15} color={colors.white} />
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.white, marginLeft: spacing.xs }}>Corte</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => this.props.navigation.navigate('Reportes')} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.xs }} hitSlop={8}>
            <IconTrendingUp size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={ventas}
          keyExtractor={v => String(v.id)}
          renderItem={item => this.renderVenta(item)}
          ListHeaderComponent={this.renderListHeader}
          contentContainerStyle={{ paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>🗒️</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', marginTop: spacing.md, color: colors.textPrimary }}>Sin ventas</Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>No hay ventas en el período seleccionado.</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }
}
