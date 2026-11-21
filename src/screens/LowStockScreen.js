import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, tarjeta } from '../config/theme';
import { formatoDinero, formatoCantidad } from '../config/formatting';
import { IconShoppingBag, IconCheckCircle } from '../ui/Icon';
import Header, { EtiquetaEncabezado } from '../ui/Header';
import { ChipEstado, EstadoVacio } from '../ui/StatusViews';

/**
 * LowStockScreen — pantalla con todas las presentaciones cuyo stock
 * está por debajo del umbral (default: 5 unidades).
 *
 * Navegación en router.js:
 *   <InventoryViews.Screen name="LowStock" component={LowStockScreen} />
 */
export default class LowStockScreen extends Component {
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
    if (stock === 0) return { tono: 'bad', label: 'Sin stock' };
    if (stock <= 2) return { tono: 'bad', label };
    return { tono: 'warn', label };
  }

  renderItem({ product, presentacion }) {
    const moneda = this.context.config?.moneda ?? '$';
    const chip = this.stockChip(presentacion);

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => this.props.navigation.navigate('EditarProducto', { productId: product.id, presentacionId: presentacion.id })}
        style={{
          ...tarjeta,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {/* Insignia de stock: tono suave (rojo si 2 o menos, naranja el resto) */}
        <View style={{ marginRight: spacing.md }}>
          <ChipEstado grande punto={false} tono={chip.tono} texto={chip.label} />
        </View>

        {/* Info */}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
            {product.nombre} {presentacion.tamano}
          </Text>
          {!!product.marca && (
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
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
            accessibilityLabel="Registrar compra"
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.md,
              backgroundColor: colors.primarySoft,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <IconShoppingBag size={20} color={colors.primaryDark} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  }

  render() {
    const items = this.getLowStockItems();

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          titulo="Stock bajo"
          onBack={() => this.props.navigation.goBack()}
          derecha={<EtiquetaEncabezado texto={`${items.length} ${items.length === 1 ? 'Producto' : 'Productos'}`} color={colors.warningDark} />}
        />

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
          ListEmptyComponent={(
            <EstadoVacio
              Icono={IconCheckCircle}
              tono="ok"
              titulo="¡Todo en orden!"
              texto={`Ningún producto tiene stock bajo el umbral de ${this.threshold} unidades.`}
            />
          )}
        />
      </View>
    );
  }
}
