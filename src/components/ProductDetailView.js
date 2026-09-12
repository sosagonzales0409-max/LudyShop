import React, { Component } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import AgregarUnidadesModal from './AgregarUnidadesModal';
import EditProductModal from './EditProductModal';
import { colors, spacing, radius, fontSize, buttonHeight, iconButton } from '../config/theme';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

/**
 * ProductDetailView — pantalla completa de detalle de un producto.
 * Reemplaza ProductDetailModal: más espacio, todas las acciones visibles,
 * sin menús ocultos ni estados que cambian el mismo botón.
 *
 * Navegación: stack dentro del tab Inventario.
 *   navigation.navigate('ProductDetail', { productId: product.id })
 *
 * Acciones por presentación (todas visibles, sin menús):
 *   [+ Agregar unidades]  [✏️ Editar]  [🗑️]
 */
export default class ProductDetailView extends Component {
  static contextType = StoreContext;

  state = {
    showAgregarModal: false,
    agregarPres: null,
    showEditModal: false,
    editPres: null,
  };

  // Obtiene el producto actualizado desde el contexto usando el id del param
  getProduct() {
    const { productId } = this.props.route.params;
    return this.context.products.find(p => p.id === productId) ?? null;
  }

  stockBadgeColor(stock) {
    if (stock === 0) return colors.danger;
    if (stock < 5) return colors.warning;
    return colors.success;
  }

  confirmDelete(product, pres) {
    Alert.alert(
      'Eliminar presentación',
      `¿Seguro que quieres eliminar "${product.nombre} ${pres.tamano}"?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            this.context.deletePresentacion(product.id, pres.id);
            // Si era la última presentación, volver al inventario
            if (product.presentaciones.length === 1) {
              this.props.navigation.goBack();
            }
          },
        },
      ],
    );
  }

  renderPresentacion(product, pres) {
    return (
      <View
        key={pres.id}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.md,
          elevation: 3,
          shadowOpacity: 0.07,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* ── Fila superior: tamaño + precio + badge stock ── */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              {pres.tamano}
            </Text>
            <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: spacing.xs }}>
              ${pres.precio.toFixed(2)} por unidad
            </Text>
          </View>

          <View
            style={{
              backgroundColor: this.stockBadgeColor(pres.stock),
              borderRadius: radius.md,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.lg,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>
              {pres.stock} uds
            </Text>
          </View>
        </View>

        {/* ── Acciones: todas visibles, sin menús ocultos ── */}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {/* Acción principal */}
          <TouchableOpacity
            onPress={() => this.setState({ showAgregarModal: true, agregarPres: pres })}
            style={{
              flex: 1,
              height: buttonHeight.action,
              backgroundColor: colors.primary,
              borderRadius: radius.lg,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
              + Agregar unidades
            </Text>
          </TouchableOpacity>

          {/* Editar */}
          <TouchableOpacity
            onPress={() => this.setState({ showEditModal: true, editPres: pres })}
            style={{
              width: buttonHeight.action,
              height: buttonHeight.action,
              borderRadius: radius.lg,
              backgroundColor: colors.chipInactive,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.body }}>✏️</Text>
          </TouchableOpacity>

          {/* Eliminar */}
          <TouchableOpacity
            onPress={() => this.confirmDelete(product, pres)}
            style={{
              width: buttonHeight.action,
              height: buttonHeight.action,
              borderRadius: radius.lg,
              backgroundColor: '#fde8e8',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.body }}>🗑️</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  render() {
    const product = this.getProduct();

    // Si el producto fue eliminado mientras se navegaba aquí
    if (!product) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>Producto no encontrado</Text>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ marginTop: spacing.lg }}>
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: fontSize.label }}>← Volver</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Modales */}
        <AgregarUnidadesModal
          visible={this.state.showAgregarModal}
          product={product}
          presentacion={this.state.agregarPres}
          onCancel={() => this.setState({ showAgregarModal: false, agregarPres: null })}
          onSave={(productId, presentacionId, cantidad) => {
            this.context.agregarStock(productId, presentacionId, cantidad);
            this.setState({ showAgregarModal: false, agregarPres: null });
          }}
        />
        <EditProductModal
          visible={this.state.showEditModal}
          product={product}
          presentacion={this.state.editPres}
          onCancel={() => this.setState({ showEditModal: false, editPres: null })}
          onSave={(productId, presentacionId, cambios) => {
            this.context.updatePresentacion(productId, presentacionId, cambios);
            this.setState({ showEditModal: false, editPres: null });
          }}
        />

        {/* Barra verde */}
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View
          style={{
            height: 60,
            paddingHorizontal: spacing.lg,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.card,
            elevation: 4,
            shadowOpacity: 0.1,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <TouchableOpacity
            onPress={() => this.props.navigation.goBack()}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}
          >
            <Text style={{ fontSize: fontSize.heading, color: colors.primary }}>←</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
              {product.nombre}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
              {product.marca}
            </Text>
          </View>
        </View>

        {/* Contenido */}
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          {/* Encabezado de sección */}
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textMuted, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {product.presentaciones.length === 1 ? '1 presentación' : `${product.presentaciones.length} presentaciones`}
          </Text>

          {/* Tarjetas de presentación */}
          {product.presentaciones.map(pres => this.renderPresentacion(product, pres))}
        </ScrollView>
      </SafeAreaView>
    );
  }
}
