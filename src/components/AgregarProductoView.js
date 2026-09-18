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

const UNIDADES_MAP = {
  'kg': 'kg', 'kgs': 'kg', 'k': 'kg', 'kilo': 'kg', 'kilos': 'kg',
  'g': 'g', 'gr': 'g', 'grs': 'g', 'gramo': 'g', 'gramos': 'g',
  'l': 'L', 'lt': 'L', 'lts': 'L', 'litro': 'L', 'litros': 'L',
  'ml': 'ml', 'mililitro': 'ml', 'mililitros': 'ml',
  'pza': 'pza', 'pzas': 'pzas', 'pieza': 'pza', 'piezas': 'pzas',
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

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

const similitud = (a, b) => levenshtein(a.toLowerCase().trim(), b.toLowerCase().trim());
const UMBRAL = 0.70;
const UNIDADES_GRANEL = ['kg', 'g', 'L', 'ml'];

/**
 * AgregarProductoView — pantalla completa para dar de alta un producto
 * o una nueva presentación de un producto existente.
 *
 * Reemplaza ProductFormModal: más espacio, secciones claras, precio de
 * compra, badge de margen, toggle granel y opción de registrar la compra
 * inicial todo en un solo flujo.
 *
 * Acceso: botón "+ Agregar Producto" en Inventory.js
 * Params opcionales: { productoIdExistente } → abre en modo "nueva presentación"
 */
export default class AgregarProductoView extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    // Si viene con productoIdExistente, pre-rellena nombre y marca
    const productoId = props.route?.params?.productoIdExistente ?? null;
    const productoBase = productoId
      ? null // se resuelve en componentDidMount
      : null;
    this.state = {
      // Identificación
      nombre: '',
      marca: '',
      categoriaId: null,
      // Similitud / sugerencias
      sugerenciasNombre: [],
      sugerenciasMarca: [],
      productoSimilar: null,
      ignorarSimilitud: false,
      // Presentación
      tamano: '',
      tamanoNormalizado: '',
      esGranel: false,
      unidadGranel: 'kg',
      // Precios
      precioCompra: '',
      precioVenta: '',
      // Stock
      stockInicial: '0',
      // Registrar como compra
      registrarCompra: false,
      proveedor: '',
      tipoPagoCompra: 'Contado',
      // UI
      sugeringNombre: false,
      sugeringMarca: false,
      productoIdExistente: productoId,
    };
  }

  componentDidMount() {
    const { productoIdExistente } = this.state;
    const selectable = (this.context.categories || []).filter(c => c.id !== 0);
    const defaultCat = selectable.length > 0 ? selectable[0].id : null;

    if (productoIdExistente) {
      const p = this.context.products.find(pr => pr.id === productoIdExistente);
      if (p) {
        this.setState({
          nombre: p.nombre,
          marca: p.marca,
          categoriaId: p.categoriaId,
          ignorarSimilitud: true,
        });
        return;
      }
    }
    this.setState({ categoriaId: defaultCat });
  }

  capitalize = t => t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  onNombreChange = text => {
    const nombre = this.capitalize(text);
    const products = this.context.products;
    const sugerencias = text.trim().length >= 2
      ? [...new Set(products.map(p => p.nombre))].filter(n => n.toLowerCase().includes(text.toLowerCase())).slice(0, 3)
      : [];
    let similar = null;
    if (text.trim().length >= 3 && !this.state.ignorarSimilitud) {
      similar = products.find(p => similitud(p.nombre, text.trim()) >= UMBRAL && p.nombre.toLowerCase() !== text.toLowerCase()) ?? null;
    }
    this.setState({ nombre, sugerenciasNombre: sugerencias, sugeringNombre: sugerencias.length > 0, productoSimilar: similar });
  };

  onMarcaChange = text => {
    const marca = this.capitalize(text);
    const sugerencias = text.trim().length >= 2
      ? [...new Set(this.context.products.map(p => p.marca))].filter(m => m.toLowerCase().includes(text.toLowerCase())).slice(0, 3)
      : [];
    this.setState({ marca, sugerenciasMarca: sugerencias, sugeringMarca: sugerencias.length > 0 });
  };

  onTamanoChange = text => {
    const norm = normalizarTamano(text);
    this.setState({ tamano: text, tamanoNormalizado: norm !== text.trim() ? norm : '' });
  };

  usarSugerenciaNombre = nombre => {
    const products = this.context.products;
    const coincidentes = products.filter(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    const marca = coincidentes.length === 1 ? coincidentes[0].marca : this.state.marca;
    const categoriaId = coincidentes.length === 1 ? coincidentes[0].categoriaId : this.state.categoriaId;
    const productoIdExistente = coincidentes.length === 1 ? coincidentes[0].id : null;
    this.setState({ nombre, marca, categoriaId, sugerenciasNombre: [], sugeringNombre: false, productoSimilar: null, ignorarSimilitud: true, productoIdExistente });
  };

  calcMargen() {
    const compra = parseFloat(this.state.precioCompra.replace(',', '.'));
    const venta  = parseFloat(this.state.precioVenta.replace(',', '.'));
    if (isNaN(compra) || isNaN(venta) || compra <= 0) return null;
    return ((venta - compra) / compra) * 100;
  }

  // ─── Guardado ─────────────────────────────────────────────────────────────

  handleSave = () => {
    const { nombre, marca, categoriaId, tamano, tamanoNormalizado, esGranel, unidadGranel,
            precioCompra, precioVenta, stockInicial, registrarCompra, proveedor, tipoPagoCompra,
            productoIdExistente } = this.state;

    const tamanoFinal  = tamanoNormalizado || tamano.trim();
    const precioVNum   = parseFloat(precioVenta.replace(',', '.'));
    const precioCoNum  = precioCompra.trim() ? parseFloat(precioCompra.replace(',', '.')) : null;
    const stockNum     = esGranel
      ? Math.max(0, parseFloat(stockInicial.replace(',', '.')) || 0)
      : Math.max(0, Math.floor(parseFloat(stockInicial) || 0));

    if (!nombre.trim()) { Alert.alert('Falta nombre', 'Ingresa el nombre del producto.'); return; }
    if (!marca.trim())  { Alert.alert('Falta marca', 'Ingresa la marca del producto.'); return; }
    if (!tamanoFinal)   { Alert.alert('Falta tamaño', 'Ej: 1 kg, 600 ml, 3 L, Chico'); return; }
    if (isNaN(precioVNum) || precioVNum <= 0) { Alert.alert('Precio inválido', 'Ingresa un precio de venta mayor a $0.'); return; }
    if (precioVNum > 99999) { Alert.alert('Precio muy alto', 'El precio no puede superar $99,999.'); return; }
    if (!categoriaId) { Alert.alert('Falta categoría', 'Selecciona una categoría.'); return; }
    if (esGranel && !unidadGranel) { Alert.alert('Falta unidad', 'Selecciona la unidad de medida para este producto a granel.'); return; }
    if (registrarCompra && !proveedor.trim()) { Alert.alert('Falta proveedor', 'Ingresa el nombre del proveedor para registrar la compra.'); return; }

    // Duplicado exacto
    const nombreNorm = nombre.trim().toLowerCase();
    const marcaNorm  = marca.trim().toLowerCase();
    const tamanoNorm = tamanoFinal.toLowerCase();
    const products   = this.context.products;

    const existente = productoIdExistente
      ? products.find(p => p.id === productoIdExistente)
      : products.find(p => p.nombre.toLowerCase() === nombreNorm && p.marca.toLowerCase() === marcaNorm);

    if (existente) {
      const dupPres = existente.presentaciones.find(pr => pr.tamano.toLowerCase() === tamanoNorm);
      if (dupPres) {
        Alert.alert('Ya existe', `"${nombre.trim()} ${tamanoFinal}" de ${marca.trim()} ya está en el inventario.`);
        return;
      }
    }

    const datosPresentacion = {
      tamano: tamanoFinal,
      precio: precioVNum,
      precioCompra: precioCoNum,
      stock: stockNum,
      esGranel,
      unidadGranel: esGranel ? unidadGranel : null,
    };

    let productoGuardado;
    if (existente) {
      this.context.addPresentacion(existente.id, datosPresentacion);
      productoGuardado = { ...existente, _nuevaPresentacionId: null };
    } else {
      productoGuardado = this.context.addProduct({
        nombre: nombre.trim(),
        marca: marca.trim(),
        categoriaId: existente ? existente.categoriaId : categoriaId,
        ...datosPresentacion,
      });
    }

    // Si el toggle de compra está activo, registrar la compra
    if (registrarCompra && stockNum > 0 && precioCoNum) {
      const presentacionId = existente
        ? `nueva-${Date.now()}`
        : productoGuardado?.presentaciones?.[0]?.id ?? `nueva-${Date.now()}`;
      this.context.addCompra({
        proveedor: proveedor.trim(),
        tipoPago: tipoPagoCompra,
        notas: '',
        total: precioCoNum * stockNum,
        items: [{
          productId: existente?.id ?? productoGuardado?.id,
          presentacionId,
          nombre: nombre.trim(),
          tamano: tamanoFinal,
          cantidad: stockNum,
          costoUnitario: precioCoNum,
          subtotal: precioCoNum * stockNum,
        }],
      });
    }

    Toast.show(existente ? 'Presentación agregada' : 'Producto guardado');
    this.props.navigation.goBack();
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

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

  renderSugerencias(lista, onSelect) {
    if (!lista.length) return null;
    return (
      <View style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, marginTop: 2, backgroundColor: colors.card, elevation: 8 }}>
        {lista.map((item, idx) => (
          <TouchableOpacity key={item} onPress={() => onSelect(item)}
            style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: idx < lista.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: fontSize.body, color: colors.textPrimary }}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  renderAvisoSimilitud() {
    const { productoSimilar, ignorarSimilitud, nombre } = this.state;
    if (!productoSimilar || ignorarSimilitud || nombre.trim().length < 3) return null;
    return (
      <View style={{ backgroundColor: '#fff8ed', borderWidth: 1, borderColor: colors.warning, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.sm }}>
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.warning, marginBottom: spacing.xs }}>⚠️ ¿Es el mismo producto?</Text>
        <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginBottom: spacing.sm }}>
          Ya existe: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{productoSimilar.nombre}</Text> · {productoSimilar.marca}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => this.usarSugerenciaNombre(productoSimilar.nombre)}
            style={{ flex: 1, height: 36, backgroundColor: colors.warning, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.white }}>Sí, usar ese</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => this.setState({ productoSimilar: null, ignorarSimilitud: true })}
            style={{ flex: 1, height: 36, backgroundColor: colors.chipInactive, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>No, crear nuevo</Text>
          </TouchableOpacity>
        </View>
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
    const { categories } = this.context;
    const selectableCategories = categories.filter(c => c.id !== 0);
    const { sugeringNombre, sugerenciasNombre, sugeringMarca, sugerenciasMarca, productoIdExistente } = this.state;
    const esNuevaP = !!productoIdExistente;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            {esNuevaP ? 'Nueva presentación' : 'Agregar producto'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Identificación ── */}
          {this.renderSeccion('Identificación', (
            <View>
              {this.renderCampo('Nombre', (
                <View>
                  <TextInput style={inputStyle} placeholder="Ej. Arroz" placeholderTextColor={colors.textMuted}
                    value={this.state.nombre} onChangeText={this.onNombreChange} autoCorrect={false}
                    editable={!esNuevaP} />
                  {sugeringNombre && this.renderSugerencias(sugerenciasNombre, this.usarSugerenciaNombre)}
                  {this.renderAvisoSimilitud()}
                </View>
              ))}
              {this.renderCampo('Marca', (
                <View>
                  <TextInput style={inputStyle} placeholder="Ej. Verde Valle" placeholderTextColor={colors.textMuted}
                    value={this.state.marca} onChangeText={this.onMarcaChange} autoCorrect={false}
                    editable={!esNuevaP} />
                  {sugeringMarca && this.renderSugerencias(sugerenciasMarca, marca => this.setState({ marca, sugerenciasMarca: [], sugeringMarca: false }))}
                </View>
              ))}
              {!esNuevaP && (
                <View>
                  <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>Categoría</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {selectableCategories.map(cat => {
                      const sel = this.state.categoriaId === cat.id;
                      return (
                        <TouchableOpacity key={cat.id} onPress={() => this.setState({ categoriaId: cat.id })}
                          style={{ backgroundColor: sel ? colors.primary : colors.chipInactive, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginRight: spacing.sm, marginBottom: spacing.sm, minHeight: 40, justifyContent: 'center' }}>
                          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: sel ? colors.white : colors.textPrimary }}>{cat.nombre}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          ))}

          {/* ── Presentación ── */}
          {this.renderSeccion('Presentación', (
            <View>
              {this.renderCampo('Tamaño / Presentación', (
                <View>
                  <TextInput style={inputStyle} placeholder="Ej. 1 kg, 600 ml, 3 L, Chico" placeholderTextColor={colors.textMuted}
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
              ), 'El último costo pagado al proveedor. Útil para calcular el margen.')}
              {this.renderCampo('Precio de venta ($)', (
                <TextInput style={inputStyle} placeholder="0.00" placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad" value={this.state.precioVenta}
                  onChangeText={t => this.setState({ precioVenta: t })} />
              ))}
              {this.renderBadgeMargen()}
            </View>
          ))}

          {/* ── Inventario ── */}
          {this.renderSeccion('Inventario', (
            this.renderCampo(
              `Stock inicial${this.state.esGranel ? ` (${this.state.unidadGranel})` : ' (unidades)'}`,
              <TextInput style={inputStyle} placeholder="0" placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad" value={this.state.stockInicial}
                onChangeText={t => this.setState({ stockInicial: t })} />,
              this.state.esGranel ? null : 'Los decimales se redondean automáticamente.',
            )
          ))}

          {/* ── Registrar como compra ── */}
          {this.renderSeccion('Registrar como compra (opcional)', (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.label, color: colors.textPrimary }}>¿Registrar esta entrada como compra?</Text>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: 2 }}>Se guardará en el historial de compras con el proveedor y el costo total.</Text>
                </View>
                <Switch value={this.state.registrarCompra} onValueChange={v => this.setState({ registrarCompra: v })} trackColor={{ true: colors.primary }} />
              </View>
              {this.state.registrarCompra && (
                <View>
                  {this.renderCampo('Proveedor', (
                    <TextInput style={inputStyle} placeholder="Ej. Distribuidora García" placeholderTextColor={colors.textMuted}
                      value={this.state.proveedor} onChangeText={t => this.setState({ proveedor: t })} autoCorrect={false} />
                  ))}
                  <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>Tipo de pago</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
                    {['Contado', 'Credito'].map(t => {
                      const sel = this.state.tipoPagoCompra === t;
                      return (
                        <TouchableOpacity key={t} onPress={() => this.setState({ tipoPagoCompra: t })}
                          style={{ flex: 1, height: buttonHeight.chip, backgroundColor: sel ? colors.primary : colors.chipInactive, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: sel ? colors.white : colors.textPrimary }}>{t === 'Credito' ? 'Crédito' : t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {this.state.precioCompra && this.state.stockInicial ? (
                    <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md }}>
                      <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
                        Total de la compra:{' '}
                        <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>
                          {this.context.config?.moneda ?? '$'}
                          {(parseFloat(this.state.precioCompra || 0) * parseFloat(this.state.stockInicial || 0)).toFixed(2)}
                        </Text>
                      </Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ))}

          <TouchableOpacity onPress={this.handleSave}
            style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
              {this.state.productoIdExistente ? 'Guardar presentación' : 'Guardar producto'}
            </Text>
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
