import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

/**
 * DetalleDeudaModal — bottom sheet con el detalle completo de la deuda
 * de un cliente. Todo el flujo ocurre en un solo nivel de modal:
 *
 *   • Resumen de deuda / abonado / pendiente
 *   • Lista de ventas a crédito con sus productos
 *   • Panel inline para editar el abono de una venta puntual
 *   • Panel inline para renombrar al cliente
 *   • Eliminar venta (condonar o devolver stock) vía Alert nativo
 *
 * No hay sub-modales — todo se expande/colapsa dentro del mismo sheet.
 *
 * @param {boolean}  visible
 * @param {object}   cliente          — objeto agrupado: { cliente, saldo,
 *                                       totalDeuda, totalAbonado, ventas[], fechaUltima }
 * @param {function} onClose
 * @param {function} onAjustarAbono   — (saleId, nuevoAbonado)
 * @param {function} onEliminarVenta  — (venta, devolverStock)
 * @param {function} onRenombrar      — (clienteActual, clienteNuevo)
 */
export default class DetalleDeudaModal extends Component {
  state = {
    // id de la venta cuyo panel de edición de abono está abierto
    editandoAbonoId: null,
    montoAbonoInput: '',
    // panel de renombrar cliente visible
    editandoNombre: false,
    nombreInput: '',
  };

