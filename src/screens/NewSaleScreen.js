import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Text,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { clientesConSaldo } from '../data/consultas/creditos';
import { crearConsultaViva } from '../data/consultaViva';
import { estadoCopia } from '../data/respaldo';
import ProductPickerModal from '../modals/ProductPickerModal.js';
import ConfirmSaleModal from '../modals/ConfirmSaleModal.js';
import NumericStepper from '../ui/NumericStepper.js';
import Toast from '../ui/Toast';
import KeyboardScrollView from '../ui/KeyboardScrollView';
import Header from '../ui/Header';
import { SelectorSegmentado, BarraGuardar } from '../ui/FormFields';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { formatoDinero, nombreProducto } from '../config/formato';
import {
  IconClose, IconClipboard, IconCreditCard, IconSettings,
  IconBack, IconPlus, IconChevronUp, IconChevronDown, IconShoppingCart,
} from '../ui/Icon';

const _window = Dimensions.get('window');
const CLIENTES_LIST_MAX_HEIGHT = Math.round(_window.height * 0.35);

const clienteInputStyle = {
  borderColor: colors.inputBorder,
  borderWidth: 1,
  borderRadius: radius.sm,
  backgroundColor: colors.card,
  paddingHorizontal: spacing.md,
  minHeight: 44,
  fontSize: fontSize.body,
  color: colors.textPrimary,
};

class NewSaleScreen extends Component {
  static contextType = StoreContext;

  constructor(props) {
    super(props);
    this.state = {
      paymentType: 'Contado',
      clienteNombre: '',
      estaNuevoCliente: false,
      seleccionClienteAbierto: false,
      showProductModal: false,
      showConfirmarModal: false,
      cartProducts: [],
      // Clientes con saldo (bajo demanda, de SQLite), mayor deuda primero.
      clientesDeuda: [],
      // Punto en el engrane: hay ventas sin respaldar (ver respaldo.estadoCopia).
      recordarCopia: false,
    };
  }

  componentDidMount() {
    // Antes se recalculaba recorriendo TODAS las ventas en cada dibujado
    // (al agregar al carrito, cambiar cantidades o escribir el cliente).
    // Ahora se consulta y se refresca solo cuando cambian ventas/abonos/clientes.
    this.consultaClientes = crearConsultaViva({
      tablas: ['ventas', 'abonos', 'clientes'],
      cargar: clientesConSaldo,
      alCargar: clientes => this.setState({ clientesDeuda: [...clientes].sort((a, b) => b.saldo - a.saldo) }),
      alFallar: error => console.error('Main.clientesConSaldo', error),
    });
    // Se apaga solo al guardar/compartir una copia (escribe en meta).
    this.consultaCopia = crearConsultaViva({
      tablas: ['ventas', 'meta'],
      cargar: estadoCopia,
      alCargar: ({ recordar }) => this.setState({ recordarCopia: recordar }),
      alFallar: error => console.error('Main.estadoCopia', error),
    });
  }

  componentWillUnmount() {
    this.consultaClientes?.detener();
    this.consultaCopia?.detener();
  }

  // Clientes con saldo pendiente (mismo cálculo que CreditsScreen), para el
  // selector de ventas a crédito y el badge. Orden: mayor deuda primero.
  getClientesConDeuda() {
    return this.state.clientesDeuda;
  }

  // Si el nombre capturado coincide (sin importar mayúsculas/espacios extra)
  // con un cliente que ya tiene ventas a crédito, reutiliza ese nombre tal
  // cual para no fragmentar su deuda en "dos personas" distintas.
  normalizarCliente(nombre) {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    const existente = this.getClientesConDeuda().find(c => c.cliente.toLowerCase() === limpio.toLowerCase());
    return existente ? existente.cliente : limpio;
  }

  addProductToCart(product) {
    const cartItem = product.esGranel
      ? { ...product, numProducts: 0, cantidadTexto: '', totalPrice: 0 }
      : { ...product, numProducts: 1, totalPrice: product.precio };
    this.setState(prev => ({ cartProducts: [...prev.cartProducts, cartItem] }));
  }

