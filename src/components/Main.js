import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import ProductsModal from './ProductsModal.js';
import NumericStepper from './NumericStepper.js';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

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
          padding: 10,
          shadowOpacity: 0.15,
          shadowRadius: 4,
          flex: 1,
          borderBottomColor: '#ccc',
          borderBottomWidth:
            index === this.state.cartProducts.length - 1 ? 0 : 2,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
              }}
            >
              {item.nombre} {item.tamano}
            </Text>
            <Text style={{ fontSize: 12, color: '#7A7C80', fontStyle: 'italic' }}>
              {item.marca}
            </Text>
          </View>
          <TouchableOpacity onPress={() => this.deleteProductFromCart(index)}>
            <Text
              style={{
                fontSize: 12,
                backgroundColor: 'red',
                padding: 5,
                borderRadius: 5,
                textAlign: 'center',
              }}
            >
              D
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={{ fontSize: 16, color: '#7A7C80' }}>
          ${item.precio} c/u
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 10,
            alignItems: 'center',
          }}
        >
          <NumericStepper
            value={item.numProducts}
            onChange={v => this.updateAmountProduct(index, v)}
            min={1}
            max={item.stock}
          />
          <View style={{ flex: 1 }} />
          <Text
            style={{
              fontSize: 20,
              fontWeight: 'bold',
            }}
          >
            ${item.totalPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  }

  addProductToCart(product) {
    // Se clona el producto para no mutar el arreglo del Context; el carrito
    // solo guarda una "copia de venta" (cantidad/subtotal) de ese producto.
    const cartItem = {
      ...product,
      numProducts: 1,
      totalPrice: product.precio,
    };
    this.setState(prevState => ({
      cartProducts: [...prevState.cartProducts, cartItem],
    }));
  }

  updateAmountProduct(index, value) {
    const products = [...this.state.cartProducts];
    products[index] = {
      ...products[index],
      numProducts: value,
      totalPrice: products[index].precio * value,
    };
    this.setState({ cartProducts: products });
  }

  getTotalCart() {
    let total = 0;
    this.state.cartProducts.forEach(product => {
      total += product.totalPrice;
    });
    return total.toFixed(2);
  }

  deleteProductFromCart(index) {
    const products = [...this.state.cartProducts];
    products.splice(index, 1);
    this.setState({ cartProducts: products });
  }

  confirmCompleteSale = () => {
    const { cartProducts, paymentType, clienteNombre } = this.state;

    if (cartProducts.length === 0) {
      return;
    }

    if (paymentType === 'Credito' && !clienteNombre.trim()) {
      Alert.alert(
        'Falta información',
        'Ingresa el nombre del cliente para ventas a crédito.',
      );
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
              cartProducts.map(p => ({
                productId: p.productId,
                presentacionId: p.presentacionId,
                cantidad: p.numProducts,
              })),
            );
            this.context.addSale({
              productos: cartProducts,
              total: parseFloat(this.getTotalCart()),
              tipoPago: paymentType,
              cliente: paymentType === 'Credito' ? clienteNombre.trim() : null,
            });
            this.setState({
              cartProducts: [],
              clienteNombre: '',
              paymentType: 'Contado',
            });
            Alert.alert('Venta completada', 'La venta se registró correctamente.');
          },
        },
      ],
    );
  };

  render() {
    const { sellableItems } = this.context;

    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#fff',
        }}
      >
        <View
          style={{
            width: _window.width / 1,
            height: GREEN_BAR_HEIGHT,
            backgroundColor: 'green',
          }}
        />
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
        <View
          style={{
            height: '8%',
            paddingHorizontal: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
            backgroundColor: '#fff',
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', flex: 1 }}>
            Nueva Venta
          </Text>

          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('perfilView')}
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              width: _window.width / 8,
              height: _window.height / 12,
            }}
          >
            <Image
              source={require('../images/user-circle.png')}
              style={{
                width: _window.width / 14,
                height: _window.width / 14,
                tintColor: '#000',
              }}
            />
          </TouchableOpacity>
        </View>
        <View
          style={{
            marginTop: 15,
            width: '90%',
            marginHorizontal: 20,
            paddingHorizontal: 15,
            backgroundColor: '#fff',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
            borderRadius: 20,
            flexDirection: 'column',
          }}
        >
          <View style={{ paddingVertical: 20, width: '100%' }}>
            <View style={{ alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 16 }}>Tipo de pago</Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: 15,
              }}
            >
              <TouchableOpacity
                onPress={() => this.setState({ paymentType: 'Contado' })}
                style={{
                  width: '45%',
                  height: 45,
                  backgroundColor:
                    this.state.paymentType === 'Contado' ? '#0088ff' : '#eee',
                  borderRadius: 15,
                  marginHorizontal: 10,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text>Contado</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => this.setState({ paymentType: 'Credito' })}
                style={{
                  width: '45%',
                  height: 45,
                  backgroundColor:
                    this.state.paymentType === 'Credito' ? '#0088ff' : '#eee',
                  borderRadius: 15,
                  marginHorizontal: 10,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text>Crédito</Text>
              </TouchableOpacity>
            </View>
          </View>
          {this.state.paymentType === 'Credito' ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginBottom: 10,
                width: '100%',
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  paddingHorizontal: 5,
                }}
              >
                Nombre del cliente
              </Text>
              <TextInput
                style={{
                  borderColor: '#ccc',
                  borderWidth: 1,
                  borderRadius: 10,
                  marginTop: 5,
                  marginBottom: 5,
                  paddingHorizontal: 10,
                  color: '#000000',
                }}
                placeholderTextColor={'black'}
                placeholder="Ingrese el nombre del cliente"
                value={this.state.clienteNombre}
                onChangeText={text => this.setState({ clienteNombre: text })}
              />
            </View>
          ) : null}
        </View>
        <View
          style={{
            width: '90%',
            marginHorizontal: 20,
            paddingHorizontal: 10,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              textAlign: 'center',
              marginTop: 15,
              fontSize: 18,
              fontWeight: 'bold',
            }}
          >
            Productos
          </Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity
            onPress={() => this.setState({ showProductModal: true })}
            style={{
              width: '40%',
              height: 45,
              backgroundColor: '#0088ff',
              borderRadius: 15,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 15,
            }}
          >
            <Text
              style={{
                textAlign: 'center',
                fontSize: 18,
                fontWeight: 'bold',
              }}
            >
              Agregar
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, marginTop: 10 }}>
          <View
            style={{
              marginTop: 15,
              width: '90%',
              marginHorizontal: 20,
              paddingHorizontal: 15,
              backgroundColor: '#fff',
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 4,
              shadowOpacity: 0.1,
              shadowOffset: { width: 0, height: 2 },
              borderRadius: 10,
              flexDirection: 'column',
            }}
          >
            {this.state.cartProducts.length === 0 ? (
              <View style={{ paddingVertical: 20, width: '100%' }}>
                <View style={{ alignSelf: 'center' }}>
                  <Image
                    source={require('../images/cart.png')}
                    style={{
                      width: 100,
                      height: 100,
                      tintColor: '#ccc',
                      alignSelf: 'center',
                    }}
                  />
                  <Text style={{ fontSize: 18, textAlign: 'center' }}>
                    No hay productos en el carrito
                  </Text>
                  <Text
                    style={{
                      fontSize: 16,
                      marginTop: 10,
                      color: '#888',
                      textAlign: 'center',
                    }}
                  >
                    Toca "Agregar" para Comenzar
                  </Text>
                </View>
              </View>
            ) : (
              <FlatList
                style={{
                  width: '100%',
                }}
                data={this.state.cartProducts}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item, index }) =>
                  this.renderProductItem(item, index)
                }
              />
            )}
          </View>
          {this.state.cartProducts.length > 0 ? (
            <View
              style={{
                marginTop: 15,
                width: '90%',
                marginHorizontal: 20,
                paddingHorizontal: 15,
                backgroundColor: '#0D57FF',
                elevation: 4,
                shadowOpacity: 0.1,
                shadowOffset: { width: 0, height: 2 },
                borderRadius: 10,
                paddingVertical: 15,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    flex: 1,
                    marginRight: 10,
                    color: '#fff',
                  }}
                >
                  Total
                </Text>
                <Text
                  style={{
                    fontSize: 20,
                    padding: 5,
                    borderRadius: 5,
                    textAlign: 'center',
                    color: '#fff',
                  }}
                >
                  ${this.getTotalCart()}
                </Text>
              </View>
              <TouchableOpacity
                onPress={this.confirmCompleteSale}
                style={{
                  width: '100%',
                  height: 45,
                  backgroundColor: '#fff',
                  borderRadius: 15,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginTop: 15,
                }}
              >
                <Text
                  style={{
                    textAlign: 'center',
                    fontSize: 18,
                    fontWeight: 'bold',
                    color: '#0088ff',
                  }}
                >
                  Completar Venta
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

export default Main;
