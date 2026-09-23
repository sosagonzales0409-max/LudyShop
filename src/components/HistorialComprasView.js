import React, { Component } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  SafeAreaView, Dimensions, Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack, IconTrash, IconEdit } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * HistorialComprasView — lista de todas las compras registradas.
 *
 * Acceso: fila "Compras" en ConfigView. Para registrar una compra nueva se usa
 * la fila "Registrar compra" independiente en ConfigView (no hay botón aquí,
 * para no duplicar esa entrada).
 * Cada compra muestra: proveedor, fecha, total, lista de ítems, un botón para
 * editarla (→ RegistrarCompraView en modo edición) y uno para eliminarla.
 */
export default class HistorialComprasView extends Component {
  static contextType = StoreContext;

  state = { expandidaId: null };

  getResumen() {
    const { compras = [] } = this.context;
    const total = compras.reduce((s, c) => s + (c.total ?? 0), 0);
    return { count: compras.length, total };
  }

  // Unidades vendidas de cada producto de la compra, después de la fecha de
  // la compra. Sirve para advertir antes de revertir stock: si ya se vendió
  // parte de esa mercancía, restarla del stock actual puede dejarlo mal.
  getVentasPosteriores(compra) {
    const { sales = [] } = this.context;
    const posteriores = sales.filter(s => s.fecha > compra.fecha);
    const resumen = {};
    (compra.items ?? []).forEach(item => {
      let vendidas = 0;
      posteriores.forEach(sale => {
        (sale.productos ?? []).forEach(p => {
          if (p.productId === item.productId && p.presentacionId === item.presentacionId) {
            vendidas += p.numProducts || 0;
          }
        });
      });
      if (vendidas > 0) {
        resumen[`${item.nombre} ${item.tamano}`] = vendidas;
      }
    });
    return resumen;
  }

  confirmarEliminar(compra) {
    const moneda = this.context.config?.moneda ?? '$';
    Alert.alert(
      'Eliminar compra',
      `¿Eliminar la compra de ${compra.proveedor} del ${fmtFecha(compra.fecha)} por ${moneda}${compra.total?.toFixed(2)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar (mantener stock)',
          onPress: () => this.context.eliminarCompra(compra.id, false),
        },
        {
          text: 'Eliminar y revertir stock',
          style: 'destructive',
          onPress: () => this.confirmarRevertirStock(compra),
        },
      ],
    );
  }

  // Si hubo ventas de estos productos después de la compra, avisa antes de
  // revertir el stock — restar a ciegas puede dejarlo incorrecto.
  confirmarRevertirStock(compra) {
    const ventasPosteriores = this.getVentasPosteriores(compra);
    const entradas = Object.entries(ventasPosteriores);

    if (entradas.length === 0) {
      this.eliminarYAvisarSiFalta(compra);
      return;
    }

    const detalle = entradas.map(([nombre, unidades]) => `• ${nombre}: ${unidades} vendidas después`).join('\n');
    Alert.alert(
      'Ya se vendió parte de esta mercancía',
      `Después de esta compra se registraron ventas de los mismos productos:\n\n${detalle}\n\nRevertir el stock puede dejarlo incorrecto. ¿Quieres continuar de todas formas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revertir de todas formas',
          style: 'destructive',
          onPress: () => this.eliminarYAvisarSiFalta(compra),
        },
      ],
    );
  }

  // Elimina la compra y, si algún ítem ya no tiene producto/presentación en
  // el inventario, avisa que ese stock no se pudo revertir (en vez de
  // fallar en silencio).
  eliminarYAvisarSiFalta(compra) {
    const resultado = this.context.eliminarCompra(compra.id, true);
    if (resultado?.itemsNoEncontrados?.length > 0) {
      const detalle = resultado.itemsNoEncontrados.map(i => `• ${i.nombre} ${i.tamano}`).join('\n');
      Alert.alert(
        'Stock no revertido para algunos productos',
        `Estos productos ya no existen en el inventario, así que su stock no se pudo revertir:\n\n${detalle}`,
      );
    }
  }

  renderCompra({ item: compra }) {
    const moneda   = this.context.config?.moneda ?? '$';
    const expandida = this.state.expandidaId === compra.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => this.setState(prev => ({ expandidaId: prev.expandidaId === compra.id ? null : compra.id }))}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          elevation: 2,
          shadowOpacity: 0.06,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        {/* Fila principal */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {compra.proveedor}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
              {fmtFecha(compra.fecha)} · {compra.tipoPago === 'Credito' ? 'Crédito' : 'Contado'}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              {moneda}{compra.total?.toFixed(2)}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
              {(compra.items ?? []).length} {compra.items?.length === 1 ? 'producto' : 'productos'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('RegistrarCompra', { compraId: compra.id })}
            style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.chipInactive, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}
          >
            <IconEdit size={fontSize.body} color={colors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => this.confirmarEliminar(compra)}
            style={{ width: 36, height: 36, borderRadius: radius.sm, backgroundColor: '#fde8e8', justifyContent: 'center', alignItems: 'center' }}
          >
            <IconTrash size={fontSize.body} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Detalle expandible */}
        {expandida && (compra.items ?? []).length > 0 && (
          <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
            {(compra.items ?? []).map((it, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: idx < compra.items.length - 1 ? spacing.sm : 0 }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={{ fontSize: fontSize.body, color: colors.textPrimary }}>{it.nombre}</Text>
                  {it.piezasPaquete != null && it.precioPaquete != null ? (
                    <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
                      Paquete de {it.piezasPaquete} × {moneda}{it.precioPaquete.toFixed(2)} · {it.cantidad} × {moneda}{it.costoUnitario?.toFixed(2)} c/u
                    </Text>
                  ) : (
                    <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
                      {it.cantidad} × {moneda}{it.costoUnitario?.toFixed(2)}
                    </Text>
                  )}
                </View>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                  {moneda}{it.subtotal?.toFixed(2)}
                </Text>
              </View>
            ))}
            {compra.notas ? (
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' }}>
                {compra.notas}
              </Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  render() {
    const { compras = [] } = this.context;
    const moneda = this.context.config?.moneda ?? '$';
    const { count, total } = this.getResumen();
    const ordenadas = [...compras].sort((a, b) => (b.fecha ?? '') > (a.fecha ?? '') ? 1 : -1);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Compras
          </Text>
        </View>

        {/* Resumen */}
        {count > 0 && (
          <View style={{ flexDirection: 'row', padding: spacing.lg, gap: spacing.sm }}>
            <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, elevation: 2 }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Total invertido</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: 2 }}>
                {moneda}{total.toFixed(2)}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.md, elevation: 2 }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Compras registradas</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: 2 }}>
                {count}
              </Text>
            </View>
          </View>
        )}

        <FlatList
          data={ordenadas}
          keyExtractor={item => item.id}
          renderItem={item => this.renderCompra(item)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>🛒</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>
                Sin compras registradas
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                Toca "Nueva" para registrar tu primera compra.
              </Text>
              <TouchableOpacity
                onPress={() => this.props.navigation.navigate('RegistrarCompra')}
                style={{ marginTop: spacing.xl, height: buttonHeight.action, paddingHorizontal: spacing.xxl, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Registrar compra</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }
}
