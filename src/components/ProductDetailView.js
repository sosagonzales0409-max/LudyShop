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
import { infoPresentaciones } from '../data/consultas/producto';
import { crearConsultaViva } from '../data/consultaViva';
import AgregarUnidadesModal from './AgregarUnidadesModal';
import EditarDatosProductoModal from './EditarDatosProductoModal';
import { colors, spacing, radius, fontSize, buttonHeight, iconButton } from '../config/theme';
import { formatoDinero, formatoCantidad, nombreProducto } from '../config/formato';
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
    showEditarDatos: false,
    // Por presentación: { ultimaCompra, vendidas30, tieneHistorial } (de SQLite)
    info: {},
  };

  componentDidMount() {
    // Bajo demanda: última compra, vendidas en 30 días e historial de cada
    // presentación (antes se recorrían todas las ventas y compras en memoria
    // en cada dibujado). Se refresca si cambian ventas, compras o las
    // presentaciones del producto (p. ej. al agregar una).
    this.consulta = crearConsultaViva({
      tablas: ['ventas', 'venta_items', 'compras', 'compra_items', 'presentaciones'],
      cargar: () => {
        const desde = new Date();
        desde.setDate(desde.getDate() - 29); // 30 días con hoy, desde la medianoche local
        desde.setHours(0, 0, 0, 0);
        const ids = (this.getProduct()?.presentaciones ?? []).map(p => p.id);
        return infoPresentaciones({ presentacionIds: ids, desde30: desde.toISOString() });
      },
      alCargar: info => this.setState({ info }),
      alFallar: error => console.error('ProductDetailView.infoPresentaciones', error),
    });
  }

  componentWillUnmount() {
    this.consulta?.detener();
  }

  // ─── Información calculada (solo lectura) ─────────────────────────────────

  nombreCategoria(product) {
    return (this.context.categories || []).find(c => String(c.id) === String(product.categoriaId))?.nombre ?? 'Sin categoría';
  }

  // Compra más reciente que incluyó esta presentación: { proveedor, costoUnitario, fecha }
  ultimaCompra(pres) {
    return this.state.info[pres.id]?.ultimaCompra ?? null;
  }

  // Unidades (o kg/L) vendidas de esta presentación en los últimos 30 días
  // (hoy incluido, desde la medianoche local de hace 29 días).
  vendidas30Dias(pres) {
    return this.state.info[pres.id]?.vendidas30 ?? 0;
  }

  formatFecha(iso) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  renderDato(etiqueta, valor, colorValor = colors.textPrimary) {
    return (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
        <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>{etiqueta}</Text>
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colorValor, flexShrink: 1, textAlign: 'right', marginLeft: spacing.md }}>{valor}</Text>
      </View>
    );
  }

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
    const tieneHistorial = !!this.state.info[pres.id]?.tieneHistorial;

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
      `¿Seguro que quieres eliminar "${nombreProducto(product.nombre, pres.tamano)}"?\n\n${advertencias.join('\n\n')}\n\nEsta acción no se puede deshacer.`,
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
    const moneda = this.context.config?.moneda ?? '$';
    const unidad = pres.esGranel ? (pres.unidadGranel || 'ud') : 'unidad';
    const tieneCosto = pres.precioCompra != null;
    const ganancia = tieneCosto ? pres.precio - pres.precioCompra : null;
    const pctGanancia = tieneCosto && pres.precio > 0 ? (ganancia / pres.precio) * 100 : null;
    const ultima = this.ultimaCompra(pres);
    const vendidas = this.vendidas30Dias(pres);
    const cantidad = n => (pres.esGranel ? formatoCantidad(n, true, pres.unidadGranel) : `${formatoCantidad(n)} uds`);

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
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: pres.tamano ? colors.textPrimary : colors.textMuted }}>
              {pres.tamano || 'Presentación única'}
            </Text>
            <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: spacing.xs }}>
              {formatoDinero(pres.precio, moneda)} por {unidad}
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
              {cantidad(pres.stock)}
            </Text>
          </View>
        </View>

        {/* ── Información de la presentación ── */}
        <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.lg }}>
          {this.renderDato('Precio de compra', tieneCosto ? `${formatoDinero(pres.precioCompra, moneda)} por ${unidad}` : 'Sin registrar', tieneCosto ? colors.textPrimary : colors.textMuted)}
          {tieneCosto && this.renderDato(
            `Ganancia por ${unidad}`,
            `${formatoDinero(ganancia, moneda)}${pctGanancia != null ? ` (${pctGanancia.toFixed(0)}%)` : ''}`,
            ganancia >= 0 ? colors.success : colors.danger,
          )}
          {tieneCosto && this.renderDato('Valor en inventario (a costo)', formatoDinero(pres.stock * pres.precioCompra, moneda))}
          {this.renderDato(
            'Última compra',
            ultima ? `${ultima.proveedor || 'Sin proveedor'} · ${formatoDinero(ultima.costoUnitario, moneda)} · ${this.formatFecha(ultima.fecha)}` : 'Sin compras registradas',
            ultima ? colors.textPrimary : colors.textMuted,
          )}
          {this.renderDato('Vendidas (últimos 30 días)', cantidad(vendidas))}
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
        <EditarDatosProductoModal
          visible={this.state.showEditarDatos}
          product={product}
          onClose={() => this.setState({ showEditarDatos: false })}
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
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }} numberOfLines={1}>
              {product.nombre}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }} numberOfLines={1}>
              {!!product.marca && <Text style={{ fontStyle: 'italic' }}>{product.marca}</Text>}{product.marca ? ' · ' : ''}{this.nombreCategoria(product)}
            </Text>
          </View>
          {/* Editar datos del producto: nombre, marca, categoría */}
          <TouchableOpacity
            onPress={() => this.setState({ showEditarDatos: true })}
            style={{ width: 44, height: 44, borderRadius: radius.lg, backgroundColor: colors.chipInactive, justifyContent: 'center', alignItems: 'center' }}
          >
            <IconEdit size={fontSize.body} color={colors.textPrimary} />
          </TouchableOpacity>
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
