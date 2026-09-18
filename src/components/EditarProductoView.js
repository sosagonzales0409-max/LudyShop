import React, { Component } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  SafeAreaView,
  Dimensions,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import Toast from './Toast';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

const UNIDADES_GRANEL = ['kg', 'g', 'L', 'ml'];

const UNIDADES_MAP = {
  'kg': 'kg', 'kgs': 'kg', 'k': 'kg', 'kilo': 'kg', 'kilos': 'kg',
  'g': 'g', 'gr': 'g', 'grs': 'g',
  'l': 'L', 'lt': 'L', 'lts': 'L', 'litro': 'L', 'litros': 'L',
  'ml': 'ml',
};

function normalizarTamano(texto) {
  if (!texto.trim()) return texto;
  const match = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-záéíóúüA-ZÁÉÍÓÚÜ]+)?$/);
  if (!match) return texto.trim();
  const num = match[1].replace(',', '.');
  const unidadNorm = UNIDADES_MAP[(match[2] ?? '').toLowerCase()];
  if (!unidadNorm) return texto.trim();
  return `${num} ${unidadNorm}`;
}

/**
 * EditarProductoView — pantalla completa para editar una presentación existente.
 *
 * Reemplaza EditProductModal: más espacio, precio de compra, toggle granel
 * y razón de ajuste de stock.
 *
 * Params requeridos: { productId, presentacionId }
 */
