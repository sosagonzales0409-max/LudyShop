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
import { IconClose } from './Icon';

/**
 * Mini-modal para sumar unidades a una presentación existente.
 * Flujo rápido: llegó mercancía → ingresa cantidad → listo.
 *
 * @param {boolean}  visible
 * @param {object}   product       — { nombre, marca }
 * @param {object}   presentacion  — { id, tamano, stock }
 * @param {function} onCancel
 * @param {function} onSave        — recibe (productId, presentacionId, cantidad)
 */
export default class AgregarUnidadesModal extends Component {
  state = { cantidad: '' };

  componentDidUpdate(prevProps) {
    // Limpiar el campo cada vez que se abre
    if (this.props.visible && !prevProps.visible) {
      this.setState({ cantidad: '' });
    }
  }

  handleSave = () => {
    const esGranel = !!this.props.presentacion?.esGranel;
    const cantidad = esGranel ? parseFloat(this.state.cantidad) : parseInt(this.state.cantidad, 10);

    if (!this.state.cantidad.trim() || isNaN(cantidad) || cantidad <= 0) {
      Alert.alert('Cantidad inválida', 'Ingresa un número mayor a 0.');
      return;
    }

    this.props.onSave(
      this.props.product.id,
      this.props.presentacion.id,
      cantidad,
    );
  };

  render() {
    const { visible, onCancel, product, presentacion } = this.props;

    if (!product || !presentacion) return null;

    const esGranel = !!presentacion.esGranel;
    const unidad = esGranel ? (presentacion.unidadGranel || 'kg') : 'unidades';
    const cantidadNum = esGranel ? parseFloat(this.state.cantidad) : parseInt(this.state.cantidad, 10);

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
              width: '85%',
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 0 }}>
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
              Agregar unidades
            </Text>
            <TouchableOpacity
              onPress={onCancel}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <IconClose size={fontSize.heading} color={colors.textMuted} />
            </TouchableOpacity>
            </View>
          <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              {product.nombre} {presentacion.tamano} · {product.marca}
            </Text>

            <View
              style={{
                backgroundColor: colors.background,
                borderRadius: radius.sm,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                marginBottom: spacing.lg,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Stock actual</Text>
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                {presentacion.stock} {unidad}
              </Text>
            </View>

            <View style={{ backgroundColor: '#fff8ed', borderWidth: 1, borderColor: colors.warning, borderRadius: radius.sm, padding: spacing.md, marginBottom: spacing.lg }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.warning, fontWeight: 'bold' }}>
                ⚠️ Estas unidades no se registran como compra ni como inversión.
              </Text>
              <Text style={{ fontSize: fontSize.small, color: colors.textSecondary, marginTop: 2 }}>
                Solo ajustan el stock. Si compraste mercancía, usa "Registrar compra" para llevar el costo y el historial al día.
              </Text>
            </View>

            <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>
              {esGranel ? `¿Cuántos ${unidad} llegaron?` : '¿Cuántas unidades llegaron?'}
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
              placeholder={esGranel ? '0.000' : '0'}
              placeholderTextColor={colors.chipInactive}
              keyboardType="decimal-pad"
              autoFocus
              value={this.state.cantidad}
              onChangeText={text => this.setState({ cantidad: esGranel ? text : text.replace(/[^0-9]/g, '') })}
            />

            {cantidadNum > 0 && (
              <Text style={{ fontSize: fontSize.caption, color: colors.primary, textAlign: 'center', marginBottom: spacing.lg }}>
                Nuevo stock:{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  {presentacion.stock + cantidadNum} {unidad}
                </Text>
              </Text>
            )}

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
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
                  Agregar
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
