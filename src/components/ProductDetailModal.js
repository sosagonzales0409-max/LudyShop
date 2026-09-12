import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

/**
 * ProductDetailModal — bottom sheet con detalle de un producto.
 *
 * Jerarquía de acciones por presentación:
 *   PRIMARIA  → "+ Agregar unidades" (azul, ancho completo)
 *   SECUNDARIA → menú ⋯ expandible con Editar y Eliminar
 *
 * AgregarUnidadesModal se maneja internamente — se apila sobre este modal
 * sin cerrarlo, para no romper el contexto visual del usuario.
 *
 * @param {boolean}  visible
 * @param {object}   product             — objeto completo con presentaciones[]
 * @param {function} onClose
 * @param {function} onEditar            — (product, presentacion)
 * @param {function} onEliminar          — (productId, presentacionId)
 */
export default class ProductDetailModal extends Component {
  state = {
    // menú ⋯ abierto para esta presentacionId (null = ninguno)
    menuAbierto: null,
    // agregar unidades inline
    showAgregar: false,
    agregarPres: null,
    cantidadInput: '',
  };

  stockBadgeColor(stock) {
    if (stock === 0) return colors.danger;
    if (stock < 5) return colors.warning;
    return colors.success;
  }

  abrirAgregar(pres) {
    this.setState({ showAgregar: true, agregarPres: pres, cantidadInput: '', menuAbierto: null });
  }

  cerrarAgregar() {
    this.setState({ showAgregar: false, agregarPres: null, cantidadInput: '' });
  }

