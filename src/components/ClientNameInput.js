import React, { useCallback, memo } from 'react';
import { TextInput } from 'react-native';
import { colors, spacing, radius, fontSize } from '../config/theme';

/**
 * ClientNameInput — TextInput controlado para el nombre de cliente en venta a
 * crédito. Extraído como componente memo para evitar re-renders innecesarios.
 *
 * Nota sobre el bug del teclado: el TextInput vivía dentro de un
 * ListHeaderComponent definido con arrow function inline en Main.js. Cada
 * setState (onChangeText) recreaba esa función, y React la trataba como un
 * tipo de componente distinto, desmontando y remontando el header en cada
 * tecla (el teclado desaparecía). La solución definitiva fue sacar la sección
 * de tipo de pago fuera del FlatList en Main.js. El memo de aquí solo evita
 * re-renders cuando value/onChangeText no cambian.
 */
const ClientNameInput = memo(({ value, onChangeText }) => {
  const handleChange = useCallback(text => onChangeText(text), [onChangeText]);

  return (
    <TextInput
      style={{
        borderColor: colors.chipInactive,
        borderWidth: 1,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        fontSize: fontSize.body,
        color: colors.textPrimary,
      }}
      placeholderTextColor={colors.textMuted}
      placeholder="Ingresa el nombre del cliente"
      value={value}
      onChangeText={handleChange}
      autoCorrect={false}
      returnKeyType="done"
    />
  );
});

export default ClientNameInput;
