import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { formatoDinero } from '../config/formato';
import { StoreContext } from '../context/StoreContext';

/**
 * ConfirmarVentaModal — reemplaza el Alert de confirmación para ventas a crédito.
 * Permite capturar el abono inicial antes de registrar la venta. Por defecto
 * la venta queda SIN abono (el caso más común); el campo solo aparece al
 * activar "¿Deja abono ahora?", para no capturar abonos por accidente.
 *
 * Para ventas de contado no se usa este modal — se mantiene el Alert simple.
 *
 * @param {boolean}  visible
 * @param {string}   cliente       — nombre del cliente
 * @param {number}   total         — total del carrito
 * @param {function} onCancel
 * @param {function} onConfirmar   — recibe (abonoInicial: number)
 */
export default class ConfirmarVentaModal extends Component {
  static contextType = StoreContext;

  state = { dejaAbono: false, abonoInput: '' };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.setState({ dejaAbono: false, abonoInput: '' });
    }
  }

  get abonoNum() {
    if (!this.state.dejaAbono) return 0;
    const n = parseFloat(this.state.abonoInput.replace(',', '.'));
    return isNaN(n) || n < 0 ? 0 : n;
  }

  get saldoPendiente() {
    return Math.max(0, this.props.total - this.abonoNum);
  }

  handleConfirmar = () => {
    const moneda = this.context.config?.moneda ?? '$';
    const { total, onConfirmar } = this.props;
    const abono = this.abonoNum;

    if (abono > total + 0.009) {
      Alert.alert('Monto excede el total', `El total de la venta es ${formatoDinero(total, moneda)}.`);
      return;
    }

    onConfirmar(abono);
  };

  render() {
    const moneda = this.context.config?.moneda ?? '$';
    const { visible, onCancel, cliente, total } = this.props;
    const { dejaAbono, abonoInput } = this.state;
    const pendiente = this.saldoPendiente;
    const saldada = pendiente <= 0.009;

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
              width: '90%',
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
            }}
          >
            {/* Título */}
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
              Confirmar venta a crédito
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              Cliente: {cliente}
            </Text>

            {/* Total */}
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
                Total de la venta
              </Text>
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                {formatoDinero(total, moneda)}
              </Text>
            </View>

            {/* Abono inicial: apagado por defecto (venta sin abono) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
                ¿Deja abono ahora?
              </Text>
              <Switch
                value={dejaAbono}
                onValueChange={v => this.setState({ dejaAbono: v, abonoInput: '' })}
                trackColor={{ false: colors.chipInactive, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
            {dejaAbono && (
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
                placeholder="¿Cuánto paga? 0.00"
                placeholderTextColor={colors.placeholder}
                keyboardType="decimal-pad"
                autoFocus
                value={abonoInput}
                onChangeText={t => this.setState({ abonoInput: t })}
              />
            )}

            {/* Preview saldo resultante */}
            <View
              style={{
                backgroundColor: saldada ? colors.successSoft : colors.warningSoft,
                borderRadius: radius.sm,
                padding: spacing.md,
                marginBottom: spacing.lg,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.body, color: saldada ? colors.successDark : colors.textSecondary, fontWeight: saldada ? 'bold' : 'normal', flex: 1 }}>
                {saldada ? '¡Quedará saldado!' : 'Quedará debiendo'}
              </Text>
              {!saldada && (
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.dangerDark }}>
                  {formatoDinero(pendiente, moneda)}
                </Text>
              )}
            </View>

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
                onPress={this.handleConfirmar}
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
                  Confirmar venta
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
