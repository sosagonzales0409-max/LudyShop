import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
} from 'react-native';
import NumericStepper from './NumericStepper';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
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
  state = {
    cantidades: {}, // { [productId::presentacionId]: number }
  };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      this.setState({ cantidades: {} });
    }
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

    const resumen = items.map(i => `• ${i.nombre} ${i.tamano} × ${i.cantidad}`).join('\n');

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
                  Venta del {this.formatFecha(venta.fecha)} · ${venta.total.toFixed(2)}
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
                      backgroundColor: cantidad > 0 ? '#eef6ff' : colors.background,
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
                        {p.numProducts} vendidas · ${p.precio.toFixed(2)} c/u
                      </Text>
                    </View>
                    <NumericStepper
                      value={cantidad}
                      onChange={v => this.setCantidad(p.productId, p.presentacionId, v, p.numProducts)}
                      min={0}
                      max={p.numProducts}
                    />
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
                  {itemsDevueltos.length} {itemsDevueltos.length === 1 ? 'producto' : 'productos'} · {itemsDevueltos.reduce((s, i) => s + i.cantidad, 0)} unidades totales
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
                  style={{ flex: 2, height: buttonHeight.action, borderRadius: radius.lg, backgroundColor: haySeleccion ? colors.warning : colors.chipInactive, justifyContent: 'center', alignItems: 'center' }}
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
