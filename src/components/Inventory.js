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
import CategoriasModal from './CategoriasModal';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconSettings, IconPlus, IconChevron, IconShoppingBag, IconWarning } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;
const HEADER_HEIGHT = 60;
const CATEGORY_CHIP_HEIGHT = 32;

class Inventory extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      selectedCategory: 0,
      searchText: '',
      showCategoriasModal: false,
    };
    this.productListRef = React.createRef();
  }

  resetListScroll() {
    if (this.productListRef.current) {
      this.productListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }

  get threshold() { return this.context.config?.umbralStock ?? 5; }
  get moneda()    { return this.context.config?.moneda ?? '$'; }

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
    products.forEach(p => p.presentaciones.forEach(pres => { if (pres.stock < this.threshold) count++; }));
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
          height: CATEGORY_CHIP_HEIGHT, paddingHorizontal: spacing.md,
          backgroundColor: isSelected ? colors.primary : colors.chipInactive,
          borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
        }}
      >
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: isSelected ? colors.white : colors.textPrimary }}>
          {item.nombre}
        </Text>
      </TouchableOpacity>
    );
  }

  renderProductItem(product) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => this.props.navigation.navigate('ProductDetail', { productId: product.id })}
        style={{
          marginTop: spacing.md, padding: spacing.lg,
          backgroundColor: colors.card, borderRadius: radius.md,
          elevation: 3, shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            {product.nombre}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {!!product.marca && (
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic', marginRight: spacing.xs }}>
                {product.marca}
              </Text>
            )}
            <IconChevron size={fontSize.itemTitle} color={colors.textMuted} />
          </View>
        </View>

        {product.presentaciones.map(pres => (
          <View
            key={pres.id}
            style={{
              flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
              borderTopWidth: 1, borderTopColor: colors.border,
              paddingTop: spacing.sm, marginTop: spacing.sm,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: pres.tamano ? colors.textPrimary : colors.textMuted }}>
                {pres.tamano || 'Presentación única'}
              </Text>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                {this.moneda}{pres.precio.toFixed(2)}
                {pres.esGranel ? ` / ${pres.unidadGranel ?? 'ud'}` : ''}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text style={{
                fontSize: fontSize.body, fontWeight: 'bold',
                color: pres.stock < this.threshold ? colors.danger : colors.success,
              }}>
                {pres.stock}{pres.esGranel ? ` ${pres.unidadGranel ?? ''}` : ' u'}
              </Text>

              {/* Registrar compra — precarga este producto/presentación en RegistrarCompraView */}
              <TouchableOpacity
                onPress={e => {
                  e.stopPropagation();
                  this.props.navigation.navigate('RegistrarCompra', { productId: product.id, presentacionId: pres.id });
                }}
                style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.success, justifyContent: 'center', alignItems: 'center' }}
              >
                <IconShoppingBag size={fontSize.label} color={colors.white} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </TouchableOpacity>
    );
  }

  render() {
    const { categories } = this.context;
    const filteredProducts = this.getFilteredProducts();
    const lowStockCount = this.getLowStockCount();
    const sortedCategories = [
      ...categories.filter(c => c.nombre === 'Todos'),
      ...categories.filter(c => c.nombre !== 'Todos').sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    ];

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Modal: categorías */}
        <CategoriasModal
          visible={this.state.showCategoriasModal}
          categories={categories}
          products={this.context.products}
          onClose={() => this.setState({ showCategoriasModal: false })}
          onAdd={nombre => this.context.addCategory(nombre)}
          onRename={(id, nombre) => this.context.renameCategory(id, nombre)}
          onDelete={id => this.context.deleteCategory(id)}
        />

        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ minHeight: HEADER_HEIGHT, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>Inventario</Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 1 }}>
              Valor total: {this.moneda}{this.getTotalValue()}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => this.props.navigation.navigate('LowStock', { threshold: this.threshold })} hitSlop={8} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
              <IconWarning size={28} color={colors.textPrimary} />
              {lowStockCount > 0 && (
                <View
                  style={{
                    position: 'absolute', top: 2, right: 2,
                    backgroundColor: colors.danger,
                    borderRadius: 9, minWidth: 18, height: 18,
                    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
                    borderWidth: 2, borderColor: colors.card,
                  }}
                >
                  <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>{lowStockCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => this.props.navigation.navigate('ConfigView')} hitSlop={8} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
              <IconSettings size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>
          <TextInput style={{ color: colors.textPrimary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, marginTop: spacing.md, borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm }} placeholder="Buscar por nombre o marca" placeholderTextColor={colors.textMuted} value={this.state.searchText} onChangeText={text => this.updateSearchText(text)} />

          {/* Chips de categoría + botón "+" fijo a la derecha (abre la gestión
              de categorías). Antes era un ícono 🏷️ suelto en el encabezado,
              poco intuitivo: ahora está donde se miran las categorías. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.md }}>
            <FlatList style={{ flex: 1, flexGrow: 1 }} horizontal showsHorizontalScrollIndicator={false} data={sortedCategories} keyExtractor={(item, index) => index.toString()} renderItem={({ item }) => this.renderCategories(item)} />
            <TouchableOpacity
              onPress={() => this.setState({ showCategoriasModal: true })}
              accessibilityLabel="Categorías: agregar, renombrar o eliminar"
              hitSlop={6}
              style={{ height: CATEGORY_CHIP_HEIGHT, minWidth: CATEGORY_CHIP_HEIGHT, paddingHorizontal: spacing.md, marginLeft: spacing.xs, backgroundColor: colors.chipInactive, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>+</Text>
            </TouchableOpacity>
          </View>

          {/* Botón + Agregar Producto → AgregarProductoView (pantalla completa) */}
          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('AgregarProducto')}
            style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.md }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconPlus size={fontSize.label} color={colors.white} />
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white, marginLeft: spacing.xs }}>Agregar Producto</Text>
            </View>
          </TouchableOpacity>

          <FlatList ref={this.productListRef} style={{ flex: 1 }} data={filteredProducts} keyExtractor={item => item.id} renderItem={({ item }) => this.renderProductItem(item)} contentContainerStyle={{ paddingBottom: spacing.xl }} ListEmptyComponent={() => (<View style={{ alignItems: 'center', marginTop: spacing.xl }}><Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>No hay productos</Text></View>)} />
        </View>
      </SafeAreaView>
    );
  }
}

export default Inventory;
