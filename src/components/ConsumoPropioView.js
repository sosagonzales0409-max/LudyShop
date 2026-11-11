import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import Toast from './Toast';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { formatoDinero, formatoCantidad, nombreProducto } from '../config/formato';
import { IconPackage } from './Icon';
import { CampoBusqueda } from './Formulario';
import Encabezado, { EtiquetaEncabezado } from './Encabezado';
import { EstadoVacio } from './Estados';

// Botones − / + de cantidad: 40 de alto para tocarlos fácil
const BOTON_CANTIDAD = 40;

export default class ConsumoPropioView extends Component {
  static contextType = StoreContext;

  state = {
    searchText: '',
    seleccion: {},      // { [id]: cantidad } — piezas o, a granel, kg/L
    textoGranel: {},    // { [id]: texto tal cual lo escribe el usuario (granel) }
  };

  getSellableItems() {
    const { sellableItems } = this.context;
    const { searchText } = this.state;
    const search = searchText.trim().toLowerCase();
    return sellableItems
      .filter(item => item.stock > 0)
      .filter(item => !search ||
        item.nombre.toLowerCase().includes(search) ||
        item.marca.toLowerCase().includes(search) ||
        item.tamano.toLowerCase().includes(search)
      );
  }

  getCantidad(id) { return this.state.seleccion[id] ?? 0; }

  // Cantidad a granel con decimales (ej. "0.5" kg). Igual que el carrito: se
  // guarda el texto tal cual (para no pelear con el punto mientras se escribe)
  // y el número ya convertido. Que no pase del stock se valida al confirmar.
  setCantidadGranel(id, texto) {
    let limpio = texto.replace(/[^0-9.]/g, '');
    const punto = limpio.indexOf('.');
    if (punto !== -1) limpio = limpio.slice(0, punto + 1) + limpio.slice(punto + 1).replace(/\./g, '');
    const valor = parseFloat(limpio);
    this.setState(prev => ({
      textoGranel: { ...prev.textoGranel, [id]: limpio },
      seleccion: { ...prev.seleccion, [id]: isNaN(valor) ? 0 : valor },
    }));
  }

  // "2" piezas o "0.5 kg"
  cantidadConUnidad(item, cantidad) {
    return item.esGranel ? formatoCantidad(cantidad, true, item.unidadGranel || 'kg') : formatoCantidad(cantidad);
  }

  setCantidad(id, cantidad, maxStock) {
    const val = Math.max(0, Math.min(cantidad, maxStock));
    this.setState(prev => ({ seleccion: { ...prev.seleccion, [id]: val } }));
  }

  // Lo seleccionado se toma de TODOS los productos con stock, no de la lista
  // filtrada por la búsqueda: antes, si elegías 2 Gansitos y luego buscabas
  // "arroz", al confirmar solo se descontaba el arroz y los Gansitos se
  // borraban de la selección sin avisar.
  getItemsSeleccionados() {
    return (this.context.sellableItems ?? [])
      .filter(item => item.stock > 0 && (this.state.seleccion[item.id] ?? 0) > 0);
  }

  // Se cuentan PRODUCTOS, no unidades: piezas y kilos no se pueden sumar.
  getTotalProductos() {
    return this.getItemsSeleccionados().length;
  }

  // Solo informativo: el consumo propio no registra dinero, solo descuenta
  // inventario. Usa el precio de COMPRA (lo que le cuesta a la tienda).
  // Los productos sin precio de compra no suman y se cuentan aparte, para que
  // el total no aparente ser completo.
  getCostoReferencia() {
    let total = 0;
    let sinCosto = 0;
    this.getItemsSeleccionados().forEach(item => {
      if (item.precioCompra == null) sinCosto++;
      else total += item.precioCompra * (this.state.seleccion[item.id] ?? 0);
    });
    return { total, sinCosto };
  }

