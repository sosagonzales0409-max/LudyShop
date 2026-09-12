import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';

/**
 * Modal de detalle de un producto completo.
 * Muestra todas sus presentaciones con stock, precio y acciones.
 *
 * Acciones por presentación:
 *   + Agregar unidades  →  llama onAgregarUnidades(product, presentacion)
 *   ✏️ Editar           →  llama onEditar(product, presentacion)
 *   🗑 Eliminar          →  confirma y llama onEliminar(productId, presentacionId)
 *
 * @param {boolean}  visible
 * @param {object}   product     — objeto completo con presentaciones[]
 * @param {function} onClose
 * @param {function} onAgregarUnidades — (product, presentacion)
 * @param {function} onEditar         — (product, presentacion)
 * @param {function} onEliminar       — (productId, presentacionId)
 */
export default class ProductDetailModal extends Component {
  confirmDelete(product, presentacion) {
    Alert.alert(
      'Eliminar presentación',
      `¿Seguro que quieres eliminar "${product.nombre} ${presentacion.tamano}"?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            this.props.onEliminar(product.id, presentacion.id);
            // Si era la última presentación, cerrar el modal
            if (product.presentaciones.length === 1) {
              this.props.onClose();
            }
          },
        },
      ],
    );
  }

  render() {
    const { visible, product, onClose, onAgregarUnidades, onEditar } = this.props;

    if (!product) return null;

    return (
      <Modal animationType="slide" transparent visible={visible}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 12,
              paddingBottom: 32,
              maxHeight: '85%',
            }}
          >
            {/* Handle visual */}
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: '#ddd',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 16,
              }}
            />

            {/* Header del producto */}
            <View
              style={{
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: 4,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' }}>
                  {product.nombre}
                </Text>
                <Text style={{ fontSize: 15, color: '#7A7C80', fontStyle: 'italic', marginTop: 2 }}>
                  {product.marca}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <Text style={{ fontSize: 22, color: '#aaa' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: 13, color: '#aaa', paddingHorizontal: 20, marginBottom: 16 }}>
              {product.presentaciones.length}{' '}
              {product.presentaciones.length === 1 ? 'presentación' : 'presentaciones'}
            </Text>

            {/* Lista de presentaciones */}
            <ScrollView style={{ paddingHorizontal: 20 }}>
              {product.presentaciones.map((pres, index) => (
                <View
                  key={pres.id}
                  style={{
                    backgroundColor: '#f8f8f8',
                    borderRadius: 14,
                    padding: 16,
                    marginBottom: 10,
                  }}
                >
                  {/* Info de la presentación */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1a1a1a' }}>
                        {pres.tamano}
                      </Text>
                      <Text style={{ fontSize: 15, color: '#555', marginTop: 2 }}>
                        ${pres.precio.toFixed(2)} c/u
                      </Text>
                    </View>
                    {/* Badge de stock */}
                    <View
                      style={{
                        backgroundColor: pres.stock === 0
                          ? '#D9534F'
                          : pres.stock < 5
                          ? '#FC9E3A'
                          : '#2e9e5b',
                        borderRadius: 10,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                        {pres.stock} uds
                      </Text>
                    </View>
                  </View>

                  {/* Acciones */}
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {/* + Agregar unidades */}
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onAgregarUnidades(product, pres);
                      }}
                      style={{
                        flex: 2,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: '#0088ff',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                        + Agregar unidades
                      </Text>
                    </TouchableOpacity>

                    {/* Editar */}
                    <TouchableOpacity
                      onPress={() => {
                        onClose();
                        onEditar(product, pres);
                      }}
                      style={{
                        flex: 1,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: '#e8e8e8',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#333', fontWeight: 'bold', fontSize: 14 }}>
                        ✏️ Editar
                      </Text>
                    </TouchableOpacity>

                    {/* Eliminar */}
                    <TouchableOpacity
                      onPress={() => this.confirmDelete(product, pres)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: '#fde8e8',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 16 }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}
