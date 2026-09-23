import React, { Component } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  SafeAreaView, Dimensions, Switch, Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

// ─── Normalización de tamaños ──────────────────────────────────────────────────
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

// ─── Similitud de Levenshtein ─────────────────────────────────────────────────
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n; if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return 1 - dp[m][n] / Math.max(m, n);
}

const similitud = (a, b) => levenshtein(a.toLowerCase().trim(), b.toLowerCase().trim());
const UMBRAL = 0.70;

// ─── Badge de margen ──────────────────────────────────────────────────────────
function calcMargen(precioCompra, precioVenta) {
  const c = parseFloat(precioCompra); const v = parseFloat(precioVenta);
  if (isNaN(c) || isNaN(v) || c <= 0) return null;
  return Math.round(((v - c) / c) * 100);
}

const UNIDADES_GRANEL = ['kg', 'g', 'L', 'ml'];

/**
 * AgregarProductoView — pantalla completa que reemplaza ProductFormModal.
 *
 * Secciones:
 *   IDENTIFICACIÓN  — nombre, marca, categoría, Levenshtein
 *   PRESENTACIÓN    — tamaño, normalización, toggle granel + unidad
 *   PRECIOS         — precio compra, precio venta, badge margen
 *   INVENTARIO      — stock inicial, toggle "registrar como compra"
 */
export default class AgregarProductoView extends Component {
  static contextType = StoreContext;

  state = {
    // Identificación
    nombre: '', marca: '', categoriaId: null,
    sugerenciasNombre: [], sugeringNombre: false,
    sugerenciasMarca: [], sugeringMarca: false,
    productoSimilar: null, ignorarSimilitud: false,
    // Presentación
    tamano: '', tamanoNormalizado: '',
    esGranel: false, unidadGranel: 'kg',
    // Precios
    precioCompra: '', precioVenta: '',
    compraEsPaquete: false,
    compraPiezasPaquete: '', compraPrecioPaquete: '', compraNumPaquetes: '',
    // Inventario
    stock: '',
    registrarComoCompra: true,
    proveedor: '',
  };

  componentDidMount() {
    const cats = (this.context.categories || []).filter(c => c.id !== 0);
    this.setState({ categoriaId: cats.length > 0 ? cats[0].id : null });
  }

  capitalize = t => t.length > 0 ? t.charAt(0).toUpperCase() + t.slice(1) : t;

  // ─── Handlers ──────────────────────────────────────────────────────────────

  onNombreChange = text => {
    const nombre = this.capitalize(text);
    const products = this.context.products || [];
    const sugerenciasNombre = text.trim().length >= 2
      ? [...new Set(products.map(p => p.nombre))].filter(n => n.toLowerCase().includes(text.toLowerCase().trim())).slice(0, 3)
      : [];
    let productoSimilar = null;
    if (text.trim().length >= 3 && !this.state.ignorarSimilitud) {
      productoSimilar = products.find(p => similitud(p.nombre, text.trim()) >= UMBRAL && p.nombre.toLowerCase().trim() !== text.toLowerCase().trim()) ?? null;
    }
    this.setState({ nombre, sugerenciasNombre, sugeringNombre: sugerenciasNombre.length > 0, productoSimilar });
  };

  onMarcaChange = text => {
    const marca = this.capitalize(text);
    const products = this.context.products || [];
    const sugerenciasMarca = text.trim().length >= 2
      ? [...new Set(products.map(p => p.marca))].filter(m => m.toLowerCase().includes(text.toLowerCase().trim())).slice(0, 3)
      : [];
    this.setState({ marca, sugerenciasMarca, sugeringMarca: sugerenciasMarca.length > 0 });
  };

  onTamanoChange = text => {
    const normalizado = normalizarTamano(text);
    this.setState({ tamano: text, tamanoNormalizado: normalizado !== text.trim() ? normalizado : '' });
  };

