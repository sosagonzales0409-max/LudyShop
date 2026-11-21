import React, { Component } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Keyboard } from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { formatoDinero } from '../config/formato';
import { IconCheck, IconSearch } from './Icon';

/**
 * Piezas compartidas de los formularios (Agregar/Editar producto, Registrar
 * compra, Mi tienda…). Antes cada pantalla tenía su propio renderInput /
 * renderLabel / renderToggle con números distintos; aquí viven una sola vez
 * para que todos los formularios se vean y se comporten igual.
 *
 *   <Seccion titulo="Precios">           título + tarjeta blanca
 *     <Campo label="Precio de venta" prefijo="$" … />
 *     <FilaInterruptor label="¿Es a granel?" value={…} onValueChange={…} />
 *   </Seccion>
 *   <BarraGuardar texto="Guardar producto" onPress={…} />   (fuera del scroll)
 */

// Estilo base de un campo de texto: también lo usan los modales que no
// necesitan etiqueta (PaymentModal, EditPaymentModal…).
export const estiloCampo = {
  height: buttonHeight.action,
  borderWidth: 1,
  borderColor: colors.inputBorder,
  borderRadius: radius.sm,
  backgroundColor: colors.card,
  paddingHorizontal: spacing.md,
  fontSize: fontSize.label,
  color: colors.textPrimary,
};

// ─── Sección: título en mayúsculas + tarjeta con separación uniforme ─────────
export function Seccion({ titulo, children, style }) {
  return (
    <View>
      {!!titulo && (
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.sm, marginHorizontal: spacing.xs }}>
          {titulo}
        </Text>
      )}
      <View style={[{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.lg, gap: spacing.lg }, style]}>
        {children}
      </View>
    </View>
  );
}

// ─── Etiqueta de campo ("Marca · opcional") ─────────────────────────────────
export function Etiqueta({ texto, opcional = false }) {
  return (
    <Text style={{ fontSize: 14, fontWeight: '500', color: colors.label }}>
      {texto}
      {opcional && <Text style={{ fontWeight: 'normal', color: colors.placeholder }}> · opcional</Text>}
    </Text>
  );
}

// ─── Texto de ayuda bajo un campo ───────────────────────────────────────────
export function Ayuda({ children }) {
  return <Text style={{ fontSize: fontSize.caption, color: colors.placeholder, lineHeight: 18 }}>{children}</Text>;
}

// ─── Confirmación con palomita ("Se guardará como 1 kg") ────────────────────
export function NotaConfirmacion({ children }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <IconCheck size={16} color={colors.primaryDark} strokeWidth={2.5} />
      <Text style={{ flex: 1, fontSize: fontSize.caption, color: colors.primaryDark }}>{children}</Text>
    </View>
  );
}

/**
 * Campo — etiqueta + caja de texto de 48 de alto, con prefijo ("$") o sufijo
 * ("unidades", "kg") opcionales dentro de la caja. Al enfocarse, el borde se
 * pone azul. Cualquier otra prop va directo al TextInput.
 */
export class Campo extends Component {
  state = { enfocado: false };

  onFocus = e => { this.setState({ enfocado: true }); this.props.onFocus?.(e); };
  onBlur = e => { this.setState({ enfocado: false }); this.props.onBlur?.(e); };

  render() {
    const { label, opcional, prefijo, sufijo, ayuda, children, style, ...inputProps } = this.props;
    const { enfocado } = this.state;
    return (
      <View style={[{ gap: 6, minWidth: 0 }, style]}>
        {!!label && <Etiqueta texto={label} opcional={opcional} />}
        <View style={{ ...estiloCampo, paddingHorizontal: 0, flexDirection: 'row', alignItems: 'center', borderColor: enfocado ? colors.primary : colors.inputBorder, borderWidth: enfocado ? 1.5 : 1 }}>
          {!!prefijo && <Text style={{ fontSize: fontSize.label, color: colors.placeholder, paddingLeft: spacing.md }}>{prefijo}</Text>}
          <TextInput
            style={{ flex: 1, height: '100%', paddingHorizontal: prefijo ? spacing.xs : spacing.md, fontSize: fontSize.label, color: colors.textPrimary }}
            placeholderTextColor={colors.placeholder}
            autoCorrect={false}
            {...inputProps}
            onFocus={this.onFocus}
            onBlur={this.onBlur}
          />
          {!!sufijo && <Text style={{ fontSize: fontSize.label, color: colors.placeholder, paddingRight: spacing.md }}>{sufijo}</Text>}
        </View>
        {!!ayuda && <Ayuda>{ayuda}</Ayuda>}
        {children}
      </View>
    );
  }
}

/**
 * CampoBusqueda — buscador de 48 de alto con lupa (Inventario, Agregar a la
 * venta, Consumo propio). Mismo borde y foco que Campo, sin etiqueta.
 */
export class CampoBusqueda extends Component {
  state = { enfocado: false };

  onFocus = e => { this.setState({ enfocado: true }); this.props.onFocus?.(e); };
  onBlur = e => { this.setState({ enfocado: false }); this.props.onBlur?.(e); };

