import React, { Component } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

// ─── Normalización de tamaños ─────────────────────────────────────────────────
// Convierte variantes comunes a una forma canónica antes de guardar y comparar.
// El usuario ve el preview en tiempo real debajo del campo.

const UNIDADES_MAP = {
  'kg': 'kg', 'kgs': 'kg', 'k': 'kg', 'kilo': 'kg', 'kilos': 'kg',
  'g': 'g', 'gr': 'g', 'grs': 'g', 'gramo': 'g', 'gramos': 'g',
  'l': 'L', 'lt': 'L', 'lts': 'L', 'litro': 'L', 'litros': 'L',
  'ml': 'ml', 'mililitro': 'ml', 'mililitros': 'ml',
  'pza': 'pza', 'pzas': 'pzas', 'pieza': 'pza', 'piezas': 'pzas',
  'und': 'und', 'unidad': 'und', 'unidades': 'unds',
};

function normalizarTamano(texto) {
  if (!texto.trim()) return texto;
  // Detectar patrón: número + unidad opcional
  // Ej: "1k", "600ML", "1 Lt", "2 Pzas", "Chico" (sin número → pasa tal cual)
  const match = texto.trim().match(/^(\d+(?:[.,]\d+)?)\s*([a-záéíóúüA-ZÁÉÍÓÚÜ]+)?$/);
  if (!match) return texto.trim(); // sin estructura numérica, retornar limpio
  const num = match[1].replace(',', '.');
  const unidadRaw = (match[2] ?? '').toLowerCase();
  const unidadNorm = UNIDADES_MAP[unidadRaw];
  if (!unidadNorm) return texto.trim(); // unidad desconocida, retornar limpio
  return `${num} ${unidadNorm}`;
}

// ─── Similitud de Levenshtein ─────────────────────────────────────────────────
// Retorna un valor 0-1 donde 1 es idéntico.

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return 1 - dp[m][n] / Math.max(m, n);
}

const similitud = (a, b) => levenshtein(a.toLowerCase().trim(), b.toLowerCase().trim());
const UMBRAL_SIMILITUD = 0.70;

/**
 * ProductFormModal — dar de alta un producto o una nueva presentación.
 *
 * Mejoras anti-errores:
 *   a) Normalización de tamaños en tiempo real con preview
 *   b) Detección de similitud (Levenshtein ≥ 70%) con aviso inline y opciones
 *   c) Sugerencias de autocompletado al escribir nombre o marca (máx. 3)
 *   d) Validaciones extra: precio absurdo, stock decimal, trim/capitalización
 */
