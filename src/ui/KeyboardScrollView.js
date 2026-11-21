import React, { Component } from 'react';
import { ScrollView, View, Keyboard, TextInput } from 'react-native';

// Espacio libre que se deja entre el campo enfocado y el borde del teclado.
const MARGEN = 24;

/**
 * KeyboardScrollView — ScrollView para formularios que mantiene visible el
 * campo que se está editando cuando aparece el teclado.
 *
 * Por qué hace falta: la app apunta a Android 16 (targetSdk 36), donde se
 * dibuja de borde a borde y `adjustResize` ya no encoge la pantalla: el
 * teclado queda ENCIMA del contenido. Además, el ScrollView nativo se
 * desplaza al campo en el momento del toque, ANTES de que el teclado exista,
 * así que los campos de la parte baja quedaban tapados.
 *
 * Qué hace:
 *   1. Al aparecer el teclado (keyboardDidShow) mide cuánto de este
 *      ScrollView quedó debajo del teclado y agrega ese espacio al final del
 *      contenido (sin él, el último campo no puede subir más). En teléfonos
 *      donde adjustResize sí encoge la pantalla, ese espacio resulta ~0.
 *   2. Busca el campo enfocado y se desplaza lo justo para mostrarlo.
 *   3. Si con el teclado abierto se toca OTRO campo, repite el ajuste (solo
 *      si cambió el campo: desplazarse para mirar no te regresa al campo).
 *   4. Si el área de la lista cambia de tamaño con el teclado abierto,
 *      vuelve a medir.
 *   5. Al cerrarse el teclado quita el espacio extra.
 *
 * Se usa igual que un ScrollView (acepta sus mismas props). Nota:
 * contentContainerStyle se aplica a un View interno para poder medir los
 * campos con respecto al inicio del contenido.
 */
export default class KeyboardScrollView extends Component {
  state = { espacioTeclado: 0 };

  scrollY = 0;          // desplazamiento actual (se actualiza en onScroll)
  topeTeclado = null;   // borde superior del teclado en pantalla; null = cerrado
  ultimoCampo = null;   // último campo que se ajustó (para no repetir)

  componentDidMount() {
    this.subs = [
      Keyboard.addListener('keyboardDidShow', e => {
        this.topeTeclado = e.endCoordinates?.screenY ?? null;
        this.ajustar();
      }),
      Keyboard.addListener('keyboardDidHide', () => {
        this.topeTeclado = null;
        this.ultimoCampo = null;
        this.setState({ espacioTeclado: 0 });
      }),
    ];
  }

  componentWillUnmount() {
    // Sin esto los listeners seguirían vivos tras salir de la pantalla.
    this.subs?.forEach(s => s.remove());
  }

  // Tocar dentro de la lista con el teclado abierto: si cambió el campo
  // enfocado, ajustar. La pequeña espera deja que el foco se asiente.
  onTouchEnd = e => {
    this.props.onTouchEnd?.(e);
    if (this.topeTeclado == null) return;
    setTimeout(() => {
      if (TextInput.State.currentlyFocusedInput() !== this.ultimoCampo) this.ajustar();
    }, 50);
  };

  ajustar = () => {
    const campo = TextInput.State.currentlyFocusedInput();
    if (this.topeTeclado == null || !campo || !this.marco || !this.contenido || !this.scroll) return;
    this.ultimoCampo = campo;

    this.marco.measureInWindow((_x, marcoY, _w, marcoAlto) => {
      // Cuánto de este ScrollView quedó debajo del teclado.
      const cubierto = Math.max(0, Math.round(marcoY + marcoAlto - this.topeTeclado));
      const visible = marcoAlto - cubierto;

      const desplazar = () => campo.measureLayout(
        this.contenido,
        (_cx, campoY, _cw, campoAlto) => {
          const arriba = this.scrollY;
          const abajo = this.scrollY + visible;
          if (campoY + campoAlto + MARGEN > abajo) {
            this.scroll.scrollTo({ y: campoY + campoAlto + MARGEN - visible, animated: true });
          } else if (campoY - MARGEN < arriba) {
            this.scroll.scrollTo({ y: Math.max(0, campoY - MARGEN), animated: true });
          }
        },
        () => {}, // el campo ya no está en esta lista: no hay nada que hacer
      );

      if (cubierto !== this.state.espacioTeclado) {
        // Primero crece el espacio al final; luego (tras dibujarse) se desplaza.
        this.setState({ espacioTeclado: cubierto }, () => requestAnimationFrame(desplazar));
      } else {
        desplazar();
      }
    });
  };

  onScroll = e => {
    this.scrollY = e.nativeEvent.contentOffset.y;
    this.props.onScroll?.(e);
  };

  // Si el área de la lista cambia de tamaño con el teclado abierto (p. ej.
  // NewPurchaseScreen oculta su barra de total al aparecer el teclado, o
  // el sistema encoge la pantalla después del aviso), volver a medir.
  onLayoutMarco = e => {
    const alto = e.nativeEvent.layout.height;
    if (this.altoMarco !== undefined && alto !== this.altoMarco && this.topeTeclado != null) {
      this.ajustar();
    }
    this.altoMarco = alto;
  };

  render() {
    const { children, contentContainerStyle, style, ...resto } = this.props;
    return (
      <View ref={r => { this.marco = r; }} style={[{ flex: 1 }, style]} collapsable={false} onLayout={this.onLayoutMarco}>
        <ScrollView
          {...resto}
          ref={r => { this.scroll = r; }}
          style={{ flex: 1 }}
          onScroll={this.onScroll}
          onTouchEnd={this.onTouchEnd}
          scrollEventThrottle={16}
        >
          <View ref={r => { this.contenido = r; }} style={contentContainerStyle} collapsable={false}>
            {children}
            {/* Espacio del teclado: permite que los últimos campos suban */}
            <View style={{ height: this.state.espacioTeclado }} />
          </View>
        </ScrollView>
      </View>
    );
  }
}
