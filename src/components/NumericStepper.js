import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { colors, spacing, radius, fontSize } from '../config/theme';

/**
 * NumericStepper — selector de cantidad con botones − y +.
 * Migrado al design system: usa tokens de theme en vez de valores hardcoded.
 */
export default function NumericStepper({ value, onChange, min = 0, max = 9999 }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
        borderRadius: radius.md,
        height: 44,
        overflow: 'hidden',
      }}
    >
      {/* Botón − */}
      <TouchableOpacity
        onPress={() => { if (value > min) onChange(value - 1); }}
        style={{
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        hitSlop={4}
      >
        <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: value <= min ? colors.textMuted : colors.textPrimary }}>
          −
        </Text>
      </TouchableOpacity>

      {/* Valor */}
      <Text
        style={{
          fontSize: fontSize.itemTitle,
          fontWeight: 'bold',
          color: colors.textPrimary,
          minWidth: 36,
          textAlign: 'center',
        }}
      >
        {value}
      </Text>

      {/* Botón + */}
      <TouchableOpacity
        onPress={() => { if (value < max) onChange(value + 1); }}
        style={{
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
        }}
        hitSlop={4}
      >
        <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: value >= max ? colors.textMuted : colors.textPrimary }}>
          +
        </Text>
      </TouchableOpacity>
    </View>
  );
}
