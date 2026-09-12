import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import ProductsModal from './ProductsModal.js';
import NumericStepper from './NumericStepper.js';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;
const HEADER_HEIGHT = 60;

class Main extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      paymentType: 'Contado',
      clienteNombre: '',
      showProductModal: false,
      cartProducts: [],
    };
  }

  renderProductItem(item, index) {
    return (
      <View
        style={{
          paddingVertical: spacing.md,
          borderBottomColor: colors.border,
          borderBottomWidth: index === this.state.cartProducts.length - 1 ? 0 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.nombre} {item.tamano}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
              {item.marca}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => this.deleteProductFromCart(index)}
            style={{
              width: 28, height: 28, borderRadius: radius.sm,
              backgroundColor: colors.danger,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.small, color: colors.white, fontWeight: 'bold' }}>D</Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: spacing.xs }}>
          ${item.precio} c/u
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, alignItems: 'center' }}>
          <NumericStepper
            value={item.numProducts}
            onChange={v => this.updateAmountProduct(index, v)}
            min={1}
            max={item.stock}
          />
          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
            ${item.totalPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  }

  addProductToCart(product) {
    const cartItem = { ...product, numProducts: 1, totalPrice: product.precio };
    this.setState(prev => ({ cartProducts: [...prev.cartProducts, cartItem] }));
  }

  updateAmountProduct(index, value) {
    const products = [...this.state.cartProducts];
    products[index] = { ...products[index], numProducts: value, totalPrice: products[index].precio * value };
    this.setState({ cartProducts: products });
  }

  getTotalCart() {
    let total = 0;
    this.state.cartProducts.forEach(p => { total += p.totalPrice; });
    return total.toFixed(2);
  }

  deleteProductFromCart(index) {
    const products = [...this.state.cartProducts];
    products.splice(index, 1);
    this.setState({ cartProducts: products });
  }

  confirmCompleteSale = () => {
    const { cartProducts, paymentType, clienteNombre } = this.state;
    if (cartProducts.length === 0) return;
    if (paymentType === 'Credito' && !clienteNombre.trim()) {
      Alert.alert('Falta información', 'Ingresa el nombre del cliente para ventas a crédito.');
      return;
    }
    Alert.alert(
      'Confirmar venta',
      `Total: $${this.getTotalCart()}\n¿Deseas completar esta venta?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            this.context.decreaseStock(
              cartProducts.map(p => ({ productId: p.productId, presentacionId: p.presentacionId, cantidad: p.numProducts })),
            );
            this.context.addSale({
              productos: cartProducts,
              total: parseFloat(this.getTotalCart()),
              tipoPago: paymentType,
              cliente: paymentType === 'Credito' ? clienteNombre.trim() : null,
            });
            this.setState({ cartProducts: [], clienteNombre: '', paymentType: 'Contado' });
            Alert.alert('Venta completada', 'La venta se registró correctamente.');
          },
        },
      ],
    );
  };

  render() {
    const { sellableItems, clientesConDeudaCount } = this.context;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        <ProductsModal
          visible={this.state.showProductModal}
          listProducts={sellableItems}
          onCancel={() => this.setState({ showProductModal: false })}
          onSelectProduct={product => {
            this.addProductToCart(product);
            this.setState({ showProductModal: false });
          }}
          cartProducts={this.state.cartProducts}
        />

        {/* ── Header ── */}
        <View
          style={{
            height: HEADER_HEIGHT,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Nueva Venta
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {/* Botón Créditos — con badge si hay deudas */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('Creditos')}
              hitSlop={8}
              style={{
                width: 44, height: 44, borderRadius: radius.sm,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, color: colors.textSecondary }}>💳</Text>
              {clientesConDeudaCount > 0 && (
                <View
                  style={{
                    position: 'absolute', top: 0, right: 0,
                    backgroundColor: colors.danger,
                    borderRadius: 9, minWidth: 18, height: 18,
                    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
                    borderWidth: 2, borderColor: colors.card,
                  }}
                >
                  <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>
                    {clientesConDeudaCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Botón Configuración */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('ConfigView')}
              hitSlop={8}
              style={{
                width: 44, height: 44, borderRadius: radius.sm,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, color: colors.textSecondary }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg }}>
          {/* Tipo de pago */}
          <View
            style={{
              marginTop: spacing.lg, padding: spacing.lg,
              backgroundColor: colors.card, borderRadius: radius.md,
              elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              Tipo de pago
            </Text>
            <View style={{ flexDirection: 'row', marginTop: spacing.md }}>
              {['Contado', 'Credito'].map(tipo => (
                <TouchableOpacity
                  key={tipo}
                  onPress={() => this.setState({ paymentType: tipo })}
                  style={{
                    flex: 1,
                    height: buttonHeight.chip,
                    backgroundColor: this.state.paymentType === tipo ? colors.primary : colors.chipInactive,
                    borderRadius: radius.lg,
                    marginHorizontal: spacing.xs,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: this.state.paymentType === tipo ? colors.white : colors.textPrimary }}>
                    {tipo === 'Credito' ? 'Crédito' : tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {this.state.paymentType === 'Credito' && (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                  Nombre del cliente
                </Text>
                <TextInput
                  style={{
                    borderColor: colors.chipInactive, borderWidth: 1,
                    borderRadius: radius.sm, marginTop: spacing.sm,
                    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
                    fontSize: fontSize.body, color: colors.textPrimary,
                  }}
                  placeholderTextColor={colors.textMuted}
                  placeholder="Ingresa el nombre del cliente"
                  value={this.state.clienteNombre}
                  onChangeText={text => this.setState({ clienteNombre: text })}
                />
              </View>
            )}
          </View>

          {/* Productos */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
              Productos
            </Text>
            <TouchableOpacity
              onPress={() => this.setState({ showProductModal: true })}
              style={{
                height: buttonHeight.action, paddingHorizontal: spacing.xl,
                backgroundColor: colors.primary, borderRadius: radius.lg,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Agregar</Text>
            </TouchableOpacity>
          </View>

          {/* Carrito */}
          <View
            style={{
              marginTop: spacing.md, padding: spacing.lg,
              backgroundColor: colors.card, borderRadius: radius.md,
              elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
            }}
          >
            {this.state.cartProducts.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                <Image source={require('../images/cart.png')} style={{ width: 90, height: 90, tintColor: colors.chipInactive }} />
                <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>
                  No hay productos en el carrito
                </Text>
                <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.xs }}>
                  Toca "Agregar" para comenzar
                </Text>
              </View>
            ) : (
              <FlatList
                data={this.state.cartProducts}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) => this.renderProductItem(item, index)}
              />
            )}
          </View>

          {this.state.cartProducts.length > 0 && (
            <View
              style={{
                marginTop: spacing.md, marginBottom: spacing.xl, padding: spacing.lg,
                backgroundColor: '#0D57FF', borderRadius: radius.md,
                elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.white }}>Total</Text>
                <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.white }}>${this.getTotalCart()}</Text>
              </View>
              <TouchableOpacity
                onPress={this.confirmCompleteSale}
                style={{
                  height: buttonHeight.action, backgroundColor: colors.white,
                  borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg,
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primary }}>Completar Venta</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>
    );
  }
}

export default Main;
