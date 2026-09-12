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
import AgregarUnidadesModal from './AgregarUnidadesModal';
import { colors, spacing, radius, fontSize, iconButton } from '../config/theme';

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
    return this.props.route?.params?.threshold ?? 5;
  }

  state = {
    showAgregarModal: false,
    agregarProduct: null,
    agregarPresentacion: null,
  };

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

  stockChip(stock) {
    if (stock === 0) return { bg: colors.danger, label: 'Sin stock' };
    if (stock <= 2) return { bg: colors.danger, label: `${stock} uds` };
    return { bg: colors.warning, label: `${stock} uds` };
  }

  renderItem({ product, presentacion }) {
    const chip = this.stockChip(presentacion.stock);

    return (
      <View
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
          <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
            {product.marca}
          </Text>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            ${presentacion.precio.toFixed(2)} c/u
          </Text>
        </View>

        {/* Acciones rápidas */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {/* + Agregar unidades */}
          <TouchableOpacity
            onPress={() =>
              this.setState({
                showAgregarModal: true,
                agregarProduct: product,
                agregarPresentacion: presentacion,
              })
            }
            style={{
              width: iconButton.size + 8,
              height: iconButton.size + 8,
              borderRadius: radius.sm,
              backgroundColor: colors.success,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.itemTitle }}>
              +
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  render() {
    const items = this.getLowStockItems();
    const { showAgregarModal, agregarProduct, agregarPresentacion } = this.state;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Modal: agregar unidades */}
        <AgregarUnidadesModal
          visible={showAgregarModal}
          product={agregarProduct}
          presentacion={agregarPresentacion}
          onCancel={() => this.setState({ showAgregarModal: false, agregarProduct: null, agregarPresentacion: null })}
          onSave={(productId, presentacionId, cantidad) => {
            this.context.agregarStock(productId, presentacionId, cantidad);
            this.setState({ showAgregarModal: false, agregarProduct: null, agregarPresentacion: null });
          }}
        />

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
            <Text style={{ fontSize: fontSize.heading, color: colors.primary }}>←</Text>
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
              {items.length} {items.length === 1 ? 'presentación' : 'presentaciones'}
            </Text>
          </View>
        </View>

        {/* Descripción */}
        <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
            Presentaciones con menos de {this.threshold} unidades, de la más crítica a la menos crítica.
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