  // Costo por unidad y stock total cuando se compró por paquete/reja —
  // mismo cálculo que RegistrarCompraView, para no pedirle al usuario que
  // haga la cuenta de piezas × paquetes a mano. No aplica a granel: ahí no
  // hay "piezas" que contar, solo peso/volumen.
  getPaqueteCompra() {
    const { compraEsPaquete, compraPiezasPaquete, compraPrecioPaquete, compraNumPaquetes, esGranel } = this.state;
    if (!compraEsPaquete || esGranel) return { costo: null, stock: null };
    const piezas = parseFloat(compraPiezasPaquete);
    const precio = parseFloat(compraPrecioPaquete);
    const numPaquetes = parseFloat(compraNumPaquetes);
    const costo = (!isNaN(piezas) && !isNaN(precio) && piezas > 0) ? precio / piezas : null;
    const stock = (!isNaN(piezas) && !isNaN(numPaquetes) && piezas > 0 && numPaquetes > 0) ? piezas * numPaquetes : null;
    return { costo, stock };
  }

  // Costo por unidad y stock inicial que realmente se van a guardar: si se
  // compró por paquete/reja, salen de ese cálculo; si no, de los campos
  // "Precio de compra"/"Stock" tal cual los llenó el usuario. Se usa tanto
  // al guardar como en la vista previa de "Total de la compra".
  getPrecioCompraYStockEfectivos() {
    const { esGranel, precioCompra, stock, compraEsPaquete } = this.state;
    const aplicaPaquete = compraEsPaquete && !esGranel;
    const paqueteCompra = this.getPaqueteCompra();

    const precioCompraNum = aplicaPaquete
      ? paqueteCompra.costo
      : (precioCompra.trim() ? parseFloat(String(precioCompra).replace(',', '.')) : null);
    const stockNum = aplicaPaquete
      ? paqueteCompra.stock
      : (esGranel
          ? parseFloat(String(stock).replace(',', '.') || '0')
          : Math.floor(parseFloat(String(stock).replace(',', '.')) || 0));

    return { precioCompraNum, stockNum };
  }

  // ─── Validación y guardado ────────────────────────────────────────────────

