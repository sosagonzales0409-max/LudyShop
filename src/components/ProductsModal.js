import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Platform,
  TextInput,
  FlatList,
} from 'react-native';
import { colors, spacing, radius, fontSize } from '../config/theme';

/**
 * Modal para seleccionar un producto (presentación específica) y agregarlo
 * al carrito de venta.
 *
 * @param {boolean} visible
 * @param {Array} listProducts // items vendibles aplanados (una fila por presentación)
 * @param {Array} cartProducts // productos ya en el carrito, para ocultarlos de la lista
 * @param {function} onCancel
 * @param {function} onSelectProduct
 */
export default class ProductsModal extends Component {
  state = {
    searchText: '',
    filteredProducts: this.props.listProducts || [],
  };

  componentDidUpdate(prevProps) {
    if (this.props.visible && prevProps.visible !== this.props.visible) {
      this.setState({
        filteredProducts: this.props.listProducts,
        searchText: '',
      });
    }
  }

  renderProductItem(item) {
    return item.stock > 0 && !this.alreadyInCart(item) ? (
      <TouchableOpacity
        onPress={() => this.props.onSelectProduct(item)}
        style={{
          backgroundColor: colors.background,
          padding: spacing.lg,
          borderRadius: radius.md,
          marginBottom: spacing.lg,
          elevation: 3,
          shadowOpacity: 0.15,
          shadowRadius: 4,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.nombre} {item.tamano}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>
              {item.marca}
            </Text>
          </View>
          <Text
            style={{
              fontSize: fontSize.body,
              fontWeight: 'bold',
              backgroundColor: '#B8E2FF',
              color: colors.textPrimary,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.sm,
              borderRadius: radius.sm,
              alignSelf: 'flex-start',
            }}
          >
            Stock: {item.stock}
          </Text>
        </View>
        <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: spacing.sm }}>
          ${item.precio}
        </Text>
      </TouchableOpacity>
    ) : null;
  }

  filterProducts(text) {
    const search = text.toLowerCase();
    const filtered = this.props.listProducts.filter(
      p =>
        p.nombre.toLowerCase().includes(search) ||
        p.marca.toLowerCase().includes(search) ||
        p.tamano.toLowerCase().includes(search),
    );

    this.setState({
      searchText: text,
      filteredProducts: filtered,
    });
  }

  alreadyInCart(product) {
    // Cada presentación (tamaño) tiene un id compuesto único
    // (productId::presentacionId), así que comparar por id ya distingue
    // correctamente, por ejemplo, entre Coca-Cola 3L y Coca-Cola 600ml.
    return this.props.cartProducts.some(p => p.id === product.id);
  }

  render() {
    return (
      <Modal animationType="slide" transparent visible={this.props.visible}>
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            backgroundColor: colors.overlay,
          }}
        >
          <View
            style={{
              borderWidth: Platform.OS === 'ios' ? 0.5 : 0.5,
              borderColor: '#A8B6C8',
              width: '90%',
              marginTop: '5%',
              alignItems: 'center',
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              height: '85%',
            }}
          >
            <View style={{ width: '85%', alignItems: 'flex-start', marginTop: spacing.lg, flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  Seleccionar Producto
                </Text>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => this.props.onCancel()}>
                  <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                    X
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={{
                  fontSize: fontSize.body,
                  color: colors.textPrimary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  marginTop: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.chipInactive,
                  borderRadius: radius.sm,
                  width: '100%',
                }}
                placeholder="Buscar productos"
                placeholderTextColor={colors.textMuted}
                value={this.state.searchText}
                onChangeText={text => this.filterProducts(text)}
              />
              <View style={{ flex: 1, width: '100%', marginTop: spacing.md }}>
                <FlatList
                  data={this.state.filteredProducts}
                  keyExtractor={(item, index) => index.toString()}
                  renderItem={({ item }) => this.renderProductItem(item)}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
