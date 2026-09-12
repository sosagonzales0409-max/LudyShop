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
 * Modal para dar de alta un producto (o una nueva presentación/tamaño de
 * un producto que ya existe) en el inventario.
 *
 * @param {boolean} visible
 * @param {Array} categories // catálogo de categorías (incluye "Todos" en id 0)
 * @param {Array} products   // productos actuales, para validar duplicados
 * @param {function} onCancel
 * @param {function} onSave  // recibe { nombre, marca, tamano, precio, stock, categoriaId, existingProductId }
 */
export default class ProductFormModal extends Component {
  state = {
    nombre: '',
    marca: '',
    tamano: '',
    precio: '',
    stock: '',
    categoriaId: null,
  };

  componentDidUpdate(prevProps) {
    // Limpiar el formulario cada vez que el modal se vuelve a abrir
    if (this.props.visible && !prevProps.visible) {
      const selectable = (this.props.categories || []).filter(c => c.id !== 0);
      this.setState({
        nombre: '',
        marca: '',
        tamano: '',
        precio: '',
        stock: '',
        categoriaId: selectable.length > 0 ? selectable[0].id : null,
      });
    }
  }

  handleSave = () => {
    const { nombre, marca, tamano, precio, stock, categoriaId } = this.state;
    const precioNum = parseFloat(String(precio).replace(',', '.'));
    const stockNum = parseInt(stock, 10);

    if (!nombre.trim()) {
      Alert.alert('Falta información', 'Ingresa el nombre del producto.');
      return;
    }
    if (!marca.trim()) {
      Alert.alert('Falta información', 'Ingresa la marca del producto.');
      return;
    }
    if (!tamano.trim()) {
      Alert.alert(
        'Falta información',
        'Ingresa el tamaño o presentación (ej. 1 kg, 600 ml).',
      );
      return;
    }
    if (isNaN(precioNum) || precioNum <= 0) {
      Alert.alert('Precio inválido', 'Ingresa un precio válido mayor a 0.');
      return;
    }
    if (isNaN(stockNum) || stockNum < 0) {
      Alert.alert('Stock inválido', 'Ingresa una cantidad de stock válida.');
      return;
    }
    if (!categoriaId) {
      Alert.alert('Falta categoría', 'Selecciona una categoría.');
      return;
    }

    const nombreNorm = nombre.trim().toLowerCase();
    const marcaNorm = marca.trim().toLowerCase();
    const tamanoNorm = tamano.trim().toLowerCase();

    // ¿Ya existe este producto (mismo nombre + misma marca)?
    const existingProduct = (this.props.products || []).find(
      p =>
        p.nombre.trim().toLowerCase() === nombreNorm &&
        p.marca.trim().toLowerCase() === marcaNorm,
    );

    if (existingProduct) {
      // Si además ya tiene esta misma presentación/tamaño, es un duplicado real.
      const duplicatePresentacion = existingProduct.presentaciones.find(
        pres => pres.tamano.trim().toLowerCase() === tamanoNorm,
      );
      if (duplicatePresentacion) {
        Alert.alert(
          'Producto ya agregado',
          `"${nombre.trim()} ${tamano.trim()}" de la marca "${marca.trim()}" ya está en el inventario.`,
        );
        return;
      }
    }

    this.props.onSave({
      nombre: nombre.trim(),
      marca: marca.trim(),
      tamano: tamano.trim(),
      precio: precioNum,
      stock: stockNum,
      // Si el producto ya existe, respeta su categoría original en vez de
      // la que se haya seleccionado en este formulario.
      categoriaId: existingProduct ? existingProduct.categoriaId : categoriaId,
      existingProductId: existingProduct ? existingProduct.id : null,
    });
  };

  render() {
    const { visible, onCancel, categories = [] } = this.props;
    const selectableCategories = categories.filter(c => c.id !== 0);

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
              maxHeight: '85%',
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.lg,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                Nuevo Producto
              </Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={onCancel}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  X
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
              Si el nombre y la marca ya existen, esto se agrega como una nueva
              presentación (tamaño) de ese mismo producto.
            </Text>

            <ScrollView style={{ marginTop: spacing.lg }}>
              <Text style={labelStyle}>Nombre</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. Arroz"
                placeholderTextColor={colors.textMuted}
                value={this.state.nombre}
                onChangeText={text => this.setState({ nombre: text })}
              />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Marca</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. Verde Valle"
                placeholderTextColor={colors.textMuted}
                value={this.state.marca}
                onChangeText={text => this.setState({ marca: text })}
              />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>
                Tamaño / Presentación
              </Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. 1 kg, 600 ml, 3 L"
                placeholderTextColor={colors.textMuted}
                value={this.state.tamano}
                onChangeText={text => this.setState({ tamano: text })}
              />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Precio</Text>
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={this.state.precio}
                onChangeText={text => this.setState({ precio: text })}
              />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Stock inicial</Text>
              <TextInput
                style={inputStyle}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={this.state.stock}
                onChangeText={text => this.setState({ stock: text })}
              />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Categoría</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {selectableCategories.map(cat => {
                  const isSelected = this.state.categoriaId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => this.setState({ categoriaId: cat.id })}
                      style={{
                        backgroundColor: isSelected ? colors.primary : colors.chipInactive,
                        borderRadius: radius.lg,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        marginRight: spacing.sm,
                        marginBottom: spacing.sm,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: fontSize.label,
                          fontWeight: 'bold',
                          color: isSelected ? colors.white : colors.textPrimary,
                        }}
                      >
                        {cat.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={this.handleSave}
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
                Guardar producto
              </Text>
            </TouchableOpacity>
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