  updateAmountProduct(index, value) {
    const products = [...this.state.cartProducts];
    products[index] = { ...products[index], numProducts: value, totalPrice: products[index].precio * value };
    this.setState({ cartProducts: products });
  }

  // Cantidad decimal para productos a granel (ej. "2.5 kg"). Se guarda el
  // texto tal cual lo escribe el usuario para no pelear con el punto decimal
  // mientras teclea, y por separado el valor numérico ya parseado.
  updateGranelAmount(index, text) {
    let cleaned = text.replace(/[^0-9.]/g, '');
    // Conservar solo el primer punto decimal — sin esto se podía escribir
    // "1.2.3" y el texto mostrado no coincidía con lo que parseFloat calculaba.
    const primerPunto = cleaned.indexOf('.');
    if (primerPunto !== -1) {
      cleaned = cleaned.slice(0, primerPunto + 1) + cleaned.slice(primerPunto + 1).replace(/\./g, '');
    }
    const value = parseFloat(cleaned);
    const products = [...this.state.cartProducts];
    products[index] = {
      ...products[index],
      cantidadTexto: cleaned,
      numProducts: isNaN(value) ? 0 : value,
      totalPrice: isNaN(value) ? 0 : products[index].precio * value,
    };
    this.setState({ cartProducts: products });
  }

  cartTieneCantidadesInvalidas() {
    return this.state.cartProducts.some(p => {
      if (p.esGranel) return !(p.numProducts > 0) || p.numProducts > p.stock;
      return !(p.numProducts > 0);
    });
  }

  deleteProductFromCart(index) {
    const products = [...this.state.cartProducts];
    products.splice(index, 1);
    this.setState({ cartProducts: products });
  }

  getTotalCart() {
    return this.state.cartProducts.reduce((sum, p) => sum + p.totalPrice, 0).toFixed(2);
  }

