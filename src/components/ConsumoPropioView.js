import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Alert,
  TextInput,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import Toast from './Toast';
import { colors, spacing, radius, fontSize, buttonHeight, iconButton } from '../config/theme';
import { IconBack } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

export default class ConsumoPropioView extends Component {
  static contextType = StoreContext;

  state = {
    searchText: '',
    seleccion: {},
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

  setCantidad(id, cantidad, maxStock) {
    const val = Math.max(0, Math.min(cantidad, maxStock));
    this.setState(prev => ({ seleccion: { ...prev.seleccion, [id]: val } }));
  }

  getItemsSeleccionados() {
    return this.getSellableItems().filter(item => (this.state.seleccion[item.id] ?? 0) > 0);
  }

  getTotalUnidades() {
    return this.getItemsSeleccionados().reduce((sum, item) => sum + (this.state.seleccion[item.id] ?? 0), 0);
  }

  confirmarConsumo = () => {
    const items = this.getItemsSeleccionados();
    if (items.length === 0) return;
    const totalUds = this.getTotalUnidades();
    const resumen = items.map(i => `• ${i.nombre} ${i.tamano} × ${this.state.seleccion[i.id]}`).join('\n');

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
            this.setState({ seleccion: {}, searchText: '' });
            Toast.show(`${totalUds} ${totalUds === 1 ? 'unidad descontada' : 'unidades descontadas'} del inventario`);
          },
        },
      ],
    );
  };

  renderItem(item) {
    const cantidad = this.getCantidad(item.id);
    const seleccionado = cantidad > 0;
    return (
      <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: seleccionado ? 1.5 : 0, borderColor: seleccionado ? colors.primary : 'transparent', elevation: seleccionado ? 4 : 2, shadowOpacity: seleccionado ? 0.1 : 0.05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>{item.nombre} {item.tamano}</Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic', marginTop: 2 }}>{item.marca}</Text>
          </View>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginRight: spacing.md }}>{item.stock} disp.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <TouchableOpacity onPress={() => this.setCantidad(item.id, cantidad - 1, item.stock)} style={{ width: iconButton.size + 4, height: iconButton.size + 4, borderRadius: radius.sm, backgroundColor: cantidad > 0 ? colors.chipInactive : colors.border, justifyContent: 'center', alignItems: 'center' }} disabled={cantidad === 0}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: cantidad > 0 ? colors.textPrimary : colors.textMuted }}>−</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: seleccionado ? colors.primary : colors.textMuted, minWidth: 28, textAlign: 'center' }}>{cantidad}</Text>
            <TouchableOpacity onPress={() => this.setCantidad(item.id, cantidad + 1, item.stock)} style={{ width: iconButton.size + 4, height: iconButton.size + 4, borderRadius: radius.sm, backgroundColor: cantidad < item.stock ? colors.success : colors.border, justifyContent: 'center', alignItems: 'center' }} disabled={cantidad >= item.stock}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: cantidad < item.stock ? colors.white : colors.textMuted }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  render() {
    const items = this.getSellableItems();
    const seleccionados = this.getItemsSeleccionados();
    const totalUnidades = this.getTotalUnidades();
    const haySeleccion = seleccionados.length > 0;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>Consumo propio</Text>
          {haySeleccion && (
            <View style={{ backgroundColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>{totalUnidades} {totalUnidades === 1 ? 'ud' : 'uds'}</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>Selecciona los productos que te llevas. Se descontarán del inventario sin registrarse como venta.</Text>
          <TextInput style={{ marginTop: spacing.md, borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }} placeholder="Buscar producto..." placeholderTextColor={colors.textMuted} value={this.state.searchText} onChangeText={text => this.setState({ searchText: text })} />
        </View>

        <FlatList
          data={items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => this.renderItem(item)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: haySeleccion ? 120 : spacing.xl }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40 }}>📦</Text>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>Sin productos disponibles</Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>{this.state.searchText ? 'No hay coincidencias.' : 'Todos los productos tienen stock 0.'}</Text>
            </View>
          )}
        />

        {haySeleccion && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, paddingBottom: spacing.xl, elevation: 8, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: -2 } }}>
            <View style={{ marginBottom: spacing.md }}>
              {seleccionados.map(item => (
                <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, flex: 1 }} numberOfLines={1}>{item.nombre} {item.tamano}</Text>
                  <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>× {this.state.seleccion[item.id]}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity onPress={this.confirmarConsumo} style={{ height: buttonHeight.action, backgroundColor: colors.warning, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Confirmar consumo · {totalUnidades} {totalUnidades === 1 ? 'unidad' : 'unidades'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }
}