  confirmarAgregar() {
    const cantidad = parseInt(this.state.cantidadInput, 10);
    if (isNaN(cantidad) || cantidad <= 0) {
      Alert.alert('Cantidad inválida', 'Ingresa un número mayor a 0.');
      return;
    }
    // Actualiza stock vía contexto — el padre lo pasa como prop
    this.props.onAgregarUnidades(this.props.product, this.state.agregarPres, cantidad);
    this.cerrarAgregar();
  }

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
            this.setState({ menuAbierto: null });
            this.props.onEliminar(product.id, presentacion.id);
            if (product.presentaciones.length === 1) this.props.onClose();
          },
        },
      ],
    );
  }

  renderAgregarPanel(pres) {
    const cantidadNum = parseInt(this.state.cantidadInput, 10);
    const nuevoStock = !isNaN(cantidadNum) && cantidadNum > 0 ? pres.stock + cantidadNum : null;

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: colors.primary,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        {/* Cabecera del panel */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primary, flex: 1 }}>
            + Agregar unidades — {pres.tamano}
          </Text>
          <TouchableOpacity
            onPress={() => this.cerrarAgregar()}
            style={{ width: 32, height: 32, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontSize: fontSize.label, color: colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Stock actual */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Stock actual</Text>
          <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
            {pres.stock} uds
          </Text>
        </View>

        {/* Input */}
        <TextInput
          style={{
            borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm,
            paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
            fontSize: fontSize.heading, fontWeight: 'bold',
            color: colors.textPrimary, textAlign: 'center',
            marginBottom: spacing.sm,
          }}
          placeholder="0"
          placeholderTextColor={colors.chipInactive}
          keyboardType="number-pad"
          autoFocus
          value={this.state.cantidadInput}
          onChangeText={t => this.setState({ cantidadInput: t })}
        />

        {/* Vista previa */}
        {nuevoStock !== null && (
          <Text style={{ fontSize: fontSize.caption, color: colors.primary, textAlign: 'center', marginBottom: spacing.md }}>
            Nuevo stock: <Text style={{ fontWeight: 'bold' }}>{nuevoStock} uds</Text>
          </Text>
        )}

        {/* Confirmar */}
        <TouchableOpacity
          onPress={() => this.confirmarAgregar()}
          style={{
            height: buttonHeight.action, backgroundColor: colors.primary,
            borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
            Confirmar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  renderPresentacion(product, pres) {
    const menuAbierto = this.state.menuAbierto === pres.id;
    const panelAgregar = this.state.showAgregar && this.state.agregarPres?.id === pres.id;

    return (
      <View key={pres.id} style={{ marginBottom: spacing.sm }}>
        {/* Tarjeta de presentación */}
        <View
          style={{
            backgroundColor: colors.background,
            borderRadius: radius.md,
            padding: spacing.lg,
          }}
        >
          {/* Fila superior: info + badge stock + menú ⋯ */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ flex: 1 }}>
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
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.md,
                marginRight: spacing.sm,
              }}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.body }}>
                {pres.stock} uds
              </Text>
            </View>

            {/* Botón ⋯ menú secundario */}
            <TouchableOpacity
              onPress={() => this.setState({ menuAbierto: menuAbierto ? null : pres.id })}
              style={{
                width: 36, height: 36, borderRadius: radius.sm,
                backgroundColor: colors.chipInactive,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, letterSpacing: 1 }}>⋯</Text>
            </TouchableOpacity>
          </View>

          {/* Acción primaria: Agregar unidades */}
          <TouchableOpacity
            onPress={() => panelAgregar ? this.cerrarAgregar() : this.abrirAgregar(pres)}
            style={{
              height: buttonHeight.action,
              backgroundColor: panelAgregar ? colors.chipInactive : colors.primary,
              borderRadius: radius.lg,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: panelAgregar ? colors.textPrimary : colors.white }}>
              {panelAgregar ? 'Cancelar' : '+ Agregar unidades'}
            </Text>
          </TouchableOpacity>

          {/* Menú ⋯ expandible */}
          {menuAbierto && (
            <View
              style={{
                marginTop: spacing.sm,
                borderTopWidth: 1, borderTopColor: colors.border,
                paddingTop: spacing.sm,
                flexDirection: 'row',
                gap: spacing.sm,
              }}
            >
              <TouchableOpacity
                onPress={() => {
                  this.setState({ menuAbierto: null });
                  this.props.onClose();
                  this.props.onEditar(product, pres);
                }}
                style={{
                  flex: 1, height: buttonHeight.chip,
                  backgroundColor: colors.chipInactive,
                  borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                  flexDirection: 'row', gap: spacing.xs,
                }}
              >
                <Text style={{ fontSize: fontSize.body }}>✏️</Text>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                  Editar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => this.confirmDelete(product, pres)}
                style={{
                  flex: 1, height: buttonHeight.chip,
                  backgroundColor: '#fde8e8',
                  borderRadius: radius.lg,
                  justifyContent: 'center', alignItems: 'center',
                  flexDirection: 'row', gap: spacing.xs,
                }}
              >
                <Text style={{ fontSize: fontSize.body }}>🗑️</Text>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.danger }}>
                  Eliminar
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Panel de agregar unidades (apilado debajo de la tarjeta) */}
        {panelAgregar && this.renderAgregarPanel(pres)}
      </View>
    );
  }

  render() {
    const { visible, product, onClose } = this.props;
    if (!product) return null;

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
            <View
              style={{
                width: 40, height: 4, backgroundColor: colors.chipInactive,
                borderRadius: 2, alignSelf: 'center', marginBottom: spacing.lg,
              }}
            />

            {/* Header */}
            <View style={{ paddingHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
                  {product.nombre}
                </Text>
                <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, fontStyle: 'italic', marginTop: spacing.xs }}>
                  {product.marca}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { this.setState({ menuAbierto: null, showAgregar: false }); onClose(); }}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: fontSize.heading, color: colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}>
              {product.presentaciones.length}{' '}
              {product.presentaciones.length === 1 ? 'presentación' : 'presentaciones'} · Toca ⋯ para editar o eliminar
            </Text>

            {/* Lista de presentaciones */}
            <ScrollView
              style={{ paddingHorizontal: spacing.xl }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {product.presentaciones.map(pres => this.renderPresentacion(product, pres))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}
