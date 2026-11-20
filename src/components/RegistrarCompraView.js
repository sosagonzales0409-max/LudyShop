import React, { Component } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { obtenerCompra } from '../data/repositories/compras';
import { proveedoresRecientes } from '../data/consultas/compras';
import { crearConsultaViva } from '../data/consultaViva';
import ScrollViewTeclado from './ScrollViewTeclado';
import { colors, spacing, radius, fontSize } from '../config/theme';
import { nombreProducto, formatoDinero, formatoCantidad } from '../config/formato';
import { IconPlus, IconClose, IconShoppingBag } from './Icon';
import Encabezado from './Encabezado';
import { Seccion, Campo, FilaCampos, Casilla, BarraGuardar, NotaConfirmacion } from './Formulario';
import { AvisoPrimeraVez, Resaltar } from './Estados';

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
      sinProveedor: false,   // compra sin proveedor (otra tienda, mercado…): se guarda proveedor ''
      proveedoresUsados: [], // de SQLite, del más reciente al más antiguo (sugerencias)
    };
  }

  componentDidMount() {
    // (La barra de total se oculta sola con el teclado abierto: BarraGuardar.)
    this.montado = true;
    // Proveedores para las sugerencias (bajo demanda; antes StoreContext los
    // recalculaba recorriendo todas las compras en cada dibujado).
    this.consultaProveedores = crearConsultaViva({
      tablas: ['compras'],
      cargar: proveedoresRecientes,
      alCargar: proveedoresUsados => this.setState({ proveedoresUsados }),
      alFallar: error => console.error('RegistrarCompraView.proveedoresRecientes', error),
    });

    const { productId, presentacionId, compraId } = this.props.route?.params ?? {};
    if (compraId) {
      this.cargarCompraParaEditar(compraId);
      return;
    }
    if (productId && presentacionId) {
      this.agregarItemPorId(productId, presentacionId);
    }
  }

  componentWillUnmount() {
    this.consultaProveedores?.detener();
    this.montado = false;
  }

  // Precarga los campos con una compra existente para poder corregirla sin
  // tener que eliminarla y volver a capturarla desde cero.
  // La compra se consulta por id (bajo demanda). `montado` evita un setState
  // si se sale de la pantalla antes de que llegue.
  async cargarCompraParaEditar(compraId) {
    let compra = null;
    try {
      compra = await obtenerCompra(compraId);
    } catch (error) {
      console.error('RegistrarCompraView.obtenerCompra', error);
    }
    if (!compra || !this.montado) return;
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
      sinProveedor: !compra.proveedor,
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
    const proveedores = this.state.proveedoresUsados;
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
    const proveedores = this.state.proveedoresUsados;
    const existente = proveedores.find(p => p.toLowerCase() === limpio.toLowerCase());
    return existente ?? limpio;
  }

  // Chip "Sin proveedor": borde punteado y cursiva para distinguirlo de los
  // proveedores reales. Al tocarlo se marca (o desmarca) y se vacía el campo.
  renderChipSinProveedor() {
    const activo = this.state.sinProveedor;
    return (
      <TouchableOpacity
        key="__sin_proveedor__"
        onPress={() => this.setState({ sinProveedor: !activo, proveedor: '' })}
        style={{ backgroundColor: activo ? colors.primary : 'transparent', borderWidth: 1, borderStyle: 'dashed', borderColor: activo ? colors.primary : colors.placeholder, borderRadius: radius.lg, minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md }}
      >
        <Text style={{ fontSize: fontSize.caption, fontWeight: '500', fontStyle: 'italic', color: activo ? colors.white : colors.label }}>
          {activo ? '✓ ' : ''}Sin proveedor
        </Text>
      </TouchableOpacity>
    );
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

  // "Comprar por paquete/reja" (latas, botellas) o, a granel, "por
  // bulto/costal": kilos por bulto × número de bultos. Mismo cálculo y mismas
  // columnas en la BD (piezas_paquete = kilos por bulto).
  aplicaPaquete(item, paq) {
    return paq.esPaquete;
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
    const { proveedor, notas, items, editandoId, sinProveedor } = this.state;

    if (!proveedor.trim() && !sinProveedor) { Alert.alert('Falta el proveedor', 'Escribe el proveedor o toca "Sin proveedor" (compras en otra tienda, mercado…).'); return; }
    if (items.length === 0) { Alert.alert('Sin productos', 'Agrega al menos un producto a la compra.'); return; }

    // "Sin proveedor" se guarda VACÍO (no el texto), para que nunca se mezcle
    // con nombres reales en sugerencias o búsquedas.
    const proveedorFinal = sinProveedor ? '' : this.normalizarProveedor(proveedor);

    const itemsValidos = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const paq   = this.getPaqueteState(this.itemKey(item.productId, item.presentacionId));
      const esPaquete = this.aplicaPaquete(item, paq);
      const costo = this.getCostoCalculado(item, i);
      const cant  = this.getCantidadCalculada(item, i);
      if (cant == null || cant <= 0) {
        const msg = esPaquete
          ? `Completa piezas por paquete y número de paquetes para "${nombreProducto(item.nombre, item.tamano)}".`
          : `Ingresa la cantidad para "${nombreProducto(item.nombre, item.tamano)}".`;
        Alert.alert('Cantidad inválida', msg);
        return;
      }
      if (costo == null || costo <= 0) { Alert.alert('Costo inválido', `Ingresa el costo unitario para "${nombreProducto(item.nombre, item.tamano)}".`); return; }

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
    const resumen = itemsValidos.map(i => `• ${nombreProducto(i.nombre, i.tamano)} × ${i.cantidad} · ${this.moneda}${i.costoUnitario.toFixed(2)} c/u`).join('\n');
    const esEdicion = !!editandoId;

    Alert.alert(
      esEdicion ? 'Guardar cambios' : 'Confirmar compra',
      `Proveedor: ${proveedorFinal || 'Sin proveedor'}\nTotal: ${this.moneda}${total.toFixed(2)}\n\n${resumen}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: esEdicion ? 'Guardar cambios' : 'Registrar compra',
          onPress: async () => {
            const datos = { proveedor: proveedorFinal, tipoPago: 'Contado', notas: notas.trim(), total, items: itemsValidos };
            if (esEdicion) {
              // editarCompra es asíncrona (lee la compra y el stock de la BD
              // en su transacción). `guardando` evita guardar dos veces si se
              // vuelve a tocar mientras tanto.
              if (this.guardando) return;
              this.guardando = true;
              const ok = await this.context.editarCompra(editandoId, datos);
              this.guardando = false;
              if (ok === false) {
                Alert.alert('No se pudo guardar la edición', 'La compra o alguno de sus productos ya no existe en el inventario. Quita ese ítem e inténtalo de nuevo.');
                return;
              }
              if (!ok) return; // falló la escritura: ya se avisó y se recargan los datos
              if (!this.montado) return;
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
      <View key={key} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: radius.md, padding: spacing.lg, marginTop: spacing.md, gap: spacing.md }}>
        {/* Nombre + quitar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>{nombreProducto(item.nombre, item.tamano)}</Text>
          <TouchableOpacity onPress={() => this.removeItem(idx)} hitSlop={8} accessibilityLabel={`Quitar ${item.nombre}`} style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.dangerSoft, justifyContent: 'center', alignItems: 'center' }}>
            <IconClose size={fontSize.body} color={colors.dangerDark} />
          </TouchableOpacity>
        </View>

        {/* Cantidad + costo unitario directos — solo si NO es por paquete */}
        {!esPaquete && (
          <FilaCampos>
            <Campo style={{ flex: 1 }} label="Cantidad" sufijo={unidad} placeholder={item.esGranel ? '0.000' : '0'} keyboardType="decimal-pad" value={item.cantidad} onChangeText={t => this.updateItem(idx, { cantidad: t })} />
            <Campo style={{ flex: 1 }} label="Costo unitario" prefijo={this.moneda} placeholder="0.00" keyboardType="decimal-pad" value={item.costoUnitario} onChangeText={t => this.updateItem(idx, { costoUnitario: t })} />
          </FilaCampos>
        )}

        {/* Casilla paquete — decide si se pide "Cantidad" directa o el
            desglose de paquete/reja (son excluyentes, no se piden juntos).
            A granel el paquete es un bulto/costal (kilos por bulto). */}
        <Casilla
          label={item.esGranel ? 'Lo compré por bulto o costal' : 'Lo compré por paquete o reja'}
          value={esPaquete}
          onChange={v => this.updatePaquete(key, { esPaquete: v })}
        />

        {/* Campos paquete */}
        {esPaquete && (
          <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md, gap: spacing.md, marginTop: -spacing.sm }}>
            <FilaCampos>
              <Campo style={{ flex: 1 }} label={item.esGranel ? `${unidad} por bulto` : 'Piezas en el paquete'} placeholder={item.esGranel ? 'Ej. 25' : 'Ej. 24'} keyboardType="decimal-pad" value={paq.piezas} onChangeText={t => this.updatePaquete(key, { piezas: t })} />
              <Campo style={{ flex: 1 }} label={item.esGranel ? 'Precio del bulto' : 'Precio del paquete'} prefijo={this.moneda} placeholder="0.00" keyboardType="decimal-pad" value={paq.precio} onChangeText={t => this.updatePaquete(key, { precio: t })} />
            </FilaCampos>
            <Campo label={item.esGranel ? '¿Cuántos bultos compraste?' : '¿Cuántos paquetes/rejas compraste?'} placeholder="Ej. 2" keyboardType="decimal-pad" value={paq.numPaquetes} onChangeText={t => this.updatePaquete(key, { numPaquetes: t })} />
            {(costoCalc != null || cantidadCalc != null) && (
              <NotaConfirmacion>
                {costoCalc != null && <>Costo <Text style={{ fontWeight: 'bold' }}>{formatoDinero(costoCalc, this.moneda)}</Text> {item.esGranel ? `por ${unidad}` : 'c/u'}</>}
                {costoCalc != null && cantidadCalc != null && ' · '}
                {cantidadCalc != null && <>Cantidad <Text style={{ fontWeight: 'bold' }}>{formatoCantidad(cantidadCalc)} {unidad}</Text></>}
              </NotaConfirmacion>
            )}
          </View>
        )}

        {/* Subtotal */}
        {subtotal != null && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
            <Text style={{ fontSize: fontSize.body, color: colors.label }}>Subtotal</Text>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>{formatoDinero(subtotal, this.moneda)}</Text>
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
    const sugerenciasProveedor = this.getSugerenciasProveedor();

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Encabezado titulo={esEdicion ? 'Editar compra' : 'Registrar compra'} onBack={() => this.props.navigation.goBack()} />

        <ScrollViewTeclado contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <AvisoPrimeraVez
            clave="pista_registrar_compra"
            titulo="Lo que compras suma"
            texto={<>Cada producto que registres aquí sube su stock. Si compraste en el mercado u otra tienda, toca <Resaltar>Sin proveedor</Resaltar>.</>}
          />

          {/* ── PROVEEDOR ── */}
          <Seccion titulo="Proveedor">
            <Campo
              placeholder={this.state.sinProveedor ? 'Sin proveedor' : 'Nombre del proveedor'}
              value={proveedor}
              onChangeText={t => this.setState({ proveedor: t, sinProveedor: false })}
            />

            {/* Sugerencias: "Sin proveedor" siempre primero (con el campo vacío),
                luego los proveedores usados o parecidos. */}
            {(proveedor.trim().length === 0 || sugerenciasProveedor.length > 0) && (
              <View style={{ gap: spacing.xs, marginTop: -spacing.sm }}>
                <Text style={{ fontSize: fontSize.small, color: colors.placeholder }}>
                  {proveedor.trim().length === 0 ? 'Usados anteriormente:' : 'Proveedores parecidos ya registrados:'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {proveedor.trim().length === 0 && this.renderChipSinProveedor()}
                  {sugerenciasProveedor.map(p => (
                    <TouchableOpacity key={p} onPress={() => this.setState({ proveedor: p, sinProveedor: false })} style={{ backgroundColor: colors.chipInactive, borderRadius: radius.lg, minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md }}>
                      <Text style={{ fontSize: fontSize.caption, fontWeight: '500', color: colors.textPrimary }}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            <Campo label="Notas" opcional placeholder="Ej. Pedido de la semana" value={notas} onChangeText={t => this.setState({ notas: t })} />
          </Seccion>

          {/* ── PRODUCTOS ── */}
          <Seccion titulo="Productos comprados">
            <Campo
              placeholder="Buscar producto del inventario..."
              value={busqueda}
              onChangeText={t => this.setState({ busqueda: t })}
            />

            {/* Sugerencias de búsqueda */}
            {sugerencias.length > 0 && (
              <View style={{ borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm, marginTop: -spacing.sm, backgroundColor: colors.card }}>
                {sugerencias.map((item, idx) => (
                  <TouchableOpacity key={item.id} onPress={() => this.agregarItemPorId(item.productId, item.presentacionId)}
                    style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: idx < sugerencias.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary }}>{nombreProducto(item.nombre, item.tamano)}</Text>
                      {!!item.marca && <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>{item.marca}</Text>}
                    </View>
                    <IconPlus size={fontSize.label} color={colors.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Botón agregar producto nuevo */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('AgregarProducto')}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: -spacing.xs }}
            >
              <IconPlus size={fontSize.label} color={colors.primaryDark} />
              <Text style={{ fontSize: fontSize.body, color: colors.primaryDark, fontWeight: 'bold', marginLeft: spacing.sm }}>Registrar producto nuevo</Text>
            </TouchableOpacity>
          </Seccion>

          {/* Ítems de la compra */}
          {items.map((item, idx) => this.renderItem(item, idx))}

          {items.length === 0 && (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg }}>
              <IconShoppingBag size={40} color={colors.placeholder} strokeWidth={1.5} />
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>Sin productos</Text>
              <Text style={{ fontSize: fontSize.body, color: colors.placeholder, marginTop: spacing.sm, textAlign: 'center' }}>Usa el buscador para agregar productos a esta compra.</Text>
            </View>
          )}
        </ScrollViewTeclado>

        {/* Barra de total + confirmar. Ocupa su lugar debajo del ScrollView
            (antes era absolute: subía con el teclado, tapaba los campos y el
            ScrollView no sabía que debía desplazarse). BarraGuardar se oculta
            sola mientras el teclado está abierto. */}
        {hayItems && (
          <BarraGuardar
            texto={esEdicion ? 'Guardar cambios' : `Confirmar compra · ${items.length} ${items.length === 1 ? 'producto' : 'productos'}`}
            onPress={this.handleConfirmar}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: fontSize.body, color: colors.label }}>Total de la compra</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>{formatoDinero(total, this.moneda)}</Text>
            </View>
          </BarraGuardar>
        )}
      </View>
    );
  }
}
