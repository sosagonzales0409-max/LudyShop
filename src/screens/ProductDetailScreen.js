import React, { Component } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { infoPresentaciones } from '../data/queries/product';
import { crearConsultaViva } from '../data/liveQuery';
import AddStockModal from '../modals/AddStockModal';
import EditProductInfoModal from '../modals/EditProductInfoModal';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { formatoDinero, formatoCantidad, nombreProducto } from '../config/formatting';
import { IconEdit, IconTrash, IconPlus, IconBack, IconShoppingBag } from '../ui/Icon';
import Header from '../ui/Header';
import { ChipEstado } from '../ui/StatusViews';

/**
 * ProductDetailScreen — pantalla completa de detalle de un producto.
 * Reemplaza ProductDetailModal: más espacio, todas las acciones visibles,
 * sin menús ocultos ni estados que cambian el mismo botón.
 *
 * Navegación: stack dentro del tab Inventario.
 *   navigation.navigate('ProductDetail', { productId: product.id })
 *
 * Acciones por presentación (todas visibles, sin menús):
 *   [+ Agregar unidades]  [✏️ Editar]  [🗑️]
 */
export default class ProductDetailScreen extends Component {
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

  // Tono de la etiqueta de stock (ver Estados.js): agotado / bajo / bien
  stockTono(stock) {
    const threshold = this.context.config?.umbralStock ?? 5;
    if (stock === 0) return 'bad';
    if (stock < threshold) return 'warn';
    return 'ok';
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
          ...tarjeta,
          padding: spacing.lg,
          marginBottom: spacing.md,
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

          <ChipEstado grande tono={this.stockTono(pres.stock)} texto={cantidad(pres.stock)} />
        </View>

        {/* ── Información de la presentación ── */}
        <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.lg }}>
          {this.renderDato('Precio de compra', tieneCosto ? `${formatoDinero(pres.precioCompra, moneda)} por ${unidad}` : 'Sin registrar', tieneCosto ? colors.textPrimary : colors.textMuted)}
          {tieneCosto && this.renderDato(
            `Ganancia por ${unidad}`,
            `${formatoDinero(ganancia, moneda)}${pctGanancia != null ? ` (${pctGanancia.toFixed(0)}%)` : ''}`,
            ganancia >= 0 ? colors.successDark : colors.dangerDark,
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
              borderRadius: radius.lg, backgroundColor: colors.dangerSoft,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <IconTrash size={fontSize.body} color={colors.dangerDark} />
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
        <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>Producto no encontrado</Text>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ marginTop: spacing.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconBack size={fontSize.label} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: fontSize.label, marginLeft: spacing.xs }}>
                Volver
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Modales */}
        <AddStockModal
          visible={this.state.showAgregarModal}
          product={product}
          presentacion={this.state.agregarPres}
          onCancel={() => this.setState({ showAgregarModal: false, agregarPres: null })}
          onSave={(productId, presentacionId, cantidad) => {
            this.context.agregarStock(productId, presentacionId, cantidad);
            this.setState({ showAgregarModal: false, agregarPres: null });
          }}
        />
        <EditProductInfoModal
          visible={this.state.showEditarDatos}
          product={product}
          onClose={() => this.setState({ showEditarDatos: false })}
        />

        {/* Encabezado: nombre + marca · categoría; el lápiz edita nombre, marca y categoría */}
        <Header
          titulo={product.nombre}
          subtitulo={`${product.marca ? `${product.marca} · ` : ''}${this.nombreCategoria(product)}`}
          onBack={() => this.props.navigation.goBack()}
          acciones={[{ Icono: IconEdit, etiqueta: 'Editar datos del producto', onPress: () => this.setState({ showEditarDatos: true }) }]}
        />

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
      </View>
    );
  }
}
