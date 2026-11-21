import React, { Component } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { proveedoresRecientes } from '../data/consultas/compras';
import { crearConsultaViva } from '../data/consultaViva';
import KeyboardScrollView from '../ui/KeyboardScrollView';
import { colors, spacing, radius, fontSize } from '../config/theme';
import { nombreProducto, formatoDinero } from '../config/formato';
import Header from '../ui/Header';
import { IconClose } from '../ui/Icon';
import {
  Seccion, Campo, FilaCampos, FilaInterruptor, Casilla, SelectorSegmentado,
  BadgeGanancia, BarraGuardar, NotaConfirmacion, Etiqueta,
} from '../ui/FormFields';
import { AvisoPrimeraVez, Resaltar } from '../ui/StatusViews';

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
    Array.from({ length: n + 1 }, (_c, j) => (i === 0 ? j : j === 0 ? i : 0)));
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
 * AddProductScreen — pantalla completa que reemplaza ProductFormModal.
 *
 * Secciones:
 *   IDENTIFICACIÓN  — nombre, marca, categoría, Levenshtein
 *   PRESENTACIÓN    — tamaño, normalización, toggle granel + unidad
 *   PRECIOS         — precio compra, precio venta, badge margen
 *   INVENTARIO      — stock inicial, toggle "registrar como compra"
 */
export default class AddProductScreen extends Component {
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
  // cálculo que NewPurchaseScreen, para que el usuario no haga la cuenta.
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

  // "+ Nueva categoría": misma validación que CategoriesModal (vacío y
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

