import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize } from '../config/theme';
import {
  IconStore, IconTrendingUp, IconCoffee, IconClipboard,
  IconSave, IconFile, IconChevron, IconBack, IconShoppingBag, IconPlus,
} from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

export default class ConfigView extends Component {
  static contextType = StoreContext;

  renderCard(children) {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
          elevation: 3,
          shadowOpacity: 0.08,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {children}
      </View>
    );
  }

  renderFila(icono, titulo, subtitulo, onPress = null) {
    const activa = onPress !== null;
    const contenido = (
      <>
        <View style={{ width: 40, alignItems: 'center' }}>
          {icono}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
            {titulo}
          </Text>
          {!!subtitulo && (
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
              {subtitulo}
            </Text>
          )}
        </View>
        {activa ? (
          <IconChevron size={fontSize.itemTitle} color={colors.textMuted} />
        ) : (
          <View
            style={{
              backgroundColor: colors.chipInactive,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: fontSize.small, fontWeight: 'bold', color: colors.textSecondary }}>
              🚧 Próximamente
            </Text>
          </View>
        )}
      </>
    );

    if (activa) {
      return (
        <TouchableOpacity
          onPress={onPress}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }}
        >
          {contenido}
        </TouchableOpacity>
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, opacity: 0.55 }}>
        {contenido}
      </View>
    );
  }

  renderDivider() {
    return <View style={{ height: 1, backgroundColor: colors.border }} />;
  }

  render() {
    const nav = this.props.navigation;

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
            onPress={() => nav.goBack()}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}
          >
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Configuración
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing.xxl }}>

          {/* ── Tienda ── */}
          {this.renderCard(
            this.renderFila(<IconStore size={20} />, 'Personalizar la tienda', 'Nombre, moneda, stock bajo',
              () => nav.navigate('TiendaView'),
            ),
          )}

          {/* ── Negocio ── */}
          {this.renderCard(
            <View>
              {this.renderFila(<IconTrendingUp size={20} />, 'Reportes', 'Analítica del negocio',
                () => nav.navigate('Reportes'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconShoppingBag size={20} />, 'Compras', 'Historial de compras a proveedores',
                () => nav.navigate('HistorialCompras'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconPlus size={20} />, 'Registrar compra', 'Nueva compra a proveedor',
                () => nav.navigate('RegistrarCompra'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconCoffee size={20} />, 'Consumo propio', 'Llevarte producto sin registrar venta',
                () => nav.navigate('ConsumoPropioView'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconClipboard size={20} />, 'Historial de actividad', 'Registro de todos los cambios en la app',
                () => nav.navigate('ActivityLogView'),
              )}
            </View>,
          )}

          {/* ── Datos ── */}
          {this.renderCard(
            <View>
              {this.renderFila(<IconSave size={20} />, 'Copia de seguridad', 'Exportar / importar datos')}
              {this.renderDivider()}
              {this.renderFila(<IconFile size={20} />, 'Exportar reporte', 'Reporte PDF / CSV')}
            </View>,
          )}

        </ScrollView>
      </SafeAreaView>
    );
  }
}
