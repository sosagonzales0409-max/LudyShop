import React, { Component } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import EditAbonoModal from './EditAbonoModal';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

/**
 * ClientDebtDetailView — pantalla completa de detalle de deuda de un cliente.
 *
 * Recibe por params:
 *   route.params.clienteData  — objeto agrupado { cliente, saldo,
 *                               totalDeuda, totalAbonado, ventas[], fechaUltima }
 *
 * Acciones disponibles:
 *   • Renombrar cliente (inline en el header)
 *   • Ver resumen de deuda / abonado / pendiente
 *   • Ver cada venta con sus productos
 *   • Editar abono de una venta (abre EditAbonoModal)
 *   • Eliminar venta (condonar o devolver stock) vía Alert nativo
 */
export default class ClientDebtDetailView extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    const clienteData = props.route?.params?.clienteData ?? null;
    this.state = {
      editandoNombre: false,
      nombreInput: clienteData?.cliente ?? '',
      showEditAbonoModal: false,
      ventaEditando: null,
    };
  }

  // Obtiene el clienteData recalculado del Context para reflejar cambios
  // (abonos, eliminaciones, renombrado) sin necesidad de pasar el objeto por ref.
  getClienteActualizado() {
    const { sales } = this.context;
    const clienteOriginal = this.props.route?.params?.clienteData;
    if (!clienteOriginal) return null;

    // Siempre usar el nombre del param (actualizado por setParams tras renombrar).
    const nombreBuscar = clienteOriginal.cliente;

    const mapa = {};
    sales
      .filter(s => s.tipoPago === 'Credito' && (s.cliente || '').trim() === nombreBuscar.trim())
      .forEach(sale => {
        const key = (sale.cliente || 'Sin nombre').trim();
        if (!mapa[key]) {
          mapa[key] = {
            cliente: key,
            totalDeuda: 0,
            totalAbonado: 0,
            totalCondonado: 0,
            ventas: [],
            fechaUltima: sale.fecha,
          };
        }
        mapa[key].totalDeuda += sale.total;
        mapa[key].totalAbonado += sale.totalAbonado ?? 0;
        mapa[key].totalCondonado += sale.condonado ?? 0;
        mapa[key].ventas.push(sale);
        if (sale.fecha > mapa[key].fechaUltima) mapa[key].fechaUltima = sale.fecha;
      });

    const entry = Object.values(mapa)[0];
    if (!entry) return null;
    return { ...entry, saldo: entry.totalDeuda - entry.totalAbonado - entry.totalCondonado };
  }

  formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  pendienteDe(venta) {
    return Math.max(0, venta.total - (venta.totalAbonado ?? 0) - (venta.condonado ?? 0));
  }

  // ─── Acciones ────────────────────────────────────────────────────────────

  guardarNombre = () => {
    const nuevo = this.state.nombreInput.trim();
    if (!nuevo) {
      Alert.alert('Nombre inválido', 'El nombre no puede quedar vacío.');
      return;
    }
    const clienteData = this.props.route?.params?.clienteData;
    this.context.renombrarCliente(clienteData.cliente, nuevo);
    // Actualizar el param para que getClienteActualizado use el nuevo nombre
    this.props.navigation.setParams({
      clienteData: { ...clienteData, cliente: nuevo },
    });
    this.setState({ editandoNombre: false });
  };

  confirmarEliminar(venta) {
    Alert.alert(
      'Eliminar venta de la deuda',
      `¿Qué ocurrió con esta venta de $${venta.total.toFixed(2)} del ${this.formatFecha(venta.fecha)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Condonar (no devolver mercancía)',
          onPress: () => {
            this.context.condonarVenta(venta.id);
          },
        },
        {
          text: 'Devolver al inventario',
          style: 'destructive',
          onPress: () => {
            this.context.eliminarVenta(venta.id, true);
          },
        },
      ],
    );
  }

  // ─── Render de cada venta ────────────────────────────────────────────────

  renderVenta({ item: venta }) {
    const pendiente = this.pendienteDe(venta);
    const saldada = pendiente <= 0.009;

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          elevation: 2,
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        {/* Fila: fecha + badge estado + eliminar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {this.formatFecha(venta.fecha)}
            </Text>
            <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: 2 }}>
              Total: ${venta.total.toFixed(2)}
            </Text>
          </View>

          {saldada ? (
            <View
              style={{
                backgroundColor: colors.success,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                marginRight: spacing.sm,
              }}
            >
              <Text style={{ color: colors.white, fontSize: fontSize.small, fontWeight: 'bold' }}>
                Saldada
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end', marginRight: spacing.sm }}>
              <Text style={{ fontSize: fontSize.small, color: colors.textMuted }}>Pendiente</Text>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.danger }}>
                ${pendiente.toFixed(2)}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => this.confirmarEliminar(venta)}
            style={{
              width: 36, height: 36, borderRadius: radius.sm,
              backgroundColor: '#fde8e8',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.body }}>🗑️</Text>
          </TouchableOpacity>
        </View>

        {/* Productos de la venta */}
        {Array.isArray(venta.productos) && venta.productos.length > 0 && (
          <View
            style={{
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingTop: spacing.sm, marginBottom: spacing.sm,
            }}
          >
            {venta.productos.map((p, i) => (
              <Text key={i} style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                {p.numProducts} × {p.nombre} {p.tamano}
              </Text>
            ))}
          </View>
        )}

        {/* Fila de abono + botón editar */}
        {!saldada && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, flex: 1 }}>
              Abonado: ${(venta.totalAbonado ?? 0).toFixed(2)}
            </Text>
            <TouchableOpacity
              onPress={() => this.setState({ showEditAbonoModal: true, ventaEditando: venta })}
              style={{
                height: 32, paddingHorizontal: spacing.md,
                backgroundColor: colors.card,
                borderRadius: radius.sm, borderWidth: 1, borderColor: colors.chipInactive,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.primary }}>
                ✏️ Editar abono
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {(venta.condonado ?? 0) > 0.009 && (
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            Condonado: ${(venta.condonado ?? 0).toFixed(2)} — deuda perdonada
          </Text>
        )}
      </View>
    );
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  render() {
    const cliente = this.getClienteActualizado();
    const { editandoNombre, nombreInput } = this.state;

    // Si el cliente fue saldado completamente, la pantalla muestra un estado vacío
    // pero no fuerza el goBack() para que el usuario pueda verlo.

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Modal editar abono */}
        <EditAbonoModal
          visible={this.state.showEditAbonoModal}
          venta={this.state.ventaEditando}
          onCancel={() => this.setState({ showEditAbonoModal: false, ventaEditando: null })}
          onSave={(saleId, nuevoAbonado) => {
            this.context.ajustarAbonoVenta(saleId, nuevoAbonado);
            this.setState({ showEditAbonoModal: false, ventaEditando: null });
          }}
        />

        {/* Barra verde */}
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View
          style={{
            minHeight: 60, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.card, elevation: 4,
            shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
          }}
        >
          <TouchableOpacity
            onPress={() => this.props.navigation.goBack()}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}
          >
            <Text style={{ fontSize: fontSize.heading, color: colors.primary }}>←</Text>
          </TouchableOpacity>

          {editandoNombre ? (
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <TextInput
                style={{
                  flex: 1,
                  fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary,
                  borderBottomWidth: 2, borderBottomColor: colors.primary,
                  paddingVertical: spacing.xs,
                }}
                autoFocus
                value={nombreInput}
                onChangeText={t => this.setState({ nombreInput: t })}
                onSubmitEditing={this.guardarNombre}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={this.guardarNombre}
                style={{
                  height: 36, paddingHorizontal: spacing.md,
                  backgroundColor: colors.primary, borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.white }}>OK</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => this.setState({ editandoNombre: false, nombreInput: cliente?.cliente ?? '' })}
                style={{
                  height: 36, paddingHorizontal: spacing.sm,
                  backgroundColor: colors.chipInactive, borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, color: colors.textPrimary }}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => this.setState({ editandoNombre: true, nombreInput: cliente?.cliente ?? '' })}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                {cliente?.cliente ?? '—'}
              </Text>
              <Text style={{ fontSize: fontSize.caption, color: colors.primary }}>✏️</Text>
            </TouchableOpacity>
          )}
        </View>

        {!cliente ? (
          // Estado vacío — todas las deudas saldadas
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.lg }}>
              ¡Deuda saldada!
            </Text>
            <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm }}>
              Este cliente ya no tiene saldo pendiente.
            </Text>
            <TouchableOpacity
              onPress={() => this.props.navigation.goBack()}
              style={{
                marginTop: spacing.xl,
                height: buttonHeight.action,
                paddingHorizontal: spacing.xxl,
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Volver a Créditos
              </Text>
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
                <View
                  style={{
                    backgroundColor: colors.card, borderRadius: radius.md,
                    padding: spacing.lg, marginBottom: spacing.lg,
                    elevation: 3, shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 },
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Deuda total</Text>
                    <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                      ${cliente.totalDeuda.toFixed(2)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Total abonado</Text>
                    <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.success }}>
                      ${cliente.totalAbonado.toFixed(2)}
                    </Text>
                  </View>
                  {cliente.totalCondonado > 0.009 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                      <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Condonado</Text>
                      <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.warning }}>
                        ${cliente.totalCondonado.toFixed(2)}
                      </Text>
                    </View>
                  )}
                  <View
                    style={{
                      flexDirection: 'row', justifyContent: 'space-between',
                      borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm,
                    }}
                  >
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                      Saldo pendiente
                    </Text>
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.danger }}>
                      ${cliente.saldo.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <Text
                  style={{
                    fontSize: fontSize.label, fontWeight: 'bold',
                    color: colors.textPrimary, marginBottom: spacing.sm,
                  }}
                >
                  Ventas a crédito ({cliente.ventas.length})
                </Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    );
  }
}