  handleGuardar = () => {
    const {
      nombre, marca, categoriaId,
      tamano, tamanoNormalizado, esGranel, unidadGranel,
      registrarComoCompra, proveedor,
      compraEsPaquete,
    } = this.state;

    // A granel no se pide un tamaño fijo (no aplica: se vende por peso/volumen) —
    // se guarda como "por <unidad>" en vez de depender de texto libre.
    const tamanoFinal = esGranel ? `por ${unidadGranel}` : (tamanoNormalizado || tamano.trim());
    const precioVentaNum = parseFloat(String(this.state.precioVenta).replace(',', '.'));

    const paqueteCompra = this.getPaqueteCompra();
    if (compraEsPaquete && !esGranel && (paqueteCompra.costo === null || paqueteCompra.stock === null)) {
      Alert.alert('Datos de paquete incompletos', 'Ingresa piezas por paquete, precio del paquete y número de paquetes.');
      return;
    }

    const { precioCompraNum, stockNum } = this.getPrecioCompraYStockEfectivos();

    // Validaciones
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Ingresa el nombre del producto.'); return; }
    if (!marca.trim())  { Alert.alert('Falta la marca', 'Ingresa la marca.'); return; }
    if (!tamanoFinal)   { Alert.alert('Falta el tamaño', 'Ej: 1 kg, 600 ml, Chico'); return; }
    if (esGranel && !unidadGranel) { Alert.alert('Falta la unidad', 'Selecciona la unidad de granel.'); return; }
    if (isNaN(precioVentaNum) || precioVentaNum <= 0) { Alert.alert('Precio inválido', 'Ingresa un precio de venta mayor a $0.'); return; }
    if (precioCompraNum !== null && (isNaN(precioCompraNum) || precioCompraNum < 0)) { Alert.alert('Precio de compra inválido', 'El precio de compra no puede ser negativo.'); return; }
    if (isNaN(stockNum) || stockNum < 0) { Alert.alert('Stock inválido', 'El stock no puede ser negativo.'); return; }
    if (!categoriaId) { Alert.alert('Falta categoría', 'Selecciona una categoría.'); return; }
    if (registrarComoCompra && stockNum <= 0) { Alert.alert('Stock requerido', 'Para registrar una compra el stock inicial debe ser mayor a 0.'); return; }
    if (registrarComoCompra && !proveedor.trim()) { Alert.alert('Falta el proveedor', 'Ingresa el nombre del proveedor para registrar la compra.'); return; }
    if (registrarComoCompra && (precioCompraNum === null || precioCompraNum <= 0)) { Alert.alert('Falta el precio de compra', 'Para registrar una compra, ingresa el precio de compra (costo).'); return; }

    const nombreNorm = nombre.trim().toLowerCase();
    const marcaNorm  = marca.trim().toLowerCase();
    const products   = this.context.products || [];

    // Duplicado exacto
    const existingProduct = products.find(
      p => p.nombre.trim().toLowerCase() === nombreNorm && p.marca.trim().toLowerCase() === marcaNorm,
    );
    if (existingProduct) {
      const dup = existingProduct.presentaciones.find(pr => pr.tamano.trim().toLowerCase() === tamanoFinal.toLowerCase());
      if (dup) { Alert.alert('Ya existe', `"${nombre.trim()} ${tamanoFinal}" de ${marca.trim()} ya está en el inventario.`); return; }
    }

    // Guardar producto / presentación
    let newProduct;
    if (existingProduct) {
      this.context.addPresentacion(existingProduct.id, {
        tamano: tamanoFinal, precio: precioVentaNum, precioCompra: precioCompraNum,
        stock: stockNum, esGranel, unidadGranel: esGranel ? unidadGranel : null,
      });
      newProduct = existingProduct;
    } else {
      newProduct = this.context.addProduct({
        nombre: nombre.trim(), marca: marca.trim(), categoriaId,
        tamano: tamanoFinal, precio: precioVentaNum, precioCompra: precioCompraNum,
        stock: stockNum, esGranel, unidadGranel: esGranel ? unidadGranel : null,
      });
    }

    // Registrar compra si el toggle está activo
    if (registrarComoCompra && stockNum > 0 && precioCompraNum) {
      const presId = existingProduct
        ? (this.context.products.find(p => p.id === existingProduct.id)?.presentaciones.find(pr => pr.tamano === tamanoFinal)?.id ?? `${Date.now()}-1`)
        : `${newProduct?.id ?? Date.now()}-1`;

      this.context.addCompra({
        proveedor: proveedor.trim(),
        tipoPago: 'Contado',
        notas: `Alta de producto: ${nombre.trim()} ${tamanoFinal}`,
        total: stockNum * precioCompraNum,
        items: [{
          productId: existingProduct?.id ?? newProduct?.id ?? '',
          presentacionId: presId,
          nombre: nombre.trim(),
          tamano: tamanoFinal,
          cantidad: stockNum,
          costoUnitario: precioCompraNum,
          subtotal: stockNum * precioCompraNum,
        }],
      });
    }

    this.props.navigation.goBack();
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  renderSeccion(titulo) {
    return (
      <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing.xl, marginBottom: spacing.md }}>
        {titulo}
      </Text>
    );
  }

  renderLabel(texto) {
    return <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.xs, marginTop: spacing.md }}>{texto}</Text>;
  }

  renderInput(props) {
    return (
      <TextInput
        style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        {...props}
      />
    );
  }

  renderSugerencias(lista, onSelect) {
    if (!lista.length) return null;
    return (
      <View style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, marginTop: 2, backgroundColor: colors.card, elevation: 6, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }}>
        {lista.map((item, idx) => (
          <TouchableOpacity key={item} onPress={() => onSelect(item)} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: idx < lista.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: fontSize.body, color: colors.textPrimary }}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  renderBadgeMargen() {
    const aplicaPaquete = this.state.compraEsPaquete && !this.state.esGranel;
    const costoEfectivo = aplicaPaquete ? this.getPaqueteCompra().costo : this.state.precioCompra;
    const margen = calcMargen(costoEfectivo, this.state.precioVenta);
    if (margen === null) return null;
    const color = margen > 15 ? colors.success : margen > 0 ? colors.warning : colors.danger;
    const icono = margen > 15 ? '✅' : margen > 0 ? '⚠️' : '🔴';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <View style={{ backgroundColor: color + '22', borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.caption }}>{icono} </Text>
          <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color }}>
            Margen estimado: {margen}%
          </Text>
        </View>
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
          <TouchableOpacity onPress={() => this.setState({ nombre: productoSimilar.nombre, marca: productoSimilar.marca, productoSimilar: null, ignorarSimilitud: false, sugerenciasNombre: [], sugeringNombre: false })}
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

  // ─── Render principal ─────────────────────────────────────────────────────

  render() {
    const {
      nombre, marca, categoriaId,
      tamano, tamanoNormalizado, esGranel, unidadGranel,
      precioCompra, precioVenta, stock,
      compraEsPaquete, compraPiezasPaquete, compraPrecioPaquete, compraNumPaquetes,
      registrarComoCompra, proveedor,
      sugerenciasNombre, sugeringNombre, sugerenciasMarca, sugeringMarca,
    } = this.state;

    const categories = (this.context.categories || []).filter(c => c.id !== 0);
    const proveedores = this.context.proveedores || [];
    const moneda = this.context.config?.moneda ?? '$';
    const paqueteCompra = this.getPaqueteCompra();
    const unidadStock = esGranel ? unidadGranel : 'unidades';
    const { precioCompraNum, stockNum } = this.getPrecioCompraYStockEfectivos();
    const aplicaPaqueteCompra = compraEsPaquete && !esGranel;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>Agregar producto</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── IDENTIFICACIÓN ── */}
          {this.renderSeccion('Identificación')}

          {this.renderLabel('Nombre')}
          {this.renderInput({ placeholder: 'Ej. Arroz', value: nombre, onChangeText: this.onNombreChange, returnKeyType: 'next' })}
          {sugeringNombre && this.renderSugerencias(sugerenciasNombre, s => {
            const products = this.context.products || [];
            const coincidentes = products.filter(p => p.nombre.toLowerCase() === s.toLowerCase());
            const marcaAuto = coincidentes.length === 1 ? coincidentes[0].marca : marca;
            this.setState({ nombre: s, marca: marcaAuto, sugerenciasNombre: [], sugeringNombre: false, productoSimilar: null });
          })}
          {this.renderAvisoSimilitud()}

          {this.renderLabel('Marca')}
          {this.renderInput({ placeholder: 'Ej. Verde Valle', value: marca, onChangeText: this.onMarcaChange, returnKeyType: 'next' })}
          {sugeringMarca && this.renderSugerencias(sugerenciasMarca, s => this.setState({ marca: s, sugerenciasMarca: [], sugeringMarca: false }))}

          {this.renderLabel('Categoría')}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {categories.map(cat => {
              const sel = categoriaId === cat.id;
              return (
                <TouchableOpacity key={cat.id} onPress={() => this.setState({ categoriaId: cat.id })}
                  style={{ backgroundColor: sel ? colors.primary : colors.chipInactive, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginRight: spacing.sm, marginBottom: spacing.sm, minHeight: 40, justifyContent: 'center' }}>
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: sel ? colors.white : colors.textPrimary }}>{cat.nombre}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── PRESENTACIÓN ── */}
          {this.renderSeccion('Presentación')}

          {this.renderToggle(
            '¿Es producto a granel?',
            esGranel,
            v => this.setState({ esGranel: v }),
            'Se vende y stockea por peso o volumen, no por un tamaño fijo',
          )}

          {esGranel ? (
            <View style={{ marginTop: spacing.md }}>
              <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>Unidad de medida</Text>
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
              <Text style={{ fontSize: fontSize.small, color: colors.primary, marginTop: spacing.sm }}>
                Se guardará como: <Text style={{ fontWeight: 'bold' }}>por {unidadGranel}</Text>
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: spacing.md }}>
              {this.renderLabel('Tamaño / Presentación')}
              {this.renderInput({ placeholder: 'Ej. 1 kg, 600 ml, Chico', value: tamano, onChangeText: this.onTamanoChange, returnKeyType: 'next' })}
              {!!tamanoNormalizado && (
                <Text style={{ fontSize: fontSize.small, color: colors.primary, marginTop: 4 }}>
                  Se guardará como: <Text style={{ fontWeight: 'bold' }}>{tamanoNormalizado}</Text>
                </Text>
              )}
            </View>
          )}

          {/* ── PRECIOS ── */}
          {this.renderSeccion('Precios')}

          {this.renderLabel(
            `Precio de compra (costo por ${esGranel ? unidadGranel : 'unidad'})` +
            (registrarComoCompra ? '' : ' — opcional'),
          )}
          {!aplicaPaqueteCompra && this.renderInput({ placeholder: '0.00', value: precioCompra, onChangeText: t => this.setState({ precioCompra: t }), keyboardType: 'decimal-pad' })}

          {/* No aplica a granel: ahí no hay "piezas" que contar, solo peso/volumen */}
          {!esGranel && (
            <TouchableOpacity
              onPress={() => this.setState({ compraEsPaquete: !compraEsPaquete })}
              style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, marginTop: compraEsPaquete ? 0 : spacing.sm }}
            >
              <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: compraEsPaquete ? colors.primary : colors.chipInactive, backgroundColor: compraEsPaquete ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}>
                {compraEsPaquete && <Text style={{ fontSize: 12, color: colors.white, fontWeight: 'bold' }}>✓</Text>}
              </View>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>¿Lo compraste por paquete/reja? (calcula costo y stock)</Text>
            </TouchableOpacity>
          )}

          {aplicaPaqueteCompra && (
            <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Piezas por paquete</Text>
                  {this.renderInput({ placeholder: 'Ej. 24', value: compraPiezasPaquete, onChangeText: t => this.setState({ compraPiezasPaquete: t }), keyboardType: 'decimal-pad' })}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Precio del paquete</Text>
                  {this.renderInput({ placeholder: '0.00', value: compraPrecioPaquete, onChangeText: t => this.setState({ compraPrecioPaquete: t }), keyboardType: 'decimal-pad' })}
                </View>
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>¿Cuántos paquetes/rejas compraste?</Text>
                {this.renderInput({ placeholder: 'Ej. 1', value: compraNumPaquetes, onChangeText: t => this.setState({ compraNumPaquetes: t }), keyboardType: 'decimal-pad' })}
              </View>
              {paqueteCompra.costo != null && (
                <Text style={{ fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.sm, fontWeight: 'bold' }}>
                  → Costo por unidad: {moneda}{paqueteCompra.costo.toFixed(4)}
                </Text>
              )}
              {paqueteCompra.stock != null && (
                <Text style={{ fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.xs, fontWeight: 'bold' }}>
                  → Stock inicial: {paqueteCompra.stock} {unidadStock}
                </Text>
              )}
            </View>
          )}

          {this.renderLabel('Precio de venta')}
          {this.renderInput({ placeholder: '0.00', value: precioVenta, onChangeText: t => this.setState({ precioVenta: t }), keyboardType: 'decimal-pad' })}
          {this.renderBadgeMargen()}

          {/* ── INVENTARIO ── */}
          {this.renderSeccion('Inventario')}

          {this.renderLabel(`Stock inicial (${unidadStock})`)}
          {aplicaPaqueteCompra ? (
            <View style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.background }}>
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: paqueteCompra.stock != null ? colors.textPrimary : colors.textMuted }}>
                {paqueteCompra.stock != null ? `${paqueteCompra.stock} ${unidadStock}` : 'Completa los datos del paquete arriba'}
              </Text>
            </View>
          ) : (
            <>
              {this.renderInput({
                placeholder: esGranel ? '0.000' : '0',
                value: stock,
                onChangeText: t => this.setState({ stock: t }),
                keyboardType: 'decimal-pad',
              })}
              {!esGranel && <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginTop: 4 }}>Los decimales se redondean automáticamente.</Text>}
            </>
          )}

          {this.renderToggle(
            '¿Registrar como compra?',
            registrarComoCompra,
            v => this.setState({ registrarComoCompra: v }),
            'Se guardará en el historial de compras y actualizará el costo',
          )}

          {registrarComoCompra && (
            <View style={{ backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, borderWidth: 1, borderColor: colors.primary + '44' }}>
              <Text style={{ fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.sm }}>Proveedor</Text>
              {this.renderInput({ placeholder: 'Nombre del proveedor', value: proveedor, onChangeText: t => this.setState({ proveedor: t }) })}

              {/* Sugerencias de proveedores anteriores */}
              {proveedor.trim().length === 0 && proveedores.length > 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginBottom: spacing.xs }}>Usados anteriormente:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {proveedores.slice(0, 4).map(p => (
                      <TouchableOpacity key={p} onPress={() => this.setState({ proveedor: p })}
                        style={{ backgroundColor: colors.chipInactive, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
                        <Text style={{ fontSize: fontSize.caption, color: colors.textPrimary }}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {precioCompraNum != null && precioCompraNum > 0 && stockNum != null && stockNum > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg, backgroundColor: colors.card, borderRadius: radius.sm, padding: spacing.md }}>
                  <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Total de la compra</Text>
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                    {moneda}{(precioCompraNum * stockNum).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Botón guardar al final del scroll */}
          <TouchableOpacity
            onPress={this.handleGuardar}
            style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xl }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Guardar producto</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }
}
