import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';

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
    const cantidad = parseInt(this.state.cantidad, 10);

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

    return (
      <Modal animationType="fade" transparent visible={visible}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: '85%',
              backgroundColor: '#fff',
              borderRadius: 20,
              padding: 24,
            }}
          >
            {/* Título */}
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1a1a1a' }}>
              Agregar unidades
            </Text>
            <Text style={{ fontSize: 14, color: '#888', marginTop: 4, marginBottom: 20 }}>
              {product.nombre} {presentacion.tamano} · {product.marca}
            </Text>

            {/* Stock actual */}
            <View
              style={{
                backgroundColor: '#f0f0f0',
                borderRadius: 10,
                paddingVertical: 10,
                paddingHorizontal: 14,
                marginBottom: 16,
                flexDirection: 'row',
                justifyContent: 'space-between',
              }}
            >
              <Text style={{ fontSize: 15, color: '#555' }}>Stock actual</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#1a1a1a' }}>
                {presentacion.stock} unidades
              </Text>
            </View>

            {/* Campo de cantidad */}
            <Text style={{ fontSize: 16, marginBottom: 8, color: '#333' }}>
              ¿Cuántas unidades llegaron?
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                borderRadius: 10,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 24,
                fontWeight: 'bold',
                color: '#000',
                textAlign: 'center',
                marginBottom: 8,
              }}
              placeholder="0"
              placeholderTextColor="#bbb"
              keyboardType="number-pad"
              autoFocus
              value={this.state.cantidad}
              onChangeText={text => this.setState({ cantidad: text })}
            />

            {/* Vista previa del nuevo stock */}
            {parseInt(this.state.cantidad, 10) > 0 && (
              <Text style={{ fontSize: 13, color: '#0088ff', textAlign: 'center', marginBottom: 16 }}>
                Nuevo stock:{' '}
                <Text style={{ fontWeight: 'bold' }}>
                  {presentacion.stock + parseInt(this.state.cantidad, 10)} unidades
                </Text>
              </Text>
            )}

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                onPress={onCancel}
                style={{
                  flex: 1,
                  height: 48,
                  borderRadius: 14,
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
                  borderRadius: 14,
                  backgroundColor: '#0088ff',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#fff' }}>
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
