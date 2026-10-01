import React, { Component } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, SafeAreaView, Dimensions, Switch, Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import ScrollViewTeclado from './ScrollViewTeclado';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack } from './Icon';
import { formatoDinero } from '../config/formato';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

const UNIDADES_MAP = {
  'kg':'kg','kgs':'kg','k':'kg','kilo':'kg','kilos':'kg',
  'g':'g','gr':'g','grs':'g','gramo':'g','gramos':'g',
  'l':'L','lt':'L','lts':'L','litro':'L','litros':'L',
  'ml':'ml','mililitro':'ml','mililitros':'ml',
  'pza':'pza','pzas':'pzas','pieza':'pza','piezas':'pzas',
  'und':'und','unidad':'und','unidades':'unds',
};

function normalizarTamano(texto) {
  if (!texto.trim()) return texto;
  const match = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-záéíóúüA-ZÁÉÍÓÚÜ]+)?$/);
  if (!match) return texto.trim();
  const num = match[1].replace(',', '.');
  const unidadRaw = (match[2] ?? '').toLowerCase();
  const unidadNorm = UNIDADES_MAP[unidadRaw];
  if (!unidadNorm) return texto.trim();
  return `${num} ${unidadNorm}`;
}

// Ganancia = venta − costo y su % sobre el PRECIO DE VENTA: misma fórmula que
// el detalle del producto (antes aquí era sobre el costo y no coincidían).
function calcGanancia(precioCompra, precioVenta) {
  const c = parseFloat(precioCompra); const v = parseFloat(precioVenta);
  if (isNaN(c) || isNaN(v) || c <= 0 || v <= 0) return null;
  return { ganancia: v - c, pct: Math.round(((v - c) / v) * 100) };
}

const UNIDADES_GRANEL = ['kg', 'g', 'L', 'ml'];

/**
 * EditarProductoView — pantalla completa para editar una presentación existente.
 * Reemplaza EditProductModal.
 *
 * Params: { productId, presentacionId }
 *
 * Secciones:
 *   PRESENTACIÓN  — tamaño, granel + unidad
 *   PRECIOS       — precio compra, precio venta, badge margen
 *   STOCK         — stock actual, razón del ajuste (opcional)
 */
export default class EditarProductoView extends Component {
  static contextType = StoreContext;

  state = {
    tamano: '', tamanoNormalizado: '',
    esGranel: false, unidadGranel: 'kg',
    precioCompra: '', precioVenta: '',
    stock: '', razonAjuste: '',
    listo: false,
  };

  componentDidMount() {
    const pres = this.getPresentacion();
    if (!pres) return;
    this.setState({
      tamano:      pres.tamano ?? '',
      esGranel:    pres.esGranel ?? false,
      unidadGranel:pres.unidadGranel ?? 'kg',
      precioCompra:pres.precioCompra != null ? String(pres.precioCompra) : '',
      precioVenta: String(pres.precio ?? ''),
      stock:       String(pres.stock ?? ''),
      listo: true,
    });
  }

  getProduct() {
    const { productId } = this.props.route.params;
    return this.context.products.find(p => p.id === productId) ?? null;
  }

  getPresentacion() {
    const { presentacionId } = this.props.route.params;
    return this.getProduct()?.presentaciones.find(pr => pr.id === presentacionId) ?? null;
  }

  onTamanoChange = text => {
    const normalizado = normalizarTamano(text);
    this.setState({ tamano: text, tamanoNormalizado: normalizado !== text.trim() ? normalizado : '' });
  };

  handleGuardar = () => {
    const moneda = this.context.config?.moneda ?? '$';
    const { tamano, tamanoNormalizado, esGranel, unidadGranel, precioCompra, precioVenta, stock, razonAjuste } = this.state;
    const { productId, presentacionId } = this.props.route.params;

    const tamanoFinal = tamanoNormalizado || tamano.trim();
    const precioVentaNum = parseFloat(String(precioVenta).replace(',', '.'));
    const precioCompraNum = precioCompra.trim() ? parseFloat(String(precioCompra).replace(',', '.')) : null;
    const stockNum = esGranel
      ? parseFloat(String(stock).replace(',', '.'))
      : Math.floor(parseFloat(String(stock).replace(',', '.')) || 0);

    // Vacía solo si es la ÚNICA presentación del producto (p. ej. "Gansito"):
    // con varias, cada una necesita nombre para distinguirlas.
    const esUnica = (this.getProduct()?.presentaciones.length ?? 0) <= 1;
    if (!tamanoFinal && !esUnica) {
      Alert.alert('Falta el tamaño', 'Este producto tiene varias presentaciones: cada una necesita un nombre para distinguirlas (ej. 1 kg, 600 ml, Individual).');
      return;
    }
    if (esGranel && !unidadGranel) { Alert.alert('Falta la unidad', 'Selecciona la unidad de granel.'); return; }
    if (isNaN(precioVentaNum) || precioVentaNum <= 0) { Alert.alert('Precio inválido', `Ingresa un precio de venta mayor a ${moneda}0.`); return; }
    if (precioCompraNum !== null && (isNaN(precioCompraNum) || precioCompraNum < 0)) { Alert.alert('Precio de compra inválido', 'El precio de compra no puede ser negativo.'); return; }
    if (isNaN(stockNum) || stockNum < 0) { Alert.alert('Stock inválido', 'El stock no puede ser negativo.'); return; }

    const cambios = {
      tamano: tamanoFinal,
      precio: precioVentaNum,
      precioCompra: precioCompraNum,
      stock: stockNum,
      esGranel,
      unidadGranel: esGranel ? unidadGranel : null,
    };

    // La razón del ajuste (si la hay) va dentro del evento de stock ajustado
    // que registra updatePresentacion — antes se registraba un segundo evento.
    this.context.updatePresentacion(productId, presentacionId, cambios, razonAjuste);

    this.props.navigation.goBack();
  };

