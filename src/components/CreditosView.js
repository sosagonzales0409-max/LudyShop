import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { clientesConSaldo } from '../data/consultas/creditos';
import { crearConsultaViva } from '../data/consultaViva';
import PagoModal from './PagoModal';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { formatoDinero } from '../config/formato';
import { IconBack, IconChevron } from './Icon';

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
    // Datos consultados (bajo demanda): clientes con saldo, agrupados en SQLite.
    clientes: [],
    cargando: true,
    error: null,
  };

  componentDidMount() {
    // Se refresca sola al registrar un pago, vender a crédito, condonar,
    // eliminar una venta o renombrar un cliente.
    this.consulta = crearConsultaViva({
      tablas: ['ventas', 'abonos', 'clientes'],
      cargar: clientesConSaldo,
      alCargar: clientes => this.setState({ clientes, cargando: false, error: null }),
      alFallar: error => this.setState({ error: error?.message ?? String(error), cargando: false }),
    });
  }

  componentWillUnmount() {
    this.consulta?.detener();
  }

  // Ordena los clientes según el criterio activo:
  //   'antiguedad' → deuda más antigua primero (inicio de la deuda), desempate por saldo.
  //   'reciente'   → venta a crédito más reciente primero, desempate por saldo.
  //   'saldo'      → mayor deuda primero.
  ordenarClientes = (a, b) => {
    if (this.state.orden === 'alfabetico') {
      return a.cliente.localeCompare(b.cliente, 'es');
    }
    if (this.state.orden === 'saldo') {
      return b.saldo - a.saldo;
    }
    if (this.state.orden === 'reciente') {
      if (a.fechaUltima !== b.fechaUltima) return a.fechaUltima > b.fechaUltima ? -1 : 1;
      return b.saldo - a.saldo;
    }
    if (a.fechaDeuda !== b.fechaDeuda) {
      return a.fechaDeuda < b.fechaDeuda ? -1 : 1;
    }
    return b.saldo - a.saldo;
  };

  // Clientes con saldo (ya agrupados por SQLite: saldo, nº de ventas, fecha de
  // la última venta y del inicio de la deuda), en el orden elegido.
  getClientesConDeuda() {
    return [...this.state.clientes].sort(this.ordenarClientes);
  }

  // Días de CALENDARIO (medianoche local vs medianoche local), no periodos de
  // 24 h: una venta de anoche a las 23:00 vista hoy a la 1:00 es "1 día", no
  // "Hoy". Math.round absorbe los días de 23/25 h del horario de verano, y el
  // tope en 0 evita "-1 días" si la fecha quedara unos minutos en el futuro.
  diasDesde(fechaISO) {
    const inicioDelDia = fecha => { const d = new Date(fecha); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const dias = Math.round((inicioDelDia(Date.now()) - inicioDelDia(fechaISO)) / (1000 * 60 * 60 * 24));
    return Math.max(0, dias);
  }

  chipAntiguedad(dias) {
    if (dias === 0) return { label: 'Hoy', bg: colors.success };
    if (dias === 1) return { label: '1 día', bg: colors.success };
    if (dias <= 7) return { label: `${dias} días`, bg: colors.warning };
    return { label: `+${dias} días`, bg: colors.danger };
  }

  renderCliente(item) {
    const moneda = this.context.config?.moneda ?? '$';
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
          onPress={() => this.props.navigation.navigate('ClientDebtDetail', { clienteData: { cliente: item.cliente, clienteId: item.clienteId } })}
          style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.cliente}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
              {item.numVentas} {item.numVentas === 1 ? 'venta' : 'ventas'} a crédito
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
            {formatoDinero(item.saldo, moneda)}
          </Text>
          <IconChevron size={fontSize.itemTitle} color={colors.textMuted} style={{ marginLeft: spacing.xs }} />
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
    const moneda = this.context.config?.moneda ?? '$';
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
            <IconBack size={28} color={colors.primary} />
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
                {formatoDinero(totalGeneral, moneda)} total
              </Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.md }}>
            {this.state.orden === 'antiguedad'
              ? 'Clientes con saldo pendiente, de la deuda más antigua a la más reciente.'
              : this.state.orden === 'reciente'
                ? 'Clientes con saldo pendiente, de la venta a crédito más reciente a la más antigua.'
              : this.state.orden === 'saldo'
                ? 'Clientes con saldo pendiente, ordenados de mayor a menor deuda.'
                : 'Clientes con saldo pendiente, en orden alfabético.'}
          </Text>

          {/* Selector de orden: chips de ANCHO NATURAL (antes flex:1 con texto
              de 16 px: "Mayor deuda" se partía en 2 líneas). Si en una
              pantalla angosta no caben, la fila se desliza en vez de cortar. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {[
              { key: 'antiguedad', label: 'Más antiguo' },
              { key: 'reciente', label: 'Más reciente' },
              { key: 'saldo', label: 'Mayor deuda' },
              { key: 'alfabetico', label: 'A-Z' },
            ].map(op => (
              <TouchableOpacity
                key={op.key}
                onPress={() => this.setState({ orden: op.key })}
                style={{
                  height: 36,
                  paddingHorizontal: spacing.md,
                  backgroundColor: this.state.orden === op.key ? colors.primary : colors.chipInactive,
                  borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text numberOfLines={1} style={{
                  fontSize: fontSize.caption, fontWeight: 'bold',
                  color: this.state.orden === op.key ? colors.white : colors.textPrimary,
                }}>
                  {op.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={clientes}
          keyExtractor={item => item.cliente}
          renderItem={({ item }) => this.renderCliente(item)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          ListEmptyComponent={() => (this.state.cargando ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
          ) : this.state.error ? (
            <Text style={{ fontSize: fontSize.body, color: colors.danger, textAlign: 'center', marginTop: 60 }}>
              No se pudieron cargar los créditos: {this.state.error}
            </Text>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', marginTop: spacing.md, color: colors.textPrimary }}>
                Sin deudas pendientes
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                Todos los clientes están al corriente.
              </Text>
            </View>
          ))}
        />
      </SafeAreaView>
    );
  }
}
