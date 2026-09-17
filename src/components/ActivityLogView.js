import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StoreContext, LOG_META } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

const FILTROS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'ventas',     label: 'Ventas' },
  { key: 'creditos',   label: 'Créditos' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'otros',      label: 'Otros' },
];

/**
 * ActivityLogView — historial cronológico de todos los cambios en la app.
 *
 * Acceso: fila "🗒️ Historial de actividad" en ConfigView.
 * Los eventos se registran automáticamente en StoreContext mediante logEvent().
 *
 * Filtros: Todos · Ventas · Créditos · Inventario · Otros
 */
export default class ActivityLogView extends Component {
  static contextType = StoreContext;

  state = { filtro: 'todos' };

  formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);

    const mismodia = (a, b) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (mismodia(d, hoy)) return `Hoy ${hora}`;
    if (mismodia(d, ayer)) return `Ayer ${hora}`;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${hora}`;
  }

  getEventosFiltrados() {
    const { activityLog } = this.context;
    const { filtro } = this.state;
    if (filtro === 'todos') return activityLog;
    return activityLog.filter(e => LOG_META[e.tipo]?.filtro === filtro);
  }

  renderEvento(evento) {
    const meta = LOG_META[evento.tipo] ?? { icono: '•', label: evento.tipo };

    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'flex-start',
          elevation: 2,
          shadowOpacity: 0.05,
          shadowRadius: 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        {/* Ícono del tipo de evento */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.sm,
            backgroundColor: colors.background,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
          }}
        >
          <Text style={{ fontSize: fontSize.label }}>{meta.icono}</Text>
        </View>

        {/* Descripción + fecha */}
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs }}
            numberOfLines={2}
          >
            {evento.desc}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
              {this.formatFecha(evento.fecha)}
            </Text>
            <View
              style={{
                backgroundColor: colors.chipInactive,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 'bold' }}>
                {meta.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  render() {
    const eventos = this.getEventosFiltrados();

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
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
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}
          >
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Historial de actividad
          </Text>
          <View
            style={{
              backgroundColor: colors.chipInactive,
              borderRadius: radius.lg,
              paddingVertical: spacing.xs,
              paddingHorizontal: spacing.md,
            }}
          >
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textSecondary }}>
              {eventos.length} eventos
            </Text>
          </View>
        </View>

        {/* Filtros */}
        <View
          style={{
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}
        >
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTROS}
            keyExtractor={f => f.key}
            renderItem={({ item: f }) => {
              const activo = this.state.filtro === f.key;
              return (
                <TouchableOpacity
                  onPress={() => this.setState({ filtro: f.key })}
                  style={{
                    height: buttonHeight.chip,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: activo ? colors.primary : colors.chipInactive,
                    borderRadius: radius.lg,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: activo ? colors.white : colors.textPrimary }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Lista de eventos */}
        <FlatList
          data={eventos}
          keyExtractor={item => item.id}
          renderItem={({ item }) => this.renderEvento(item)}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xxl,
          }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 40 }}>🗒️</Text>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>
                Sin actividad registrada
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>
                {this.state.filtro === 'todos'
                  ? 'Los cambios que hagas en la app aparecerán aquí.'
                  : 'No hay eventos de este tipo todavía.'}
              </Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }
}