  renderSeccion(titulo) {
    return <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.md }}>{titulo}</Text>;
  }

  renderLabel(texto) {
    return <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md }}>{texto}</Text>;
  }

  renderInput(props) {
    return <TextInput style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }} placeholderTextColor={colors.textMuted} autoCorrect={false} {...props} />;
  }

  renderBadgeMargen() {
    const g = calcGanancia(this.state.precioCompra, this.state.precioVenta);
    if (g === null) return null;
    const moneda = this.context.config?.moneda ?? '$';
    const unidad = this.state.esGranel ? this.state.unidadGranel : 'unidad';
    const color = g.pct > 15 ? colors.success : g.pct > 0 ? colors.warning : colors.danger;
    const icono = g.pct > 15 ? '✅' : g.pct > 0 ? '⚠️' : '🔴';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <View style={{ backgroundColor: color + '22', borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.caption }}>{icono} </Text>
          <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color }}>Ganancia: {formatoDinero(g.ganancia, moneda)} por {unidad} ({g.pct}% del precio)</Text>
        </View>
      </View>
    );
  }

  renderToggle(label, value, onChange, sublabel = '') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary }}>{label}</Text>
          {!!sublabel && <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 }}>{sublabel}</Text>}
        </View>
        <Switch value={value} onValueChange={onChange} trackColor={{ false: colors.chipInactive, true: colors.primary + '88' }} thumbColor={value ? colors.primary : '#f4f3f4'} />
      </View>
    );
  }

  render() {
    const product = this.getProduct();
    const { tamano, tamanoNormalizado, esGranel, unidadGranel, precioCompra, precioVenta, stock, razonAjuste, listo } = this.state;

    if (!product || !listo) return null;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>Editar presentación</Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>{product.nombre}{product.marca ? ` · ${product.marca}` : ''}</Text>
          </View>
        </View>

        <ScrollViewTeclado contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── PRESENTACIÓN ── */}
          {this.renderSeccion('Presentación')}
          {this.renderLabel('Tamaño / Presentación')}
          {this.renderInput({ placeholder: 'Ej. 1 kg, 600 ml, Chico', value: tamano, onChangeText: this.onTamanoChange, returnKeyType: 'next' })}
          {!!tamanoNormalizado && <Text style={{ fontSize: fontSize.small, color: colors.primary, marginTop: 4 }}>Se guardará como: <Text style={{ fontWeight: 'bold' }}>{tamanoNormalizado}</Text></Text>}
          {(this.getProduct()?.presentaciones.length ?? 0) <= 1 && (
            <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginTop: 4 }}>
              Es la única presentación: puedes dejarlo vacío y se mostrará solo el nombre del producto.
            </Text>
          )}

          {this.renderToggle('¿Es producto a granel?', esGranel, v => this.setState({ esGranel: v }), 'Se vende y stockea por peso o volumen')}

          {esGranel && (
            <>
              <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm, marginTop: spacing.md }}>Unidad de medida</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {UNIDADES_GRANEL.map(u => {
                  const sel = unidadGranel === u;
                  return (
                    <TouchableOpacity key={u} onPress={() => this.setState({ unidadGranel: u })}
                      style={{ flex: 1, height: 44, backgroundColor: sel ? colors.primary : colors.chipInactive, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: sel ? colors.white : colors.textPrimary }}>{u}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* ── PRECIOS ── */}
          {this.renderSeccion('Precios')}
          {this.renderLabel('Precio de compra (costo) — opcional')}
          {this.renderInput({ placeholder: '0.00', value: precioCompra, onChangeText: t => this.setState({ precioCompra: t }), keyboardType: 'decimal-pad' })}
          {this.renderLabel('Precio de venta')}
          {this.renderInput({ placeholder: '0.00', value: precioVenta, onChangeText: t => this.setState({ precioVenta: t }), keyboardType: 'decimal-pad' })}
          {this.renderBadgeMargen()}

          {/* ── STOCK ── */}
          {this.renderSeccion('Stock')}
          {this.renderLabel(`Stock actual${esGranel ? ` (${unidadGranel})` : ''}`)}
          {this.renderInput({ placeholder: esGranel ? '0.000' : '0', value: stock, onChangeText: t => this.setState({ stock: t }), keyboardType: 'decimal-pad' })}
          {this.renderLabel('Razón del ajuste — opcional')}
          {this.renderInput({ placeholder: 'Ej. Merma, Error de conteo, Inventario físico', value: razonAjuste, onChangeText: t => this.setState({ razonAjuste: t }) })}
          <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginTop: 4 }}>Solo se registra en el historial si el stock cambia.</Text>

          <TouchableOpacity onPress={this.handleGuardar} style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Guardar cambios</Text>
          </TouchableOpacity>
        </ScrollViewTeclado>
      </SafeAreaView>
    );
  }
}
