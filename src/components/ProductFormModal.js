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

    if (!nombre.trim()) { Alert.alert('Falta información', 'Ingresa el nombre del producto.'); return; }
    if (!marca.trim()) { Alert.alert('Falta información', 'Ingresa la marca del producto.'); return; }
    if (!tamano.trim()) { Alert.alert('Falta información', 'Ingresa el tamaño o presentación (ej. 1 kg, 600 ml).'); return; }
    if (isNaN(precioNum) || precioNum <= 0) { Alert.alert('Precio inválido', 'Ingresa un precio válido mayor a 0.'); return; }
    if (isNaN(stockNum) || stockNum < 0) { Alert.alert('Stock inválido', 'Ingresa una cantidad de stock válida.'); return; }
    if (!categoriaId) { Alert.alert('Falta categoría', 'Selecciona una categoría.'); return; }

    const nombreNorm = nombre.trim().toLowerCase();
    const marcaNorm = marca.trim().toLowerCase();
    const tamanoNorm = tamano.trim().toLowerCase();

    const existingProduct = (this.props.products || []).find(
      p => p.nombre.trim().toLowerCase() === nombreNorm && p.marca.trim().toLowerCase() === marcaNorm,
    );

    if (existingProduct) {
      const duplicatePresentacion = existingProduct.presentaciones.find(
        pres => pres.tamano.trim().toLowerCase() === tamanoNorm,
      );
      if (duplicatePresentacion) {
        Alert.alert('Producto ya agregado', `"${nombre.trim()} ${tamano.trim()}" de "${marca.trim()}" ya está en el inventario.`);
        return;
      }
    }

    this.props.onSave({
      nombre: nombre.trim(),
      marca: marca.trim(),
      tamano: tamano.trim(),
      precio: precioNum,
      stock: stockNum,
      categoriaId: existingProduct ? existingProduct.categoriaId : categoriaId,
      existingProductId: existingProduct ? existingProduct.id : null,
    });
  };

  render() {
    const { visible, onCancel, categories = [] } = this.props;
    const selectableCategories = categories.filter(c => c.id !== 0);

    return (
      <Modal animationType="slide" transparent visible={visible}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxHeight: '85%', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg }}>

            {/* Header con X de cierre con área táctil correcta */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
                Nuevo Producto
              </Text>
              <TouchableOpacity
                onPress={onCancel}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: fontSize.heading, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.lg }}>
              Si el nombre y la marca ya existen, esto se agrega como una nueva presentación de ese producto.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={labelStyle}>Nombre</Text>
              <TextInput style={inputStyle} placeholder="Ej. Arroz" placeholderTextColor={colors.textMuted}
                value={this.state.nombre} onChangeText={text => this.setState({ nombre: text })} />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Marca</Text>
              <TextInput style={inputStyle} placeholder="Ej. Verde Valle" placeholderTextColor={colors.textMuted}
                value={this.state.marca} onChangeText={text => this.setState({ marca: text })} />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Tamaño / Presentación</Text>
              <TextInput style={inputStyle} placeholder="Ej. 1 kg, 600 ml, 3 L" placeholderTextColor={colors.textMuted}
                value={this.state.tamano} onChangeText={text => this.setState({ tamano: text })} />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Precio ($)</Text>
              <TextInput style={inputStyle} placeholder="0.00" placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad" value={this.state.precio} onChangeText={text => this.setState({ precio: text })} />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Stock inicial</Text>
              <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted}
                keyboardType="number-pad" value={this.state.stock} onChangeText={text => this.setState({ stock: text })} />

              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Categoría</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
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
                        minHeight: 44,
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: isSelected ? colors.white : colors.textPrimary }}>
                        {cat.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={this.handleSave}
              style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Guardar producto</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
}

const labelStyle = { fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.xs };
const inputStyle = {
  borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  fontSize: fontSize.body, color: colors.textPrimary,
};
