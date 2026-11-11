import React from 'react';
import { View, Text } from 'react-native';
import { colors, spacing, fontSize } from '../config/theme';

/**
 * Piezas para mostrar ESTADOS de forma consistente (rediseño nov 2026):
 * stock bajo / agotado, antigüedad de una deuda, sin deudas, lista vacía…
 * Antes cada pantalla usaba un color sólido con letra blanca (o un emoji);
 * ahora: fondo suave + punto de color + texto oscuro, que se lee con sol.
 */

// tono → [relleno del punto, fondo suave, texto]
export const TONOS = {
  ok:   [colors.success, colors.successSoft, colors.successDark],
  warn: [colors.warning, colors.warningSoft, colors.warningDark],
  bad:  [colors.danger,  colors.dangerSoft,  colors.dangerDark],
  info: [colors.primary, colors.primarySoft, colors.primaryDark],
};

// Etiqueta de estado: <ChipEstado tono="warn" texto="3 u · bajo" />
export function ChipEstado({ tono = 'info', texto, punto = true, grande = false }) {
  const [relleno, fondo, tinta] = TONOS[tono] ?? TONOS.info;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: fondo, borderRadius: 14, height: grande ? 40 : 28, paddingHorizontal: grande ? spacing.md : 10, minWidth: grande ? 76 : undefined, justifyContent: 'center' }}>
      {punto && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: relleno }} />}
      <Text numberOfLines={1} style={{ fontSize: grande ? 14 : fontSize.caption, fontWeight: 'bold', color: tinta }}>{texto}</Text>
    </View>
  );
}

// Estado vacío: ícono en círculo suave + título + explicación.
// <EstadoVacio Icono={IconCheckCircle} tono="ok" titulo="¡Todo en orden!" texto="…" />
export function EstadoVacio({ Icono, tono = 'info', titulo, texto, style }) {
  const [, fondo, tinta] = TONOS[tono] ?? TONOS.info;
  return (
    <View style={[{ alignItems: 'center', marginTop: 48, paddingHorizontal: spacing.xxl }, style]}>
      {!!Icono && (
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: fondo, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md }}>
          <Icono size={36} color={tinta} />
        </View>
      )}
      <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, textAlign: 'center' }}>{titulo}</Text>
      {!!texto && <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>{texto}</Text>}
    </View>
  );
}
