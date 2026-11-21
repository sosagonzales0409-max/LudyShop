import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { clientesConSaldo } from '../data/queries/credits';
import { crearConsultaViva } from '../data/liveQuery';
import PaymentModal from '../modals/PaymentModal';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { formatoDinero } from '../config/formatting';
import { IconChevron, IconCheckCircle } from '../ui/Icon';
import Header, { EtiquetaEncabezado } from '../ui/Header';
import { ChipEstado, EstadoVacio, AvisoPrimeraVez, Resaltar } from '../ui/StatusViews';

/**
 * CreditsScreen — lista de clientes con saldo pendiente.
 * Agrupa las ventas del contexto donde tipoPago === 'Credito',
 * suma el total y resta los abonos registrados.
 *
 * Al tocar un cliente navega a CustomerDebtScreen (pantalla completa).
 *
 * Navegación: stack dentro del tab Ventas.
 *   <MainViews.Screen name="Creditos" component={CreditsScreen} />
 */
export default class CreditsScreen extends Component {
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

  // Etiqueta de antigüedad: texto + tono de <ChipEstado> (verde hasta 1 día,
  // naranja hasta 7, rojo después).
  chipAntiguedad(dias) {
    if (dias === 0) return { label: 'Hoy', tono: 'ok' };
    if (dias === 1) return { label: '1 día', tono: 'ok' };
    if (dias <= 7) return { label: `${dias} días`, tono: 'warn' };
    return { label: `+${dias} días`, tono: 'bad' };
  }

  renderCliente(item) {
    const moneda = this.context.config?.moneda ?? '$';
    const dias = this.diasDesde(item.fechaUltima);
    const chip = this.chipAntiguedad(dias);

    return (
      <View style={{ ...tarjeta, padding: spacing.lg, marginBottom: spacing.sm }}>
        {/* Fila 1: nombre, nº de ventas y antigüedad de la deuda */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: spacing.sm }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.cliente}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
              {item.numVentas} {item.numVentas === 1 ? 'venta' : 'ventas'} a crédito
            </Text>
          </View>
          <ChipEstado tono={chip.tono} texto={chip.label} />
        </View>

        {/* Fila 2 (tocable → detalle): saldo grande en su propia línea para
            que no compita con el nombre en pantallas angostas. */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => this.props.navigation.navigate('ClientDebtDetail', { clienteData: { cliente: item.cliente, clienteId: item.clienteId } })}
          style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: spacing.xs, marginBottom: spacing.sm }}
        >
          <Text style={{ flex: 1, fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.dangerDark }}>
            {formatoDinero(item.saldo, moneda)}
          </Text>
          <IconChevron size={fontSize.itemTitle} color={colors.placeholder} style={{ marginLeft: spacing.xs }} />
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
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        <PaymentModal
          visible={this.state.showPagoModal}
          cliente={this.state.clienteSeleccionado}
          deudaTotal={this.state.deudaSeleccionada}
          onCancel={() => this.setState({ showPagoModal: false, clienteSeleccionado: null, deudaSeleccionada: 0 })}
          onSave={(cliente, monto) => {
            this.context.registrarAbono(cliente, monto);
            this.setState({ showPagoModal: false, clienteSeleccionado: null, deudaSeleccionada: 0 });
          }}
        />

        <Header
          titulo="Créditos"
          onBack={() => this.props.navigation.goBack()}
          derecha={clientes.length > 0
            ? <EtiquetaEncabezado texto={`${formatoDinero(totalGeneral, moneda)} total`} color={colors.dangerDark} />
            : null}
        />

        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <AvisoPrimeraVez
            clave="pista_creditos"
            titulo="Quién te debe"
            texto={<>Toca el saldo para ver el detalle de cada venta. Con <Resaltar>Registrar pago</Resaltar> anotas lo que te abonan.</>}
            style={{ marginTop: 0, marginBottom: spacing.md }}
          />
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
          ListEmptyComponent={(this.state.cargando ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
          ) : this.state.error ? (
            <Text style={{ fontSize: fontSize.body, color: colors.danger, textAlign: 'center', marginTop: 60 }}>
              No se pudieron cargar los créditos: {this.state.error}
            </Text>
          ) : (
            <EstadoVacio
              Icono={IconCheckCircle}
              tono="ok"
              titulo="Sin deudas pendientes"
              texto="Todos los clientes están al corriente."
            />
          ))}
        />
      </View>
    );
  }
}
