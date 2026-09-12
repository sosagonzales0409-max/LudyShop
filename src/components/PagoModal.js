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
 * PagoModal — registra un abono o pago completo a un cliente con deuda.
 *
 * @param {boolean}  visible
 * @param {string}   cliente      — nombre del cliente
 * @param {number}   deudaTotal   — saldo pendiente actual
 * @param {function} onCancel
 * @param {function} onSave       — recibe (cliente, monto)
 */
export default class PagoModal extends Component {
  state = { monto: '' };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.setState({ monto: '' });
    }
  }

  handleSave = () => {
    const monto = parseFloat(this.state.monto.replace(',', '.'));
    if (isNaN(monto) || monto <= 0) {
      Alert.alert('Monto inválido', 'Ingresa un monto mayor a 0.');
      return;
    }
    if (monto > this.props.deudaTotal + 0.009) {
      Alert.alert(
        'Monto excede la deuda',
        `El saldo pendiente es $${this.props.deudaTotal.toFixed(2)}. No puedes abonar más de eso.`,
      );
      return;
    }
    this.props.onSave(this.props.cliente, monto);
  };

  pagarTotal = () => {
    const total = this.props.deudaTotal.toFixed(2);
    Alert.alert(
      'Confirmar pago completo',
      `Se registrará el pago de toda la deuda: $${total}. ¿Deseas continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => this.setState({ monto: total }, this.handleSave),
        },
      ],
    );
  };

  render() {
    const { visible, onCancel, cliente, deudaTotal } = this.props;
    if (!cliente) return null;

    const montoNum = parseFloat(this.state.monto.replace(',', '.'));
    const nuevoSaldo =
      !isNaN(montoNum) && montoNum > 0
        ? Math.max(0, deudaTotal - montoNum)
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
              Registrar pago
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              {cliente}
            </Text>

            {/* Saldo actual */}
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
              <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>
                Saldo pendiente
              </Text>
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.danger }}>
                ${deudaTotal.toFixed(2)}
              </Text>
            </View>

            {/* Campo monto */}
            <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>
              Monto a pagar
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
                marginBottom: spacing.sm,
              }}
              placeholder="0.00"
              placeholderTextColor={colors.chipInactive}
              keyboardType="decimal-pad"
              autoFocus
              value={this.state.monto}
              onChangeText={text => this.setState({ monto: text })}
            />

            {/* Vista previa del nuevo saldo */}
            {nuevoSaldo !== null && (
              <Text style={{ fontSize: fontSize.caption, color: colors.primary, textAlign: 'center', marginBottom: spacing.md }}>
                Nuevo saldo:{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  ${nuevoSaldo.toFixed(2)}
                  {nuevoSaldo === 0 ? ' — ¡Deuda saldada! 🎉' : ''}
                </Text>
              </Text>
            )}

            {/* Botón pago total */}
            <TouchableOpacity
              onPress={this.pagarTotal}
              style={{
                height: buttonHeight.chip,
                borderRadius: radius.lg,
                borderWidth: 1.5,
                borderColor: colors.success,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.success }}>
                Pagar todo (${deudaTotal.toFixed(2)})
              </Text>
            </TouchableOpacity>

            {/* Cancelar / Guardar */}
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
                  Registrar abono
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
