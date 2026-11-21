import React, { Component } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { detalleCliente } from '../data/consultas/creditos';
import { crearConsultaViva } from '../data/consultaViva';
import { normalizarNombre } from '../data/nombres';
import EditPaymentModal from '../modals/EditPaymentModal';
import ReturnModal from '../modals/ReturnModal';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { formatoDinero, nombreProducto } from '../config/formato';
import { IconEdit, IconClose, IconTrash, IconCornerUp, IconCheckCircle } from '../ui/Icon';
import Header from '../ui/Header';
import { ChipEstado, EstadoVacio } from '../ui/StatusViews';

export default class CustomerDebtScreen extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    const clienteData = props.route?.params?.clienteData ?? null;
    this.state = {
      editandoNombre: false,
      nombreInput: clienteData?.cliente ?? '',
      showEditAbonoModal: false,
      ventaEditando: null,
      showDevolucionModal: false,
      ventaDevolucion: null,
      // Datos consultados (bajo demanda): totales y ventas a crédito del cliente.
      detalle: null,
      cargando: true,
      error: null,
    };
  }

  componentDidMount() {
    // Se refresca sola al abonar, corregir un abono, condonar, devolver,
    // eliminar una venta o renombrar al cliente.
    this.consulta = crearConsultaViva({
      tablas: ['ventas', 'venta_items', 'abonos', 'clientes'],
      cargar: () => detalleCliente({ clienteId: this.clienteId() }),
      alCargar: detalle => this.setState({ detalle, cargando: false, error: null }),
      alFallar: error => this.setState({ error: error?.message ?? String(error), cargando: false }),
    });
  }

  componentWillUnmount() {
    this.consulta?.detener();
  }

  // El cliente se busca por ID (no cambia al renombrarlo). Si no llegó en los
  // params, se resuelve por nombre en el catálogo de clientes; "Sin nombre"
  // (ventas a crédito sin cliente) = null.
  clienteId() {
    const datos = this.props.route?.params?.clienteData;
    if (datos?.clienteId !== undefined) return datos.clienteId;
    const nombre = normalizarNombre(datos?.cliente ?? '');
    return (this.context.clientes ?? []).find(c => normalizarNombre(c.nombre) === nombre)?.id ?? null;
  }

  getClienteActualizado() {
    return this.state.detalle;
  }

  formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  pendienteDe(venta) {
    return Math.max(0, venta.total - (venta.totalAbonado ?? 0) - (venta.condonado ?? 0));
  }

  // ─── Acciones ─────────────────────────────────────────────────────────────

  guardarNombre = () => {
    // Misma limpieza que renombrarCliente (limpiarNombre): sin esto, con
    // espacios repetidos el nombre de los params no coincidiría con el de las
    // ventas y el detalle se quedaría vacío tras renombrar.
    const nuevo = this.state.nombreInput.trim().replace(/\s+/g, ' ');
    if (!nuevo) { Alert.alert('Nombre inválido', 'El nombre no puede quedar vacío.'); return; }
    const clienteData = this.props.route?.params?.clienteData;
    const ok = this.context.renombrarCliente(clienteData.cliente, nuevo);
    if (!ok) {
      Alert.alert('Nombre en uso', 'Ya existe otro cliente con ese nombre. Elige un nombre distinto para no mezclar su historial con el de esa persona.');
      return;
    }
    this.props.navigation.setParams({ clienteData: { ...clienteData, cliente: nuevo } });
    this.setState({ editandoNombre: false });
  };

  confirmarEliminar(venta) {
    const moneda = this.context.config?.moneda ?? '$';
    const abonado = venta.totalAbonado ?? 0;
    const advertencia = abonado > 0.009
      ? `\n\n⚠️ Esta venta ya tiene ${formatoDinero(abonado, moneda)} abonados. Al eliminarla, ese registro de pago también desaparece del historial.`
      : '';
    Alert.alert(
      'Eliminar venta de la deuda',
      `¿Qué ocurrió con esta venta de ${formatoDinero(venta.total, moneda)} del ${this.formatFecha(venta.fecha)}?${advertencia}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Condonar (no devolver mercancía)', onPress: () => this.context.condonarVenta(venta.id) },
        { text: 'Devolver al inventario',           style: 'destructive', onPress: () => this.eliminarVentaYAvisarSiFalta(venta) },
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

  // ─── Render de cada venta ─────────────────────────────────────────────────

  renderVenta({ item: venta }) {
    const moneda = this.context.config?.moneda ?? '$';
    const pendiente = this.pendienteDe(venta);
    const saldada   = pendiente <= 0.009;

    return (
      <View style={{ ...tarjeta, padding: spacing.lg, marginBottom: spacing.sm }}>

        {/* Fila: fecha + badge + eliminar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {this.formatFecha(venta.fecha)}
            </Text>
            <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: 2 }}>
              Total: {formatoDinero(venta.total, moneda)}
            </Text>
          </View>

          {saldada ? (
            <View style={{ marginRight: spacing.sm }}>
              <ChipEstado tono="ok" texto="Saldada" />
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end', marginRight: spacing.sm }}>
              <Text style={{ fontSize: fontSize.small, color: colors.textMuted }}>Pendiente</Text>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.danger }}>{formatoDinero(pendiente, moneda)}</Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => this.confirmarEliminar(venta)}
            accessibilityLabel="Eliminar venta de la deuda"
            style={{ width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.dangerSoft, justifyContent: 'center', alignItems: 'center' }}
          >
            <IconTrash size={fontSize.itemTitle} color={colors.dangerDark} />
          </TouchableOpacity>
        </View>

        {/* Productos */}
        {Array.isArray(venta.productos) && venta.productos.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginBottom: spacing.sm }}>
            {venta.productos.map((p, i) => (
              <Text key={i} style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                {p.numProducts} × {p.nombre} {p.tamano}
              </Text>
            ))}
          </View>
        )}

        {/* Abono + editar */}
        {!saldada && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, flex: 1 }}>
              Abonado: {formatoDinero(venta.totalAbonado ?? 0, moneda)}
            </Text>
            <TouchableOpacity
              onPress={() => this.setState({ showEditAbonoModal: true, ventaEditando: venta })}
              style={{ height: 40, paddingHorizontal: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconEdit size={fontSize.body} color={colors.primaryDark} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.primaryDark, marginLeft: spacing.xs }}>Editar abono</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Botón devolución */}
        <TouchableOpacity
          onPress={() => this.setState({ showDevolucionModal: true, ventaDevolucion: venta })}
          style={{
            height: buttonHeight.chip, borderRadius: radius.lg,
            backgroundColor: colors.chipInactive,
            justifyContent: 'center', alignItems: 'center',
            flexDirection: 'row', gap: spacing.xs,
            marginTop: spacing.md,
          }}
        >
          <IconCornerUp size={fontSize.label} color={colors.textPrimary} />
          <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>Registrar devolución</Text>
        </TouchableOpacity>

        {(venta.condonado ?? 0) > 0.009 && (
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            Condonado: {formatoDinero(venta.condonado ?? 0, moneda)} — deuda perdonada
          </Text>
        )}
      </View>
    );
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  render() {
    const moneda = this.context.config?.moneda ?? '$';
    const cliente = this.getClienteActualizado();
    const { editandoNombre, nombreInput } = this.state;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        <EditPaymentModal
          visible={this.state.showEditAbonoModal}
          venta={this.state.ventaEditando}
          onCancel={() => this.setState({ showEditAbonoModal: false, ventaEditando: null })}
          onSave={(saleId, nuevoAbonado) => {
            this.context.ajustarAbonoVenta(saleId, nuevoAbonado);
            this.setState({ showEditAbonoModal: false, ventaEditando: null });
          }}
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

        {/* Encabezado azul: el nombre del cliente es el título; el lápiz abre
            la fila de edición justo debajo (no cabe un campo dentro de la barra). */}
        <Header
          titulo={cliente?.cliente ?? '—'}
          onBack={() => this.props.navigation.goBack()}
          acciones={editandoNombre ? [] : [{
            Icono: IconEdit,
            etiqueta: 'Editar nombre',
            onPress: () => this.setState({ editandoNombre: true, nombreInput: cliente?.cliente ?? '' }),
          }]}
        />

        {editandoNombre && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
            <TextInput
              style={{ flex: 1, fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, borderBottomWidth: 2, borderBottomColor: colors.primary, paddingVertical: spacing.xs }}
              autoFocus value={nombreInput}
              onChangeText={t => this.setState({ nombreInput: t })}
              onSubmitEditing={this.guardarNombre}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={this.guardarNombre} style={{ height: 44, paddingHorizontal: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.white }}>OK</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => this.setState({ editandoNombre: false, nombreInput: cliente?.cliente ?? '' })} accessibilityLabel="Cancelar" style={{ width: 44, height: 44, backgroundColor: colors.chipInactive, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
              <IconClose size={fontSize.label} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {this.state.cargando ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : this.state.error ? (
          <Text style={{ fontSize: fontSize.body, color: colors.danger, textAlign: 'center', margin: spacing.xl }}>
            No se pudo cargar el detalle: {this.state.error}
          </Text>
        ) : !cliente ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <EstadoVacio
              Icono={IconCheckCircle}
              tono="ok"
              titulo="¡Deuda saldada!"
              texto="Este cliente ya no tiene saldo pendiente."
              style={{ marginTop: 0 }}
            />
            <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ marginTop: spacing.xl, height: buttonHeight.action, paddingHorizontal: spacing.xxl, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Volver a Créditos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={cliente.ventas}
            keyExtractor={v => v.id}
            renderItem={item => this.renderVenta(item)}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
            ListHeaderComponent={() => (
              <View>
                {/* Resumen */}
                <View style={{ ...tarjeta, padding: spacing.lg, marginBottom: spacing.lg }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Deuda total</Text>
                    <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>{formatoDinero(cliente.totalDeuda, moneda)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Total abonado</Text>
                    <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.success }}>{formatoDinero(cliente.totalAbonado, moneda)}</Text>
                  </View>
                  {cliente.totalCondonado > 0.009 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                      <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Condonado</Text>
                      <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.warningDark }}>{formatoDinero(cliente.totalCondonado, moneda)}</Text>
                    </View>
                  )}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>Saldo pendiente</Text>
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.danger }}>{formatoDinero(cliente.saldo, moneda)}</Text>
                  </View>
                </View>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm }}>
                  Ventas a crédito ({cliente.ventas.length})
                </Text>
              </View>
            )}
          />
        )}
      </View>
    );
  }
}
