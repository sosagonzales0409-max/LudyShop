import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import PagoModal from './PagoModal';
import DetalleDeudaModal from './DetalleDeudaModal';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

/**
 * CreditosView — lista de clientes con saldo pendiente.
 * Agrupa las ventas del contexto donde tipoPago === 'Credito',
 * suma el total y resta los abonos registrados.
 *
 * Navegación: stack dentro del tab Ventas.
 *   <MainViews.Screen name="Creditos" component={CreditosView} />
 */
export default class CreditosView extends Component {
  static contextType = StoreContext;

  state = {
    showPagoModal: false,
    clienteSeleccionado: null,
    deudaSeleccionada: 0,
    detalleCliente: null,
  };

  // Agrupa ventas a crédito por cliente y calcula saldo pendiente.
  getClientesConDeuda() {
    const { sales } = this.context;
    const mapa = {};

    sales
      .filter(s => s.tipoPago === 'Credito')
      .forEach(sale => {
        const key = (sale.cliente || 'Sin nombre').trim();
        if (!mapa[key]) {
          mapa[key] = {
            cliente: key,
            totalDeuda: 0,
            totalAbonado: 0,
            ventas: [],
            fechaUltima: sale.fecha,
          };
        }
        mapa[key].totalDeuda += sale.total;
        mapa[key].totalAbonado += sale.totalAbonado ?? 0;
        mapa[key].ventas.push(sale);
        // Guardar la fecha más reciente
        if (sale.fecha > mapa[key].fechaUltima) {
          mapa[key].fechaUltima = sale.fecha;
        }
      });

    return Object.values(mapa)
      .map(c => ({ ...c, saldo: c.totalDeuda - c.totalAbonado }))
      .filter(c => c.saldo > 0.009) // ignorar saldos prácticamente en cero
      .sort((a, b) => b.saldo - a.saldo); // mayor deuda primero
  }

  // Calcula antigüedad en días desde la venta más reciente.
  diasDesde(fechaISO) {
    const diff = Date.now() - new Date(fechaISO).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  chipAntiguedad(dias) {
    if (dias === 0) return { label: 'Hoy', bg: colors.success };
    if (dias === 1) return { label: '1 día', bg: colors.success };
    if (dias <= 3) return { label: `${dias} días`, bg: colors.warning };
    if (dias <= 7) return { label: `${dias} días`, bg: colors.warning };
    return { label: `+${dias} días`, bg: colors.danger };
  }

  abrirPago(cliente, saldo) {
    this.setState({
      showPagoModal: true,
      clienteSeleccionado: cliente,
      deudaSeleccionada: saldo,
    });
  }

  cerrarPago() {
    this.setState({
      showPagoModal: false,
      clienteSeleccionado: null,
      deudaSeleccionada: 0,
    });
  }

  abrirDetalle(cliente) {
    this.setState({ detalleCliente: cliente });
  }

  cerrarDetalle() {
    this.setState({ detalleCliente: null });
  }

  renderCliente(item) {
    const dias = this.diasDesde(item.fechaUltima);
    const chip = this.chipAntiguedad(dias);

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          elevation: 3,
          shadowOpacity: 0.08,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => this.abrirDetalle(item)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
          >
            {/* Info cliente */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                {item.cliente}
              </Text>
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
                {item.ventas.length} {item.ventas.length === 1 ? 'venta' : 'ventas'} a crédito
              </Text>
            </View>

            {/* Badge de antigüedad */}
            <View
              style={{
                backgroundColor: chip.bg,
                borderRadius: radius.sm,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                marginRight: spacing.sm,
              }}
            >
              <Text style={{ color: colors.white, fontSize: fontSize.small, fontWeight: 'bold' }}>
                {chip.label}
              </Text>
            </View>

            {/* Saldo */}
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.danger }}>
              ${item.saldo.toFixed(2)}
            </Text>

            <Text style={{ fontSize: fontSize.itemTitle, color: colors.textMuted, marginLeft: spacing.xs }}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Botón registrar pago */}
        <TouchableOpacity
          onPress={() => this.abrirPago(item.cliente, item.saldo)}
          style={{
            height: buttonHeight.action,
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            justifyContent: 'center',
            alignItems: 'center',
            marginTop: spacing.md,
          }}
        >
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
            Registrar pago
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  render() {
    const clientes = this.getClientesConDeuda();
    const totalGeneral = clientes.reduce((s, c) => s + c.saldo, 0);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Modal de pago */}
        <PagoModal
          visible={this.state.showPagoModal}
          cliente={this.state.clienteSeleccionado}
          deudaTotal={this.state.deudaSeleccionada}
          onCancel={() => this.cerrarPago()}
          onSave={(cliente, monto) => {
            this.context.registrarAbono(cliente, monto);
            this.cerrarPago();
          }}
        />

        {/* Detalle de deuda por cliente */}
        <DetalleDeudaModal
          visible={this.state.detalleCliente !== null}
          cliente={this.state.detalleCliente}
          onClose={() => this.cerrarDetalle()}
          onAjustarAbono={(saleId, monto) =>
            this.context.ajustarAbonoVenta(saleId, monto)
          }
          onEliminarVenta={(venta, devolverStock) => {
            if (devolverStock) {
              this.context.eliminarVenta(venta.id, true);
            } else {
              this.context.ajustarAbonoVenta(venta.id, venta.total);
            }
            this.cerrarDetalle();
          }}
          onRenombrar={(actual, nuevo) => {
            this.context.renombrarCliente(actual, nuevo);
            this.cerrarDetalle();
          }}
        />

        {/* Barra verde */}
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View
          style={{
            height: 60,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <TouchableOpacity
            onPress={() => this.props.navigation.goBack()}
            style={{ marginRight: spacing.md }}
          >
            <Text style={{ fontSize: fontSize.heading, color: colors.primary }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Créditos
          </Text>
          {clientes.length > 0 && (
            <View
              style={{
                backgroundColor: colors.danger,
                borderRadius: radius.lg,
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.md,
              }}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>
                ${totalGeneral.toFixed(2)} total
              </Text>
            </View>
          )}
        </View>

        {/* Descripción */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
            Clientes con saldo pendiente, ordenados de mayor a menor deuda.
          </Text>
        </View>

        {/* Lista */}
        <FlatList
          data={clientes}
          keyExtractor={item => item.cliente}
          renderItem={({ item }) => this.renderCliente(item)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', marginTop: spacing.md, color: colors.textPrimary }}>
                Sin deudas pendientes
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                Todos los clientes están al corriente.
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }
}
