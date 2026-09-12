import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Image,
  Text,
  Dimensions,
  SafeAreaView,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import ProductFormModal from './ProductFormModal';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

class Inventory extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      selectedCategory: 0,
      searchText: '',
      showAddProductModal: false,
    };
    this.productListRef = React.createRef();
  }

  // Al cambiar de categoría o de texto de búsqueda, el FlatList conserva su
  // posición de scroll anterior. Si el nuevo listado filtrado es más corto,
  // eso se ve como un hueco en blanco. Forzamos el scroll a 0 en cada cambio.
  resetListScroll() {
    if (this.productListRef.current) {
      this.productListRef.current.scrollToOffset({
        offset: 0,
        animated: false,
      });
    }
  }

  selectCategory(categoryId) {
    this.setState({ selectedCategory: categoryId }, () =>
      this.resetListScroll(),
    );
  }

  updateSearchText(text) {
    this.setState({ searchText: text }, () => this.resetListScroll());
  }

  getTotalValue() {
    const { products } = this.context;
    let total = 0;
    products.forEach(product => {
      product.presentaciones.forEach(pres => {
        total += pres.precio * pres.stock;
      });
    });
    return total.toFixed(2);
  }

  getLowStockCount() {
    const { products } = this.context;
    let count = 0;
    products.forEach(product => {
      product.presentaciones.forEach(pres => {
        if (pres.stock < 5) count += 1;
      });
    });
    return count;
  }

  // Filtro combinado de categoría + búsqueda (por nombre o marca), calculado
  // directo del Context, a nivel de producto (no de presentación individual).
  getFilteredProducts() {
    const { products } = this.context;
    const { selectedCategory, searchText } = this.state;
    const search = searchText.trim().toLowerCase();

    return products.filter(product => {
      const matchesCategory =
        selectedCategory === 0 ||
        String(product.categoriaId) === String(selectedCategory);
      const matchesSearch =
        !search ||
        product.nombre.toLowerCase().includes(search) ||
        product.marca.toLowerCase().includes(search);
      return matchesCategory && matchesSearch;
    });
  }

  confirmDeletePresentacion(product, presentacion) {
    Alert.alert(
      'Eliminar presentación',
      `¿Seguro que quieres eliminar "${product.nombre} ${presentacion.tamano}" (${product.marca})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () =>
            this.context.deletePresentacion(product.id, presentacion.id),
        },
      ],
    );
  }

  renderCategories(item) {
    return (
      <TouchableOpacity
        onPress={() => this.selectCategory(item.id)}
        style={{
          height: 45,
          width: 'auto',
          backgroundColor:
            this.state.selectedCategory == item.id ? '#0088ff' : '#ccc',
          borderRadius: 15,
          justifyContent: 'center',
          alignItems: 'center',
          flex: 1,
          marginHorizontal: 5,
        }}
      >
        <Text
          style={{
            textAlign: 'center',
            fontSize: 18,
            fontWeight: 'bold',
            marginHorizontal: 10,
          }}
        >
          {item.nombre}
        </Text>
      </TouchableOpacity>
    );
  }

  renderProductItem(product) {
    return (
      <View
        style={{
          marginTop: 10,
          width: '100%',
          paddingHorizontal: 15,
          backgroundColor: '#fff',
          flexDirection: 'column',
          justifyContent: 'center',
          elevation: 4,
          shadowOpacity: 0.1,
          borderRadius: 10,
          paddingVertical: 10,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
            {product.nombre}
          </Text>
          <Text style={{ fontSize: 14, color: '#7A7C80', fontStyle: 'italic' }}>
            {product.marca}
          </Text>
        </View>

        {product.presentaciones.map(pres => (
          <View
            key={pres.id}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTopWidth: 1,
              borderTopColor: '#eee',
              paddingTop: 10,
              marginTop: 10,
            }}
          >
            <View>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>
                {pres.tamano}
              </Text>
              <Text style={{ fontSize: 14, color: '#7A7C80' }}>
                ${pres.precio}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: pres.stock < 5 ? '#D9534F' : 'green',
                  marginRight: 10,
                }}
              >
                {pres.stock} Unidades
              </Text>
              <TouchableOpacity
                onPress={() => this.confirmDeletePresentacion(product, pres)}
              >
                <Text
                  style={{
                    fontSize: 12,
                    backgroundColor: 'red',
                    color: '#fff',
                    padding: 5,
                    borderRadius: 5,
                    textAlign: 'center',
                  }}
                >
                  D
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  }

  render() {
    const { categories } = this.context;
    const filteredProducts = this.getFilteredProducts();

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <ProductFormModal
          visible={this.state.showAddProductModal}
          categories={categories}
          products={this.context.products}
          onCancel={() => this.setState({ showAddProductModal: false })}
          onSave={data => {
            if (data.existingProductId) {
              this.context.addPresentacion(data.existingProductId, {
                tamano: data.tamano,
                precio: data.precio,
                stock: data.stock,
              });
            } else {
              this.context.addProduct(data);
            }
            this.setState({ showAddProductModal: false });
          }}
        />

        {/* Barra verde superior */}
        <View
          style={{
            width: _window.width,
            height: GREEN_BAR_HEIGHT,
            backgroundColor: 'green',
          }}
        />

        {/* Header Inventario */}
        <View
          style={{
            paddingHorizontal: 15,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
            backgroundColor: '#fff',
            height: 60,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: 'bold', flex: 1 }}>
            Inventario
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

        {/* Contenido debajo del inventario */}
        <View
          style={{
            width: '90%',
            alignSelf: 'center',
            paddingVertical: 10,
          }}
        >
          <View
            style={{
              paddingVertical: 5,
              width: '100%',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                marginTop: 5,
              }}
            >
              {/* Tarjeta 1 */}
              <View
                style={{
                  width: '45%',
                  backgroundColor: '#0088ff',
                  borderRadius: 15,
                  marginHorizontal: 10,
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                }}
              >
                <Text
                  style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}
                >
                  Valor total
                </Text>
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 18,
                    marginTop: 5,
                  }}
                >
                  ${this.getTotalValue()}
                </Text>
              </View>

              {/* Tarjeta 2 */}
              <View
                style={{
                  width: '45%',
                  backgroundColor: '#FC9E3A',
                  borderRadius: 15,
                  marginHorizontal: 10,
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  paddingVertical: 10,
                  paddingHorizontal: 10,
                }}
              >
                <Text
                  style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}
                >
                  Stock Bajo
                </Text>
                <Text
                  style={{
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: 18,
                    marginTop: 5,
                  }}
                >
                  {this.getLowStockCount()} Presentaciones
                </Text>
              </View>
            </View>
          </View>
          <TextInput
            style={{
              fontFamily: 'AvenirNext-DemiBold',
              color: '#000000',
              paddingHorizontal: 10,
              fontSize: 18,
              marginTop: 10,
              textAlign: 'left',
              borderWidth: 1,
              borderRadius: 10,
              width: 'auto',
              justifyContent: 'center',
              marginHorizontal: 8,
            }}
            placeholder="Buscar por nombre o marca"
            placeholderTextColor="#777"
            value={this.state.searchText}
            onChangeText={text => this.updateSearchText(text)}
          />
        </View>
        <View
          style={{
            width: '86%',
            alignSelf: 'center',
            alignItems: 'center',
            flex: 1,
          }}
        >
          <FlatList
            style={{ paddingBottom: 15 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={categories}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => this.renderCategories(item)}
          />

          <TouchableOpacity
            onPress={() => this.setState({ showAddProductModal: true })}
            style={{
              width: '100%',
              height: 45,
              backgroundColor: '#0088ff',
              borderRadius: 15,
              justifyContent: 'center',
              alignItems: 'center',
              marginTop: 10,
            }}
          >
            <Text
              style={{ textAlign: 'center', fontSize: 18, fontWeight: 'bold' }}
            >
              + Agregar Producto
            </Text>
          </TouchableOpacity>

          <FlatList
            ref={this.productListRef}
            style={{ width: '100%', marginTop: 10, flex: 1 }}
            data={filteredProducts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => this.renderProductItem(item)}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <Text style={{ fontSize: 16, color: '#888' }}>
                  No hay productos
                </Text>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    );
  }
}

export default Inventory;
