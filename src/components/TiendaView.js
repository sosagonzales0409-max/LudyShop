import React, { Component } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

const MONEDAS = ['$', 'US$', '€', 'S/', 'Bs'];

const VALORES_DEFAULT = {
  nombreTienda: 'Mi Tienda',
  nombreDueno: '',
  moneda: '$',
  umbralStock: 5,
};

const labelStyle = { fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.xs };
const inputStyle = {
  borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  fontSize: fontSize.body, color: colors.textPrimary, backgroundColor: colors.card,
};

/**
 * TiendaView — Formulario de personalización de la tienda.
 * Nombre del dueño, nombre de la tienda, moneda, umbral de stock bajo.
 * Se abre desde ConfigView → 🏪 Personalizar la tienda.
 * El nombre del dueño vivía en ProfileView (eliminado); quedó aquí.
 */
export default class TiendaView extends Component {
  static contextType = StoreContext;

  state = {
    form: null,
    error: null,
    guardado: false,
  };

  componentDidMount() {
    this.setState({ form: { ...this.context.config } });
  }

  parseEntero(texto) {
    const n = parseInt(texto, 10);
    return Number.isNaN(n) ? 0 : n;
  }

  guardar() {
    const f = this.state.form;
    const umbral = this.parseEntero(f.umbralStock);

    if (f.nombreTienda.trim().length === 0) {
      this.setState({ error: 'El nombre de la tienda no puede quedar vacío.', guardado: false });
      return;
    }

    this.context.updateConfig({
      nombreTienda: f.nombreTienda.trim(),
      nombreDueno: f.nombreDueno.trim(),
      moneda: f.moneda,
      umbralStock: umbral,
    });

    this.setState({ error: null, guardado: true });
    clearTimeout(this._timerGuardado);
    this._timerGuardado = setTimeout(() => this.setState({ guardado: false }), 2000);
  }

  restablecer() {
    this.setState({ form: { ...VALORES_DEFAULT }, error: null, guardado: false });
  }

  setCampo(campo, valor) {
    this.setState(prev => ({ form: { ...prev.form, [campo]: valor }, error: null, guardado: false }));
  }

  renderSeccion(titulo, children) {
    return (
      <View
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.md,
          padding: spacing.lg,
          marginBottom: spacing.lg,
          elevation: 3,
          shadowOpacity: 0.08,
          shadowRadius: 4,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textSecondary, marginBottom: spacing.md }}>
          {titulo}
        </Text>
        {children}
      </View>
    );
  }

  render() {
    const f = this.state.form || this.context.config;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

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
            onPress={() => this.props.navigation.goBack()}
            style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}
          >
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Personalizar tienda
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>

          {this.renderSeccion('Tienda', (
            <View>
              <Text style={labelStyle}>Nombre del dueño</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. Juan García"
                placeholderTextColor={colors.textMuted}
                value={f.nombreDueno}
                onChangeText={text => this.setCampo('nombreDueno', text)}
                autoCorrect={false}
                returnKeyType="next"
              />
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm }}>
                Quién administra la tienda (aparece en reportes y cortes).
              </Text>

              <Text style={[labelStyle, { marginTop: spacing.md }]}>Nombre de la tienda</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. Mi Tienda"
                placeholderTextColor={colors.textMuted}
                value={f.nombreTienda}
                onChangeText={text => this.setCampo('nombreTienda', text)}
                autoCorrect={false}
                returnKeyType="done"
              />
            </View>
          ))}

          {this.renderSeccion('Moneda', (
            <View>
              <Text style={labelStyle}>Símbolo de moneda</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
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
                        marginRight: spacing.sm,
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
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm }}>
                Ej. {f.moneda}25.50 y {f.moneda}100.00
              </Text>
            </View>
          ))}

          {this.renderSeccion('Inventario', (
            <View>
              <Text style={labelStyle}>Umbral de stock bajo</Text>
              <TextInput
                style={inputStyle}
                placeholder="5"
                placeholderTextColor={colors.textMuted}
                value={String(f.umbralStock)}
                onChangeText={text => this.setCampo('umbralStock', text)}
                keyboardType="number-pad"
                returnKeyType="done"
              />
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm }}>
                Los productos con menos de esta cantidad unidades aparecen en "Stock bajo".
              </Text>
            </View>
          ))}

          {this.state.error && (
            <View
              style={{
                backgroundColor: '#fdecea',
                borderWidth: 1,
                borderColor: colors.danger,
                borderRadius: radius.sm,
                padding: spacing.md,
                marginBottom: spacing.md,
              }}
            >
              <Text style={{ fontSize: fontSize.caption, color: colors.danger, fontWeight: 'bold' }}>
                {this.state.error}
              </Text>
            </View>
          )}

          {this.state.guardado && (
            <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.success, textAlign: 'center', marginBottom: spacing.md }}>
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
              marginTop: spacing.md,
              borderRadius: radius.lg,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textSecondary }}>
              Restablecer valores
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }
}