  renderSugerencias(lista, onSelect) {
    if (!lista.length) return null;
    return (
      <View style={{ borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm, marginTop: -spacing.sm, backgroundColor: colors.card }}>
        {lista.map((item, idx) => (
          <TouchableOpacity key={item} onPress={() => onSelect(item)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderBottomWidth: idx < lista.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
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
    const unidad = this.state.esGranel ? this.state.unidadGranel : 'unidad';
    return <BadgeGanancia g={g} unidad={unidad} moneda={moneda} />;
  }

  renderAvisoSimilitud() {
    const { productoSimilar, ignorarSimilitud, nombre } = this.state;
    if (!productoSimilar || ignorarSimilitud || nombre.trim().length < 3) return null;
    return (
      <View style={{ backgroundColor: colors.warningSoft, borderWidth: 1, borderColor: colors.warning, borderRadius: radius.sm, padding: spacing.md, marginTop: -spacing.sm }}>
        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.warningDark, marginBottom: spacing.xs }}>¿Es el mismo producto?</Text>
        <Text style={{ fontSize: fontSize.caption, color: colors.label, marginBottom: spacing.sm }}>
          Ya existe: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{productoSimilar.nombre}</Text>{productoSimilar.marca ? ` · ${productoSimilar.marca}` : ''}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <TouchableOpacity onPress={() => this.setState({ nombre: productoSimilar.nombre, marca: productoSimilar.marca, productoSimilar: null, ignorarSimilitud: false, sugerenciasNombre: [], sugeringNombre: false })}
            style={{ flex: 1, height: 44, backgroundColor: colors.warning, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>Sí, usar ese</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => this.setState({ productoSimilar: null, ignorarSimilitud: true })}
            style={{ flex: 1, height: 44, backgroundColor: colors.chipInactive, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textPrimary }}>No, crear nuevo</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Chip de categoría / proveedor (mismo estilo que antes).
  renderChip({ key, texto, sel, onPress, punteado = false, chico = false }) {
    return (
      <TouchableOpacity key={key} onPress={onPress} hitSlop={chico ? 4 : undefined}
        style={{
          backgroundColor: sel ? colors.primary : (punteado ? 'transparent' : colors.chipInactive),
          borderWidth: punteado ? 1 : 0, borderStyle: 'dashed',
          borderColor: sel ? colors.primary : (chico ? colors.placeholder : colors.primary),
          borderRadius: radius.lg, paddingHorizontal: spacing.md,
          minHeight: chico ? 36 : 40, justifyContent: 'center',
        }}>
        <Text style={{
          fontSize: chico ? fontSize.caption : fontSize.body,
          fontWeight: chico ? '500' : 'bold',
          fontStyle: chico && punteado ? 'italic' : 'normal',
          color: sel ? colors.white : (punteado && !chico ? colors.primaryDark : colors.textPrimary),
        }}>{texto}</Text>
      </TouchableOpacity>
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
      ? { casilla: 'Lo compré por bulto o costal', piezas: `${unidadGranel} por bulto`, precio: 'Precio del bulto', cuantos: '¿Cuántos bultos compraste?' }
      : { casilla: 'Lo compré por paquete o reja', piezas: 'Piezas por paquete', precio: 'Precio del paquete', cuantos: '¿Cuántos paquetes/rejas compraste?' };

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header titulo="Agregar producto" onBack={() => this.props.navigation.goBack()} />

        <KeyboardScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <AvisoPrimeraVez
            clave="pista_agregar_producto"
            titulo="Granel y presentaciones"
            texto={<>Si vendes por kilo o litro, activa <Resaltar>¿Es producto a granel?</Resaltar> Para otro tamaño de un producto que ya tienes, escribe el mismo nombre y marca: se agrega como otra presentación.</>}
          />

          {/* ── IDENTIFICACIÓN ── */}
          <Seccion titulo="Identificación">
            <Campo label="Nombre" placeholder="Ej. Arroz" value={nombre} onChangeText={this.onNombreChange} returnKeyType="next" />
            {sugeringNombre && this.renderSugerencias(sugerenciasNombre, s => {
              const products = this.context.products || [];
              const coincidentes = products.filter(p => p.nombre.toLowerCase() === s.toLowerCase());
              const marcaAuto = coincidentes.length === 1 ? coincidentes[0].marca : marca;
              this.setState({ nombre: s, marca: marcaAuto, sugerenciasNombre: [], sugeringNombre: false, productoSimilar: null });
            })}
            {this.renderAvisoSimilitud()}

            <Campo label="Marca" opcional placeholder="Ej. Verde Valle" value={marca} onChangeText={this.onMarcaChange} returnKeyType="next" />
            {sugeringMarca && this.renderSugerencias(sugerenciasMarca, s => this.setState({ marca: s, sugerenciasMarca: [], sugeringMarca: false }))}

            <View style={{ gap: 6 }}>
              <Etiqueta texto="Categoría" />
              {categories.length === 0 && !this.state.creandoCategoria && (
                <Text style={{ fontSize: fontSize.caption, color: colors.placeholder }}>Aún no hay categorías. Crea la primera:</Text>
              )}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {categories.map(cat => this.renderChip({
                  key: cat.id, texto: cat.nombre, sel: categoriaId === cat.id,
                  onPress: () => this.setState({ categoriaId: cat.id }),
                }))}
                {!this.state.creandoCategoria && this.renderChip({
                  key: 'nueva', texto: '+ Nueva categoría', punteado: true,
                  onPress: () => this.setState({ creandoCategoria: true, nuevaCategoria: '' }),
                })}
              </View>
              {this.state.creandoCategoria && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
                  <Campo style={{ flex: 1 }} placeholder="Nombre de la categoría" value={this.state.nuevaCategoria} onChangeText={t => this.setState({ nuevaCategoria: t })} autoFocus returnKeyType="done" onSubmitEditing={this.crearCategoria} />
                  <TouchableOpacity onPress={this.crearCategoria} style={{ height: 48, paddingHorizontal: spacing.md, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Crear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => this.setState({ creandoCategoria: false, nuevaCategoria: '' })} accessibilityLabel="Cancelar nueva categoría" style={{ width: 48, height: 48, backgroundColor: colors.chipInactive, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
                    <IconClose size={fontSize.label} color={colors.textPrimary} />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </Seccion>

          {/* ── PRESENTACIÓN ── */}
          <Seccion titulo="Presentación">
            <FilaInterruptor
              label="¿Es producto a granel?"
              sublabel="Se vende y stockea por peso o volumen, no por un tamaño fijo"
              value={esGranel}
              onValueChange={v => this.setState({ esGranel: v })}
            />

            {esGranel ? (
              <View style={{ gap: spacing.sm }}>
                <Etiqueta texto="Unidad de medida" />
                <SelectorSegmentado opciones={UNIDADES_GRANEL} valor={unidadGranel} onChange={u => this.setState({ unidadGranel: u })} />
                <NotaConfirmacion>Se guardará como <Text style={{ fontWeight: 'bold' }}>por {unidadGranel}</Text></NotaConfirmacion>
              </View>
            ) : (
              <>
                {/* "Presentación única" (Gansito, Chocorroles…): encendido, la
                    presentación se guarda vacía de verdad y en la app se ve solo
                    el nombre (y "Presentación única" donde va el tamaño). Apagado
                    por defecto: casi todos los abarrotes llevan tamaño. El
                    subtítulo aclara que NO es para "solo lo vendo en 600 ml". */}
                <FilaInterruptor
                  separador
                  label="Presentación única"
                  sublabel="Actívalo si no hace falta indicar tamaño (Gansito, Chocorroles). Se verá solo el nombre."
                  value={this.state.sinPresentacion}
                  onValueChange={this.setPresentacionUnica}
                />
                {this.state.sinPresentacion ? (
                  <NotaConfirmacion>
                    Se verá como <Text style={{ fontWeight: 'bold' }}>{nombreProducto(this.state.nombre, '') || 'el nombre del producto'}</Text>
                  </NotaConfirmacion>
                ) : (
                  <Campo label="Tamaño / Presentación" placeholder="Ej. 1 kg, 600 ml, Chico" value={tamano} onChangeText={this.onTamanoChange} returnKeyType="next">
                    {!!tamanoNormalizado && (
                      <NotaConfirmacion>Se guardará como <Text style={{ fontWeight: 'bold' }}>{tamanoNormalizado}</Text></NotaConfirmacion>
                    )}
                  </Campo>
                )}
              </>
            )}
          </Seccion>

          {/* ── PRECIOS ── */}
          <Seccion titulo="Precios">
            <FilaCampos>
              {!aplicaPaqueteCompra && (
                <Campo
                  style={{ flex: 1 }}
                  label={`Costo por ${esGranel ? unidadGranel : 'unidad'}`}
                  opcional={!registrarComoCompra}
                  prefijo={moneda}
                  placeholder="0.00"
                  value={precioCompra}
                  onChangeText={t => this.setState({ precioCompra: t })}
                  keyboardType="decimal-pad"
                />
              )}
              <Campo
                style={{ flex: 1 }}
                label={esGranel ? `Venta por ${unidadGranel}` : 'Precio de venta'}
                prefijo={moneda}
                placeholder="0.00"
                value={precioVenta}
                onChangeText={t => this.setState({ precioVenta: t })}
                keyboardType="decimal-pad"
              />
            </FilaCampos>

            {/* Paquete/reja, o bulto/costal si es a granel */}
            <Casilla label={txtPaquete.casilla} value={compraEsPaquete} onChange={v => this.setState({ compraEsPaquete: v })} />

            {aplicaPaqueteCompra && (
              <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, gap: spacing.md, marginTop: -spacing.sm }}>
                <FilaCampos>
                  <Campo style={{ flex: 1 }} label={txtPaquete.piezas} placeholder={esGranel ? 'Ej. 25' : 'Ej. 24'} value={compraPiezasPaquete} onChangeText={t => this.setState({ compraPiezasPaquete: t })} keyboardType="decimal-pad" />
                  <Campo style={{ flex: 1 }} label={txtPaquete.precio} prefijo={moneda} placeholder="0.00" value={compraPrecioPaquete} onChangeText={t => this.setState({ compraPrecioPaquete: t })} keyboardType="decimal-pad" />
                </FilaCampos>
                <Campo label={txtPaquete.cuantos} placeholder="Ej. 1" value={compraNumPaquetes} onChangeText={t => this.setState({ compraNumPaquetes: t })} keyboardType="decimal-pad" />
                {(paqueteCompra.costo != null || paqueteCompra.stock != null) && (
                  <NotaConfirmacion>
                    {paqueteCompra.costo != null && <>Costo por {esGranel ? unidadGranel : 'unidad'} <Text style={{ fontWeight: 'bold' }}>{formatoDinero(paqueteCompra.costo, moneda)}</Text></>}
                    {paqueteCompra.costo != null && paqueteCompra.stock != null && ' · '}
                    {paqueteCompra.stock != null && <>Stock <Text style={{ fontWeight: 'bold' }}>{paqueteCompra.stock} {unidadStock}</Text></>}
                  </NotaConfirmacion>
                )}
              </View>
            )}

            {this.renderBadgeMargen()}
          </Seccion>

          {/* ── INVENTARIO ── */}
          <Seccion titulo="Inventario">
            {aplicaPaqueteCompra ? (
              <View style={{ gap: 6 }}>
                <Etiqueta texto="Stock inicial" />
                <View style={{ height: 48, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm, paddingHorizontal: spacing.md, justifyContent: 'center', backgroundColor: colors.background }}>
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: paqueteCompra.stock != null ? colors.textPrimary : colors.placeholder }}>
                    {paqueteCompra.stock != null ? `${paqueteCompra.stock} ${unidadStock}` : 'Completa los datos del paquete arriba'}
                  </Text>
                </View>
              </View>
            ) : (
              <Campo
                label="Stock inicial"
                placeholder={esGranel ? '0.000' : '0'}
                sufijo={unidadStock}
                value={stock}
                onChangeText={t => this.setState({ stock: t })}
                keyboardType="decimal-pad"
                ayuda={esGranel ? null : 'Los decimales se redondean automáticamente.'}
              />
            )}

            <FilaInterruptor
              separador
              label="¿Registrar como compra?"
              sublabel="Se guardará en el historial de compras y actualizará el costo"
              value={registrarComoCompra}
              onValueChange={v => this.setState({ registrarComoCompra: v })}
            />

            {registrarComoCompra && (
              <View style={{ gap: spacing.md }}>
                <Campo
                  label="Proveedor"
                  placeholder={this.state.sinProveedor ? 'Sin proveedor' : 'Nombre del proveedor'}
                  value={proveedor}
                  onChangeText={t => this.setState({ proveedor: t, sinProveedor: false })}
                />

                {/* Sugerencias: "Sin proveedor" siempre primero, luego los usados */}
                {proveedor.trim().length === 0 && (
                  <View style={{ gap: spacing.xs }}>
                    <Text style={{ fontSize: fontSize.small, color: colors.placeholder }}>Usados anteriormente:</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {/* Borde punteado y cursiva: no es un proveedor real */}
                      {this.renderChip({
                        key: 'sin', chico: true, punteado: true, sel: this.state.sinProveedor,
                        texto: `${this.state.sinProveedor ? '✓ ' : ''}Sin proveedor`,
                        onPress: () => this.setState(prev => ({ sinProveedor: !prev.sinProveedor, proveedor: '' })),
                      })}
                      {proveedores.slice(0, 4).map(p => this.renderChip({
                        key: p, chico: true, texto: p,
                        onPress: () => this.setState({ proveedor: p, sinProveedor: false }),
                      }))}
                    </View>
                  </View>
                )}

                {precioCompraNum != null && precioCompraNum > 0 && stockNum != null && stockNum > 0 && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
                    <Text style={{ fontSize: fontSize.body, color: colors.label }}>Total de la compra</Text>
                    <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
                      {formatoDinero(precioCompraNum * stockNum, moneda)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Seccion>
        </KeyboardScrollView>

        {/* Guardar siempre a la vista (fuera del scroll) */}
        <BarraGuardar texto="Guardar producto" onPress={this.handleGuardar} />
      </View>
    );
  }
}