  confirmCompleteSale = () => {
    const moneda = this.context.config?.moneda ?? '$';
    const { cartProducts, paymentType, clienteNombre } = this.state;
    if (cartProducts.length === 0) return;

    if (this.cartTieneCantidadesInvalidas()) {
      Alert.alert('Cantidad inválida', 'Revisa la cantidad de los productos a granel en el carrito.');
      return;
    }

    if (paymentType === 'Credito') {
      if (!clienteNombre.trim()) {
        Alert.alert('Falta información', 'Selecciona o escribe el nombre del cliente para ventas a crédito.');
        return;
      }
      this.setState({ showConfirmarModal: true });
      return;
    }

    Alert.alert(
      'Confirmar venta',
      `Total: ${formatoDinero(Number(this.getTotalCart()), moneda)}\n¿Deseas completar esta venta?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => this.finalizarVenta(0),
        },
      ],
    );
  };

  // Productos que con esta venta cruzan (de arriba hacia abajo) el umbral de
  // stock bajo — se calcula ANTES de decreaseStock, comparando contra el
  // stock actual, para avisar solo cuando la venta es la causa de la caída
  // (no cuando el producto ya estaba bajo desde antes).
  getProductosQueCaenBajoUmbral(cartProducts) {
    const umbral = this.context.config?.umbralStock ?? 5;
    return cartProducts.filter(p => {
      const producto = this.context.products.find(pr => pr.id === p.productId);
      const pres = producto?.presentaciones.find(pr => pr.id === p.presentacionId);
      if (!pres) return false;
      const stockDespues = pres.stock - p.numProducts;
      return pres.stock >= umbral && stockDespues < umbral;
    });
  }

  finalizarVenta = abonoInicial => {
    const { cartProducts, paymentType, clienteNombre } = this.state;
    const caidos = this.getProductosQueCaenBajoUmbral(cartProducts);
    // addSale descuenta el stock en la misma transacción que guarda la venta.
    this.context.addSale({
      productos: cartProducts,
      total: parseFloat(this.getTotalCart()),
      tipoPago: paymentType,
      cliente: paymentType === 'Credito' ? this.normalizarCliente(clienteNombre) : null,
      totalAbonado: abonoInicial || 0,
    });
    this.setState({ cartProducts: [], clienteNombre: '', paymentType: 'Contado', showConfirmarModal: false });
    if (caidos.length > 0) {
      const nombres = caidos.map(p => `${nombreProducto(p.nombre, p.tamano)}`).join(', ');
      Toast.show(`Venta completada · Stock bajo: ${nombres}`, 'info');
    } else {
      Toast.show('Venta completada');
    }
  };

  // Fila de un producto del carrito (dentro de una sola tarjeta con
  // divisores; antes cada fila tenía su propia sombra y bordes redondeados).
  renderCartItem(item, index) {
    const moneda = this.context.config?.moneda ?? '$';
    const ultimo = index === this.state.cartProducts.length - 1;
    return (
      <View
        key={`${item.productId}::${item.presentacionId}::${index}`}
        style={{ paddingVertical: spacing.md, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: colors.border, gap: spacing.sm }}
      >
        {/* Nombre (+ marca) + quitar */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {nombreProducto(item.nombre, item.tamano)}
            </Text>
            {!!item.marca && (
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>{item.marca}</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => this.deleteProductFromCart(index)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${item.nombre} del carrito`}
            style={{ width: 36, height: 36, marginTop: -6, marginRight: -6, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}
          >
            <IconClose size={20} color={colors.dangerDark} />
          </TouchableOpacity>
        </View>

        {/* Precio unitario + cantidad + subtotal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ fontSize: fontSize.caption + 1, color: colors.textMuted, flex: 1 }}>
            {formatoDinero(item.precio, moneda)} c/u
          </Text>
          {item.esGranel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <TextInput
                style={{
                  width: 84, height: 40, borderRadius: radius.sm,
                  borderWidth: 1, borderColor: colors.inputBorder, backgroundColor: colors.card,
                  textAlign: 'center', fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary,
                  paddingHorizontal: spacing.sm,
                }}
                keyboardType="decimal-pad"
                placeholder="0.000"
                placeholderTextColor={colors.placeholder}
                value={item.cantidadTexto}
                onChangeText={text => this.updateGranelAmount(index, text)}
              />
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>
                {item.unidadGranel || 'kg'}
              </Text>
            </View>
          ) : (
            <NumericStepper
              value={item.numProducts}
              onChange={v => this.updateAmountProduct(index, v)}
              min={1}
              max={item.stock}
            />
          )}
          <Text style={{ fontSize: fontSize.label + 1, fontWeight: 'bold', color: colors.textPrimary, minWidth: 66, textAlign: 'right' }}>
            {formatoDinero(item.totalPrice, moneda)}
          </Text>
        </View>
      </View>
    );
  }

  // Selector de cliente para ventas a crédito (mismo comportamiento de siempre:
  // campo directo si no hay deudores; si los hay, lista desplegable + "Nuevo cliente").
  renderSelectorCliente(clientesDeuda, clienteSeleccionado) {
    const moneda = this.context.config?.moneda ?? '$';
    return (
      <View style={{ marginTop: spacing.lg }}>
        <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm }}>
          Cliente
        </Text>

        {clientesDeuda.length === 0 ? (
          /* ── Sin deudores → campo de texto directo ── */
          <TextInput
            style={clienteInputStyle}
            placeholder="Nombre del cliente nuevo"
            placeholderTextColor={colors.placeholder}
            value={this.state.clienteNombre}
            onChangeText={text => this.setState({ clienteNombre: text })}
            autoCorrect={false}
            returnKeyType="done"
          />
        ) : this.state.estaNuevoCliente ? (
          /* ── Cliente nuevo: campo de texto + volver al selector ── */
          <View>
            <TextInput
              style={clienteInputStyle}
              placeholder="Nombre del cliente nuevo"
              placeholderTextColor={colors.placeholder}
              value={this.state.clienteNombre}
              onChangeText={text => this.setState({ clienteNombre: text })}
              autoCorrect={false}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => this.setState({ estaNuevoCliente: false, clienteNombre: '', seleccionClienteAbierto: false })}
              style={{ alignSelf: 'flex-start', marginTop: spacing.xs, minHeight: 40, justifyContent: 'center' }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <IconBack size={fontSize.caption} color={colors.primaryDark} />
                <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.primaryDark, marginLeft: spacing.xs }}>
                  Volver al selector
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Lista desplegable ── */
          <View>
            <TouchableOpacity
              onPress={() => this.setState({ seleccionClienteAbierto: !this.state.seleccionClienteAbierto })}
              style={{ ...clienteInputStyle, flexDirection: 'row', alignItems: 'center' }}
            >
              <Text style={{ flex: 1, fontSize: fontSize.body, color: clienteSeleccionado ? colors.textPrimary : colors.placeholder }}>
                {clienteSeleccionado ? clienteSeleccionado.cliente : 'Selecciona un cliente'}
              </Text>
              {this.state.seleccionClienteAbierto
                ? <IconChevronUp size={fontSize.body} color={colors.textPrimary} />
                : <IconChevronDown size={fontSize.body} color={colors.textPrimary} />}
            </TouchableOpacity>

            {this.state.seleccionClienteAbierto && (
              <View
                style={{
                  borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm,
                  marginTop: spacing.xs, maxHeight: CLIENTES_LIST_MAX_HEIGHT, overflow: 'hidden',
                }}
              >
                {/* nestedScrollEnabled: la lista vive dentro del scroll de la pantalla */}
                <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                  <TouchableOpacity
                    onPress={() => this.setState({ estaNuevoCliente: true, clienteNombre: '', seleccionClienteAbierto: false })}
                    style={{ paddingHorizontal: spacing.md, minHeight: 48, justifyContent: 'center' }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <IconPlus size={fontSize.body} color={colors.primaryDark} />
                      <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.primaryDark, marginLeft: spacing.xs }}>
                        Nuevo cliente
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {clientesDeuda.map(c => {
                    const activo = c.cliente === this.state.clienteNombre.trim();
                    return (
                      <TouchableOpacity
                        key={c.cliente}
                        onPress={() => this.setState({ clienteNombre: c.cliente, seleccionClienteAbierto: false })}
                        style={{
                          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                          paddingHorizontal: spacing.md, minHeight: 48,
                          borderTopWidth: 1, borderTopColor: colors.border,
                          backgroundColor: activo ? colors.primarySoft : colors.card,
                        }}
                      >
                        <Text style={{ fontSize: fontSize.body, color: colors.textPrimary, flex: 1, fontWeight: activo ? 'bold' : 'normal' }}>
                          {c.cliente}
                        </Text>
                        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.dangerDark }}>
                          {formatoDinero(c.saldo, moneda)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {clienteSeleccionado && (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, flex: 1 }}>
              Cliente: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{clienteSeleccionado.cliente}</Text>
            </Text>
            <View style={{ backgroundColor: colors.warningSoft, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs }}>
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.dangerDark }}>
                Pendiente: {formatoDinero(clienteSeleccionado.saldo, moneda)}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }

  render() {
    const moneda = this.context.config?.moneda ?? '$';
    const { sellableItems, categories, config } = this.context;
    const { cartProducts } = this.state;
    const clientesDeuda = this.getClientesConDeuda();
    const clienteSeleccionado = this.state.clienteNombre.trim()
      ? clientesDeuda.find(c => c.cliente === this.state.clienteNombre.trim()) || null
      : null;
    const total = formatoDinero(Number(this.getTotalCart()), moneda);

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ProductPickerModal
          visible={this.state.showProductModal}
          listProducts={sellableItems}
          categories={categories}
          umbralStock={config?.umbralStock ?? 5}
          onCancel={() => this.setState({ showProductModal: false })}
          onSelectProduct={product => {
            this.addProductToCart(product);
            this.setState({ showProductModal: false });
          }}
          cartProducts={cartProducts}
        />

        <ConfirmSaleModal
          visible={this.state.showConfirmarModal}
          cliente={this.state.clienteNombre.trim()}
          total={parseFloat(this.getTotalCart())}
          onCancel={() => this.setState({ showConfirmarModal: false })}
          onConfirmar={abono => this.finalizarVenta(abono)}
        />

        <Header
          titulo="Nueva Venta"
          acciones={[
            { Icono: IconClipboard, etiqueta: 'Historial de ventas', onPress: () => this.props.navigation.navigate('Historial') },
            { Icono: IconCreditCard, etiqueta: 'Créditos', badge: clientesDeuda.length, onPress: () => this.props.navigation.navigate('Creditos') },
            { Icono: IconSettings, etiqueta: 'Configuración', punto: this.state.recordarCopia, onPress: () => this.props.navigation.navigate('ConfigView') },
          ]}
        />

        {/* Toda la pantalla se desplaza junta (antes Tipo de pago quedaba fijo
            arriba y solo se movía el carrito). KeyboardScrollView además evita
            que el teclado tape el nombre del cliente nuevo o una cantidad a
            granel. El carrito ya no es una FlatList: son pocos productos y así
            el TextInput del cliente nunca se desmonta al escribir. */}
        <KeyboardScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Tipo de pago ── */}
          <View style={{ ...tarjeta, padding: spacing.lg }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.md }}>
              Tipo de pago
            </Text>
            <SelectorSegmentado
              opciones={['Contado', 'Credito']}
              valor={this.state.paymentType}
              etiqueta={tipo => (tipo === 'Credito' ? 'Crédito' : tipo)}
              alto={44}
              onChange={tipo => this.setState({ paymentType: tipo, estaNuevoCliente: false, seleccionClienteAbierto: false })}
            />
            {this.state.paymentType === 'Credito' && this.renderSelectorCliente(clientesDeuda, clienteSeleccionado)}
          </View>

          {/* ── Productos + Agregar (arriba de la lista) ── */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Productos{cartProducts.length > 0 ? ` · ${cartProducts.length}` : ''}
            </Text>
            <TouchableOpacity
              onPress={() => this.setState({ showProductModal: true })}
              accessibilityRole="button"
              style={{
                height: buttonHeight.action, paddingHorizontal: spacing.lg, gap: spacing.xs,
                backgroundColor: colors.primary, borderRadius: radius.lg,
                flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
              }}
            >
              <IconPlus size={fontSize.itemTitle} color={colors.white} />
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Agregar
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Carrito ── */}
          {cartProducts.length === 0 ? (
            <View style={{ ...tarjeta, alignItems: 'center', paddingVertical: spacing.xxl }}>
              <IconShoppingCart size={64} color={colors.inputBorder} />
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>
                Carrito vacío
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.xs }}>
                Toca "Agregar" para comenzar
              </Text>
            </View>
          ) : (
            <View style={{ ...tarjeta, paddingHorizontal: spacing.lg }}>
              {cartProducts.map((item, index) => this.renderCartItem(item, index))}
            </View>
          )}
        </KeyboardScrollView>

        {/* Total + cobrar, fijos abajo (antes al final de la lista: había que
            bajar hasta el final para cobrar). Solo con productos; BarraGuardar
            se oculta sola mientras el teclado está abierto. */}
        {cartProducts.length > 0 && (
          <BarraGuardar
            texto={this.state.paymentType === 'Credito' ? 'Cobrar a crédito' : `Cobrar ${total}`}
            onPress={this.confirmCompleteSale}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text style={{ fontSize: fontSize.body, color: colors.label }}>Total</Text>
              <Text style={{ fontSize: fontSize.splash, fontWeight: 'bold', color: colors.textPrimary }}>{total}</Text>
            </View>
          </BarraGuardar>
        )}
      </View>
    );
  }
}

export default NewSaleScreen;
