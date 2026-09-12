import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight, iconButton } from '../config/theme';

/**
 * Modal de detalle de un producto completo.
 * Muestra todas sus presentaciones con stock, precio y acciones.
 *
 * Acciones por presentación:
 *   + Agregar unidades  →  llama onAgregarUnidades(product, presentacion)
 *   ✏️ Editar           →  llama onEditar(product, presentacion)
 *   🗑 Eliminar          →  confirma y llama onEliminar(productId, presentacionId)
 *
 * @param {boolean}  visible
 * @param {object}   product             — objeto completo con presentaciones[]
 * @param {function} onClose
 * @param {function} onAgregarUnidades   — (product, presentacion)
 * @param {function} onEditar            — (product, presentacion)
 * @param {function} onEliminar          — (productId, presentacionId)
 */
export default class ProductDetailModal extends Component {
  confirmDelete(product, presentacion) {
    Alert.alert(
      'Eliminar presentación',
      `¿Seguro que quieres eliminar "${product.nombre} ${presentacion.tamano}"?\n\nEsta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            this.props.onEliminar(product.id, presentacion.id);
            if (product.presentaciones.length === 1) {
              this.props.onClose();
            }
          },
        },
      ],
    );
  }

  stockBadgeColor(stock) {
    if (stock === 0) return colors.danger;
    if (stock < 5) return colors.warning;
    return colors.success;
  }

  render() {
    const { visible, product, onClose, onAgregarUnidades, onEditar } = this.props;

    if (!product) return null;

    return (
      <Modal animationType="slide" transparent visible={visible}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
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
            {/* Handle visual */}
            <View
              style={{
                width: 40,
                height: 4,
                backgroundColor: colors.chipInactive,
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: spacing.lg,
              }}
            />

            {/* Header del producto */}
            <View
              style={{
                paddingHorizontal: spacing.xl,
                flexDirection: 'row',
                alignItems: 'flex-start',
                marginBottom: spacing.xs,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  {product.nombre}
                </Text>
                <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs }}>
                  {product.marca}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ padding: spacing.xs }}>
                <Text style={{ fontSize: fontSize.heading, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text
              style={{
                fontSize: fontSize.caption,
                color: colors.textMuted,
                paddingHorizontal: spacing.xl,
                marginBottom: spacing.lg,
              }}
            >
              {product.presentaciones.length}{' '}
              {product.presentaciones.length === 1 ? 'presentación' : 'presentaciones'}
            </Text>

            {/* Lista de presentaciones */}
            <ScrollView style={{ paddingHorizontal: spacing.xl }}>
              {product.presentaciones.map(pres => (
                <View
                  key={pres.id}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: radius.md,
                    padding: spacing.lg,
                    marginBottom: spacing.sm,
                  }}
                >
                  {/* Info de la presentación */}
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: spacing.md,
                    }}
                  >
                    <View>
                      <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
                        {pres.tamano}
                      </Text>
                      <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: spacing.xs }}>
                        ${pres.precio.toFixed(2)} c/u
                      </Text>
                    </View>

                    {/* Badge de stock */}
                    <View
                      style={{
                        backgroundColor: this.stockBadgeColor(pres.stock),
                        borderRadius: radius.sm,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                      }}
                    >
                      <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.body }}>
                        {pres.stock} uds
                      </Text>
                    </View>
                  </View>

                  {/* Acciones */}
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {/* + Agregar unidades */}
                    <TouchableOpacity
                      onPress={() => { onClose(); onAgregarUnidades(product, pres); }}
                      style={{
                        flex: 2,
                        height: buttonHeight.action,
                        borderRadius: radius.lg,
                        backgroundColor: colors.primary,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>
                        + Agregar unidades
                      </Text>
                    </TouchableOpacity>

                    {/* Editar */}
                    <TouchableOpacity
                      onPress={() => { onClose(); onEditar(product, pres); }}
                      style={{
                        flex: 1,
                        height: buttonHeight.action,
                        borderRadius: radius.lg,
                        backgroundColor: colors.chipInactive,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: colors.textPrimary, fontWeight: 'bold', fontSize: fontSize.label }}>
                        ✏️ Editar
                      </Text>
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
                      <Text style={{ fontSize: fontSize.label }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}
