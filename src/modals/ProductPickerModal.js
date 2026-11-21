import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import { colors, spacing, radius, fontSize, tarjeta } from '../config/theme';
import { formatoDinero } from '../config/formatting';
import { StoreContext } from '../context/StoreContext';
import { IconClose } from '../ui/Icon';
import { CampoBusqueda } from '../ui/FormFields';
import { ChipEstado } from '../ui/StatusViews';

const CATEGORY_CHIP_HEIGHT = 36;

// Tamaño FIJO de la tarjeta, calculado con la pantalla al cargar. Con
// porcentajes (o flex) se calculaba contra la ventana del Modal, que en
// Android se encoge al abrir el teclado: la tarjeta se achicaba. Con un alto
// fijo no cambia de tamaño ni de lugar; el teclado queda encima de la parte
// baja de la lista, que se puede desplazar.
const ALTO_PANTALLA = Dimensions.get('window').height;
const ALTO_TARJETA = Math.round(ALTO_PANTALLA * 0.8);
const MARGEN_SUPERIOR = Math.round(ALTO_PANTALLA * 0.06);

/**
 * Modal (bottom sheet) para seleccionar un producto (presentación específica)
 * y agregarlo al carrito de venta.
 *
 * @param {boolean} visible
 * @param {Array} listProducts   // items vendibles aplanados (una fila por presentación)
 * @param {Array} cartProducts   // productos ya en el carrito, para ocultarlos de la lista
 * @param {Array} categories     // incluye la pseudo-categoría "Todos" (id: 0)
 * @param {number} umbralStock   // umbral de stock bajo en vivo (Config)
 * @param {function} onCancel
 * @param {function} onSelectProduct
 */
export default class ProductPickerModal extends Component {
  static contextType = StoreContext;

  state = {
    searchText: '',
    selectedCategory: 0,
  };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.setState({ searchText: '', selectedCategory: 0 });
    }
  }

  alreadyInCart(product) {
    // Cada presentación (tamaño) tiene un id compuesto único
    // (productId::presentacionId), así que comparar por id ya distingue
    // correctamente, por ejemplo, entre Coca-Cola 3L y Coca-Cola 600ml.
    return this.props.cartProducts.some(p => p.id === product.id);
  }

  getFilteredProducts() {
    const { listProducts } = this.props;
    const { searchText, selectedCategory } = this.state;
    const search = searchText.toLowerCase();

    return listProducts.filter(p => {
      if (p.stock <= 0 || this.alreadyInCart(p)) return false;
      const matchCat = selectedCategory === 0 || String(p.categoriaId) === String(selectedCategory);
      const matchSearch = !search
        || p.nombre.toLowerCase().includes(search)
        || p.marca.toLowerCase().includes(search)
        || p.tamano.toLowerCase().includes(search);
      return matchCat && matchSearch;
    });
  }

  // Mismo criterio de severidad que LowStockScreen, más un tercer nivel
  // "normal" (aquí sí conviven productos con stock de sobra, a diferencia
  // de LowStockScreen donde todo lo listado ya es poco stock).
  // Devuelve el tono de <ChipEstado> ('bad' | 'warn') o null si el stock es normal.
  stockTono(item) {
    const umbral = this.props.umbralStock ?? 5;
    if (item.stock <= 2) return 'bad';
    if (item.stock < umbral) return 'warn';
    return null;
  }

  renderCategoryChip(item) {
    const isSelected = this.state.selectedCategory === item.id;
    return (
      <TouchableOpacity
        onPress={() => this.setState({ selectedCategory: item.id })}
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

  renderProductItem(item) {
    const moneda = this.context.config?.moneda ?? '$';
    const tono = this.stockTono(item);
    const textoStock = `Stock: ${item.stock}${item.esGranel ? ` ${item.unidadGranel || 'kg'}` : ''}`;
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => this.props.onSelectProduct(item)}
        style={{
          ...tarjeta,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.nombre} {item.tamano}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs, gap: spacing.xs }}>
              {!!item.marca && (
                <Text
                  style={{
                    fontSize: fontSize.small,
                    color: colors.textSecondary,
                    backgroundColor: colors.chipInactive,
                    paddingVertical: 2,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.sm,
                    alignSelf: 'flex-start',
                  }}
                >
                  {item.marca}
                </Text>
              )}
              {item.esGranel && (
                <Text
                  style={{
                    fontSize: fontSize.small,
                    fontWeight: 'bold',
                    color: colors.primaryDark,
                    borderWidth: 1,
                    borderColor: colors.primary,
                    paddingVertical: 2,
                    paddingHorizontal: spacing.sm,
                    borderRadius: radius.sm,
                    alignSelf: 'flex-start',
                  }}
                >
                  A granel
                </Text>
              )}
            </View>
          </View>
          {/* Stock: etiqueta de estado si es poco; gris neutro si es normal */}
          {tono ? (
            <ChipEstado tono={tono} texto={textoStock} />
          ) : (
            <View style={{ backgroundColor: colors.chipInactive, borderRadius: 14, height: 28, paddingHorizontal: 10, justifyContent: 'center' }}>
              <Text numberOfLines={1} style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>{textoStock}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: spacing.sm }}>
          {formatoDinero(item.precio, moneda)}
        </Text>
      </TouchableOpacity>
    );
  }

  render() {
    const { visible, onCancel, categories = [] } = this.props;
    const items = this.getFilteredProducts();

    return (
      <Modal animationType="slide" transparent visible={visible} onRequestClose={onCancel}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, alignItems: 'center' }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              width: '90%',
              marginTop: MARGEN_SUPERIOR,
              height: ALTO_TARJETA, // fijo: no se encoge con el teclado (ver arriba)
              paddingTop: spacing.lg,
              paddingBottom: spacing.xxl,
              elevation: 8,
              shadowOpacity: 0.2,
              shadowOffset: { width: 0, height: 4 },
              shadowRadius: 12,
            }}
          >
            {/* Header */}
            <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
                Seleccionar producto
              </Text>
              <TouchableOpacity
                onPress={onCancel}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <IconClose size={fontSize.heading} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Buscador */}
            <View style={{ paddingHorizontal: spacing.xl }}>
              <CampoBusqueda
                placeholder="Buscar productos"
                value={this.state.searchText}
                onChangeText={text => this.setState({ searchText: text })}
              />
            </View>

            {/* Chips de categoría */}
            {categories.length > 0 && (
              <FlatList
                style={{ marginTop: spacing.md, flexGrow: 0 }}
                contentContainerStyle={{ paddingHorizontal: spacing.xl }}
                horizontal
                showsHorizontalScrollIndicator={false}
                data={categories}
                keyExtractor={item => String(item.id)}
                renderItem={({ item }) => this.renderCategoryChip(item)}
              />
            )}

            {/* Separador */}
            <View style={{ height: 1, backgroundColor: colors.border, marginTop: spacing.md, marginHorizontal: spacing.xl }} />

            {/* Lista de productos */}
            <View style={{ flex: 1, marginTop: spacing.md }}>
              <FlatList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => this.renderProductItem(item)}
                contentContainerStyle={{ paddingHorizontal: spacing.xl }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={(
                  <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
                    <Text style={{ fontSize: fontSize.body, color: colors.textMuted, textAlign: 'center' }}>
                      No se encontraron productos.
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
