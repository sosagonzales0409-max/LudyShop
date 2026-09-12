import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Text,
  FlatList,
  Alert,
  Image,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import ProductsModal from './ProductsModal.js';
import NumericStepper from './NumericStepper.js';
import ClientNameInput from './ClientNameInput';
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

  addProductToCart(product) {
    const cartItem = { ...product, numProducts: 1, totalPrice: product.precio };
    this.setState(prev => ({ cartProducts: [...prev.cartProducts, cartItem] }));
  }

  updateAmountProduct(index, value) {
    const products = [...this.state.cartProducts];
    products[index] = { ...products[index], numProducts: value, totalPrice: products[index].precio * value };
    this.setState({ cartProducts: products });
  }

  deleteProductFromCart(index) {
    const products = [...this.state.cartProducts];
    products.splice(index, 1);
    this.setState({ cartProducts: products });
  }

  getTotalCart() {
    return this.state.cartProducts.reduce((sum, p) => sum + p.totalPrice, 0).toFixed(2);
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

  // Pie de la FlatList: total + botón confirmar (solo si hay productos)
  renderListFooter() {
    if (this.state.cartProducts.length === 0) return null;

    return (
      <View
        style={{
          marginHorizontal: spacing.lg, marginTop: spacing.sm,
          marginBottom: spacing.xxl, padding: spacing.lg,
          backgroundColor: colors.primary, borderRadius: radius.md,
          elevation: 3, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.white }}>
            Total
          </Text>
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.white }}>
            ${this.getTotalCart()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={this.confirmCompleteSale}
          style={{
            height: buttonHeight.action, backgroundColor: colors.white,
            borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primary }}>
            Completar Venta
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  renderCartItem({ item, index }) {
    return (
      <View
        style={{
          marginHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.card,
          // Bordes redondeados solo en el primer y último elemento
          borderTopLeftRadius: index === 0 ? radius.md : 0,
          borderTopRightRadius: index === 0 ? radius.md : 0,
          borderBottomLeftRadius: index === this.state.cartProducts.length - 1 ? radius.md : 0,
          borderBottomRightRadius: index === this.state.cartProducts.length - 1 ? radius.md : 0,
          borderBottomWidth: index === this.state.cartProducts.length - 1 ? 0 : 1,
          borderBottomColor: colors.border,
          elevation: index === 0 ? 3 : 0,
          shadowOpacity: index === 0 ? 0.08 : 0,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Nombre + botón eliminar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.nombre} {item.tamano}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
              {item.marca}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => this.deleteProductFromCart(index)}
            style={{
              width: 32, height: 32, borderRadius: radius.sm,
              backgroundColor: colors.danger,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.caption, color: colors.white, fontWeight: 'bold' }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Precio unitario + stepper + subtotal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, flex: 1 }}>
            ${item.precio.toFixed(2)} c/u
          </Text>
          <NumericStepper
            value={item.numProducts}
            onChange={v => this.updateAmountProduct(index, v)}
            min={1}
            max={item.stock}
          />
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, minWidth: 72, textAlign: 'right' }}>
            ${item.totalPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  }

  render() {
    const { sellableItems, clientesConDeudaCount } = this.context;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Barra verde */}
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
            height: HEADER_HEIGHT, paddingHorizontal: spacing.lg,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.card, elevation: 4,
            shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Nueva Venta
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {/* Créditos con badge */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('Creditos')}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: fontSize.label }}>💳</Text>
              {clientesConDeudaCount > 0 && (
                <View
                  style={{
                    position: 'absolute', top: 2, right: 2,
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

            {/* Configuración */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('ConfigView')}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: fontSize.label }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tipo de pago — fuera del FlatList para que el TextInput no se desmonte ── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View
            style={{
              marginTop: spacing.lg, padding: spacing.lg,
              backgroundColor: colors.card, borderRadius: radius.md,
              elevation: 3, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.md }}>
              Tipo de pago
            </Text>
            <View style={{ flexDirection: 'row' }}>
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
                  <Text style={{
                    fontSize: fontSize.label, fontWeight: 'bold',
                    color: this.state.paymentType === tipo ? colors.white : colors.textPrimary,
                  }}>
                    {tipo === 'Credito' ? 'Crédito' : tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {this.state.paymentType === 'Credito' && (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm }}>
                  Nombre del cliente
                </Text>
                <ClientNameInput
                  value={this.state.clienteNombre}
                  onChangeText={text => this.setState({ clienteNombre: text })}
                />
              </View>
            )}
          </View>

          {/* Fila: "Productos" + botón Agregar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm }}>
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
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Agregar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Lista del carrito + estado vacío + total ── */}
        <FlatList
          data={this.state.cartProducts}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => this.renderCartItem({ item, index })}
          ListEmptyComponent={
            <View
              style={{
                marginHorizontal: spacing.lg,
                backgroundColor: colors.card, borderRadius: radius.md,
                alignItems: 'center', paddingVertical: spacing.xxl,
                elevation: 3, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 },
              }}
            >
              <Image
                source={require('../images/cart.png')}
                style={{ width: 80, height: 80, tintColor: colors.chipInactive }}
              />
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>
                Carrito vacío
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.xs }}>
                Toca "Agregar" para comenzar
              </Text>
            </View>
          }
          ListFooterComponent={() => this.renderListFooter()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }
}

export default Main;
