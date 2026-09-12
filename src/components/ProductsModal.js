import React, { Component } from 'react';
import {
  Modal,
  View,
  Dimensions,
  Text,
  TouchableOpacity,
  Platform,
  Image,
  TextInput,
  FlatList,
} from 'react-native';
const _window = Dimensions.get('window');

export default class BirthdayModal extends Component {
  state = {
    searchText: '',
    filteredProducts: this.props.listProducts || [],
  };
  /**
   * This component shows a modal with a birthday greeting
   *
   * @param {boolean} visible // Indicates whether the modal should be visible or not.
   * @param {string} birthdayName // Indicates the name that should appear in the modal
   * @param {function} onCancel // Function to execute when clicking "Cancel".
   * @param {function} onLoad // Function that is executed when loading the component
   * @return {*}
   * @memberof BirthdayModal
   */

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
          backgroundColor: '#F7F7F7',
          padding: 15,
          borderRadius: 12,
          marginBottom: 20,
          elevation: 3,
          shadowOpacity: 0.15,
          shadowRadius: 4,
          width: '100%',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: 'bold',
                marginBottom: 2,
                flex: 1,
                marginRight: 10,
              }}
            >
              {item.nombre} {item.tamano}
            </Text>
            <Text style={{ fontSize: 13, color: '#7A7C80', fontStyle: 'italic' }}>
              {item.marca}
            </Text>
          </View>
          <Text
            style={{
              fontSize: 16,
              backgroundColor: '#B8E2FF',
              padding: 5,
              borderRadius: 5,
              textAlign: 'center',
              marginBottom: item.nombre.length >= 18 ? 20 : 0,
            }}
          >
            Stock: {item.stock}
          </Text>
        </View>
        <Text style={{ fontSize: 16, color: '#7A7C80', marginTop: 6 }}>
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
      <View>
        <Modal
          animationType="slide"
          transparent={true}
          visible={this.props.visible}
        >
          <View
            style={{
              height: _window.height / 1,
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            }}
          >
            <View
              style={{
                borderWidth: Platform.OS === 'ios' ? 0.5 : 0.5,
                borderColor: '#A8B6C8',
                width: '90%',
                marginTop: '5%',
                alignItems: 'center',
                backgroundColor: '#ffffff',
                borderRadius: 20,
                height: '85%',
              }}
            >
              <View
                style={{
                  width: '85%',
                  alignItems: 'flex-start',
                  marginTop: 15,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text
                    style={{
                      fontFamily: 'AvenirNext-DemiBold',
                      fontSize: 20,
                      color: '#000000',
                      fontWeight: 'bold',
                    }}
                  >
                    Seleccionar Producto
                  </Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => this.props.onCancel()}>
                    <Text
                      style={{
                        fontFamily: 'AvenirNext-DemiBold',
                        fontSize: 20,
                        color: '#000000',
                        fontWeight: 'bold',
                      }}
                    >
                      X
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={{
                    fontSize: 16,
                    fontFamily: 'AvenirNext-DemiBold',
                    color: '#000000',
                    paddingHorizontal: 10,
                    fontSize: 18,
                    marginTop: 10,
                    textAlign: 'left',
                    borderWidth: 1,
                    borderRadius: 10,
                    width: '100%',
                  }}
                  placeholder="Buscar productos"
                  placeholderTextColor="#777"
                  value={this.state.searchText}
                  onChangeText={text => this.filterProducts(text)}
                ></TextInput>
                <View style={{ height: '85%', width: '100%', marginTop: 10 }}>
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
      </View>
    );
  }
}
