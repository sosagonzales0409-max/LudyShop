import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Dimensions,
  SafeAreaView,
  TextInput,
  FlatList,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import ProductFormModal from './ProductFormModal';
import AgregarUnidadesModal from './AgregarUnidadesModal';
import CategoriasModal from './CategoriasModal';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;
const HEADER_HEIGHT = 60;
const SUMMARY_CARD_HEIGHT = 60;

class Inventory extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      selectedCategory: 0,
      searchText: '',
      showAddProductModal: false,
      showAgregarUnidadesModal: false,
      agregarProduct: null,
      agregarPresentacion: null,
      showCategoriasModal: false,
    };
    this.productListRef = React.createRef();
  }

  resetListScroll() {
    if (this.productListRef.current) {
      this.productListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }

  selectCategory(categoryId) {
    this.setState({ selectedCategory: categoryId }, () => this.resetListScroll());
  }

  updateSearchText(text) {
    this.setState({ searchText: text }, () => this.resetListScroll());
  }

  getTotalValue() {
    const { products } = this.context;
    let total = 0;
    products.forEach(p => p.presentaciones.forEach(pres => { total += pres.precio * pres.stock; }));
    return total.toFixed(2);
  }

  getLowStockCount() {
    const { products } = this.context;
    let count = 0;
    products.forEach(p => p.presentaciones.forEach(pres => { if (pres.stock < 5) count++; }));
    return count;
  }

  getFilteredProducts() {
    const { products } = this.context;
    const { selectedCategory, searchText } = this.state;
    const search = searchText.trim().toLowerCase();
    return products
      .filter(p => {
        const matchCat = selectedCategory === 0 || String(p.categoriaId) === String(selectedCategory);
        const matchSearch = !search || p.nombre.toLowerCase().includes(search) || p.marca.toLowerCase().includes(search);
        return matchCat && matchSearch;
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }

  renderCategories(item) {
    const isSelected = this.state.selectedCategory == item.id;
    return (
      <TouchableOpacity
        onPress={() => this.selectCategory(item.id)}
        style={{
          height: buttonHeight.chip, paddingHorizontal: spacing.lg,
          backgroundColor: isSelected ? colors.primary : colors.chipInactive,
          borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
        }}
      >
        <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: isSelected ? colors.white : colors.textPrimary }}>
          {item.nombre}
        </Text>
      </TouchableOpacity>
    );
  }

  renderProductItem(product) {
    return (
      // Toca la tarjeta → navega a ProductDetailView (pantalla completa)
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => this.props.navigation.navigate('ProductDetail', { productId: product.id })}
        style={{
          marginTop: spacing.md, padding: spacing.lg,
          backgroundColor: colors.card, borderRadius: radius.md,
          elevation: 3, shadowOpacity: 0.07,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Nombre + marca + indicador de navegación */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            {product.nombre}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic', marginRight: spacing.xs }}>
              {product.marca}
            </Text>
            <Text style={{ fontSize: fontSize.itemTitle, color: colors.textMuted }}>›</Text>
          </View>
        </View>

        {/* Presentaciones — resumen compacto, acciones en la vista de detalle */}
        {product.presentaciones.map((pres, idx) => (
          <View
            key={pres.id}
            style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingTop: spacing.sm, marginTop: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary }}>
                {pres.tamano}
              </Text>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                ${pres.precio.toFixed(2)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{
                fontSize: fontSize.body, fontWeight: 'bold',
                color: pres.stock < 5 ? colors.danger : colors.success,
              }}>
                {pres.stock} uds
              </Text>

              {/* Botón + directo desde la lista — acción más frecuente */}
              <TouchableOpacity
                onPress={e => {
                  e.stopPropagation();
                  this.setState({
                    showAgregarUnidadesModal: true,
                    agregarProduct: product,
                    agregarPresentacion: pres,
                  });
                }}
                style={{
                  width: 36, height: 36, borderRadius: radius.sm,
                  backgroundColor: colors.success,
                  justifyContent: 'center', alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, color: colors.white, fontWeight: 'bold' }}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </TouchableOpacity>
    );
  }

  render() {
    const { categories, products } = this.context;
    const filteredProducts = this.getFilteredProducts();
    const lowStockCount = this.getLowStockCount();
    const sortedCategories = [
      ...categories.filter(c => c.nombre === 'Todos'),
      ...categories.filter(c => c.nombre !== 'Todos').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    ];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Modal: agregar producto */}
        <ProductFormModal
          visible={this.state.showAddProductModal}
          categories={categories}
          products={products}
          onCancel={() => this.setState({ showAddProductModal: false })}
          onSave={data => {
            if (data.existingProductId) {
              this.context.addPresentacion(data.existingProductId, { tamano: data.tamano, precio: data.precio, stock: data.stock });
            } else {
              this.context.addProduct(data);
            }
            this.setState({ showAddProductModal: false });
          }}
        />

        {/* Modal: agregar unidades (desde el botón + de la lista) */}
        <AgregarUnidadesModal
          visible={this.state.showAgregarUnidadesModal}
          product={this.state.agregarProduct}
          presentacion={this.state.agregarPresentacion}
          onCancel={() => this.setState({ showAgregarUnidadesModal: false, agregarProduct: null, agregarPresentacion: null })}
          onSave={(productId, presentacionId, cantidad) => {
            this.context.agregarStock(productId, presentacionId, cantidad);
            this.setState({ showAgregarUnidadesModal: false, agregarProduct: null, agregarPresentacion: null });
          }}
        />

        {/* Modal: categorías */}
        <CategoriasModal
          visible={this.state.showCategoriasModal}
          categories={categories}
          products={products}
          onClose={() => this.setState({ showCategoriasModal: false })}
          onAdd={nombre => this.context.addCategory(nombre)}
          onRename={(id, nombre) => this.context.renameCategory(id, nombre)}
          onDelete={id => this.context.deleteCategory(id)}
        />

        {/* Barra verde */}
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View
          style={{
            height: HEADER_HEIGHT, paddingHorizontal: spacing.lg,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.card, elevation: 4,
            shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Inventario
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity
              onPress={() => this.setState({ showCategoriasModal: true })}
              hitSlop={8}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: fontSize.label }}>🏷️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('ConfigView')}
              hitSlop={8}
              style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: fontSize.label }}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          {/* Tarjetas resumen */}
          <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
            <View
              style={{
                flex: 1, height: SUMMARY_CARD_HEIGHT,
                backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.primary,
                borderRadius: radius.md, marginRight: spacing.sm, paddingHorizontal: spacing.lg, justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: 'bold', fontSize: fontSize.caption }}>Valor total</Text>
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: fontSize.label, marginTop: spacing.xs }}>
                ${this.getTotalValue()}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('LowStock')}
              style={{
                flex: 1, height: SUMMARY_CARD_HEIGHT,
                backgroundColor: colors.warning, borderRadius: radius.md,
                marginLeft: spacing.sm, paddingHorizontal: spacing.lg, justifyContent: 'center',
              }}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.caption, opacity: 0.9 }}>Stock bajo</Text>
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label, marginTop: spacing.xs }}>
                {lowStockCount} {lowStockCount === 1 ? 'Producto' : 'Productos'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Buscador */}
          <TextInput
            style={{
              color: colors.textPrimary, paddingHorizontal: spacing.md,
              paddingVertical: spacing.sm, fontSize: fontSize.body,
              marginTop: spacing.md, borderWidth: 1,
              borderColor: colors.chipInactive, borderRadius: radius.sm,
            }}
            placeholder="Buscar por nombre o marca"
            placeholderTextColor={colors.textMuted}
            value={this.state.searchText}
            onChangeText={text => this.updateSearchText(text)}
          />

          {/* Filtros de categoría */}
          <FlatList
            style={{ marginTop: spacing.md, flexGrow: 0 }}
            horizontal
            showsHorizontalScrollIndicator={false}
            data={sortedCategories}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => this.renderCategories(item)}
          />

          {/* Botón agregar producto */}
          <TouchableOpacity
            onPress={() => this.setState({ showAddProductModal: true })}
            style={{
              height: buttonHeight.action, backgroundColor: colors.primary,
              borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md,
            }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
              + Agregar Producto
            </Text>
          </TouchableOpacity>

          {/* Lista de productos */}
          <FlatList
            ref={this.productListRef}
            style={{ flex: 1 }}
            data={filteredProducts}
            keyExtractor={item => item.id}
            renderItem={({ item }) => this.renderProductItem(item)}
            contentContainerStyle={{ paddingBottom: spacing.xl }}
            ListEmptyComponent={() => (
              <View style={{ alignItems: 'center', marginTop: spacing.xl }}>
                <Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>No hay productos</Text>
              </View>
            )}
          />
        </View>
      </SafeAreaView>
    );
  }
}

export default Inventory;