  render() {
    const { style, ...inputProps } = this.props;
    const { enfocado } = this.state;
    return (
      <View style={[{ ...estiloCampo, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderColor: enfocado ? colors.primary : colors.inputBorder, borderWidth: enfocado ? 1.5 : 1 }, style]}>
        <IconSearch />
        <TextInput
          style={{ flex: 1, height: '100%', padding: 0, fontSize: fontSize.label, color: colors.textPrimary }}
          placeholderTextColor={colors.placeholder}
          autoCorrect={false}
          returnKeyType="search"
          {...inputProps}
          onFocus={this.onFocus}
          onBlur={this.onBlur}
        />
      </View>
    );
  }
}

// Dos campos lado a lado (costo y venta, piezas y precio del paquete).
export function FilaCampos({ children }) {
  return <View style={{ flexDirection: 'row', gap: spacing.md }}>{children}</View>;
}

// ─── Interruptor: toda la fila responde al toque ────────────────────────────
export function FilaInterruptor({ label, sublabel, value, onValueChange, separador = false }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[{ flexDirection: 'row', alignItems: 'center', minHeight: buttonHeight.action, gap: spacing.md }, separador && { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.lg }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontSize.body, fontWeight: '500', color: colors.textPrimary }}>{label}</Text>
        {!!sublabel && <Text style={{ fontSize: fontSize.caption, color: colors.placeholder, marginTop: 2, lineHeight: 18 }}>{sublabel}</Text>}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: colors.chipInactive, true: colors.primary + '88' }} thumbColor={value ? colors.primary : '#f4f3f4'} />
    </TouchableOpacity>
  );
}

// ─── Casilla de verificación (fila completa de 48) ──────────────────────────
export function Casilla({ label, value, onChange }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onChange(!value)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={{ flexDirection: 'row', alignItems: 'center', minHeight: buttonHeight.action, gap: spacing.md }}
    >
      <View style={{ width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: value ? colors.primary : colors.inputBorder, backgroundColor: value ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
        {value && <IconCheck size={14} color={colors.white} strokeWidth={3.5} />}
      </View>
      <Text style={{ flex: 1, fontSize: 14, color: colors.label }}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Selector segmentado (kg · g · L · ml, Contado · Crédito) ───────────────
// `etiqueta` permite mostrar un texto distinto al valor guardado
// (p. ej. valor 'Credito' → "Crédito").
export function SelectorSegmentado({ opciones, valor, onChange, etiqueta = op => op, alto = 42 }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.chipInactive, borderRadius: radius.md, padding: 3, gap: 3 }}>
      {opciones.map(op => {
        const sel = op === valor;
        return (
          <TouchableOpacity
            key={op}
            onPress={() => onChange(op)}
            accessibilityRole="button"
            accessibilityState={{ selected: sel }}
            style={{ flex: 1, height: alto, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: sel ? colors.card : 'transparent', elevation: sel ? 1 : 0 }}
          >
            <Text style={{ fontSize: alto > 42 ? fontSize.label : fontSize.body, fontWeight: 'bold', color: sel ? colors.primaryDark : colors.label }}>{etiqueta(op)}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Ganancia: punto de color + texto (sin emojis) ──────────────────────────
// g = { ganancia, pct } de calcGanancia; > 15% verde, > 0% naranja, si no rojo.
export function BadgeGanancia({ g, unidad, moneda }) {
  if (!g) return null;
  const [color, tinta] = g.pct > 15
    ? [colors.success, colors.successDark]
    : g.pct > 0 ? [colors.warning, colors.warningDark] : [colors.danger, colors.dangerDark];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: color + '1A', borderRadius: radius.sm, paddingVertical: 10, paddingHorizontal: spacing.md }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ flex: 1, fontSize: 14, color: tinta }}>
        Ganancia <Text style={{ fontWeight: 'bold' }}>{formatoDinero(g.ganancia, moneda)}</Text> por {unidad} · <Text style={{ fontWeight: 'bold' }}>{g.pct}%</Text> del precio
      </Text>
    </View>
  );
}

/**
 * BarraGuardar — barra inferior con el botón principal, siempre a la vista
 * (va DEBAJO del KeyboardScrollView, no dentro). Se oculta mientras el teclado
 * está abierto: en los teléfonos donde adjustResize encoge la pantalla, la
 * barra subiría con el teclado y taparía el campo que se edita (mismo motivo
 * que la barra de total de NewPurchaseScreen). `children` va arriba del
 * botón (p. ej. el total de la compra).
 */
export class BarraGuardar extends Component {
  state = { tecladoVisible: false };

  componentDidMount() {
    this.subs = [
      Keyboard.addListener('keyboardDidShow', () => this.setState({ tecladoVisible: true })),
      Keyboard.addListener('keyboardDidHide', () => this.setState({ tecladoVisible: false })),
    ];
  }

  componentWillUnmount() {
    this.subs?.forEach(s => s.remove());
  }

  render() {
    const { texto, onPress, color = colors.primary, children } = this.props;
    if (this.state.tecladoVisible) return null;
    return (
      <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder, padding: spacing.md, gap: spacing.md }}>
        {children}
        <TouchableOpacity
          onPress={onPress}
          accessibilityRole="button"
          style={{ height: buttonHeight.action, backgroundColor: color, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>{texto}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}