export default class EditarProductoView extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      tamano: '',
      tamanoNormalizado: '',
      esGranel: false,
      unidadGranel: 'kg',
      precioCompra: '',
      precioVenta: '',
      stock: '',
      razonAjuste: '',
      listo: false,
    };
  }

  componentDidMount() {
    const pres = this.getPresentacion();
    if (!pres) return;
    this.setState({
      tamano:       pres.tamano ?? '',
      esGranel:     pres.esGranel ?? false,
      unidadGranel: pres.unidadGranel ?? 'kg',
      precioCompra: pres.precioCompra != null ? String(pres.precioCompra) : '',
      precioVenta:  String(pres.precio ?? ''),
      stock:        String(pres.stock ?? 0),
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
    const norm = normalizarTamano(text);
    this.setState({ tamano: text, tamanoNormalizado: norm !== text.trim() ? norm : '' });
  };

  calcMargen() {
    const compra = parseFloat(String(this.state.precioCompra).replace(',', '.'));
    const venta  = parseFloat(String(this.state.precioVenta).replace(',', '.'));
    if (isNaN(compra) || isNaN(venta) || compra <= 0) return null;
    return ((venta - compra) / compra) * 100;
  }

  handleSave = () => {
    const pres    = this.getPresentacion();
    const product = this.getProduct();
    if (!pres || !product) return;

    const tamanoFinal = this.state.tamanoNormalizado || this.state.tamano.trim();
    const precioVNum  = parseFloat(String(this.state.precioVenta).replace(',', '.'));
    const precioCoNum = this.state.precioCompra.trim()
      ? parseFloat(String(this.state.precioCompra).replace(',', '.'))
      : null;
    const stockNum    = this.state.esGranel
      ? Math.max(0, parseFloat(String(this.state.stock).replace(',', '.')) || 0)
      : Math.max(0, Math.floor(parseFloat(this.state.stock) || 0));

    if (!tamanoFinal)             { Alert.alert('Falta tamaño', 'El tamaño no puede quedar vacío.'); return; }
    if (isNaN(precioVNum) || precioVNum <= 0) { Alert.alert('Precio inválido', 'Ingresa un precio de venta mayor a $0.'); return; }
    if (precioVNum > 99999)       { Alert.alert('Precio muy alto', 'El precio no puede superar $99,999.'); return; }
    if (isNaN(stockNum) || stockNum < 0) { Alert.alert('Stock inválido', 'El stock no puede ser negativo.'); return; }

    this.context.updatePresentacion(product.id, pres.id, {
      tamano:      tamanoFinal,
      precio:      precioVNum,
      precioCompra: precioCoNum,
      stock:       stockNum,
      esGranel:    this.state.esGranel,
      unidadGranel: this.state.esGranel ? this.state.unidadGranel : null,
    });

    Toast.show('Cambios guardados');
    this.props.navigation.goBack();
  };

  renderSeccion(titulo, children) {
    return (
      <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, elevation: 2, shadowOpacity: 0.06, shadowOffset: { width: 0, height: 1 } }}>
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textMuted, marginBottom: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {titulo}
        </Text>
        {children}
      </View>
    );
  }

  renderCampo(label, children, hint) {
    return (
      <View style={{ marginBottom: spacing.lg }}>
        <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.xs }}>{label}</Text>
        {children}
        {hint ? <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginTop: 4 }}>{hint}</Text> : null}
      </View>
    );
  }

  renderBadgeMargen() {
    const margen = this.calcMargen();
    if (margen === null) return null;
    const color = margen > 15 ? colors.success : margen > 0 ? colors.warning : colors.danger;
    const bg    = margen > 15 ? '#edfaf3' : margen > 0 ? '#fff8ed' : '#fdf0f0';
    return (
      <View style={{ backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, alignSelf: 'flex-start', marginTop: spacing.sm }}>
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color }}>
          Margen estimado: {margen > 0 ? '+' : ''}{margen.toFixed(1)}%
        </Text>
      </View>
    );
  }

  render() {
    const product = this.getProduct();
    const pres    = this.getPresentacion();

    if (!product || !pres) {
      return (
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
          <Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>Presentación no encontrada</Text>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
              Editar presentación
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
              {product.nombre} · {product.marca}
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Presentación ── */}
          {this.renderSeccion('Presentación', (
            <View>
              {this.renderCampo('Tamaño / Presentación', (
                <View>
                  <TextInput style={inputStyle} placeholderTextColor={colors.textMuted}
                    value={this.state.tamano} onChangeText={this.onTamanoChange} autoCorrect={false} />
                  {this.state.tamanoNormalizado ? (
                    <Text style={{ fontSize: fontSize.small, color: colors.primary, marginTop: 4 }}>
                      Se guardará como: <Text style={{ fontWeight: 'bold' }}>{this.state.tamanoNormalizado}</Text>
                    </Text>
                  ) : null}
                </View>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.label, color: colors.textPrimary }}>¿Producto a granel?</Text>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 }}>Se vende y stockea por peso o volumen</Text>
                </View>
                <Switch value={this.state.esGranel} onValueChange={v => this.setState({ esGranel: v })} trackColor={{ true: colors.primary }} />
              </View>
              {this.state.esGranel && (
                <View style={{ marginBottom: spacing.lg }}>
                  <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>Unidad de medida</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {UNIDADES_GRANEL.map(u => {
                      const sel = this.state.unidadGranel === u;
                      return (
                        <TouchableOpacity key={u} onPress={() => this.setState({ unidadGranel: u })}
                          style={{ flex: 1, height: 40, backgroundColor: sel ? colors.primary : colors.chipInactive, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: sel ? colors.white : colors.textPrimary }}>{u}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* ── Precios ── */}
          {this.renderSeccion('Precios', (
            <View>
              {this.renderCampo('Precio de compra ($)', (
                <TextInput style={inputStyle} placeholder="0.00 (opcional)" placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad" value={this.state.precioCompra}
                  onChangeText={t => this.setState({ precioCompra: t })} />
              ), 'Último costo pagado al proveedor.')}
              {this.renderCampo('Precio de venta ($)', (
                <TextInput style={inputStyle} placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad" value={this.state.precioVenta}
                  onChangeText={t => this.setState({ precioVenta: t })} />
              ))}
              {this.renderBadgeMargen()}
            </View>
          ))}

          {/* ── Stock ── */}
          {this.renderSeccion('Stock', (
            <View>
              {this.renderCampo(
                `Stock actual${this.state.esGranel ? ` (${this.state.unidadGranel})` : ' (unidades)'}`,
                <TextInput style={inputStyle} placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad" value={this.state.stock}
                  onChangeText={t => this.setState({ stock: t })} />,
                this.state.esGranel ? null : 'Los decimales se redondean automáticamente.',
              )}
              {this.renderCampo('Razón del ajuste (opcional)', (
                <TextInput style={[inputStyle, { height: 72, textAlignVertical: 'top' }]}
                  placeholder="Ej. Merma, corrección de conteo, devolución" placeholderTextColor={colors.textMuted}
                  multiline value={this.state.razonAjuste}
                  onChangeText={t => this.setState({ razonAjuste: t })} />
              ), 'Se registra en el historial de actividad.')}
            </View>
          ))}

          <TouchableOpacity onPress={this.handleSave}
            style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Guardar cambios</Text>
          </TouchableOpacity>

        </ScrollView>
      </SafeAreaView>
    );
  }
}

const inputStyle = {
  borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  fontSize: fontSize.body, color: colors.textPrimary,
};
