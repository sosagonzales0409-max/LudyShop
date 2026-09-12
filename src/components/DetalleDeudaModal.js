import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

const _window = Dimensions.get('window');

/**
 * DetalleDeudaModal — detalle de la deuda de un cliente: desglose de cada
 * venta a crédito, con acciones para corregir el abono, eliminar una venta
 * (devolviendo al inventario o condonando) y renombrar al cliente.
 *
 * @param {boolean}  visible
 * @param {object}   cliente       — objeto agrupado por getClientesConDeuda()
 * @param {function} onClose
 * @param {function} onAjustarAbono      — recibe (saleId, nuevoAbonado)
 * @param {function} onEliminarVenta     — recibe (venta, devolverStock)
 * @param {function} onRenombrar         — recibe (clienteActual, clienteNuevo)
 */
export default class DetalleDeudaModal extends Component {
  state = {
    ventaAbono: null,
    montoAbono: '',
    editandoNombre: false,
    nombreNuevo: '',
  };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.setState({
        ventaAbono: null,
        montoAbono: '',
        editandoNombre: false,
        nombreNuevo: '',
      });
    }
  }

  formatFecha(iso) {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${d.getFullYear()}`;
  }

  pendienteDe(venta) {
    return venta.total - (venta.totalAbonado ?? 0);
  }

  abrirEditarAbono(venta) {
    this.setState({
      ventaAbono: venta,
      montoAbono: String(venta.totalAbonado ?? 0),
    });
  }

  cerrarEditarAbono() {
    this.setState({ ventaAbono: null, montoAbono: '' });
  }

  guardarAbono() {
    const { ventaAbono, montoAbono } = this.state;
    if (!ventaAbono) return;

    const monto = parseFloat(String(montoAbono).replace(',', '.'));
    if (isNaN(monto) || monto < 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor o igual a 0.');
      return;
    }
    if (monto > ventaAbono.total) {
      Alert.alert(
        'Monto excede la venta',
        `El total de la venta es $${ventaAbono.total.toFixed(2)}.`,
      );
      return;
    }

    this.props.onAjustarAbono(ventaAbono.id, monto);
    this.cerrarEditarAbono();
  }

  confirmarEliminar(venta) {
    Alert.alert(
      'Eliminar venta de la deuda',
      `¿Qué ocurrió con esta venta de $${venta.total.toFixed(2)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Condonar deuda',
          onPress: () => this.props.onEliminarVenta(venta, false),
        },
        {
          text: 'Devolver al inventario',
          style: 'destructive',
          onPress: () => this.props.onEliminarVenta(venta, true),
        },
      ],
    );
  }

  abrirRenombrar() {
    this.setState({ editandoNombre: true, nombreNuevo: this.props.cliente.cliente });
  }

  cerrarRenombrar() {
    this.setState({ editandoNombre: false, nombreNuevo: '' });
  }

  guardarNombre() {
    const nuevo = this.state.nombreNuevo.trim();
    if (!nuevo) {
      Alert.alert('Nombre inválido', 'El nombre no puede quedar vacío.');
      return;
    }
    this.props.onRenombrar(this.props.cliente.cliente, nuevo);
    this.cerrarRenombrar();
  }

  renderVenta(venta) {
    const pendiente = this.pendienteDe(venta);
    const saldada = pendiente <= 0.009;

    return (
      <View
        key={venta.id}
        style={{
          backgroundColor: colors.background,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        {/* Fecha + total */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
            {this.formatFecha(venta.fecha)}
          </Text>
          <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
            ${venta.total.toFixed(2)}
          </Text>
        </View>

        {/* Productos */}
        {Array.isArray(venta.productos) &&
          venta.productos.map((p, i) => (
            <Text key={i} style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
              {p.numProducts} × {p.nombre} {p.tamano}
            </Text>
          ))}

        {/* Abonado / Pendiente */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
            Abonado: ${(venta.totalAbonado ?? 0).toFixed(2)}
          </Text>
          {saldada ? (
            <View style={{ backgroundColor: colors.success, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
              <Text style={{ color: colors.white, fontSize: fontSize.small, fontWeight: 'bold' }}>
                Saldada
              </Text>
            </View>
          ) : (
            <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.danger }}>
              ${pendiente.toFixed(2)}
            </Text>
          )}
        </View>

        {/* Acciones */}
        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
          <TouchableOpacity
            onPress={() => this.abrirEditarAbono(venta)}
            style={{
              flex: 1, height: buttonHeight.chip,
              backgroundColor: colors.chipInactive, borderRadius: radius.lg,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
              ✏️ Editar abono
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => this.confirmarEliminar(venta)}
            style={{
              width: buttonHeight.chip, height: buttonHeight.chip,
              backgroundColor: '#fde8e8', borderRadius: radius.lg,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.body }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  render() {
    const { visible, onClose, cliente } = this.props;
    if (!cliente) return null;

    const ventasCredito = cliente.ventas;

    return (
      <Modal animationType="fade" transparent visible={visible}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: '92%',
              maxHeight: _window.height * 0.9,
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
            }}
          >
            {/* Título */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  {cliente.cliente}
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
                  {ventasCredito.length} {ventasCredito.length === 1 ? 'venta' : 'ventas'} a crédito · última {this.formatFecha(cliente.fechaUltima)}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8} style={{ padding: spacing.xs }}>
                <Text style={{ fontSize: fontSize.heading, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Renombrar cliente */}
            <TouchableOpacity
              onPress={() => this.abrirRenombrar()}
              style={{ marginTop: spacing.md, alignSelf: 'flex-start' }}
            >
              <Text style={{ fontSize: fontSize.body, color: colors.primary, fontWeight: 'bold' }}>
                ✏️ Renombrar cliente
              </Text>
            </TouchableOpacity>

            {/* Resumen */}
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: radius.md,
                padding: spacing.lg,
                marginTop: spacing.md,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Deuda total</Text>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                  ${cliente.totalDeuda.toFixed(2)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Total abonado</Text>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.success }}>
                  ${cliente.totalAbonado.toFixed(2)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>Saldo pendiente</Text>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.danger }}>
                  ${cliente.saldo.toFixed(2)}
                </Text>
              </View>
            </View>

            {/* Ventas */}
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.sm }}>
              Ventas a crédito
            </Text>
            <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ maxHeight: _window.height * 0.38 }}>
              {ventasCredito.map(v => this.renderVenta(v))}
            </ScrollView>

            {/* Cerrar */}
            <TouchableOpacity
              onPress={onClose}
              style={{
                height: buttonHeight.action,
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: spacing.lg,
              }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Cerrar
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Modal editar abono ── */}
          <Modal transparent visible={this.state.ventaAbono !== null} animationType="fade">
            <View
              style={{
                flex: 1,
                backgroundColor: colors.overlay,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '88%',
                  backgroundColor: colors.card,
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                }}
              >
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  Editar abono
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md }}>
                  Venta del {this.state.ventaAbono && this.formatFecha(this.state.ventaAbono.fecha)} · Total $
                  {this.state.ventaAbono && this.state.ventaAbono.total.toFixed(2)}
                </Text>

                <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>
                  Monto ya abonado
                </Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.chipInactive,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    fontSize: fontSize.heading,
                    fontWeight: 'bold',
                    color: colors.textPrimary,
                    textAlign: 'center',
                    marginBottom: spacing.xs,
                  }}
                  placeholder="0.00"
                  placeholderTextColor={colors.chipInactive}
                  keyboardType="decimal-pad"
                  autoFocus
                  value={this.state.montoAbono}
                  onChangeText={text => this.setState({ montoAbono: text })}
                />
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.lg }}>
                  Entre 0 y el total de la venta.
                </Text>

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => this.cerrarEditarAbono()}
                    style={{
                      flex: 1,
                      height: buttonHeight.action,
                      borderRadius: radius.lg,
                      backgroundColor: colors.chipInactive,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => this.guardarAbono()}
                    style={{
                      flex: 1,
                      height: buttonHeight.action,
                      borderRadius: radius.lg,
                      backgroundColor: colors.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                      Guardar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* ── Modal renombrar cliente ── */}
          <Modal transparent visible={this.state.editandoNombre} animationType="fade">
            <View
              style={{
                flex: 1,
                backgroundColor: colors.overlay,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <View
                style={{
                  width: '88%',
                  backgroundColor: colors.card,
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                }}
              >
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  Renombrar cliente
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md }}>
                  Se actualizará en todas sus ventas.
                </Text>

                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: colors.chipInactive,
                    borderRadius: radius.sm,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.md,
                    fontSize: fontSize.body,
                    color: colors.textPrimary,
                    marginBottom: spacing.lg,
                  }}
                  placeholder="Nombre del cliente"
                  placeholderTextColor={colors.chipInactive}
                  autoFocus
                  value={this.state.nombreNuevo}
                  onChangeText={text => this.setState({ nombreNuevo: text })}
                />

                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity
                    onPress={() => this.cerrarRenombrar()}
                    style={{
                      flex: 1,
                      height: buttonHeight.action,
                      borderRadius: radius.lg,
                      backgroundColor: colors.chipInactive,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => this.guardarNombre()}
                    style={{
                      flex: 1,
                      height: buttonHeight.action,
                      borderRadius: radius.lg,
                      backgroundColor: colors.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                      Guardar
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </Modal>
    );
  }
}