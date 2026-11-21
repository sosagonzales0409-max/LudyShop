import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import KeyboardScrollView from '../ui/KeyboardScrollView';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import Header from '../ui/Header';
import { Seccion, Campo, Etiqueta, Ayuda } from '../ui/FormFields';
import { AvisoPrimeraVez } from '../ui/StatusViews';

// Aviso "Empieza por aquí": se cierra con su X o al guardar.
const PISTA = 'pista_tienda';

const MONEDAS = ['$', 'US$', '€', 'S/', 'Bs'];

const VALORES_DEFAULT = {
  nombreTienda: 'Mi Tienda',
  nombreDueno: '',
  moneda: '$',
  umbralStock: 5,
};

/**
 * StoreSettingsScreen — Formulario de personalización de la tienda.
 * Nombre del dueño, nombre de la tienda, moneda, umbral de stock bajo.
 * Se abre desde SettingsScreen → Personalizar la tienda.
 * El nombre del dueño vivía en ProfileView (eliminado); quedó aquí.
 */
export default class StoreSettingsScreen extends Component {
  static contextType = StoreContext;

  state = {
    form: null,
    error: null,
    guardado: false,
  };

  componentDidMount() {
    this.setState({ form: { ...this.context.config } });
  }

  componentWillUnmount() {
    clearTimeout(this._timerGuardado);
  }

  parseEntero(texto) {
    const n = parseInt(texto, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  guardar() {
    // El error y el "✓ Cambios guardados" se muestran DEBAJO del último campo:
    // con el teclado abierto quedarían tapados y parecería que no pasó nada.
    Keyboard.dismiss();
    const f = this.state.form;
    const umbral = this.parseEntero(f.umbralStock);

    if (f.nombreTienda.trim().length === 0) {
      this.setState({ error: 'El nombre de la tienda no puede quedar vacío.', guardado: false });
      return;
    }

    if (umbral < 0) {
      this.setState({ error: 'El umbral de stock bajo no puede ser negativo.', guardado: false });
      return;
    }

    this.context.updateConfig({
      nombreTienda: f.nombreTienda.trim(),
      nombreDueno: f.nombreDueno.trim(),
      moneda: f.moneda,
      umbralStock: umbral,
    });

    this.setState({ error: null, guardado: true });
    this.context.marcarPistaVista(PISTA);
    clearTimeout(this._timerGuardado);
    this._timerGuardado = setTimeout(() => this.setState({ guardado: false }), 2000);
  }

  restablecer() {
    this.setState({ form: { ...VALORES_DEFAULT }, error: null, guardado: false });
  }

  setCampo(campo, valor) {
    this.setState(prev => ({ form: { ...prev.form, [campo]: valor }, error: null, guardado: false }));
  }

  render() {
    const f = this.state.form || this.context.config;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header titulo="Personalizar tienda" onBack={() => this.props.navigation.goBack()} />

        {/* KeyboardScrollView: con la app de borde a borde (Android 16) el
            teclado tapaba el campo del umbral, que es el último de la pantalla.
            El botón Guardar se queda dentro del scroll (no en barra fija) para
            que el error o el "✓ Cambios guardados" aparezcan junto a él. */}
        <KeyboardScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled">

          <AvisoPrimeraVez
            clave={PISTA}
            titulo="Empieza por aquí"
            texto="Escribe el nombre de tu tienda y elige tu moneda. Puedes cambiarlo cuando quieras."
          />

          <Seccion titulo="Tienda">
            <Campo
              label="Nombre del dueño"
              placeholder="Ej. Juan García"
              value={f.nombreDueno}
              onChangeText={text => this.setCampo('nombreDueno', text)}
              returnKeyType="next"
              ayuda="Quién administra la tienda (aparece en reportes y cortes)."
            />
            <Campo
              label="Nombre de la tienda"
              placeholder="Ej. Mi Tienda"
              value={f.nombreTienda}
              onChangeText={text => this.setCampo('nombreTienda', text)}
              returnKeyType="done"
            />
          </Seccion>

          <Seccion titulo="Moneda">
            <View style={{ gap: spacing.sm }}>
              <Etiqueta texto="Símbolo de moneda" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {MONEDAS.map(simbolo => {
                  const activo = f.moneda === simbolo;
                  return (
                    <TouchableOpacity
                      key={simbolo}
                      onPress={() => this.setCampo('moneda', simbolo)}
                      style={{
                        minWidth: 56,
                        height: buttonHeight.chip,
                        backgroundColor: activo ? colors.primary : colors.chipInactive,
                        borderRadius: radius.lg,
                        paddingHorizontal: spacing.md,
                        justifyContent: 'center', alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: activo ? colors.white : colors.textPrimary }}>
                        {simbolo}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Ayuda>Ej. {f.moneda}25.50 y {f.moneda}100.00</Ayuda>
            </View>
          </Seccion>

          <Seccion titulo="Inventario">
            <Campo
              label="Umbral de stock bajo"
              placeholder="5"
              value={String(f.umbralStock)}
              onChangeText={text => this.setCampo('umbralStock', text)}
              keyboardType="number-pad"
              returnKeyType="done"
              ayuda='Los productos con menos de esta cantidad aparecen en "Stock bajo".'
            />
          </Seccion>

          <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
            {this.state.error && (
              <View
                style={{
                  backgroundColor: colors.dangerSoft,
                  borderWidth: 1,
                  borderColor: colors.danger,
                  borderRadius: radius.sm,
                  padding: spacing.md,
                }}
              >
                <Text style={{ fontSize: fontSize.caption, color: colors.dangerDark, fontWeight: 'bold' }}>
                  {this.state.error}
                </Text>
              </View>
            )}

            {this.state.guardado && (
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.successDark, textAlign: 'center' }}>
                ✓ Cambios guardados
              </Text>
            )}

            <TouchableOpacity
              onPress={() => this.guardar()}
              style={{
                height: buttonHeight.action,
                backgroundColor: colors.primary,
                borderRadius: radius.lg,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Guardar cambios
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => this.restablecer()}
              style={{
                height: buttonHeight.chip,
                borderRadius: radius.lg,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textSecondary }}>
                Restablecer valores
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardScrollView>
      </View>
    );
  }
}
