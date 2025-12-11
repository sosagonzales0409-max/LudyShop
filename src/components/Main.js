import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Image,
  StatusBar,
  Dimensions,
  Text,
  TextInput,
  Modal,
  FlatList,
  ScrollView,
} from 'react-native';
import ProductsModal from './ProductsModal.js';
import NumericStepper from './NumericStepper.js';
const _window = Dimensions.get('window');
const Products = [
  {
    nombre: 'Arroz 1kg',
    precio: 28.5,
    stock: 4,
  },
  {
    nombre: 'Frijol 1kg',
    precio: 32.0,
    stock: 35,
  },
  {
    nombre: 'Azúcar 1kg',
    precio: 27.0,
    stock: 50,
  },
  {
    nombre: 'Aceite vegetal 1L',
    precio: 38.9,
    stock: 25,
  },
  {
    nombre: 'Huevo (cartón 12 pzas)',
    precio: 36.0,
    stock: 15,
  },
  {
    nombre: 'Tortillas 1kg',
    precio: 22.0,
    stock: 60,
  },
  {
    nombre: 'Leche entera 1L',
    precio: 24.5,
    stock: 30,
  },
  {
    nombre: 'Pan blanco',
    precio: 34.0,
    stock: 20,
  },
  {
    nombre: 'Café soluble 100g',
    precio: 45.0,
    stock: 12,
  },
  {
    nombre: 'Agua embotellada 1.5L',
    precio: 15.0,
    stock: 70,
  },
  {
    nombre: 'Refresco 2L',
    precio: 28.0,
    stock: 25,
  },
  {
    nombre: 'Pasta para sopa',
    precio: 9.0,
    stock: 100,
  },
  {
    nombre: 'Atún en lata',
    precio: 18.5,
    stock: 45,
  },
  {
    nombre: 'Galletas saladas',
    precio: 12.0,
    stock: 50,
  },
  {
    nombre: 'Sardina en lata',
    precio: 16.5,
    stock: 20,
  },
];

class Main extends Component {
  constructor(props) {
    super(props);
    this.state = {
      paymentType: 'Contado',
      showProductModal: false,
      listProducts: Products,
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
          <View style={{}}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                flex: 1,
                marginRight: 10,
              }}
            >
              {item.nombre}
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
            ${item.totalPrice}
          </Text>
        </View>
      </View>
    );
  }

  addProductToCart(product) {
    product.numProducts = 1;
    product.totalPrice = product.precio;
    this.setState(prevState => ({
      cartProducts: [...prevState.cartProducts, product],
    }));
  }

  updateAmountProduct(index, value) {
    const products = [...this.state.cartProducts]; // copiar array
    products[index].numProducts = value; // actualizar sólo ese
    products[index].totalPrice = products[index].precio * value; // actualizar precio total
    this.setState({ cartProducts: products }); // actualizar estado
  }
  getTotalCart() {
    let total = 0;
    this.state.cartProducts.forEach(product => {
      total += product.totalPrice;
    });
    return total;
  }

 deleteProductFromCart(index) {
    const products = [...this.state.cartProducts]; // copiar array
    products.splice(index, 1); // eliminar sólo ese
    this.setState({ cartProducts: products }); // actualizar estado
  }

  updateSctockProduct() {
    const products = [...this.state.listProducts]; // copiar array
    const cartProducts = [...this.state.cartProducts]; // copiar array
    products.map((p, i) => {
      cartProducts.map((cp, j) => {
        if (p.nombre === cp.nombre) {
          p.stock = p.stock - cp.numProducts;
        }
      });
    });
    this.setState({ listProducts: products }); // actualizar estado
  }

  render() {
    const { onMenuPress, onProfilePress } = this.props;

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
            height: '5%',
            backgroundColor: 'green',
          }}
        />
        <ProductsModal
          visible={this.state.showProductModal}
          listProducts={this.state.listProducts}
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
          {/* Icono de menú */}
          <TouchableOpacity onPress={onMenuPress}>
            <Image
              source={require('../images/chevron-back-outline.png')}
              style={{ width: 28, height: 28 }}
            />
          </TouchableOpacity>

          {/* Espaciador */}

          <View style={{ flex: 1 }} />
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Nueva Venta</Text>
          <View style={{ flex: 1 }} />

          {/* Icono de perfil */}
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
            flexDirection: 'row',
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
            {/* Título alineado a la izquierda */}
            <View style={{ alignSelf: 'flex-start' }}>
              <Text style={{ fontSize: 16 }}>Tipo de pago</Text>
            </View>

            {/* Contenedor centrado */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: 15,
              }}
            >
              {/* View redondeada 1 */}
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

              {/* View redondeada 2 */}
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
                }}
                placeholderTextColor={'black'}
                placeholder="Ingrese el nombre del cliente"
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
              flexDirection: 'row',
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
                {/* Título alineado a la izquierda */}
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

                {/* Contenedor centrado */}
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'center',
                    marginTop: 15,
                  }}
                ></View>
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
            <TouchableOpacity
              onPress={() => this.setState({ showProductModal: true })}
              style={{
                marginTop: 15,
                width: '90%',
                marginHorizontal: 20,
                paddingHorizontal: 15,
                backgroundColor: '#0D57FF',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                elevation: 4,
                shadowOpacity: 0.1,
                shadowOffset: { width: 0, height: 2 },
                borderRadius: 10,
                flexDirection: 'column',
                paddingVertical: 15,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                }}
              >
                <View style={{ flex: 1 }}>
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
                </View>
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
                onPress={() => {
                  this.updateSctockProduct();
                  this.setState({ cartProducts: [] });
                }}
                style={{
                  width: '100%',
                  height: 45,
                  backgroundColor: '#0088ff',
                  borderRadius: 15,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginTop: 15,
                  backgroundColor: '#fff',
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
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      </View>
    );
  }
}

export default Main;
