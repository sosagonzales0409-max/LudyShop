import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { StoreContext } from '../context/StoreContext';
import { Campo, Etiqueta } from './Formulario';

/**
 * EditarDatosProductoModal — edita los datos del PRODUCTO (nombre, marca,
 * categoría), no de sus presentaciones (eso es EditarProductoView).
 * Es también la forma de reasignar la categoría de un producto, p. ej. para
 * poder borrar una categoría que está en uso.
 *
 * @param {boolean}  visible
 * @param {object}   product    — { id, nombre, marca, categoriaId }
 * @param {function} onClose
 */
export default class EditarDatosProductoModal extends Component {
  static contextType = StoreContext;

  state = { nombre: '', marca: '', categoriaId: null };

  componentDidUpdate(prevProps) {
    // Al abrir, precargar con los datos actuales del producto.
    if (this.props.visible && !prevProps.visible && this.props.product) {
      const { nombre, marca, categoriaId } = this.props.product;
      this.setState({ nombre, marca, categoriaId });
    }
  }

  handleGuardar = () => {
    const { nombre, marca, categoriaId } = this.state;
    const resultado = this.context.updateProduct(this.props.product.id, { nombre, marca, categoriaId });
    if (!resultado.ok) {
      Alert.alert('No se pudo guardar', resultado.error);
      return;
    }
    this.props.onClose();
  };

  render() {
    const { visible, onClose } = this.props;
    const { nombre, marca, categoriaId } = this.state;
    // Sin la pseudo-categoría "Todos" (id 0): no es una categoría real.
    const categorias = (this.context.categories || []).filter(c => c.id !== 0);

    return (
      <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '90%', maxHeight: '85%', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl }}>
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>Editar producto</Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
              Las ventas y compras anteriores conservan el nombre con el que se registraron.
            </Text>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: spacing.lg, paddingTop: spacing.lg }}>
              <Campo label="Nombre" value={nombre} onChangeText={t => this.setState({ nombre: t })} placeholder="Ej. Arroz" />
              <Campo label="Marca" opcional value={marca} onChangeText={t => this.setState({ marca: t })} placeholder="Ej. Verde Valle" />

              <View style={{ gap: 6 }}>
                <Etiqueta texto="Categoría" />
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {categorias.map(cat => {
                    const sel = String(categoriaId) === String(cat.id);
                    return (
                      <TouchableOpacity key={cat.id} onPress={() => this.setState({ categoriaId: cat.id })}
                        style={{ backgroundColor: sel ? colors.primary : colors.chipInactive, borderRadius: radius.lg, paddingHorizontal: spacing.md, minHeight: 40, justifyContent: 'center' }}>
                        <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: sel ? colors.white : colors.textPrimary }}>{cat.nombre}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <TouchableOpacity onPress={onClose} style={{ flex: 1, height: buttonHeight.action, borderRadius: radius.lg, backgroundColor: colors.chipInactive, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={this.handleGuardar} style={{ flex: 1, height: buttonHeight.action, borderRadius: radius.lg, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
