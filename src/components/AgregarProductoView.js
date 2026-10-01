import React, { Component } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, SafeAreaView, Dimensions, Switch, Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { proveedoresRecientes } from '../data/consultas/compras';
import { crearConsultaViva } from '../data/consultaViva';
import ScrollViewTeclado from './ScrollViewTeclado';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { nombreProducto, formatoDinero } from '../config/formato';
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

// ─── Badge de ganancia ────────────────────────────────────────────────────────
// Misma fórmula que el detalle del producto: ganancia = venta − costo, y su %
// sobre el PRECIO DE VENTA (antes aquí era sobre el costo: el mismo producto
// mostraba 50% al darlo de alta y 33% en su detalle).
function calcGanancia(precioCompra, precioVenta) {
  const c = parseFloat(precioCompra); const v = parseFloat(precioVenta);
  if (isNaN(c) || isNaN(v) || c <= 0 || v <= 0) return null;
  return { ganancia: v - c, pct: Math.round(((v - c) / v) * 100) };
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
    creandoCategoria: false, nuevaCategoria: '', // "+ Nueva categoría" sin salir de la pantalla
    sugerenciasNombre: [], sugeringNombre: false,
    sugerenciasMarca: [], sugeringMarca: false,
    productoSimilar: null, ignorarSimilitud: false,
    // Presentación
    tamano: '', tamanoNormalizado: '',
    sinPresentacion: false, // toggle "Presentación única" encendido: sin tamaño (p. ej. "Gansito")
    esGranel: false, unidadGranel: 'kg',
    // Precios
    precioCompra: '', precioVenta: '',
    compraEsPaquete: false,
    compraPiezasPaquete: '', compraPrecioPaquete: '', compraNumPaquetes: '',
    // Inventario
    stock: '',
    registrarComoCompra: true,
    proveedor: '',
    sinProveedor: false, // compra sin proveedor (otra tienda, mercado…): se guarda proveedor ''
    proveedoresUsados: [], // de SQLite, del más reciente al más antiguo (sugerencias)
  };

  componentDidMount() {
    const cats = (this.context.categories || []).filter(c => c.id !== 0);
    this.setState({ categoriaId: cats.length > 0 ? cats[0].id : null });
    // Proveedores para las sugerencias de "Registrar como compra" (bajo demanda).
    this.consultaProveedores = crearConsultaViva({
      tablas: ['compras'],
      cargar: proveedoresRecientes,
      alCargar: proveedoresUsados => this.setState({ proveedoresUsados }),
      alFallar: error => console.error('AgregarProductoView.proveedoresRecientes', error),
    });
  }

  componentWillUnmount() {
    this.consultaProveedores?.detener();
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

  // Toggle "Presentación única". Al activarlo se borra lo escrito para que
  // no se guarde por accidente un tamaño que ya no se ve.
  setPresentacionUnica = unica => {
    this.setState(unica
      ? { sinPresentacion: true, tamano: '', tamanoNormalizado: '' }
      : { sinPresentacion: false });
  };

  // Costo por unidad y stock total cuando se compró por paquete/reja (o por
  // bulto/costal en granel: kilos por bulto × número de bultos) — mismo
  // cálculo que RegistrarCompraView, para que el usuario no haga la cuenta.
  getPaqueteCompra() {
    const { compraEsPaquete, compraPiezasPaquete, compraPrecioPaquete, compraNumPaquetes } = this.state;
    if (!compraEsPaquete) return { costo: null, stock: null };
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
    const aplicaPaquete = compraEsPaquete;
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
    const moneda = this.context.config?.moneda ?? '$';
    const {
      nombre, marca, categoriaId,
      tamano, tamanoNormalizado, sinPresentacion, esGranel, unidadGranel,
      registrarComoCompra, proveedor,
      compraEsPaquete,
    } = this.state;

    // A granel no se pide un tamaño fijo (no aplica: se vende por peso/volumen) —
    // se guarda como "por <unidad>" en vez de depender de texto libre.
    // "Presentación única" activado → '' (vacío de verdad, nunca un espacio).
    const tamanoFinal = esGranel
      ? `por ${unidadGranel}`
      : (sinPresentacion ? '' : (tamanoNormalizado || tamano.trim()));
    const precioVentaNum = parseFloat(String(this.state.precioVenta).replace(',', '.'));

    const paqueteCompra = this.getPaqueteCompra();
    if (compraEsPaquete && (paqueteCompra.costo === null || paqueteCompra.stock === null)) {
      Alert.alert(
        esGranel ? 'Datos del bulto incompletos' : 'Datos de paquete incompletos',
        esGranel
          ? `Ingresa ${unidadGranel} por bulto, precio del bulto y número de bultos.`
          : 'Ingresa piezas por paquete, precio del paquete y número de paquetes.',
      );
      return;
    }

    const { precioCompraNum, stockNum } = this.getPrecioCompraYStockEfectivos();

    // Validaciones
    if (!nombre.trim()) { Alert.alert('Falta el nombre', 'Ingresa el nombre del producto.'); return; }
    if (!tamanoFinal && !sinPresentacion) { Alert.alert('Falta el tamaño', 'Ej: 1 kg, 600 ml, Chico. Si no hace falta indicar tamaño (Gansito, Chocorroles), activa "Presentación única".'); return; }
    if (esGranel && !unidadGranel) { Alert.alert('Falta la unidad', 'Selecciona la unidad de granel.'); return; }
    if (isNaN(precioVentaNum) || precioVentaNum <= 0) { Alert.alert('Precio inválido', `Ingresa un precio de venta mayor a ${moneda}0.`); return; }
    if (precioCompraNum !== null && (isNaN(precioCompraNum) || precioCompraNum < 0)) { Alert.alert('Precio de compra inválido', 'El precio de compra no puede ser negativo.'); return; }
    if (isNaN(stockNum) || stockNum < 0) { Alert.alert('Stock inválido', 'El stock no puede ser negativo.'); return; }
    if (!categoriaId) { Alert.alert('Falta categoría', 'Selecciona una categoría.'); return; }
    if (registrarComoCompra && stockNum <= 0) { Alert.alert('Stock requerido', 'Para registrar una compra el stock inicial debe ser mayor a 0.'); return; }
    if (registrarComoCompra && !proveedor.trim() && !this.state.sinProveedor) { Alert.alert('Falta el proveedor', 'Escribe el proveedor o toca "Sin proveedor" (compras en otra tienda, mercado…).'); return; }
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
      const deMarca = marca.trim() ? ` de ${marca.trim()}` : ' (sin marca)';
      if (dup) { Alert.alert('Ya existe', `"${nombreProducto(nombre, tamanoFinal)}"${deMarca} ya está en el inventario.`); return; }
      // Agregar una presentación a un producto existente: debe tener nombre
      // para distinguirla de las demás.
      if (!tamanoFinal) {
        Alert.alert('Falta la presentación', `"${nombre.trim()}"${deMarca} ya existe. Para agregarle otra presentación, ponle nombre (ej. "Paquete 3 pzas").`);
        return;
      }
      // Nunca conviven una presentación sin nombre y otra con nombre.
      if (existingProduct.presentaciones.some(pr => !pr.tamano.trim())) {
        Alert.alert(
          'Primero nombra la presentación actual',
          `"${nombre.trim()}" ya existe sin presentación. Edítala primero (Inventario → ${nombre.trim()} → ✏️) y ponle nombre, por ejemplo "Individual"; luego agrega la nueva.`,
        );
        return;
      }
    }

    // Si el toggle está activo, el stock inicial se registra como una compra.
    // Va dentro de addProduct/addPresentacion (misma transacción): llamar a
    // addCompra por separado no funcionaba — el producto recién creado aún no
    // estaba en el estado y su id no se podía adivinar.
    const datosCompra = registrarComoCompra && stockNum > 0 && precioCompraNum
      ? {
          proveedor: this.state.sinProveedor ? '' : proveedor.trim(),
          tipoPago: 'Contado',
          notas: `Alta de producto: ${nombreProducto(nombre, tamanoFinal)}`,
          // Desglose para el historial ("Paquete de 8 × $232.00" / "Bulto de 25 kg × $500.00")
          paquete: compraEsPaquete
            ? { piezasPaquete: parseFloat(this.state.compraPiezasPaquete), precioPaquete: parseFloat(this.state.compraPrecioPaquete), numPaquetes: parseFloat(this.state.compraNumPaquetes) }
            : null,
        }
      : null;

    // Guardar producto / presentación
    const datosPresentacion = {
      tamano: tamanoFinal, precio: precioVentaNum, precioCompra: precioCompraNum,
      stock: stockNum, esGranel, unidadGranel: esGranel ? unidadGranel : null,
    };
    if (existingProduct) {
      this.context.addPresentacion(existingProduct.id, datosPresentacion, datosCompra);
    } else {
      this.context.addProduct({ nombre: nombre.trim(), marca: marca.trim(), categoriaId, ...datosPresentacion }, datosCompra);
    }

    this.props.navigation.goBack();
  };

  // "+ Nueva categoría": misma validación que CategoriasModal (vacío y
  // duplicado sin importar mayúsculas, incluida "Todos"). La categoría creada
  // queda seleccionada.
  crearCategoria = () => {
    const nombre = this.state.nuevaCategoria.trim();
    if (!nombre) { Alert.alert('Falta información', 'Escribe un nombre para la categoría.'); return; }
    const existe = (this.context.categories || []).some(c => c.nombre.toLowerCase() === nombre.toLowerCase());
    if (existe) { Alert.alert('Ya existe', `La categoría "${nombre}" ya está en la lista.`); return; }
    const nueva = this.context.addCategory(nombre);
    this.setState({ categoriaId: nueva.id, creandoCategoria: false, nuevaCategoria: '' });
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
    const moneda = this.context.config?.moneda ?? '$';
    const costoEfectivo = this.state.compraEsPaquete ? this.getPaqueteCompra().costo : this.state.precioCompra;
    const g = calcGanancia(costoEfectivo, this.state.precioVenta);
    if (g === null) return null;
    const unidad = this.state.esGranel ? this.state.unidadGranel : 'unidad';
    const color = g.pct > 15 ? colors.success : g.pct > 0 ? colors.warning : colors.danger;
    const icono = g.pct > 15 ? '✅' : g.pct > 0 ? '⚠️' : '🔴';
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <View style={{ backgroundColor: color + '22', borderRadius: radius.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: fontSize.caption }}>{icono} </Text>
          <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color }}>
            Ganancia: {formatoDinero(g.ganancia, moneda)} por {unidad} ({g.pct}% del precio)
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
          Ya existe: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{productoSimilar.nombre}</Text>{productoSimilar.marca ? ` · ${productoSimilar.marca}` : ''}
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
    const proveedores = this.state.proveedoresUsados;
    const moneda = this.context.config?.moneda ?? '$';
    const paqueteCompra = this.getPaqueteCompra();
    const unidadStock = esGranel ? unidadGranel : 'unidades';
    const { precioCompraNum, stockNum } = this.getPrecioCompraYStockEfectivos();
    const aplicaPaqueteCompra = compraEsPaquete;
    // En granel el "paquete" es un bulto/costal (kilos por bulto × bultos).
    const txtPaquete = esGranel
      ? { casilla: `¿Lo compraste por bulto/costal? (calcula costo por ${unidadGranel} y stock)`, piezas: `${unidadGranel} por bulto`, precio: 'Precio del bulto', cuantos: '¿Cuántos bultos compraste?' }
      : { casilla: '¿Lo compraste por paquete/reja? (calcula costo y stock)', piezas: 'Piezas por paquete', precio: 'Precio del paquete', cuantos: '¿Cuántos paquetes/rejas compraste?' };

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

        <ScrollViewTeclado contentContainerStyle={{ padding: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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

          {this.renderLabel('Marca — opcional')}
          {this.renderInput({ placeholder: 'Ej. Verde Valle', value: marca, onChangeText: this.onMarcaChange, returnKeyType: 'next' })}
          {sugeringMarca && this.renderSugerencias(sugerenciasMarca, s => this.setState({ marca: s, sugerenciasMarca: [], sugeringMarca: false }))}

          {this.renderLabel('Categoría')}
          {categories.length === 0 && !this.state.creandoCategoria && (
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.sm }}>Aún no hay categorías. Crea la primera:</Text>
          )}
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
            {!this.state.creandoCategoria && (
              <TouchableOpacity onPress={() => this.setState({ creandoCategoria: true, nuevaCategoria: '' })}
                style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, marginRight: spacing.sm, marginBottom: spacing.sm, minHeight: 40, justifyContent: 'center' }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primary }}>+ Nueva categoría</Text>
              </TouchableOpacity>
            )}
          </View>
          {this.state.creandoCategoria && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
              <View style={{ flex: 1 }}>
                {this.renderInput({ placeholder: 'Nombre de la categoría', value: this.state.nuevaCategoria, onChangeText: t => this.setState({ nuevaCategoria: t }), autoFocus: true, returnKeyType: 'done', onSubmitEditing: this.crearCategoria })}
              </View>
              <TouchableOpacity onPress={this.crearCategoria} style={{ height: 40, paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Crear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => this.setState({ creandoCategoria: false, nuevaCategoria: '' })} style={{ height: 40, paddingHorizontal: spacing.md, backgroundColor: colors.chipInactive, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

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
            <>
              {/* "Presentación única" (Gansito, Chocorroles…): encendido, la
                  presentación se guarda vacía de verdad y en la app se ve solo
                  el nombre (y "Presentación única" donde va el tamaño). Apagado
                  por defecto: casi todos los abarrotes llevan tamaño. El
                  subtítulo aclara que NO es para "solo lo vendo en 600 ml". */}
              {this.renderToggle(
                'Presentación única',
                this.state.sinPresentacion,
                this.setPresentacionUnica,
                'Actívalo si no hace falta indicar tamaño (Gansito, Chocorroles). Se verá solo el nombre.',
              )}
              {this.state.sinPresentacion ? (
                <Text style={{ fontSize: fontSize.small, color: colors.primary, marginTop: spacing.xs }}>
                  Se verá como: <Text style={{ fontWeight: 'bold' }}>{nombreProducto(this.state.nombre, '') || 'el nombre del producto'}</Text>
                </Text>
              ) : (
                <View style={{ marginTop: spacing.xs }}>
                  {this.renderLabel('Tamaño / Presentación')}
                  {this.renderInput({ placeholder: 'Ej. 1 kg, 600 ml, Chico', value: tamano, onChangeText: this.onTamanoChange, returnKeyType: 'next' })}
                  {!!tamanoNormalizado && (
                    <Text style={{ fontSize: fontSize.small, color: colors.primary, marginTop: 4 }}>
                      Se guardará como: <Text style={{ fontWeight: 'bold' }}>{tamanoNormalizado}</Text>
                    </Text>
                  )}
                </View>
              )}
            </>
          )}

          {/* ── PRECIOS ── */}
          {this.renderSeccion('Precios')}

          {this.renderLabel(
            `Precio de compra (costo por ${esGranel ? unidadGranel : 'unidad'})` +
            (registrarComoCompra ? '' : ' — opcional'),
          )}
          {!aplicaPaqueteCompra && this.renderInput({ placeholder: '0.00', value: precioCompra, onChangeText: t => this.setState({ precioCompra: t }), keyboardType: 'decimal-pad' })}

          {/* Paquete/reja, o bulto/costal si es a granel */}
          <TouchableOpacity
            onPress={() => this.setState({ compraEsPaquete: !compraEsPaquete })}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, marginTop: compraEsPaquete ? 0 : spacing.sm }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: compraEsPaquete ? colors.primary : colors.chipInactive, backgroundColor: compraEsPaquete ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}>
              {compraEsPaquete && <Text style={{ fontSize: 12, color: colors.white, fontWeight: 'bold' }}>✓</Text>}
            </View>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>{txtPaquete.casilla}</Text>
          </TouchableOpacity>

          {aplicaPaqueteCompra && (
            <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.sm }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>{txtPaquete.piezas}</Text>
                  {this.renderInput({ placeholder: esGranel ? 'Ej. 25' : 'Ej. 24', value: compraPiezasPaquete, onChangeText: t => this.setState({ compraPiezasPaquete: t }), keyboardType: 'decimal-pad' })}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>{txtPaquete.precio}</Text>
                  {this.renderInput({ placeholder: '0.00', value: compraPrecioPaquete, onChangeText: t => this.setState({ compraPrecioPaquete: t }), keyboardType: 'decimal-pad' })}
                </View>
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>{txtPaquete.cuantos}</Text>
                {this.renderInput({ placeholder: 'Ej. 1', value: compraNumPaquetes, onChangeText: t => this.setState({ compraNumPaquetes: t }), keyboardType: 'decimal-pad' })}
              </View>
              {paqueteCompra.costo != null && (
                <Text style={{ fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.sm, fontWeight: 'bold' }}>
                  → Costo por {esGranel ? unidadGranel : 'unidad'}: {formatoDinero(paqueteCompra.costo, moneda)}
                </Text>
              )}
              {paqueteCompra.stock != null && (
                <Text style={{ fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.xs, fontWeight: 'bold' }}>
                  → Stock inicial: {paqueteCompra.stock} {unidadStock}
                </Text>
              )}
            </View>
          )}

          {this.renderLabel(esGranel ? `Precio de venta (por ${unidadGranel})` : 'Precio de venta')}
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
              {this.renderInput({
                placeholder: this.state.sinProveedor ? 'Sin proveedor' : 'Nombre del proveedor',
                value: proveedor, onChangeText: t => this.setState({ proveedor: t, sinProveedor: false }),
              })}

              {/* Sugerencias: "Sin proveedor" siempre primero, luego los usados */}
              {proveedor.trim().length === 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginBottom: spacing.xs }}>Usados anteriormente:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {/* Borde punteado y cursiva: no es un proveedor real */}
                    <TouchableOpacity
                      onPress={() => this.setState(prev => ({ sinProveedor: !prev.sinProveedor, proveedor: '' }))}
                      style={{ backgroundColor: this.state.sinProveedor ? colors.primary : colors.card, borderWidth: 1, borderStyle: 'dashed', borderColor: this.state.sinProveedor ? colors.primary : colors.textMuted, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
                      <Text style={{ fontSize: fontSize.caption, fontStyle: 'italic', color: this.state.sinProveedor ? colors.white : colors.textSecondary }}>
                        {this.state.sinProveedor ? '✓ ' : ''}Sin proveedor
                      </Text>
                    </TouchableOpacity>
                    {proveedores.slice(0, 4).map(p => (
                      <TouchableOpacity key={p} onPress={() => this.setState({ proveedor: p, sinProveedor: false })}
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
        </ScrollViewTeclado>
      </SafeAreaView>
    );
  }
}