  confirmarConsumo = () => {
    const items = this.getItemsSeleccionados();
    if (items.length === 0) return;
    const excedido = items.find(i => this.state.seleccion[i.id] > i.stock);
    if (excedido) {
      Alert.alert('Cantidad inválida', `"${nombreProducto(excedido.nombre, excedido.tamano)}": solo hay ${this.cantidadConUnidad(excedido, excedido.stock)} disponibles.`);
      return;
    }
    const total = this.getTotalProductos();
    const resumen = items.map(i => `• ${nombreProducto(i.nombre, i.tamano)} × ${this.cantidadConUnidad(i, this.state.seleccion[i.id])}`).join('\n');

    Alert.alert(
      'Confirmar consumo propio',
      `Se descontarán del inventario:\n\n${resumen}\n\nEsta acción no se registra como venta ni afecta los ingresos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            // esConsumoPropio = true → registra en activityLog con tipo 'consumo_propio'
            this.context.decreaseStock(
              items.map(i => ({ productId: i.productId, presentacionId: i.presentacionId, cantidad: this.state.seleccion[i.id] })),
              true,
            );
            this.setState({ seleccion: {}, textoGranel: {}, searchText: '' });
            Toast.show(`${total} ${total === 1 ? 'producto descontado' : 'productos descontados'} del inventario`);
          },
        },
      ],
    );
  };

  renderItem(item) {
    const cantidad = this.getCantidad(item.id);
    const seleccionado = cantidad > 0;
    return (
      <View style={{ ...tarjeta, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: seleccionado ? 1.5 : 1, borderColor: seleccionado ? colors.primary : colors.cardBorder }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>{item.nombre} {item.tamano}</Text>
            {!!item.marca && <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>{item.marca}</Text>}
          </View>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginRight: spacing.md }}>{this.cantidadConUnidad(item, item.stock)} disp.</Text>
          {item.esGranel ? (
            // A granel: cantidad con decimales (ej. 0.5 kg), como en el carrito
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{ width: 76, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: seleccionado ? colors.primary : colors.inputBorder, textAlign: 'center', fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, paddingHorizontal: spacing.sm }}
                keyboardType="decimal-pad"
                placeholder="0.000"
                placeholderTextColor={colors.placeholder}
                value={this.state.textoGranel[item.id] ?? ''}
                onChangeText={t => this.setCantidadGranel(item.id, t)}
              />
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginLeft: spacing.xs }}>{item.unidadGranel || 'kg'}</Text>
            </View>
          ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity onPress={() => this.setCantidad(item.id, cantidad - 1, item.stock)} style={{ width: BOTON_CANTIDAD, height: BOTON_CANTIDAD, borderRadius: radius.sm, backgroundColor: cantidad > 0 ? colors.chipInactive : colors.border, justifyContent: 'center', alignItems: 'center' }} disabled={cantidad === 0}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: cantidad > 0 ? colors.textPrimary : colors.textMuted }}>−</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: seleccionado ? colors.primary : colors.textMuted, minWidth: 28, textAlign: 'center' }}>{cantidad}</Text>
            <TouchableOpacity onPress={() => this.setCantidad(item.id, cantidad + 1, item.stock)} style={{ width: BOTON_CANTIDAD, height: BOTON_CANTIDAD, borderRadius: radius.sm, backgroundColor: cantidad < item.stock ? colors.success : colors.border, justifyContent: 'center', alignItems: 'center' }} disabled={cantidad >= item.stock}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: cantidad < item.stock ? colors.white : colors.textMuted }}>+</Text>
            </TouchableOpacity>
          </View>
          )}
        </View>
      </View>
    );
  }

  render() {
    const items = this.getSellableItems();
    const seleccionados = this.getItemsSeleccionados();
    const totalProductos = this.getTotalProductos();
    const haySeleccion = seleccionados.length > 0;
    const moneda = this.context.config?.moneda ?? '$';
    const costo = this.getCostoReferencia();
    const hayCosto = seleccionados.length > costo.sinCosto;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Encabezado
          titulo="Consumo propio"
          onBack={() => this.props.navigation.goBack()}
          derecha={haySeleccion ? <EtiquetaEncabezado texto={`${totalProductos} ${totalProductos === 1 ? 'producto' : 'productos'}`} /> : null}
        />

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.cardBorder }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>Selecciona los productos que te llevas. Se descontarán del inventario sin registrarse como venta.</Text>
          <CampoBusqueda style={{ marginTop: spacing.md }} placeholder="Buscar producto..." value={this.state.searchText} onChangeText={text => this.setState({ searchText: text })} />
        </View>

        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => this.renderItem(item)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={() => (
            <EstadoVacio
              Icono={IconPackage}
              tono="info"
              titulo="Sin productos disponibles"
              texto={this.state.searchText ? 'No hay coincidencias.' : 'Todos los productos tienen stock 0.'}
            />
          )}
        />

        {/* Panel de selección: ocupa su lugar debajo de la lista (antes era
            absolute con un espacio fijo de 120 px, y al crecer tapaba los
            últimos productos de la lista). */}
        {haySeleccion && (
          <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder, padding: spacing.lg, paddingBottom: spacing.xl }}>
            <View style={{ marginBottom: spacing.md }}>
              {seleccionados.map(item => {
                const cantidad = this.state.seleccion[item.id];
                return (
                  <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{item.nombre} {item.tamano}</Text>
                    <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>
                      × {this.cantidadConUnidad(item, cantidad)}
                      <Text style={{ fontWeight: 'normal', color: colors.textMuted }}>
                        {' · '}{item.precioCompra != null ? formatoDinero(item.precioCompra * cantidad, moneda) : 'sin costo'}
                      </Text>
                    </Text>
                  </View>
                );
              })}
              {hayCosto && (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xs, paddingTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Costo de referencia</Text>
                    <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textSecondary }}>{formatoDinero(costo.total, moneda)}</Text>
                  </View>
                  <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginTop: 2 }}>
                    Solo informativo, no se registra como gasto
                    {costo.sinCosto > 0 ? ` · no incluye ${costo.sinCosto} ${costo.sinCosto === 1 ? 'producto' : 'productos'} sin costo` : ''}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={this.confirmarConsumo} style={{ height: buttonHeight.action, backgroundColor: colors.warningDark, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Confirmar consumo · {totalProductos} {totalProductos === 1 ? 'producto' : 'productos'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
}
