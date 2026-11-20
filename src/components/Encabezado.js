import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius, fontSize, HEADER_ALTO } from '../config/theme';
import { IconBack } from './Icon';

/**
 * Encabezado — barra azul de todas las pantallas (rediseño nov 2026).
 *
 * Reemplaza la franja verde fija de 50 (GREEN_BAR_HEIGHT) + el encabezado
 * blanco de 60. La app se dibuja de borde a borde (targetSdk 36), así que la
 * barra de estado del sistema queda ENCIMA de la app: el azul se extiende
 * debajo de ella con el alto real de cada teléfono (insets.top) en vez de
 * un número fijo.
 *
 *   <Encabezado
 *     titulo="Inventario"
 *     subtitulo="Valor total $18452.50"
 *     onBack={() => navigation.goBack()}          // opcional: flecha atrás
 *     acciones={[{ Icono: IconSettings, onPress, etiqueta: 'Configuración', badge: 3, punto: false }]}
 *     derecha={<EtiquetaEncabezado texto="$1245.00 total" color={colors.dangerDark} />}
 *   />
 *
 * `miniatura`: sin el alto de la barra de estado (réplicas de pantallas
 * dentro de la bienvenida, BienvenidaView).
 */
export default function Encabezado({ titulo, subtitulo, onBack, acciones = [], derecha = null, miniatura = false }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ backgroundColor: colors.primary, paddingTop: miniatura ? 0 : insets.top }}>
      <View style={{ height: HEADER_ALTO, flexDirection: 'row', alignItems: 'center', paddingLeft: onBack ? spacing.xs : spacing.lg, paddingRight: spacing.xs }}>
        {!!onBack && (
          <TouchableOpacity onPress={onBack} accessibilityRole="button" accessibilityLabel="Regresar" style={{ width: 48, height: 48, justifyContent: 'center', alignItems: 'center' }}>
            <IconBack size={28} color={colors.white} />
          </TouchableOpacity>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.white }}>{titulo}</Text>
          {!!subtitulo && (
            <Text numberOfLines={1} style={{ fontSize: fontSize.small + 0.5, color: colors.white, opacity: 0.92 }}>{subtitulo}</Text>
          )}
        </View>
        {derecha}
        {acciones.map(({ Icono, onPress, etiqueta, badge, punto }) => (
          <TouchableOpacity key={etiqueta} onPress={onPress} hitSlop={4} accessibilityRole="button" accessibilityLabel={etiqueta}
            style={{ width: 44, height: 48, justifyContent: 'center', alignItems: 'center' }}>
            <Icono size={26} color={colors.white} />
            {badge > 0 && (
              <View style={{ position: 'absolute', top: 6, right: 2, backgroundColor: colors.danger, borderRadius: 9, minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.primary }}>
                <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>{badge}</Text>
              </View>
            )}
            {punto && (
              <View style={{ position: 'absolute', top: 10, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.warning, borderWidth: 2, borderColor: colors.primary }} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Etiqueta blanca dentro del encabezado azul ("$1245.00 total", "4 productos").
export function EtiquetaEncabezado({ texto, color = colors.primaryDark }) {
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: radius.lg, paddingHorizontal: spacing.md, height: 30, justifyContent: 'center', marginHorizontal: spacing.sm }}>
      <Text numberOfLines={1} style={{ color, fontWeight: 'bold', fontSize: 14 }}>{texto}</Text>
    </View>
  );
}
