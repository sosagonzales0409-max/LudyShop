import React, { Component } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  SafeAreaView, Dimensions, Alert, ScrollView,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { IconBack, IconPlus, IconClose } from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;

/**
 * RegistrarCompraView — pantalla para registrar una compra de mercancía.
 *
 * Params opcionales:
 *   { productId, presentacionId } — pre-rellena el primer ítem con ese producto.
 *   { compraId } — modo edición: precarga proveedor/notas/ítems de esa compra
 *                  y al confirmar llama a editarCompra en vez de addCompra.
 *
 * Flujo:
 *   1. Seleccionar proveedor (historial inline)
 *   2. Buscar productos del inventario y agregar ítems
 *   3. Por cada ítem: cantidad + costo unitario (o toggle paquete)
 *   4. Confirmar → addCompra/editarCompra → stock actualizado → Toast
 */
export default class RegistrarCompraView extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      editandoId: null,
      proveedor: '',
      notas: '',
      busqueda: '',
      items: [],             // [{ productId, presentacionId, nombre, tamano, esGranel, unidadGranel, cantidad, costoUnitario, esPaquete, piezasPaquete, precioPaquete }]
      paqueteStates: {},     // { [key]: { esPaquete, piezas, precio } }
    };
  }

  componentDidMount() {
    const { productId, presentacionId, compraId } = this.props.route?.params ?? {};
    if (compraId) {
      this.cargarCompraParaEditar(compraId);
      return;
    }
    if (productId && presentacionId) {
      this.agregarItemPorId(productId, presentacionId);
    }
  }

  // Precarga los campos con una compra existente para poder corregirla sin
  // tener que eliminarla y volver a capturarla desde cero.
  cargarCompraParaEditar(compraId) {
    const compra = (this.context.compras ?? []).find(c => c.id === compraId);
    if (!compra) return;
    const sellable = this.context.sellableItems ?? [];
    const items = [];
    const paqueteStates = {};
    (compra.items ?? []).forEach(it => {
      const info = sellable.find(s => s.productId === it.productId && s.presentacionId === it.presentacionId);
      items.push({
        productId: it.productId,
        presentacionId: it.presentacionId,
        nombre: it.nombre,
        tamano: it.tamano,
        esGranel: info?.esGranel ?? false,
        unidadGranel: info?.unidadGranel ?? null,
        cantidad: String(it.cantidad),
        costoUnitario: String(it.costoUnitario),
      });
      // Si esta compra se registró como paquete/reja, restaurar ese estado
      // para no perder el desglose al editar. Compras guardadas antes de
      // registrar numPaquetes (legacy) lo derivan de cantidad/piezas.
      paqueteStates[this.itemKey(it.productId, it.presentacionId)] = (it.piezasPaquete != null && it.precioPaquete != null)
        ? {
            esPaquete: true,
            piezas: String(it.piezasPaquete),
            precio: String(it.precioPaquete),
            numPaquetes: String(it.numPaquetes ?? (it.piezasPaquete > 0 ? it.cantidad / it.piezasPaquete : '')),
          }
        : { esPaquete: false, piezas: '', precio: '', numPaquetes: '' };
    });
    this.setState({
      editandoId: compra.id,
      proveedor: compra.proveedor,
      notas: compra.notas ?? '',
      items,
      paqueteStates,
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  get moneda() { return this.context.config?.moneda ?? '$'; }

  // Sugerencias de proveedor: recientes si el campo está vacío, o los que
  // coincidan parcialmente mientras se escribe (para notar si ya existe uno
  // parecido, ej. "Coca Cola" vs "Coca-Cola FEMSA", antes de crear otro).
  getSugerenciasProveedor() {
    const proveedores = this.context.proveedores ?? [];
    const texto = this.state.proveedor.trim().toLowerCase();
    if (!texto) return proveedores.slice(0, 5);
    if (proveedores.some(p => p.toLowerCase() === texto)) return [];
    return proveedores.filter(p => p.toLowerCase().includes(texto)).slice(0, 5);
  }

  // Si el nombre capturado coincide (sin importar mayúsculas/espacios extra)
  // con un proveedor ya usado, reutiliza ese nombre tal cual para no
  // fragmentar el historial con variantes de escritura del mismo proveedor.
  normalizarProveedor(nombre) {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    const proveedores = this.context.proveedores ?? [];
    const existente = proveedores.find(p => p.toLowerCase() === limpio.toLowerCase());
    return existente ?? limpio;
  }

  itemKey = (productId, presentacionId) => `${productId}::${presentacionId}`;

  getSellableItems() {
    const { sellableItems } = this.context;
    const { busqueda } = this.state;
    const search = busqueda.trim().toLowerCase();
    if (!search) return [];
    return (sellableItems ?? [])
      .filter(i => i.nombre.toLowerCase().includes(search) || i.marca.toLowerCase().includes(search) || i.tamano.toLowerCase().includes(search))
      .filter(i => !this.state.items.find(it => it.productId === i.productId && it.presentacionId === i.presentacionId))
      .slice(0, 6);
  }

  agregarItemPorId(productId, presentacionId) {
    const item = (this.context.sellableItems ?? []).find(i => i.productId === productId && i.presentacionId === presentacionId);
    if (!item) return;
    const nuevo = {
      productId: item.productId,
      presentacionId: item.presentacionId,
      nombre: item.nombre,
      tamano: item.tamano,
      esGranel: item.esGranel ?? false,
      unidadGranel: item.unidadGranel ?? null,
      cantidad: '',
      costoUnitario: item.precioCompra != null ? String(item.precioCompra) : '',
    };
    this.setState(prev => ({
      items: [nuevo, ...prev.items],
      busqueda: '',
      paqueteStates: { ...prev.paqueteStates, [this.itemKey(productId, presentacionId)]: { esPaquete: false, piezas: '', precio: '', numPaquetes: '' } },
    }));
  }

  updateItem(idx, cambios) {
    this.setState(prev => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...cambios };
      return { items };
    });
  }

  removeItem(idx) {
    this.setState(prev => {
      const item = prev.items[idx];
      const key = this.itemKey(item.productId, item.presentacionId);
      const { [key]: _omit, ...paqueteStates } = prev.paqueteStates;
      return { items: prev.items.filter((_, i) => i !== idx), paqueteStates };
    });
  }

  getPaqueteState(key) {
    return this.state.paqueteStates[key] ?? { esPaquete: false, piezas: '', precio: '', numPaquetes: '' };
  }

  updatePaquete(key, cambios) {
    this.setState(prev => ({
      paqueteStates: { ...prev.paqueteStates, [key]: { ...this.getPaqueteState(key), ...cambios } },
    }));
  }

  // "Comprar por paquete/reja" es para conteos discretos (latas, botellas) —
  // no aplica a granel, donde no hay "piezas" que contar, solo peso/volumen.
  // Si el ítem es a granel, se ignora cualquier estado de paquete guardado.
  aplicaPaquete(item, paq) {
    return paq.esPaquete && !item.esGranel;
  }

  getCostoCalculado(item, idx) {
    const key = this.itemKey(item.productId, item.presentacionId);
    const paq = this.getPaqueteState(key);
    if (this.aplicaPaquete(item, paq)) {
      const piezas = parseFloat(paq.piezas);
      const precio = parseFloat(paq.precio);
      if (!isNaN(piezas) && !isNaN(precio) && piezas > 0) return precio / piezas;
      return null;
    }
    const c = parseFloat(item.costoUnitario);
    return isNaN(c) ? null : c;
  }

  // Cantidad total de la línea. Si es compra por paquete, se calcula sola
  // (piezas por paquete × número de paquetes) en vez de pedirla aparte —
  // pedir "Cantidad" Y "Piezas en el paquete" por separado era redundante y
  // contradictorio (¿cuál manda?).
  getCantidadCalculada(item, idx) {
    const key = this.itemKey(item.productId, item.presentacionId);
    const paq = this.getPaqueteState(key);
    if (this.aplicaPaquete(item, paq)) {
      const piezas = parseFloat(paq.piezas);
      const numPaquetes = parseFloat(paq.numPaquetes);
      if (!isNaN(piezas) && !isNaN(numPaquetes) && piezas > 0 && numPaquetes > 0) return piezas * numPaquetes;
      return null;
    }
    const c = parseFloat(item.cantidad);
    return isNaN(c) ? null : c;
  }

  calcTotal() {
    return this.state.items.reduce((sum, item, idx) => {
      const costo = this.getCostoCalculado(item, idx);
      const cant  = this.getCantidadCalculada(item, idx);
      if (costo == null || cant == null || cant <= 0) return sum;
      return sum + costo * cant;
    }, 0);
  }

  // ─── Confirmar compra ──────────────────────────────────────────────────────

  handleConfirmar = () => {
    const { proveedor, notas, items, editandoId } = this.state;

    if (!proveedor.trim()) { Alert.alert('Falta el proveedor', 'Ingresa el nombre del proveedor.'); return; }
    if (items.length === 0) { Alert.alert('Sin productos', 'Agrega al menos un producto a la compra.'); return; }

    const proveedorFinal = this.normalizarProveedor(proveedor);

    const itemsValidos = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const paq   = this.getPaqueteState(this.itemKey(item.productId, item.presentacionId));
      const esPaquete = this.aplicaPaquete(item, paq);
      const costo = this.getCostoCalculado(item, i);
      const cant  = this.getCantidadCalculada(item, i);
      if (cant == null || cant <= 0) {
        const msg = esPaquete
          ? `Completa piezas por paquete y número de paquetes para "${item.nombre} ${item.tamano}".`
          : `Ingresa la cantidad para "${item.nombre} ${item.tamano}".`;
        Alert.alert('Cantidad inválida', msg);
        return;
      }
      if (costo == null || costo <= 0) { Alert.alert('Costo inválido', `Ingresa el costo unitario para "${item.nombre} ${item.tamano}".`); return; }

      // Si se compró por paquete/reja, guardamos el desglose (piezas + precio
      // del paquete + número de paquetes) además del costoUnitario ya
      // calculado, para que el historial pueda mostrar "2 rejas de 24 a
      // $300 c/u" en vez de solo el costo unitario derivado.
      const desglosePaquete = esPaquete
        ? { piezasPaquete: parseFloat(paq.piezas), precioPaquete: parseFloat(paq.precio), numPaquetes: parseFloat(paq.numPaquetes) }
        : {};

      itemsValidos.push({ productId: item.productId, presentacionId: item.presentacionId, nombre: item.nombre, tamano: item.tamano, cantidad: cant, costoUnitario: parseFloat(costo.toFixed(4)), subtotal: parseFloat((costo * cant).toFixed(2)), ...desglosePaquete });
    }

    const total = parseFloat(this.calcTotal().toFixed(2));
    const resumen = itemsValidos.map(i => `• ${i.nombre} ${i.tamano} × ${i.cantidad} · ${this.moneda}${i.costoUnitario.toFixed(2)} c/u`).join('\n');
    const esEdicion = !!editandoId;

    Alert.alert(
      esEdicion ? 'Guardar cambios' : 'Confirmar compra',
      `Proveedor: ${proveedorFinal}\nTotal: ${this.moneda}${total.toFixed(2)}\n\n${resumen}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: esEdicion ? 'Guardar cambios' : 'Registrar compra',
          onPress: () => {
            const datos = { proveedor: proveedorFinal, tipoPago: 'Contado', notas: notas.trim(), total, items: itemsValidos };
            if (esEdicion) {
              const ok = this.context.editarCompra(editandoId, datos);
              if (!ok) {
                Alert.alert('No se pudo guardar la edición', 'Alguno de los productos ya no existe en el inventario. Quita ese ítem e inténtalo de nuevo.');
                return;
              }
            } else {
              const resultado = this.context.addCompra(datos);
              if (!resultado) {
                Alert.alert('No se pudo registrar la compra', 'Alguno de los productos ya no existe en el inventario. Quita ese ítem e inténtalo de nuevo.');
                return;
              }
            }
            this.props.navigation.goBack();
          },
        },
      ],
    );
  };

  // ─── Render de un ítem ───────────────────────────────────────────────────────

  renderItem(item, idx) {
    const key = this.itemKey(item.productId, item.presentacionId);
    const paq = this.getPaqueteState(key);
    const esPaquete = this.aplicaPaquete(item, paq);
    const costoCalc = this.getCostoCalculado(item, idx);
    const cantidadCalc = this.getCantidadCalculada(item, idx);
    const subtotal = costoCalc != null && cantidadCalc != null && cantidadCalc > 0 ? costoCalc * cantidadCalc : null;
    const unidad = item.esGranel ? (item.unidadGranel ?? '') : 'uds';

    return (
      <View key={key} style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.md, elevation: 3, shadowOpacity: 0.07, shadowOffset: { width: 0, height: 2 } }}>
        {/* Nombre + quitar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>{item.nombre} {item.tamano}</Text>
          </View>
          <TouchableOpacity onPress={() => this.removeItem(idx)} style={{ width: 32, height: 32, borderRadius: radius.sm, backgroundColor: '#fde8e8', justifyContent: 'center', alignItems: 'center' }}>
            <IconClose size={fontSize.caption} color={colors.danger} />
          </TouchableOpacity>
        </View>

        {/* Toggle paquete — decide si se pide "Cantidad" directa o el
            desglose de paquete/reja (son excluyentes, no se piden juntos).
            No aplica a granel: ahí no hay "piezas" que contar, solo peso/volumen. */}
        {!item.esGranel && (
          <TouchableOpacity
            onPress={() => this.updatePaquete(key, { esPaquete: !paq.esPaquete })}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, marginBottom: spacing.sm }}
          >
            <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: esPaquete ? colors.primary : colors.chipInactive, backgroundColor: esPaquete ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}>
              {esPaquete && <Text style={{ fontSize: 12, color: colors.white, fontWeight: 'bold' }}>✓</Text>}
            </View>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>¿Compraste por paquete/reja? (calcula costo y cantidad totales)</Text>
          </TouchableOpacity>
        )}

        {/* Cantidad + costo unitario directos — solo si NO es por paquete */}
        {!esPaquete && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Cantidad ({unidad})</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }}
                placeholder={item.esGranel ? '0.000' : '0'}
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={item.cantidad}
                onChangeText={t => this.updateItem(idx, { cantidad: t })}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Costo unitario</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }}
                placeholder="0.00"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                value={item.costoUnitario}
                onChangeText={t => this.updateItem(idx, { costoUnitario: t })}
              />
            </View>
          </View>
        )}

        {/* Campos paquete */}
        {esPaquete && (
          <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Piezas en el paquete</Text>
                <TextInput style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }} placeholder="Ej. 24" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={paq.piezas} onChangeText={t => this.updatePaquete(key, { piezas: t })} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>Precio del paquete</Text>
                <TextInput style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={paq.precio} onChangeText={t => this.updatePaquete(key, { precio: t })} />
              </View>
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>¿Cuántos paquetes/rejas compraste?</Text>
              <TextInput style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary }} placeholder="Ej. 2" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" value={paq.numPaquetes} onChangeText={t => this.updatePaquete(key, { numPaquetes: t })} />
            </View>
            {costoCalc != null && (
              <Text style={{ fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.sm, fontWeight: 'bold' }}>
                → Costo unitario calculado: {this.moneda}{costoCalc.toFixed(4)} c/u
              </Text>
            )}
            {cantidadCalc != null && (
              <Text style={{ fontSize: fontSize.caption, color: colors.primary, marginTop: spacing.xs, fontWeight: 'bold' }}>
                → Cantidad total: {cantidadCalc} {unidad}
              </Text>
            )}
          </View>
        )}

        {/* Subtotal */}
        {subtotal != null && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>Subtotal</Text>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>{this.moneda}{subtotal.toFixed(2)}</Text>
          </View>
        )}
      </View>
    );
  }

  // ─── Render principal ────────────────────────────────────────────────────────

  render() {
    const { proveedor, notas, busqueda, items, editandoId } = this.state;
    const sugerencias = this.getSellableItems();
    const total = this.calcTotal();
    const hayItems = items.length > 0;
    const esEdicion = !!editandoId;

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        {/* Header */}
        <View style={{ height: 60, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, elevation: 4, shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 } }}>
          <TouchableOpacity onPress={() => this.props.navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs }}>
            <IconBack size={28} color={colors.primary} />
          </TouchableOpacity>
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>{esEdicion ? 'Editar compra' : 'Registrar compra'}</Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: hayItems ? 120 : 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── PROVEEDOR ── */}
          <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md }}>Proveedor</Text>

          <TextInput
            style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary, marginBottom: spacing.sm }}
            placeholder="Nombre del proveedor"
            placeholderTextColor={colors.textMuted}
            value={proveedor}
            onChangeText={t => this.setState({ proveedor: t })}
          />

          {/* Historial / sugerencias de proveedores */}
          {this.getSugerenciasProveedor().length > 0 && (
            <View style={{ marginBottom: spacing.md }}>
              <Text style={{ fontSize: fontSize.small, color: colors.textMuted, marginBottom: spacing.xs }}>
                {proveedor.trim().length === 0 ? 'Usados anteriormente:' : 'Proveedores parecidos ya registrados:'}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {this.getSugerenciasProveedor().map(p => (
                  <TouchableOpacity key={p} onPress={() => this.setState({ proveedor: p })} style={{ backgroundColor: colors.chipInactive, borderRadius: radius.lg, paddingVertical: spacing.xs, paddingHorizontal: spacing.md }}>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textPrimary }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Notas */}
          <TextInput
            style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary, marginBottom: spacing.xl }}
            placeholder="Notas opcionales"
            placeholderTextColor={colors.textMuted}
            value={notas}
            onChangeText={t => this.setState({ notas: t })}
          />

          {/* ── PRODUCTOS ── */}
          <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.md }}>Productos comprados</Text>

          {/* Buscador */}
          <TextInput
            style={{ borderWidth: 1, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: fontSize.body, color: colors.textPrimary, marginBottom: spacing.xs }}
            placeholder="Buscar producto del inventario..."
            placeholderTextColor={colors.textMuted}
            value={busqueda}
            onChangeText={t => this.setState({ busqueda: t })}
          />

          {/* Sugerencias de búsqueda */}
          {sugerencias.length > 0 && (
            <View style={{ borderWidth: 1, borderColor: colors.chipInactive, borderRadius: radius.sm, marginBottom: spacing.md, backgroundColor: colors.card, elevation: 4 }}>
              {sugerencias.map((item, idx) => (
                <TouchableOpacity key={item.id} onPress={() => this.agregarItemPorId(item.productId, item.presentacionId)}
                  style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: idx < sugerencias.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary }}>{item.nombre} {item.tamano}</Text>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>{item.marca}</Text>
                  </View>
                  <IconPlus size={fontSize.label} color={colors.primary} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Botón agregar producto nuevo */}
          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('AgregarProducto')}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, marginBottom: spacing.lg }}
          >
            <IconPlus size={fontSize.label} color={colors.primary} />
            <Text style={{ fontSize: fontSize.label, color: colors.primary, fontWeight: 'bold', marginLeft: spacing.sm }}>Registrar producto nuevo</Text>
          </TouchableOpacity>

          {/* Ítems de la compra */}
          {items.map((item, idx) => this.renderItem(item, idx))}

          {items.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={{ fontSize: 40 }}>🛍️</Text>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>Sin productos</Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' }}>Usa el buscador para agregar productos a esta compra.</Text>
            </View>
          )}
        </ScrollView>

        {/* Barra de total + confirmar */}
        {hayItems && (
          <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border, padding: spacing.lg, paddingBottom: spacing.xl, elevation: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>Total de la compra</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.primary }}>{this.moneda}{total.toFixed(2)}</Text>
            </View>
            <TouchableOpacity onPress={this.handleConfirmar} style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                {esEdicion ? 'Guardar cambios' : `Confirmar compra · ${items.length} ${items.length === 1 ? 'producto' : 'productos'}`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    );
  }
}
