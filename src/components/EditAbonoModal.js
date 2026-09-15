import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

/**
 * EditAbonoModal — corrige el monto ya abonado de una venta puntual.
 *
 * @param {boolean}  visible
 * @param {object}   venta        — { id, total, totalAbonado, fecha }
 * @param {function} onCancel
 * @param {function} onSave       — recibe (saleId, nuevoAbonado)
 */
export default class EditAbonoModal extends Component {
  state = { montoInput: '' };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible && this.props.venta) {
      this.setState({
        montoInput: String((this.props.venta.totalAbonado ?? 0).toFixed(2)),
      });
    }
  }

  formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  handleSave = () => {
    const { venta, onSave } = this.props;
    const monto = parseFloat(this.state.montoInput.replace(',', '.'));
    const maxAbono = Math.max(0, venta.total - (venta.condonado ?? 0));

    if (isNaN(monto) || monto < 0) {
      Alert.alert('Monto inválido', 'Ingresa un valor entre 0 y el cobrable de la venta.');
      return;
    }
    if (monto > maxAbono + 0.009) {
      Alert.alert('Monto excede la venta', `El total cobrable de esta venta es $${maxAbono.toFixed(2)}.`);
      return;
    }

    onSave(venta.id, monto);
  };

  render() {
    const { visible, onCancel, venta } = this.props;
    if (!venta) return null;

    const montoNum = parseFloat(this.state.montoInput.replace(',', '.'));
    const maxAbono = Math.max(0, venta.total - (venta.condonado ?? 0));
    const condonado = venta.condonado ?? 0;
    const nuevoPendiente = !isNaN(montoNum) && montoNum >= 0
      ? Math.max(0, venta.total - montoNum - condonado)
      : null;

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
              width: '88%',
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
            }}
          >
            {/* Título */}
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
              Editar abono
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              Venta del {this.formatFecha(venta.fecha)} · Total ${venta.total.toFixed(2)}
            </Text>

            {/* Resumen actual */}
            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: radius.sm,
                padding: spacing.md,
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Abonado actual</Text>
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                ${(venta.totalAbonado ?? 0).toFixed(2)}
              </Text>
            </View>
            {condonado > 0.009 && (
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: radius.sm,
                  padding: spacing.md,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  marginBottom: spacing.lg,
                }}
              >
                <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Condonado</Text>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.warning }}>
                  ${condonado.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Label */}
            <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>
              Nuevo monto abonado (0 – ${maxAbono.toFixed(2)})
            </Text>

            {/* Input */}
            <TextInput
              style={{
                borderWidth: 1.5,
                borderColor: colors.primary,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                fontSize: fontSize.heading,
                fontWeight: 'bold',
                color: colors.textPrimary,
                textAlign: 'center',
                marginBottom: spacing.sm,
              }}
              placeholder="0.00"
              placeholderTextColor={colors.chipInactive}
              keyboardType="decimal-pad"
              autoFocus
              value={this.state.montoInput}
              onChangeText={t => this.setState({ montoInput: t })}
            />

            {/* Preview */}
            {nuevoPendiente !== null && (
              <Text style={{ fontSize: fontSize.caption, color: colors.primary, textAlign: 'center', marginBottom: spacing.lg }}>
                Pendiente resultante:{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  ${nuevoPendiente.toFixed(2)}
                  {nuevoPendiente === 0 ? ' — Venta saldada 🎉' : ''}
                </Text>
              </Text>
            )}

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={onCancel}
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
                onPress={this.handleSave}
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
    );
  }
}
