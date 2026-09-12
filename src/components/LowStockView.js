import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import EditProductModal from './EditProductModal';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

/**
 * LowStockView — pantalla con todas las presentaciones cuyo stock
 * está por debajo del umbral (default: 5 unidades).
 *
 * Se abre como pantalla dentro del stack de Inventario, navegando desde
 * el botón de la tarjeta naranja "Stock Bajo" en Inventory.js.
 *
 * Navegación esperada en router.js:
 *   <InventoryViews.Screen name="LowStock" component={LowStockView} />
 */
export default class LowStockView extends Component {
  static contextType = StoreContext;

  // El umbral puede venir como parámetro de navegación o usar el default
  get threshold() {
    return this.props.route?.params?.threshold ?? 5;
  }

  state = {
    showEditModal: false,
    selectedProduct: null,
    selectedPresentacion: null,
  };

  getLowStockItems() {
    const { products } = this.context;
    const threshold = this.threshold;
    const items = [];

    products.forEach(product => {
      product.presentaciones.forEach(pres => {
        if (pres.stock < threshold) {
          items.push({ product, presentacion: pres });
        }
      });
    });

    // Ordenar de menor stock a mayor (los más críticos primero)
    return items.sort((a, b) => a.presentacion.stock - b.presentacion.stock);
  }

  getStockChipStyle(stock) {
    if (stock === 0) {
      return { bg: '#D9534F', label: 'Sin stock' };
    }
    if (stock <= 2) {
      return { bg: '#D9534F', label: `${stock} uds` };
    }
    return { bg: '#FC9E3A', label: `${stock} uds` };
  }

  openEditModal(product, presentacion) {
    this.setState({
      showEditModal: true,
      selectedProduct: product,
      selectedPresentacion: presentacion,
    });
  }

  closeEditModal() {
    this.setState({
      showEditModal: false,
      selectedProduct: null,
      selectedPresentacion: null,
    });
  }

  handleSaveEdit = (productId, presentacionId, cambios) => {
    this.context.updatePresentacion(productId, presentacionId, cambios);
    this.closeEditModal();
  };

  renderItem({ product, presentacion }) {
    const chip = this.getStockChipStyle(presentacion.stock);

    return (
      <View
        style={{
          backgroundColor: '#fff',
          borderRadius: 12,
          padding: 14,
          marginBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          elevation: 3,
          shadowOpacity: 0.08,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Chip de stock (izquierda) */}
        <View
          style={{
            backgroundColor: chip.bg,
            borderRadius: 10,
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginRight: 14,
            minWidth: 62,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
            {chip.label}
          </Text>
        </View>

        {/* Info del producto */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#1a1a1a' }}>
            {product.nombre} {presentacion.tamano}
          </Text>
          <Text style={{ fontSize: 13, color: '#7A7C80', fontStyle: 'italic' }}>
            {product.marca}
          </Text>
          <Text style={{ fontSize: 13, color: '#555', marginTop: 2 }}>
            ${presentacion.precio.toFixed(2)} c/u
          </Text>
        </View>

        {/* Botón editar */}
        <TouchableOpacity
          onPress={() => this.openEditModal(product, presentacion)}
          style={{
            backgroundColor: '#0088ff',
            borderRadius: 10,
            paddingVertical: 8,
            paddingHorizontal: 12,
            marginLeft: 8,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>
            Editar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  render() {
    const items = this.getLowStockItems();
    const { showEditModal, selectedProduct, selectedPresentacion } = this.state;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        {/* Barra verde superior (consistente con el resto de la app) */}
        <View
          style={{
            width: _window.width,
            height: GREEN_BAR_HEIGHT,
            backgroundColor: 'green',
          }}
        />

        {/* Header */}
        <View
          style={{
            paddingHorizontal: 15,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#fff',
            height: 60,
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <TouchableOpacity
            onPress={() => this.props.navigation.goBack()}
            style={{ marginRight: 12 }}
          >
            <Text style={{ fontSize: 22, color: '#0088ff' }}>←</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: 'bold', flex: 1 }}>
            Stock bajo
          </Text>
          <View
            style={{
              backgroundColor: '#FC9E3A',
              borderRadius: 12,
              paddingVertical: 4,
              paddingHorizontal: 10,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
              {items.length} {items.length === 1 ? 'presentación' : 'presentaciones'}
            </Text>
          </View>
        </View>

        {/* Descripción */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, color: '#888' }}>
            Presentaciones con menos de {this.threshold} unidades en inventario,
            ordenadas de la más crítica a la menos crítica.
          </Text>
        </View>

        {/* Lista */}
        <FlatList
          data={items}
          keyExtractor={item => `${item.product.id}::${item.presentacion.id}`}
          renderItem={({ item }) => this.renderItem(item)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          ListEmptyComponent={() => (
            <View
              style={{
                alignItems: 'center',
                marginTop: 60,
              }}
            >
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: 'bold',
                  marginTop: 12,
                  color: '#333',
                }}
              >
                ¡Todo en orden!
              </Text>
              <Text style={{ fontSize: 15, color: '#888', marginTop: 6 }}>
                Ningún producto tiene stock bajo el umbral de {this.threshold} unidades.
              </Text>
            </View>
          )}
        />

        {/* Modal de edición */}
        <EditProductModal
          visible={showEditModal}
          product={selectedProduct}
          presentacion={selectedPresentacion}
          onCancel={() => this.closeEditModal()}
          onSave={this.handleSaveEdit}
        />
      </SafeAreaView>
    );
  }
}
