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
import EditProductModal from './EditProductModal';
import AgregarUnidadesModal from './AgregarUnidadesModal';
import ProductDetailModal from './ProductDetailModal';
import CategoriasModal from './CategoriasModal';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;
const HEADER_HEIGHT = 60;

class Inventory extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      selectedCategory: 0,
      searchText: '',
      showAddProductModal: false,
      showEditModal: false,
      editProduct: null,
      editPresentacion: null,
      showAgregarUnidadesModal: false,
      agregarProduct: null,
      agregarPresentacion: null,
      showDetailModal: false,
      detailProduct: null,
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

  openEditModal(product, presentacion) {
    this.setState({ showEditModal: true, editProduct: product, editPresentacion: presentacion });
  }

  openAgregarUnidadesModal(product, presentacion) {
    this.setState({ showAgregarUnidadesModal: true, agregarProduct: product, agregarPresentacion: presentacion });
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
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => this.setState({ showDetailModal: true, detailProduct: product })}
        style={{
          marginTop: spacing.md, padding: spacing.lg,
          backgroundColor: colors.card, borderRadius: radius.md,
          elevation: 4, shadowOpacity: 0.1,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
            {product.nombre}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
              {product.marca}
            </Text>
            <Text style={{ fontSize: fontSize.itemTitle, color: colors.textMuted, marginLeft: spacing.xs }}>›</Text>
          </View>
        </View>

        {product.presentaciones.map(pres => (
          <View
            key={pres.id}
            style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingTop: spacing.md, marginTop: spacing.md,
            }}
          >
            <View>
              <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary }}>{pres.tamano}</Text>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>${pres.precio}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: pres.stock < 5 ? colors.danger : colors.success, marginRight: spacing.md }}>
                {pres.stock} Unidades
              </Text>
              <TouchableOpacity
                onPress={() => this.openAgregarUnidadesModal(product, pres)}
                style={{
                  width: 32, height: 32, borderRadius: radius.sm,
                  backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center',
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
      ...categories
        .filter(c => c.nombre !== 'Todos')
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    ];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Modales */}
        <ProductFormModal
          visible={this.state.showAddProductModal}
          categories={categories} products={products}
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
        <EditProductModal
          visible={this.state.showEditModal}
          product={this.state.editProduct} presentacion={this.state.editPresentacion}
          onCancel={() => this.setState({ showEditModal: false, editProduct: null, editPresentacion: null })}
          onSave={(productId, presentacionId, cambios) => {
            this.context.updatePresentacion(productId, presentacionId, cambios);
            this.setState({ showEditModal: false, editProduct: null, editPresentacion: null });
          }}
        />
        <AgregarUnidadesModal
          visible={this.state.showAgregarUnidadesModal}
          product={this.state.agregarProduct} presentacion={this.state.agregarPresentacion}
          onCancel={() => this.setState({ showAgregarUnidadesModal: false, agregarProduct: null, agregarPresentacion: null })}
          onSave={(productId, presentacionId, cantidad) => {
            this.context.agregarStock(productId, presentacionId, cantidad);
            this.setState({ showAgregarUnidadesModal: false, agregarProduct: null, agregarPresentacion: null });
          }}
        />
        <ProductDetailModal
          visible={this.state.showDetailModal}
          product={this.state.detailProduct}
          onClose={() => this.setState({ showDetailModal: false, detailProduct: null })}
          onAgregarUnidades={(product, pres) => this.openAgregarUnidadesModal(product, pres)}
          onEditar={(product, pres) => this.openEditModal(product, pres)}
          onEliminar={(productId, presentacionId) => this.context.deletePresentacion(productId, presentacionId)}
        />
        <CategoriasModal
          visible={this.state.showCategoriasModal}
          categories={categories} products={products}
          onClose={() => this.setState({ showCategoriasModal: false })}
          onAdd={nombre => this.context.addCategory(nombre)}
          onRename={(id, nombre) => this.context.renameCategory(id, nombre)}
          onDelete={id => this.context.deleteCategory(id)}
        />

        {/* Barra verde */}
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

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
            Inventario
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            {/* Botón Categorías */}
            <TouchableOpacity
              onPress={() => this.setState({ showCategoriasModal: true })}
              hitSlop={8}
              style={{
                width: 44, height: 44, borderRadius: radius.sm,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, color: colors.textSecondary }}>🏷️</Text>
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

        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          {/* Tarjetas de resumen */}
          <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
            <View style={{ flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, marginRight: spacing.sm, padding: spacing.md }}>
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>Valor total</Text>
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.itemTitle, marginTop: spacing.xs }}>${this.getTotalValue()}</Text>
            </View>
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('LowStock')}
              style={{ flex: 1, backgroundColor: colors.warning, borderRadius: radius.md, marginLeft: spacing.sm, padding: spacing.md }}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>Stock Bajo</Text>
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.itemTitle, marginTop: spacing.xs }}>
                {lowStockCount} {lowStockCount === 1 ? 'Presentación' : 'Presentaciones'}
              </Text>
              {lowStockCount > 0 && (
                <Text style={{ color: colors.white, fontSize: fontSize.small, marginTop: 2, opacity: 0.85 }}>Toca para ver detalle →</Text>
              )}
            </TouchableOpacity>
          </View>

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

          <FlatList
            style={{ marginTop: spacing.md, flexGrow: 0 }}
            horizontal showsHorizontalScrollIndicator={false}
            data={sortedCategories}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => this.renderCategories(item)}
          />

          <TouchableOpacity
            onPress={() => this.setState({ showAddProductModal: true })}
            style={{
              height: buttonHeight.action, backgroundColor: colors.primary,
              borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md,
            }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>+ Agregar Producto</Text>
          </TouchableOpacity>

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
