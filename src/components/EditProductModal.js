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
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: '90%',
              backgroundColor: '#ffffff',
              borderRadius: 20,
              padding: 20,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', flex: 1 }}>
                Editar presentación
              </Text>
              <TouchableOpacity onPress={onCancel}>
                <Text style={{ fontSize: 20, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
              {product.nombre} · {product.marca}
            </Text>

            <ScrollView>
              {/* Tamaño */}
              <Text style={labelStyle}>Tamaño / Presentación</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. 1 kg, 600 ml"
                placeholderTextColor="#777"
                value={this.state.tamano}
                onChangeText={text => this.setState({ tamano: text })}
              />

              {/* Precio */}
              <Text style={[labelStyle, { marginTop: 16 }]}>Precio ($)</Text>
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor="#777"
                keyboardType="decimal-pad"
                value={this.state.precio}
                onChangeText={text => this.setState({ precio: text })}
              />

              {/* Stock */}
              <Text style={[labelStyle, { marginTop: 16 }]}>Stock actual</Text>
              <TextInput
                style={inputStyle}
                placeholder="0"
                placeholderTextColor="#777"
                keyboardType="number-pad"
                value={this.state.stock}
                onChangeText={text => this.setState({ stock: text })}
              />
            </ScrollView>

            {/* Botones */}
            <View style={{ flexDirection: 'row', marginTop: 20, gap: 10 }}>
              <TouchableOpacity
                onPress={onCancel}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 15,
                  backgroundColor: '#eee',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#333' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={this.handleSave}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 15,
                  backgroundColor: '#0088ff',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#fff' }}>
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
  fontSize: 16,
  marginBottom: 6,
  color: '#333',
};

const inputStyle = {
  borderWidth: 1,
  borderColor: '#ccc',
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  fontSize: 16,
  color: '#000',
};
