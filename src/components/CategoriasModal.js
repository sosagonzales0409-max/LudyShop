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
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconClose, IconEdit, IconPlus, IconTrash } from './Icon';

/**
 * CategoriasModal — CRUD completo de categorías.
 * Se abre desde el header de Inventory.js.
 *
 * @param {boolean}  visible
 * @param {Array}    categories   — lista del contexto (incluye id:0 "Todos")
 * @param {function} onClose
 * @param {function} onAdd        — recibe (nombre) → string
 * @param {function} onRename     — recibe (id, nuevoNombre)
 * @param {function} onDelete     — recibe (id)
 * @param {Array}    products     — para validar "categoría en uso"
 */
export default class CategoriasModal extends Component {
  state = {
    nuevaNombre: '',
    editandoId: null,
    editandoNombre: '',
  };

  categoriaEnUso(id) {
    return (this.props.products || []).some(
      p => String(p.categoriaId) === String(id),
    );
  }

  handleAdd = () => {
    const nombre = this.state.nuevaNombre.trim();
    if (!nombre) {
      Alert.alert('Falta información', 'Escribe un nombre para la categoría.');
      return;
    }
    const existe = (this.props.categories || []).some(
      c => c.nombre.toLowerCase() === nombre.toLowerCase(),
    );
    if (existe) {
      Alert.alert('Ya existe', `La categoría "${nombre}" ya está en la lista.`);
      return;
    }
    this.props.onAdd(nombre);
    this.setState({ nuevaNombre: '' });
  };

  handleRename = () => {
    const nombre = this.state.editandoNombre.trim();
    if (!nombre) {
      Alert.alert('Falta información', 'El nombre no puede estar vacío.');
      return;
    }
    this.props.onRename(this.state.editandoId, nombre);
    this.setState({ editandoId: null, editandoNombre: '' });
  };

  handleDelete = (cat) => {
    if (this.categoriaEnUso(cat.id)) {
      Alert.alert(
        'Categoría en uso',
        `"${cat.nombre}" tiene productos asignados. Reasigna o elimina esos productos antes de borrar la categoría.`,
      );
      return;
    }
    Alert.alert(
      'Eliminar categoría',
      `¿Seguro que quieres eliminar "${cat.nombre}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: () => this.props.onDelete(cat.id) },
      ],
    );
  };

  renderCategoria(cat) {
    const isEditing = this.state.editandoId === cat.id;

    return (
      <View
        key={String(cat.id)}
        style={{
          backgroundColor: colors.background,
          borderRadius: radius.md,
          padding: spacing.md,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        {isEditing ? (
          <>
            <TextInput
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: colors.primary,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                fontSize: fontSize.body,
                color: colors.textPrimary,
                marginRight: spacing.sm,
              }}
              autoFocus
              value={this.state.editandoNombre}
              onChangeText={t => this.setState({ editandoNombre: t })}
              onSubmitEditing={this.handleRename}
            />
            <TouchableOpacity
              onPress={this.handleRename}
              style={{
                height: buttonHeight.chip,
                paddingHorizontal: spacing.md,
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: spacing.sm,
              }}
            >
              <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label }}>
                OK
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => this.setState({ editandoId: null, editandoNombre: '' })}
              style={{
                height: buttonHeight.chip,
                paddingHorizontal: spacing.sm,
                backgroundColor: colors.chipInactive,
                borderRadius: radius.lg,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <IconClose size={fontSize.label} color={colors.textPrimary} />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={{ flex: 1, fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary }}>
              {cat.nombre}
            </Text>
            {/* Editar */}
            <TouchableOpacity
              onPress={() => this.setState({ editandoId: cat.id, editandoNombre: cat.nombre })}
              style={{
                height: 36,
                paddingHorizontal: spacing.md,
                backgroundColor: colors.chipInactive,
                borderRadius: radius.sm,
                justifyContent: 'center',
                alignItems: 'center',
                marginRight: spacing.sm,
              }}
            >
              <IconEdit size={fontSize.body} color={colors.textPrimary} />
            </TouchableOpacity>
            {/* Eliminar */}
            <TouchableOpacity
              onPress={() => this.handleDelete(cat)}
              style={{
                height: 36,
                paddingHorizontal: spacing.md,
                backgroundColor: '#fde8e8',
                borderRadius: radius.sm,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <IconTrash size={fontSize.body} color={colors.textPrimary} />
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  }

  render() {
    const { visible, onClose, categories = [] } = this.props;
    // "Todos" (id:0) no es editable
    const editables = categories.filter(c => c.id !== 0);

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
              maxHeight: '80%',
            }}
          >
            {/* Handle */}
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

            {/* Header */}
            <View
              style={{
                paddingHorizontal: spacing.xl,
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: spacing.lg,
              }}
            >
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
                Categorías
              </Text>
              <TouchableOpacity onPress={onClose}>
                <IconClose size={fontSize.heading} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Lista de categorías editables */}
            <FlatList
              data={editables}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => this.renderCategoria(item)}
              contentContainerStyle={{ paddingHorizontal: spacing.xl }}
              style={{ maxHeight: 320 }}
              ListEmptyComponent={() => (
                <Text style={{ color: colors.textMuted, fontSize: fontSize.body, textAlign: 'center', marginVertical: spacing.xl }}>
                  No hay categorías. Agrega una abajo.
                </Text>
              )}
            />

            {/* Campo para agregar nueva */}
            <View
              style={{
                paddingHorizontal: spacing.xl,
                paddingTop: spacing.lg,
                borderTopWidth: 1,
                borderTopColor: colors.border,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
              }}
            >
              <TextInput
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: colors.chipInactive,
                  borderRadius: radius.sm,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  fontSize: fontSize.body,
                  color: colors.textPrimary,
                }}
                placeholder="Nueva categoría..."
                placeholderTextColor={colors.textMuted}
                value={this.state.nuevaNombre}
                onChangeText={t => this.setState({ nuevaNombre: t })}
                onSubmitEditing={this.handleAdd}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={this.handleAdd}
                style={{
                  height: buttonHeight.action,
                  paddingHorizontal: spacing.lg,
                  backgroundColor: colors.primary,
                  borderRadius: radius.lg,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconPlus size={fontSize.label} color={colors.white} />
                <Text style={{ color: colors.white, fontWeight: 'bold', fontSize: fontSize.label, marginLeft: spacing.xs }}>
                  Agregar
                </Text>
              </View>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