export default class ProductFormModal extends Component {
  state = {
    nombre: '',
    marca: '',
    tamano: '',
    precio: '',
    stock: '',
    categoriaId: null,
    // Sugerencias
    sugerenciasNombre: [],
    sugeringNombre: false,
    sugerenciasMarca: [],
    sugeringMarca: false,
    // Similitud
    productoSimilar: null,        // producto encontrado con similitud ≥ umbral
    ignorarSimilitud: false,      // el usuario eligió "No, crear nuevo"
    // Preview del tamaño normalizado
    tamanoNormalizado: '',
  };

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) {
      const selectable = (this.props.categories || []).filter(c => c.id !== 0);
      this.setState({
        nombre: '', marca: '', tamano: '', precio: '', stock: '',
        categoriaId: selectable.length > 0 ? selectable[0].id : null,
        sugerenciasNombre: [], sugeringNombre: false,
        sugerenciasMarca: [], sugeringMarca: false,
        productoSimilar: null, ignorarSimilitud: false,
        tamanoNormalizado: '',
      });
    }
  }

  // ─── Handlers de campo ───────────────────────────────────────────────────

  onNombreChange = text => {
    const nombre = this.capitalize(text);
    const products = this.props.products || [];

    // Sugerencias: coincidencia parcial de nombre
    const sugerenciasNombre = text.trim().length >= 2
      ? [...new Set(products.map(p => p.nombre))]
          .filter(n => n.toLowerCase().includes(text.toLowerCase().trim()))
          .slice(0, 3)
      : [];

    // Similitud con nombre + marca existentes
    let productoSimilar = null;
    if (text.trim().length >= 3 && !this.state.ignorarSimilitud) {
      productoSimilar = products.find(p =>
        similitud(p.nombre, text.trim()) >= UMBRAL_SIMILITUD &&
        p.nombre.toLowerCase().trim() !== text.toLowerCase().trim(),
      ) ?? null;
    }

    this.setState({ nombre, sugerenciasNombre, sugeringNombre: sugerenciasNombre.length > 0, productoSimilar: productoSimilar || this.state.productoSimilar });
  };

  onMarcaChange = text => {
    const marca = this.capitalize(text);
    const products = this.props.products || [];

    const sugerenciasMarca = text.trim().length >= 2
      ? [...new Set(products.map(p => p.marca))]
          .filter(m => m.toLowerCase().includes(text.toLowerCase().trim()))
          .slice(0, 3)
      : [];

    this.setState({ marca, sugerenciasMarca, sugeringMarca: sugerenciasMarca.length > 0 });
  };

  onTamanoChange = text => {
    const normalizado = normalizarTamano(text);
    this.setState({
      tamano: text,
      tamanoNormalizado: normalizado !== text.trim() ? normalizado : '',
    });
  };

  capitalize = text => text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text;

  seleccionarSugerenciaNombre = nombre => {
    // Pre-rellenar nombre, buscar la marca si el producto es único
    const products = this.props.products || [];
    const coincidentes = products.filter(p => p.nombre.toLowerCase() === nombre.toLowerCase());
    const marca = coincidentes.length === 1 ? coincidentes[0].marca : this.state.marca;
    this.setState({
      nombre,
      marca,
      sugerenciasNombre: [],
      sugeringNombre: false,
      productoSimilar: null,
      ignorarSimilitud: false,
    });
  };

  seleccionarSugerenciaMarca = marca => {
    this.setState({ marca, sugerenciasMarca: [], sugeringMarca: false });
  };

  // ─── Validación y guardado ────────────────────────────────────────────────

  handleSave = () => {
    const { nombre, marca, precio, stock, categoriaId } = this.state;
    // Usar el tamaño normalizado si existe, si no el original
    const tamano = this.state.tamanoNormalizado || this.state.tamano.trim();

    const precioNum = parseFloat(String(precio).replace(',', '.'));
    const stockNum  = Math.floor(parseFloat(String(stock).replace(',', '.')) || 0);

    // Validaciones inline — los errores de campo se muestran con Alert solo si
    // son de formato (el campo requiere un valor que no tiene nada que ver con
    // el diseño visual). Los campos ya tienen hint text.
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Ingresa el nombre del producto.'); return; }
    if (!marca.trim())  { Alert.alert('Falta la marca', 'Ingresa la marca del producto.'); return; }
    if (!tamano)        { Alert.alert('Falta el tamaño', 'Ej: 1 kg, 600 ml, 3 L'); return; }
    if (isNaN(precioNum) || precioNum <= 0) { Alert.alert('Precio inválido', 'Ingresa un precio mayor a $0.'); return; }
    if (precioNum > 99999) { Alert.alert('Precio muy alto', 'El precio no puede superar $99,999.'); return; }
    if (isNaN(stockNum) || stockNum < 0)   { Alert.alert('Stock inválido', 'El stock no puede ser negativo.'); return; }
    if (!categoriaId) { Alert.alert('Falta categoría', 'Selecciona una categoría.'); return; }

    const nombreNorm = nombre.trim().toLowerCase();
    const marcaNorm  = marca.trim().toLowerCase();
    const tamanoNorm = tamano.toLowerCase();
    const products   = this.props.products || [];

    // Duplicado exacto
    const existingProduct = products.find(
      p => p.nombre.trim().toLowerCase() === nombreNorm &&
           p.marca.trim().toLowerCase()  === marcaNorm,
    );

    if (existingProduct) {
      const dupPres = existingProduct.presentaciones.find(
        pr => pr.tamano.trim().toLowerCase() === tamanoNorm,
      );
      if (dupPres) {
        Alert.alert(
          'Ya existe',
          `"${nombre.trim()} ${tamano}" de ${marca.trim()} ya está en el inventario.`,
        );
        return;
      }
    }

    this.props.onSave({
      nombre: nombre.trim(),
      marca:  marca.trim(),
      tamano,
      precio: precioNum,
      stock:  stockNum,
      categoriaId: existingProduct ? existingProduct.categoriaId : categoriaId,
      existingProductId: existingProduct ? existingProduct.id : null,
    });
  };

  // ─── Render helpers ───────────────────────────────────────────────────────

  renderSugerencias(lista, onSelect) {
    if (!lista.length) return null;
    return (
      <View style={{
        borderWidth: 1, borderColor: colors.chipInactive,
        borderRadius: radius.sm, marginTop: 2, backgroundColor: colors.card,
        elevation: 6, shadowOpacity: 0.12, shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
      }}>
        {lista.map((item, idx) => (
          <TouchableOpacity
            key={item}
            onPress={() => onSelect(item)}
            style={{
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              borderBottomWidth: idx < lista.length - 1 ? 1 : 0,
              borderBottomColor: colors.border,
            }}
          >
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
      <View style={{
        backgroundColor: '#fff8ed',
        borderWidth: 1, borderColor: colors.warning,
        borderRadius: radius.sm,
        padding: spacing.md,
        marginTop: spacing.sm,
      }}>
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.warning, marginBottom: spacing.xs }}>
          ⚠️ ¿Es el mismo producto?
        </Text>
        <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginBottom: spacing.sm }}>
          Ya existe: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>
            {productoSimilar.nombre}
          </Text> · {productoSimilar.marca}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity
            onPress={() => {
              // Pre-rellenar con los datos del producto existente
              this.setState({
                nombre: productoSimilar.nombre,
                marca: productoSimilar.marca,
                productoSimilar: null,
                ignorarSimilitud: false,
                sugerenciasNombre: [],
                sugeringNombre: false,
              });
            }}
            style={{
              flex: 1, height: 36,
              backgroundColor: colors.warning, borderRadius: radius.sm,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.white }}>
              Sí, usar ese
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => this.setState({ productoSimilar: null, ignorarSimilitud: true })}
            style={{
              flex: 1, height: 36,
              backgroundColor: colors.chipInactive, borderRadius: radius.sm,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>
              No, crear nuevo
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  renderPreviewTamano() {
    const { tamanoNormalizado } = this.state;
    if (!tamanoNormalizado) return null;
    return (
      <Text style={{ fontSize: fontSize.small, color: colors.primary, marginTop: 4 }}>
        Se guardará como: <Text style={{ fontWeight: 'bold' }}>{tamanoNormalizado}</Text>
      </Text>
    );
  }

  // ─── Render principal ─────────────────────────────────────────────────────

  render() {
    const { visible, onCancel, categories = [] } = this.props;
    const { sugerenciasNombre, sugeringNombre, sugerenciasMarca, sugeringMarca } = this.state;
    const selectableCategories = categories.filter(c => c.id !== 0);

    return (
      <Modal animationType="slide" transparent visible={visible}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: '92%', maxHeight: '90%', backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg }}>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs }}>
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
                Nuevo Producto
              </Text>
              <TouchableOpacity
                onPress={onCancel}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: fontSize.heading, color: colors.textMuted, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.lg }}>
              Si el nombre y marca ya existen, se agrega como nueva presentación de ese producto.
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              {/* Nombre */}
              <Text style={labelStyle}>Nombre</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. Arroz"
                placeholderTextColor={colors.textMuted}
                value={this.state.nombre}
                onChangeText={this.onNombreChange}
                returnKeyType="next"
                autoCorrect={false}
              />
              {sugeringNombre && this.renderSugerencias(sugerenciasNombre, this.seleccionarSugerenciaNombre)}
              {this.renderAvisoSimilitud()}

              {/* Marca */}
              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Marca</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. Verde Valle"
                placeholderTextColor={colors.textMuted}
                value={this.state.marca}
                onChangeText={this.onMarcaChange}
                returnKeyType="next"
                autoCorrect={false}
              />
              {sugeringMarca && this.renderSugerencias(sugerenciasMarca, this.seleccionarSugerenciaMarca)}

              {/* Tamaño */}
              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Tamaño / Presentación</Text>
              <TextInput
                style={inputStyle}
                placeholder="Ej. 1 kg, 600 ml, 3 L, Chico"
                placeholderTextColor={colors.textMuted}
                value={this.state.tamano}
                onChangeText={this.onTamanoChange}
                returnKeyType="next"
                autoCorrect={false}
              />
              {this.renderPreviewTamano()}

              {/* Precio */}
              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Precio ($)</Text>
              <TextInput
                style={inputStyle}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={this.state.precio}
                onChangeText={text => this.setState({ precio: text })}
              />

              {/* Stock */}
              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Stock inicial</Text>
              <TextInput
                style={inputStyle}
                placeholder="0"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={this.state.stock}
                onChangeText={text => this.setState({ stock: text })}
              />
              <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginTop: 4 }}>
                Los decimales se redondean automáticamente.
              </Text>

              {/* Categoría */}
              <Text style={[labelStyle, { marginTop: spacing.lg }]}>Categoría</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm }}>
                {selectableCategories.map(cat => {
                  const isSelected = this.state.categoriaId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => this.setState({ categoriaId: cat.id })}
                      style={{
                        backgroundColor: isSelected ? colors.primary : colors.chipInactive,
                        borderRadius: radius.lg,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        marginRight: spacing.sm,
                        marginBottom: spacing.sm,
                        minHeight: 40,
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: isSelected ? colors.white : colors.textPrimary }}>
                        {cat.nombre}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

            </ScrollView>

            <TouchableOpacity
              onPress={this.handleSave}
              style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Guardar producto
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
}

const labelStyle = { fontSize: fontSize.label, color: colors.textPrimary, marginBottom: spacing.xs };
const inputStyle = {
  borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm,
  paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  fontSize: fontSize.body, color: colors.textPrimary,
};
