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
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

/**
 * CreditosView — lista de clientes con saldo pendiente.
 * Agrupa las ventas del contexto donde tipoPago === 'Credito',
 * suma el total y resta los abonos registrados.
 *
 * Al tocar un cliente navega a ClientDebtDetailView (pantalla completa).
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
    orden: 'antiguedad',
  };

  // Ordena los clientes según el criterio activo:
  //   'antiguedad' → deuda más antigua primero (inicio de la deuda), desempate por saldo.
  //   'saldo'      → mayor deuda primero.
  ordenarClientes = (a, b) => {
    if (this.state.orden === 'saldo') {
      return b.saldo - a.saldo;
    }
    if (a.fechaDeuda !== b.fechaDeuda) {
      return a.fechaDeuda < b.fechaDeuda ? -1 : 1;
    }
    return b.saldo - a.saldo;
  };

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
        if (sale.fecha > mapa[key].fechaUltima) mapa[key].fechaUltima = sale.fecha;
      });

    return Object.values(mapa)
      .map(c => {
        const saldo = c.totalDeuda - c.totalAbonado;
        // Inicio de la deuda: fecha de la venta pendiente más antigua.
        // (campo calculado en memoria, no se almacena ni se pide al usuario)
        const pendientes = c.ventas.filter(
          v => v.total - (v.totalAbonado ?? 0) > 0.009,
        );
        const fechaDeuda =
          pendientes.length > 0
            ? pendientes.map(v => v.fecha).sort()[0]
            : c.fechaUltima;
        return { ...c, saldo, fechaDeuda };
      })
      .filter(c => c.saldo > 0.009)
      .sort(this.ordenarClientes);
  }

  diasDesde(fechaISO) {
    const diff = Date.now() - new Date(fechaISO).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  chipAntiguedad(dias) {
    if (dias === 0) return { label: 'Hoy', bg: colors.success };
    if (dias === 1) return { label: '1 día', bg: colors.success };
    if (dias <= 7) return { label: `${dias} días`, bg: colors.warning };
    return { label: `+${dias} días`, bg: colors.danger };
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
        {/* Fila tocable → detalle */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => this.props.navigation.navigate('ClientDebtDetail', { clienteData: item })}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.cliente}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
              {item.ventas.length} {item.ventas.length === 1 ? 'venta' : 'ventas'} a crédito
            </Text>
          </View>

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

          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.danger }}>
            ${item.saldo.toFixed(2)}
          </Text>
          <Text style={{ fontSize: fontSize.itemTitle, color: colors.textMuted, marginLeft: spacing.xs }}>›</Text>
        </TouchableOpacity>

        {/* Botón registrar pago */}
        <TouchableOpacity
          onPress={() => this.setState({
            showPagoModal: true,
            clienteSeleccionado: item.cliente,
            deudaSeleccionada: item.saldo,
          })}
          style={{
            height: buttonHeight.action,
            backgroundColor: colors.primary,
            borderRadius: radius.lg,
            justifyContent: 'center',
            alignItems: 'center',
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

        <PagoModal
          visible={this.state.showPagoModal}
          cliente={this.state.clienteSeleccionado}
          deudaTotal={this.state.deudaSeleccionada}
          onCancel={() => this.setState({ showPagoModal: false, clienteSeleccionado: null, deudaSeleccionada: 0 })}
          onSave={(cliente, monto) => {
            this.context.registrarAbono(cliente, monto);
            this.setState({ showPagoModal: false, clienteSeleccionado: null, deudaSeleccionada: 0 });
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
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}
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

        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.md }}>
            {this.state.orden === 'antiguedad'
              ? 'Clientes con saldo pendiente, de la deuda más antigua a la más reciente.'
              : 'Clientes con saldo pendiente, ordenados de mayor a menor deuda.'}
          </Text>

          {/* Selector de orden */}
          <View style={{ flexDirection: 'row' }}>
            {[
              { key: 'antiguedad', label: 'Más antiguo' },
              { key: 'saldo', label: 'Mayor deuda' },
            ].map(op => (
              <TouchableOpacity
                key={op.key}
                onPress={() => this.setState({ orden: op.key })}
                style={{
                  flex: 1,
                  height: buttonHeight.chip,
                  backgroundColor: this.state.orden === op.key ? colors.primary : colors.chipInactive,
                  borderRadius: radius.lg,
                  marginHorizontal: spacing.xs,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text style={{
                  fontSize: fontSize.label, fontWeight: 'bold',
                  color: this.state.orden === op.key ? colors.white : colors.textPrimary,
                }}>
                  {op.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
