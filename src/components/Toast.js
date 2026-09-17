import React, { Component } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { colors, spacing, radius, fontSize } from '../config/theme';
import { IconCheck, IconClose, IconInfo } from './Icon';

/**
 * Toast — mensaje flotante que aparece desde abajo, dura 2.5 s y desaparece.
 *
 * USO
 * ---
 * 1. Montar UNA sola instancia en App.tsx (encima de todo):
 *
 *      import Toast from './src/components/Toast';
 *
 *      export default function App() {
 *        return (
 *          <>
 *            <Navigator />
 *            <Toast ref={ref => Toast.setRef(ref)} />
 *          </>
 *        );
 *      }
 *
 * 2. Llamar desde cualquier archivo sin imports adicionales:
 *
 *      Toast.show('Venta completada');
 *      Toast.show('Stock actualizado', 'success');
 *      Toast.show('Nombre inválido', 'error');
 *      Toast.show('3 unidades descontadas', 'info');
 *
 * TIPOS
 * -----
 *   'success' (default) — verde  · para confirmaciones de éxito
 *   'error'             — rojo   · para errores no bloqueantes
 *   'info'              — azul   · para avisos informativos
 *
 * Por qué ref estático y no Context:
 * Los componentes de clase no tienen acceso a hooks, así que Context requeriría
 * un HOC wrapper en cada componente que use el Toast. El ref estático es más
 * simple: una instancia global, llamable desde cualquier lugar sin imports
 * adicionales, igual que Alert.alert.
 */

const DURACION = 2500;   // ms que el toast permanece visible
const OFFSET_Y = 90;     // px sobre el borde inferior (encima de la tab bar)

const BG = {
  success: colors.success,
  error:   colors.danger,
  info:    colors.primary,
};

export default class Toast extends Component {
  // ─── Ref estático ─────────────────────────────────────────────────────────

  static _ref = null;

  static setRef(ref) {
    Toast._ref = ref;
  }

  /**
   * Muestra el toast.
   * @param {string} mensaje
   * @param {'success'|'error'|'info'} tipo
   */
  static show(mensaje, tipo = 'success') {
    Toast._ref?.mostrar(mensaje, tipo);
  }

  // ─── Estado interno ───────────────────────────────────────────────────────

  state = {
    mensaje: '',
    tipo: 'success',
    visible: false,
  };

  _opacidad = new Animated.Value(0);
  _traslacion = new Animated.Value(20);
  _timer = null;

  // ─── API de instancia ─────────────────────────────────────────────────────

  mostrar(mensaje, tipo = 'success') {
    // Si hay uno visible, cancelarlo primero y resetear animaciones.
    clearTimeout(this._timer);
    this._opacidad.setValue(0);
    this._traslacion.setValue(20);

    this.setState({ mensaje, tipo, visible: true }, () => {
      // Entrada
      Animated.parallel([
        Animated.spring(this._opacidad,    { toValue: 1, useNativeDriver: true, speed: 20 }),
        Animated.spring(this._traslacion,  { toValue: 0, useNativeDriver: true, speed: 20 }),
      ]).start();

      // Salida automática
      this._timer = setTimeout(() => this._ocultar(), DURACION);
    });
  }

  _ocultar() {
    Animated.parallel([
      Animated.timing(this._opacidad,   { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(this._traslacion, { toValue: 20, duration: 250, useNativeDriver: true }),
    ]).start(() => this.setState({ visible: false }));
  }

  componentWillUnmount() {
    clearTimeout(this._timer);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  render() {
    const { mensaje, tipo, visible } = this.state;
    if (!visible) return null;

    const icono = tipo === 'success' ? (
      <IconCheck size={fontSize.label} color="#fff" />
    ) : tipo === 'error' ? (
      <IconClose size={fontSize.label} color="#fff" />
    ) : (
      <IconInfo size={fontSize.label} color="#fff" />
    );

    return (
      <Animated.View
        pointerEvents="none"          // no intercepta toques
        style={[
          styles.contenedor,
          { backgroundColor: BG[tipo] },
          {
            opacity:   this._opacidad,
            transform: [{ translateY: this._traslacion }],
          },
        ]}
      >
        <View style={styles.icono}>{icono}</View>
        <Text style={styles.texto} numberOfLines={2}>
          {mensaje}
        </Text>
      </Animated.View>
    );
  }
}

const styles = StyleSheet.create({
  contenedor: {
    position: 'absolute',
    bottom: OFFSET_Y,
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    zIndex: 9999,
  },
  icono: {
    marginRight: spacing.sm,
  },
  texto: {
    fontSize: fontSize.body,
    color: '#fff',
    fontWeight: '600',
    flex: 1,
  },
});
