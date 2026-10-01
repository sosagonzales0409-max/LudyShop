import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

/**
 * Se muestra mientras StoreProvider abre la BD y carga los datos
 * (normalmente una fracción de segundo), o si ese arranque falla.
 *
 * @param {string|null} error       — mensaje si falló la carga
 * @param {Function}    onReintentar
 */
export default function PantallaCarga({ error, onReintentar }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white, justifyContent: 'center', alignItems: 'center', padding: spacing.xxl }}>
      {error ? (
        <>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm }}>
            No se pudieron cargar los datos
          </Text>
          <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl }}>
            {error}
          </Text>
          <TouchableOpacity
            onPress={onReintentar}
            style={{ height: buttonHeight.action, paddingHorizontal: spacing.xxl, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Reintentar</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Image
            source={require('../images/logo.png')}
            style={{ width: 300, height: 300, marginBottom: spacing.xl }}
          />
          <Text style={{ fontSize: fontSize.splash, color: colors.textPrimary, marginTop: spacing.md }}>Cargando…</Text>
        </>
      )}
    </View>
  );
}
