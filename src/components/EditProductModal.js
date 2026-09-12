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
 * Modal para editar una presentación existente (precio, stock, tamaño).
 *
 * @param {boolean}  visible
 * @param {object}   product       — producto padre { id, nombre, marca, ... }
 * @param {object}   presentacion  — presentación a editar { id, tamano, precio, stock }
 * @param {function} onCancel
 * @param {function} onSave        — recibe (productId, presentacionId, { tamano, precio, stock })
 */
export default class EditProductModal extends Component {
  state = {
    tamano: '',
    precio: '',
    stock: '',
  };

  componentDidUpdate(prevProps) {
    // Inicializar el form con los valores actuales cada vez que se abre
    if (this.props.visible && !prevProps.visible && this.props.presentacion) {
      const { tamano, precio, stock } = this.props.presentacion;
      this.setState({
        tamano: tamano ?? '',
        precio: String(precio ?? ''),
        stock: String(stock ?? ''),
      });
    }
  }

  handleSave = () => {
    const { tamano, precio, stock } = this.state;
    const precioNum = parseFloat(String(precio).replace(',', '.'));
    const stockNum = parseInt(stock, 10);

    if (!tamano.trim()) {
      Alert.alert('Falta información', 'El tamaño / presentación no puede estar vacío.');
      return;
    }
    if (isNaN(precioNum) || precioNum <= 0) {
      Alert.alert('Precio inválido', 'Ingresa un precio válido mayor a 0.');
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Stock inválido', 'El stock no puede ser negativo.');
      return;
    }

    this.props.onSave(
      this.props.product.id,
      this.props.presentacion.id,
      {
        tamano: tamano.trim(),
        precio: precioNum,
        stock: stockNum,
      },
    );
  };

  render() {
    const { visible, onCancel, product, presentacion } = this.props;

    if (!product || !presentacion) return null;

    return (
      <Modal animationType="slide" transparent visible={visible}>
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
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
                Editar presentación
              </Text>
              <TouchableOpacity onPress={onCancel}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              {product.nombre} · {product.marca}
            </Text>

            <ScrollView>
              <Text style={labelStyle}>Tamaño / Presentación</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. 1 kg, 600 ml"
                placeholderTextColor={colors.textMuted}
                value={this.state.tamano}
                onChangeText={text => this.setState({ tamano: text })}
              />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Precio ($)</Text>
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={this.state.precio}
                onChangeText={text => this.setState({ precio: text })}
              />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Stock actual</Text>
              <TextInput
                style={inputStyle}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={this.state.stock}
                onChangeText={text => this.setState({ stock: text })}
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', marginTop: spacing.xl, gap: spacing.sm }}>
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

const labelStyle = {
  fontSize: fontSize.label,
  color: colors.textPrimary,
  marginBottom: spacing.xs,
};

const inputStyle = {
  borderWidth: 1,
  borderColor: colors.chipInactive,
  borderRadius: radius.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  fontSize: fontSize.body,
  color: colors.textPrimary,
};
