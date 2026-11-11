import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconClose, IconWarning } from './Icon';

// Palabra que hay que escribir para confirmar (sin importar mayúsculas).
const PALABRA = 'BORRAR';

/**
 * BorrarDatosModal — segundo paso de "Borrar todos los datos".
 *
 * El primero es un Alert con lo que se perdería y la opción de exportar.
 * Aquí hay que ESCRIBIR una palabra: un toque accidental (o tocar "sí" sin
 * leer) no alcanza para algo que no se puede deshacer. Es un Modal propio
 * porque en Android Alert no admite campos de texto.
 *
 * @param {boolean}  visible
 * @param {function} onCancel
 * @param {function} onConfirmar
 */
export default class BorrarDatosModal extends Component {
  state = { texto: '' };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) this.setState({ texto: '' });
  }

  render() {
    const { visible, onCancel, onConfirmar } = this.props;
    const listo = this.state.texto.trim().toUpperCase() === PALABRA;

    return (
      <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: '88%',
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
            }}
          >
            {/* Título */}
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconWarning size={fontSize.heading} color={colors.danger} />
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1, marginLeft: spacing.sm }}>
                Borrar todos los datos
              </Text>
              <TouchableOpacity
                onPress={onCancel}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <IconClose size={fontSize.heading} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              Esta acción no se puede deshacer. Para confirmar, escribe{' '}
              <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{PALABRA}</Text>.
            </Text>

            <TextInput
              style={{
                borderWidth: 1.5,
                borderColor: listo ? colors.danger : colors.inputBorder,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                fontSize: fontSize.heading,
                fontWeight: 'bold',
                color: colors.textPrimary,
                textAlign: 'center',
                marginBottom: spacing.lg,
              }}
              placeholder={PALABRA}
              placeholderTextColor={colors.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              value={this.state.texto}
              onChangeText={texto => this.setState({ texto })}
            />

            {/* Botones */}
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <TouchableOpacity
                onPress={onCancel}
                style={{
                  flex: 1,
                  height: buttonHeight.action,
                  borderRadius: radius.lg,
                  backgroundColor: colors.chipInactive,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                  Cancelar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onConfirmar}
                disabled={!listo}
                style={{
                  flex: 1,
                  height: buttonHeight.action,
                  borderRadius: radius.lg,
                  backgroundColor: colors.danger,
                  opacity: listo ? 1 : 0.4,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                  Borrar todo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }
}
