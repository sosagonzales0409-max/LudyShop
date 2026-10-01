import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, iconButton } from '../config/theme';
import { formatoDinero, formatoCantidad } from '../config/formato';
import { IconBack, IconShoppingBag } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

/**
 * LowStockView — pantalla con todas las presentaciones cuyo stock
 * está por debajo del umbral (default: 5 unidades).
 *
 * Navegación en router.js:
 *   <InventoryViews.Screen name="LowStock" component={LowStockView} />
 */
export default class LowStockView extends Component {
  static contextType = StoreContext;

  get threshold() {
    // Config en vivo tiene prioridad sobre el param de navegación — si el
    // umbral cambia en Config mientras esta pantalla sigue montada (stacks
    // anidados de React Navigation), debe reflejarse sin tener que reabrirla.
    return this.context.config?.umbralStock ?? this.props.route?.params?.threshold ?? 5;
  }

  getLowStockItems() {
    const { products } = this.context;
    const items = [];
    products.forEach(product => {
      product.presentaciones.forEach(pres => {
        if (pres.stock < this.threshold) {
          items.push({ product, presentacion: pres });
        }
      });
    });
    return items.sort((a, b) => a.presentacion.stock - b.presentacion.stock);
  }

  stockChip(pres) {
    const { stock } = pres;
    // A granel lleva su unidad ("2.5 kg"); si no, piezas ("3 uds").
    const label = pres.esGranel ? formatoCantidad(stock, true, pres.unidadGranel || 'kg') : `${formatoCantidad(stock)} uds`;
    if (stock === 0) return { bg: colors.danger, label: 'Sin stock' };
    if (stock <= 2) return { bg: colors.danger, label };
    return { bg: colors.warning, label };
  }

  renderItem({ product, presentacion }) {
    const moneda = this.context.config?.moneda ?? '$';
    const chip = this.stockChip(presentacion);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => this.props.navigation.navigate('EditarProducto', { productId: product.id, presentacionId: presentacion.id })}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          elevation: 3,
          shadowOpacity: 0.08,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Badge de stock */}
        <View
          style={{
            backgroundColor: chip.bg,
            borderRadius: radius.sm,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
            marginRight: spacing.lg,
            minWidth: 68,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.body }}>
            {chip.label}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
            {product.nombre} {presentacion.tamano}
          </Text>
          {!!product.marca && (
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
              {product.marca}
            </Text>
          )}
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            {formatoDinero(presentacion.precio, moneda)} c/u
          </Text>
        </View>

        {/* Acciones rápidas */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {/* Registrar compra — pre-carga este producto/presentación */}
          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('RegistrarCompra', { productId: product.id, presentacionId: presentacion.id })}
            style={{
              width: iconButton.size + 8,
              height: iconButton.size + 8,
              borderRadius: radius.sm,
              backgroundColor: colors.primary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <IconShoppingBag size={fontSize.itemTitle} color={colors.white} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  render() {
    const items = this.getLowStockItems();

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Barra verde superior */}
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            height: 60,
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <TouchableOpacity
            onPress={() => this.props.navigation.goBack()}
            style={{ marginRight: spacing.md }}
          >
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Stock bajo
          </Text>
          <View
            style={{
              backgroundColor: colors.warning,
              borderRadius: radius.lg,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>
              {items.length} {items.length === 1 ? 'Producto' : 'Productos'}
            </Text>
          </View>
        </View>

        {/* Descripción */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
            Productos con menos de {this.threshold} unidades, de la más crítica a la menos crítica.
          </Text>
        </View>

        {/* Lista */}
        <FlatList
          data={items}
          keyExtractor={item => `${item.product.id}::${item.presentacion.id}`}
          renderItem={({ item }) => this.renderItem(item)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', marginTop: spacing.md, color: colors.textPrimary }}>
                ¡Todo en orden!
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                Ningún producto tiene stock bajo el umbral de {this.threshold} unidades.
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }
}