  componentDidUpdate(prevProps) {
    // Cerrar paneles cada vez que el modal se abre de nuevo
    if (this.props.visible && !prevProps.visible) {
      this.setState({
        editandoAbonoId: null,
        montoAbonoInput: '',
        editandoNombre: false,
        nombreInput: '',
      });
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  pendienteDe(venta) {
    return Math.max(0, venta.total - (venta.totalAbonado ?? 0));
  }

  // ─── Acciones ───────────────────────────────────────────────────────────

  abrirEditarAbono(venta) {
    this.setState({
      editandoAbonoId: venta.id,
      montoAbonoInput: String((venta.totalAbonado ?? 0).toFixed(2)),
      editandoNombre: false,
    });
  }

  cerrarEditarAbono() {
    this.setState({ editandoAbonoId: null, montoAbonoInput: '' });
  }

  guardarAbono(venta) {
    const monto = parseFloat(this.state.montoAbonoInput.replace(',', '.'));
    if (isNaN(monto) || monto < 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto entre 0 y el total de la venta.');
      return;
    }
    if (monto > venta.total + 0.009) {
      Alert.alert('Monto excede la venta', `El total de esta venta es $${venta.total.toFixed(2)}.`);
      return;
    }
    this.props.onAjustarAbono(venta.id, monto);
    this.cerrarEditarAbono();
  }

  confirmarEliminar(venta) {
    Alert.alert(
      'Eliminar venta de la deuda',
      `¿Qué ocurrió con esta venta de $${venta.total.toFixed(2)} del ${this.formatFecha(venta.fecha)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Condonar (no devolver mercancía)',
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
    this.setState({
      editandoNombre: true,
      nombreInput: this.props.cliente?.cliente ?? '',
      editandoAbonoId: null,
    });
  }

  cerrarRenombrar() {
    this.setState({ editandoNombre: false, nombreInput: '' });
  }

  guardarNombre() {
    const nuevo = this.state.nombreInput.trim();
    if (!nuevo) {
      Alert.alert('Nombre inválido', 'El nombre no puede quedar vacío.');
      return;
    }
    this.props.onRenombrar(this.props.cliente.cliente, nuevo);
    this.cerrarRenombrar();
  }

  // ─── Render ventas ──────────────────────────────────────────────────────

  renderVenta(venta) {
    const pendiente = this.pendienteDe(venta);
    const saldada = pendiente <= 0.009;
    const editandoEsta = this.state.editandoAbonoId === venta.id;
    const montoNum = parseFloat(this.state.montoAbonoInput.replace(',', '.'));

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
        {/* ── Fila superior: fecha + total + eliminar ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {this.formatFecha(venta.fecha)}
            </Text>
            <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: 2 }}>
              Total: ${venta.total.toFixed(2)}
            </Text>
          </View>

          {/* Badge estado */}
          {saldada ? (
            <View style={{ backgroundColor: colors.success, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginRight: spacing.sm }}>
              <Text style={{ color: colors.white, fontSize: fontSize.small, fontWeight: 'bold' }}>Saldada</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'flex-end', marginRight: spacing.sm }}>
              <Text style={{ fontSize: fontSize.small, color: colors.textMuted }}>Pendiente</Text>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.danger }}>
                ${pendiente.toFixed(2)}
              </Text>
            </View>
          )}

          {/* Botón eliminar */}
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

        {/* ── Productos de la venta ── */}
        {Array.isArray(venta.productos) && venta.productos.length > 0 && (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm, marginBottom: spacing.sm }}>
            {venta.productos.map((p, i) => (
              <Text key={i} style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                {p.numProducts} × {p.nombre} {p.tamano}
              </Text>
            ))}
          </View>
        )}

        {/* ── Abonado + botón editar ── */}
        {!saldada && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, flex: 1 }}>
              Abonado: ${(venta.totalAbonado ?? 0).toFixed(2)}
            </Text>
            <TouchableOpacity
              onPress={() => editandoEsta ? this.cerrarEditarAbono() : this.abrirEditarAbono(venta)}
              style={{
                height: 32, paddingHorizontal: spacing.md,
                backgroundColor: editandoEsta ? colors.chipInactive : colors.card,
                borderRadius: radius.sm, borderWidth: 1, borderColor: colors.chipInactive,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: editandoEsta ? colors.textPrimary : colors.primary }}>
                {editandoEsta ? 'Cancelar' : '✏️ Editar abono'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Panel inline editar abono ── */}
        {editandoEsta && (
          <View
            style={{
              marginTop: spacing.md,
              borderTopWidth: 1, borderTopColor: colors.primary,
              paddingTop: spacing.md,
            }}
          >
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.sm }}>
              Corrige el monto ya cobrado para esta venta (0 – ${venta.total.toFixed(2)})
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1.5, borderColor: colors.primary,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                  fontSize: fontSize.itemTitle, fontWeight: 'bold',
                  color: colors.textPrimary, textAlign: 'center',
                }}
                placeholder="0.00"
                placeholderTextColor={colors.chipInactive}
                keyboardType="decimal-pad"
                autoFocus
                value={this.state.montoAbonoInput}
                onChangeText={t => this.setState({ montoAbonoInput: t })}
              />
              <TouchableOpacity
                onPress={() => this.guardarAbono(venta)}
                style={{
                  height: buttonHeight.action, paddingHorizontal: spacing.xl,
                  backgroundColor: colors.primary, borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                  Guardar
                </Text>
              </TouchableOpacity>
            </View>

            {/* Preview nuevo pendiente */}
            {!isNaN(montoNum) && montoNum >= 0 && (
              <Text style={{ fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.sm }}>
                Nuevo pendiente:{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  ${Math.max(0, venta.total - montoNum).toFixed(2)}
                  {montoNum >= venta.total ? ' — Venta saldada 🎉' : ''}
                </Text>
              </Text>
            )}
          </View>
        )}
      </View>
    );
  }

  // ─── Render principal ───────────────────────────────────────────────────

  render() {
    const { visible, onClose, cliente } = this.props;
    if (!cliente) return null;

    const { editandoNombre, nombreInput } = this.state;

    return (
      <Modal animationType="slide" transparent visible={visible}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: spacing.sm,
              paddingBottom: spacing.xxl,
              maxHeight: '92%',
            }}
          >
            {/* Handle */}
            <View
              style={{
                width: 40, height: 4, backgroundColor: colors.chipInactive,
                borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg,
              }}
            />

            {/* ── Header ── */}
            <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm }}>
              <View style={{ flex: 1 }}>

                {/* Nombre editable inline */}
                {editandoNombre ? (
                  <View>
                    <TextInput
                      style={{
                        fontSize: fontSize.heading, fontWeight: 'bold',
                        color: colors.textPrimary,
                        borderBottomWidth: 2, borderBottomColor: colors.primary,
                        paddingVertical: spacing.xs, marginBottom: spacing.sm,
                      }}
                      autoFocus
                      value={nombreInput}
                      onChangeText={t => this.setState({ nombreInput: t })}
                      onSubmitEditing={() => this.guardarNombre()}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <TouchableOpacity
                        onPress={() => this.cerrarRenombrar()}
                        style={{
                          height: 36, paddingHorizontal: spacing.lg,
                          backgroundColor: colors.chipInactive, borderRadius: radius.lg,
                          justifyContent: 'center', alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>
                          Cancelar
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => this.guardarNombre()}
                        style={{
                          height: 36, paddingHorizontal: spacing.lg,
                          backgroundColor: colors.primary, borderRadius: radius.lg,
                          justifyContent: 'center', alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.white }}>
                          Guardar nombre
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    onPress={() => this.abrirRenombrar()}
                    activeOpacity={0.7}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
                  >
                    <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                      {cliente.cliente}
                    </Text>
                    <Text style={{ fontSize: fontSize.caption, color: colors.primary }}>✏️</Text>
                  </TouchableOpacity>
                )}

                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
                  {cliente.ventas.length} {cliente.ventas.length === 1 ? 'venta' : 'ventas'} · última el {this.formatFecha(cliente.fechaUltima)}
                </Text>
              </View>

              {/* Cerrar */}
              <TouchableOpacity
                onPress={() => { this.setState({ editandoAbonoId: null, editandoNombre: false }); onClose(); }}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: fontSize.heading, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* ── Resumen ── */}
            <View
              style={{
                marginHorizontal: spacing.xl, marginBottom: spacing.lg,
                backgroundColor: colors.background, borderRadius: radius.md,
                padding: spacing.lg,
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

            {/* ── Sección ventas ── */}
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
              Ventas a crédito
            </Text>

            <ScrollView
              style={{ paddingHorizontal: spacing.xl }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {cliente.ventas.map(v => this.renderVenta(v))}
              {/* Padding final para que el último elemento no quede pegado al borde */}
              <View style={{ height: spacing.xl }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}
