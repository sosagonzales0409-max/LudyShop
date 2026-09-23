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
import { colors, spacing, radius, fontSize, buttonHeight, iconButton } from '../config/theme';
import { IconEdit, IconTrash, IconPlus, IconBack, IconShoppingBag } from './Icon';

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
  };

  // Obtiene el producto actualizado desde el contexto usando el id del param
  getProduct() {
    const { productId } = this.props.route.params;
    return this.context.products.find(p => p.id === productId) ?? null;
  }

  stockBadgeColor(stock) {
    const threshold = this.context.config?.umbralStock ?? 5;
    if (stock === 0) return colors.danger;
    if (stock < threshold) return colors.warning;
    return colors.success;
  }

  confirmDelete(product, pres) {
    const esUltima = product.presentaciones.length === 1;
    const { sales = [], compras = [] } = this.context;
    const tieneHistorial =
      sales.some(s => (s.productos || []).some(p => p.productId === product.id && p.presentacionId === pres.id)) ||
      compras.some(c => (c.items || []).some(i => i.productId === product.id && i.presentacionId === pres.id));

    const advertencias = [];
    if (pres.stock > 0) {
      advertencias.push(`Se perderán ${pres.stock} ${pres.esGranel ? (pres.unidadGranel || '') : 'unidades'} de stock sin registrar como merma.`);
    }
    if (esUltima) {
      advertencias.push(`Es la única presentación de "${product.nombre}" — se eliminará el producto completo del catálogo.`);
    }
    if (tieneHistorial) {
      advertencias.push('El historial de ventas y compras de este producto no se ve afectado, se conserva tal cual.');
    }

    Alert.alert(
      esUltima ? 'Eliminar producto' : 'Eliminar presentación',
      `¿Seguro que quieres eliminar "${product.nombre} ${pres.tamano}"?\n\n${advertencias.join('\n\n')}\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            this.context.deletePresentacion(product.id, pres.id);
            // Si era la última presentación, volver al inventario
            if (esUltima) {
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
              {(this.context.config?.moneda ?? '$')}{pres.precio.toFixed(2)} por unidad
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <IconPlus size={fontSize.label} color={colors.white} />
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white, marginLeft: spacing.xs }}>
              Agregar unidades
            </Text>
          </View>
          </TouchableOpacity>

          {/* Editar */}
          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('EditarProducto', { productId: product.id, presentacionId: pres.id })}
            style={{
              width: buttonHeight.action, height: buttonHeight.action,
              borderRadius: radius.lg, backgroundColor: colors.chipInactive,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <IconEdit size={fontSize.body} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Eliminar */}
          <TouchableOpacity
            onPress={() => this.confirmDelete(product, pres)}
            style={{
              width: buttonHeight.action, height: buttonHeight.action,
              borderRadius: radius.lg, backgroundColor: '#fde8e8',
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <IconTrash size={fontSize.body} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Botón registrar compra — segunda fila, color secundario */}
        <TouchableOpacity
          onPress={() => this.props.navigation.navigate('RegistrarCompra', { productId: product.id, presentacionId: pres.id })}
          style={{
            height: buttonHeight.action, backgroundColor: colors.background,
            borderRadius: radius.lg, borderWidth: 1.5, borderColor: colors.primary,
            justifyContent: 'center', alignItems: 'center', marginTop: spacing.sm,
            flexDirection: 'row',
          }}
        >
          <IconShoppingBag size={fontSize.label} color={colors.primary} />
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primary, marginLeft: spacing.xs }}>
            Registrar compra
          </Text>
        </TouchableOpacity>
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconBack size={fontSize.label} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: fontSize.label, marginLeft: spacing.xs }}>
                Volver
              </Text>
            </View>
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
            <IconBack size={28} color={colors.primary} />
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
