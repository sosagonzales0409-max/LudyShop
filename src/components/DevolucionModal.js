import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import NumericStepper from './NumericStepper';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { formatoDinero, formatoCantidad, nombreProducto } from '../config/formato';
import { StoreContext } from '../context/StoreContext';
import { IconClose } from './Icon';

/**
 * DevolucionModal — bottom sheet para registrar una devolución parcial
 * o total de una venta.
 *
 * Muestra la lista de productos de la venta con un stepper para indicar
 * cuántas unidades devuelve el cliente (0 = no devuelve ese producto).
 *
 * Al confirmar pregunta si el stock regresa al inventario.
 *
 * @param {boolean}  visible
 * @param {object}   venta          — objeto de venta completo con productos[]
 * @param {function} onCancel
 * @param {function} onConfirmar    — recibe ({ items, devolverStock })
 *                                    items: [{ productId, presentacionId,
 *                                              nombre, tamano, cantidad }]
 */
export default class DevolucionModal extends Component {
  static contextType = StoreContext;

  state = {
    cantidades: {},  // { [productId::presentacionId]: number }
    textos: {},      // a granel: texto tal cual se escribe ("0.5")
  };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.setState({ cantidades: {}, textos: {} });
    }
  }

  // A granel se devuelve con decimales (0.5 kg de 1.5 kg vendidos). Se guarda
  // el texto tal cual y el número; que no pase de lo vendido se valida al
  // confirmar.
  setCantidadGranel(productId, presentacionId, texto) {
    const key = `${productId}::${presentacionId}`;
    let limpio = texto.replace(/[^0-9.]/g, '');
    const punto = limpio.indexOf('.');
    if (punto !== -1) limpio = limpio.slice(0, punto + 1) + limpio.slice(punto + 1).replace(/\./g, '');
    const valor = parseFloat(limpio);
    this.setState(prev => ({
      textos: { ...prev.textos, [key]: limpio },
      cantidades: { ...prev.cantidades, [key]: isNaN(valor) ? 0 : valor },
    }));
  }

  // "2" piezas o "0.5 kg"
  cantidadConUnidad(p, n) {
    return p.esGranel ? formatoCantidad(n, true, p.unidadGranel || 'kg') : formatoCantidad(n);
  }

  getCantidad(productId, presentacionId) {
    return this.state.cantidades[`${productId}::${presentacionId}`] ?? 0;
  }

  setCantidad(productId, presentacionId, valor, max) {
    const key = `${productId}::${presentacionId}`;
    const val = Math.max(0, Math.min(valor, max));
    this.setState(prev => ({ cantidades: { ...prev.cantidades, [key]: val } }));
  }

  getItemsDevueltos() {
    const { venta } = this.props;
    if (!venta || !Array.isArray(venta.productos)) return [];
    return venta.productos
      .map(p => ({
        productId: p.productId,
        presentacionId: p.presentacionId,
        nombre: p.nombre,
        tamano: p.tamano,
        esGranel: !!p.esGranel,
        unidadGranel: p.unidadGranel ?? null,
        cantidad: this.getCantidad(p.productId, p.presentacionId),
        max: p.numProducts,
      }))
      .filter(p => p.cantidad > 0);
  }

  handleConfirmar = () => {
    const items = this.getItemsDevueltos();
    if (items.length === 0) {
      Alert.alert('Sin productos', 'Selecciona al menos un producto para devolver.');
      return;
    }

    const excedido = items.find(i => i.cantidad > i.max + 0.0005);
    if (excedido) {
      Alert.alert('Cantidad inválida', `"${nombreProducto(excedido.nombre, excedido.tamano)}": solo se vendieron ${this.cantidadConUnidad(excedido, excedido.max)}.`);
      return;
    }

    const resumen = items.map(i => `• ${nombreProducto(i.nombre, i.tamano)} × ${this.cantidadConUnidad(i, i.cantidad)}`).join('\n');

    Alert.alert(
      '¿Devolver al inventario?',
      `Productos a devolver:\n\n${resumen}\n\n¿El cliente devuelve la mercancía físicamente?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'No (solo ajustar deuda)',
          onPress: () => this.props.onConfirmar({ items, devolverStock: false }),
        },
        {
          text: 'Sí, devolver al inventario',
          onPress: () => this.props.onConfirmar({ items, devolverStock: true }),
        },
      ],
    );
  };

  formatFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  render() {
    const moneda = this.context.config?.moneda ?? '$';
    const { visible, onCancel, venta } = this.props;
    if (!venta) return null;

    const productos = Array.isArray(venta.productos) ? venta.productos : [];
    const itemsDevueltos = this.getItemsDevueltos();
    const haySeleccion = itemsDevueltos.length > 0;

    return (
      <Modal animationType="slide" transparent visible={visible}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: colors.card,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              paddingTop: spacing.sm,
              paddingBottom: spacing.xxl,
              maxHeight: '85%',
            }}
          >
            {/* Handle */}
            <View style={{ width: 40, height: 4, backgroundColor: colors.chipInactive, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg }} />

            {/* Header */}
            <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  Registrar devolución
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>
                  Venta del {this.formatFecha(venta.fecha)} · {formatoDinero(venta.total, moneda)}
                </Text>
              </View>
              <TouchableOpacity
                onPress={onCancel}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <IconClose size={fontSize.heading} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}>
              Indica cuántas unidades devuelve el cliente de cada producto.
            </Text>

            {/* Lista de productos */}
            <FlatList
              data={productos}
              keyExtractor={(_, i) => i.toString()}
              style={{ paddingHorizontal: spacing.xl }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item: p }) => {
                const cantidad = this.getCantidad(p.productId, p.presentacionId);
                return (
                  <View
                    style={{
                      backgroundColor: cantidad > 0 ? colors.primarySoft : colors.background,
                      borderRadius: radius.md,
                      padding: spacing.lg,
                      marginBottom: spacing.sm,
                      borderWidth: cantidad > 0 ? 1.5 : 0,
                      borderColor: cantidad > 0 ? colors.primary : 'transparent',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flex: 1, marginRight: spacing.md }}>
                      <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                        {p.nombre} {p.tamano}
                      </Text>
                      <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                        {p.esGranel
                          ? `${this.cantidadConUnidad(p, p.numProducts)} vendidos · ${formatoDinero(p.precio, moneda)} por ${p.unidadGranel || 'kg'}`
                          : `${p.numProducts} vendidas · ${formatoDinero(p.precio, moneda)} c/u`}
                      </Text>
                    </View>
                    {p.esGranel ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TextInput
                          style={{ width: 76, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: cantidad > 0 ? colors.primary : colors.inputBorder, backgroundColor: colors.card, textAlign: 'center', fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, paddingHorizontal: spacing.sm }}
                          keyboardType="decimal-pad"
                          placeholder="0.000"
                          placeholderTextColor={colors.placeholder}
                          value={this.state.textos[`${p.productId}::${p.presentacionId}`] ?? ''}
                          onChangeText={t => this.setCantidadGranel(p.productId, p.presentacionId, t)}
                        />
                        <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginLeft: spacing.xs }}>{p.unidadGranel || 'kg'}</Text>
                      </View>
                    ) : (
                      <NumericStepper
                        value={cantidad}
                        onChange={v => this.setCantidad(p.productId, p.presentacionId, v, p.numProducts)}
                        min={0}
                        max={p.numProducts}
                      />
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={() => (
                <Text style={{ color: colors.textMuted, textAlign: 'center', fontSize: fontSize.body }}>
                  Esta venta no tiene productos registrados.
                </Text>
              )}
            />

            {/* Resumen + botón confirmar */}
            <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm }}>
              {haySeleccion && (
                <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginBottom: spacing.md }}>
                  {itemsDevueltos.length} {itemsDevueltos.length === 1 ? 'producto' : 'productos'} a devolver
                </Text>
              )}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <TouchableOpacity
                  onPress={onCancel}
                  style={{ flex: 1, height: buttonHeight.action, borderRadius: radius.lg, backgroundColor: colors.chipInactive, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={this.handleConfirmar}
                  style={{ flex: 2, height: buttonHeight.action, borderRadius: radius.lg, backgroundColor: haySeleccion ? colors.warningDark : colors.chipInactive, justifyContent: 'center', alignItems: 'center' }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: haySeleccion ? colors.white : colors.textMuted }}>
                    Confirmar devolución
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
