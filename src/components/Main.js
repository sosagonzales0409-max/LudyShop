import React, { Component } from 'react';
import {
  View,
  TouchableOpacity,
  Dimensions,
  Text,
  TextInput,
  FlatList,
  Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import ProductsModal from './ProductsModal.js';
import ConfirmarVentaModal from './ConfirmarVentaModal.js';
import NumericStepper from './NumericStepper.js';
import Toast from './Toast';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import {
  IconClose, IconClipboard, IconCreditCard, IconSettings,
  IconBack, IconPlus, IconChevronUp, IconChevronDown, IconShoppingCart,
} from './Icon';

const _window = Dimensions.get('window');
const GREEN_BAR_HEIGHT = 50;
const HEADER_HEIGHT = 60;

const clienteInputStyle = {
  borderColor: colors.chipInactive,
  borderWidth: 1,
  borderRadius: radius.sm,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  fontSize: fontSize.body,
  color: colors.textPrimary,
};

class Main extends Component {
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
    };
  }

  // Clientes con saldo pendiente (mismo cálculo que CreditosView), para el
  // selector de ventas a crédito. Orden: mayor deuda primero.
  getClientesConDeuda() {
    const { sales } = this.context;
    const mapa = {};
    sales
      .filter(s => s.tipoPago === 'Credito')
      .forEach(sale => {
        const key = (sale.cliente || 'Sin nombre').trim();
        if (!mapa[key]) {
          mapa[key] = { cliente: key, saldo: 0 };
        }
        mapa[key].saldo += sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
      });
    return Object.values(mapa)
      .filter(c => c.saldo > 0.009)
      .sort((a, b) => b.saldo - a.saldo);
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
      `Total: $${this.getTotalCart()}\n¿Deseas completar esta venta?`,
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
    this.context.decreaseStock(
      cartProducts.map(p => ({ productId: p.productId, presentacionId: p.presentacionId, cantidad: p.numProducts })),
    );
    this.context.addSale({
      productos: cartProducts,
      total: parseFloat(this.getTotalCart()),
      tipoPago: paymentType,
      cliente: paymentType === 'Credito' ? this.normalizarCliente(clienteNombre) : null,
      totalAbonado: abonoInicial || 0,
    });
    this.setState({ cartProducts: [], clienteNombre: '', paymentType: 'Contado', showConfirmarModal: false });
    if (caidos.length > 0) {
      const nombres = caidos.map(p => `${p.nombre} ${p.tamano}`).join(', ');
      Toast.show(`Venta completada · Stock bajo: ${nombres}`, 'info');
    } else {
      Toast.show('Venta completada');
    }
  };

  // Pie de la FlatList: total + botón confirmar (solo si hay productos)
  renderListFooter() {
    if (this.state.cartProducts.length === 0) return null;

    return (
      <View
        style={{
          marginHorizontal: spacing.lg, marginTop: spacing.sm,
          marginBottom: spacing.xxl, padding: spacing.lg,
          backgroundColor: colors.primary, borderRadius: radius.md,
          elevation: 3, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.white }}>
            Total
          </Text>
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.white }}>
            ${this.getTotalCart()}
          </Text>
        </View>
        <TouchableOpacity
          onPress={this.confirmCompleteSale}
          style={{
            height: buttonHeight.action, backgroundColor: colors.white,
            borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primary }}>
            Completar Venta
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  renderCartItem({ item, index }) {
    return (
      <View
        style={{
          marginHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          backgroundColor: colors.card,
          // Bordes redondeados solo en el primer y último elemento
          borderTopLeftRadius: index === 0 ? radius.md : 0,
          borderTopRightRadius: index === 0 ? radius.md : 0,
          borderBottomLeftRadius: index === this.state.cartProducts.length - 1 ? radius.md : 0,
          borderBottomRightRadius: index === this.state.cartProducts.length - 1 ? radius.md : 0,
          borderBottomWidth: index === this.state.cartProducts.length - 1 ? 0 : 1,
          borderBottomColor: colors.border,
          elevation: index === 0 ? 3 : 0,
          shadowOpacity: index === 0 ? 0.08 : 0,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        {/* Nombre + botón eliminar */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
              {item.nombre} {item.tamano}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, fontStyle: 'italic' }}>
              {item.marca}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => this.deleteProductFromCart(index)}
            style={{
              width: 32, height: 32, borderRadius: radius.sm,
              backgroundColor: colors.danger,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <IconClose size={fontSize.caption} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Precio unitario + stepper + subtotal */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
          <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, flex: 1 }}>
            ${item.precio.toFixed(2)} c/u
          </Text>
          {item.esGranel ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TextInput
                style={{
                  width: 76, height: 44, borderRadius: radius.md,
                  backgroundColor: colors.background, textAlign: 'center',
                  fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary,
                  paddingHorizontal: spacing.sm,
                }}
                keyboardType="decimal-pad"
                placeholder="0.000"
                placeholderTextColor={colors.textMuted}
                value={item.cantidadTexto}
                onChangeText={text => this.updateGranelAmount(index, text)}
              />
              <Text style={{ fontSize: fontSize.body, color: colors.textSecondary, marginLeft: spacing.xs }}>
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
          <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, minWidth: 72, textAlign: 'right' }}>
            ${item.totalPrice.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  }

  render() {
    const { sellableItems, clientesConDeudaCount, categories, config } = this.context;
    const clientesDeuda = this.getClientesConDeuda();
    const clienteSeleccionado = this.state.clienteNombre.trim()
      ? clientesDeuda.find(c => c.cliente === this.state.clienteNombre.trim()) || null
      : null;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Barra verde */}
        <View style={{ width: _window.width, height: GREEN_BAR_HEIGHT, backgroundColor: 'green' }} />

        <ProductsModal
          visible={this.state.showProductModal}
          listProducts={sellableItems}
          categories={categories}
          umbralStock={config?.umbralStock ?? 5}
          onCancel={() => this.setState({ showProductModal: false })}
          onSelectProduct={product => {
            this.addProductToCart(product);
            this.setState({ showProductModal: false });
          }}
          cartProducts={this.state.cartProducts}
        />

        <ConfirmarVentaModal
          visible={this.state.showConfirmarModal}
          cliente={this.state.clienteNombre.trim()}
          total={parseFloat(this.getTotalCart())}
          onCancel={() => this.setState({ showConfirmarModal: false })}
          onConfirmar={abono => this.finalizarVenta(abono)}
        />

        {/* ── Header ── */}
        <View
          style={{
            height: HEADER_HEIGHT, paddingHorizontal: spacing.lg,
            flexDirection: 'row', alignItems: 'center',
            backgroundColor: colors.card, elevation: 4,
            shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
            Nueva Venta
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
            {/* Historial */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('Historial')}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}
            >
              <IconClipboard size={28} color={colors.textPrimary} />
            </TouchableOpacity>

            {/* Créditos con badge */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('Creditos')}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}
            >
              <IconCreditCard size={28} color={colors.textPrimary} />
              {clientesConDeudaCount > 0 && (
                <View
                  style={{
                    position: 'absolute', top: 2, right: 2,
                    backgroundColor: colors.danger,
                    borderRadius: 9, minWidth: 18, height: 18,
                    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
                    borderWidth: 2, borderColor: colors.card,
                  }}
                >
                  <Text style={{ color: colors.white, fontSize: 10, fontWeight: 'bold' }}>
                    {clientesConDeudaCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Configuración */}
            <TouchableOpacity
              onPress={() => this.props.navigation.navigate('ConfigView')}
              hitSlop={8}
              style={{ width: 44, height: 44, borderRadius: radius.sm, justifyContent: 'center', alignItems: 'center' }}
            >
              <IconSettings size={28} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Tipo de pago — fuera del FlatList para que el TextInput no se desmonte ── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          <View
            style={{
              marginTop: spacing.lg, padding: spacing.lg,
              backgroundColor: colors.card, borderRadius: radius.md,
              elevation: 3, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 },
            }}
          >
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.md }}>
              Tipo de pago
            </Text>
            <View style={{ flexDirection: 'row' }}>
              {['Contado', 'Credito'].map(tipo => (
                <TouchableOpacity
                  key={tipo}
                  onPress={() => this.setState({ paymentType: tipo, estaNuevoCliente: false, seleccionClienteAbierto: false })}
                  style={{
                    flex: 1,
                    height: buttonHeight.chip,
                    backgroundColor: this.state.paymentType === tipo ? colors.primary : colors.chipInactive,
                    borderRadius: radius.lg,
                    marginHorizontal: spacing.xs,
                    justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <Text style={{
                    fontSize: fontSize.label, fontWeight: 'bold',
                    color: this.state.paymentType === tipo ? colors.white : colors.textPrimary,
                  }}>
                    {tipo === 'Credito' ? 'Crédito' : tipo}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {this.state.paymentType === 'Credito' && (
              <View style={{ marginTop: spacing.lg }}>
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary, marginBottom: spacing.sm }}>
                  Cliente
                </Text>

                {clientesDeuda.length === 0 ? (
                  /* ── Sin deudores → campo de texto directo ── */
                  <TextInput
                    style={clienteInputStyle}
                    placeholder="Nombre del cliente nuevo"
                    placeholderTextColor={colors.textMuted}
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
                      placeholderTextColor={colors.textMuted}
                      value={this.state.clienteNombre}
                      onChangeText={text => this.setState({ clienteNombre: text })}
                      autoCorrect={false}
                      returnKeyType="done"
                    />
                    <TouchableOpacity
                      onPress={() => this.setState({ estaNuevoCliente: false, clienteNombre: '', seleccionClienteAbierto: false })}
                      style={{ alignSelf: 'flex-start', marginTop: spacing.sm, paddingVertical: spacing.xs }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconBack size={fontSize.caption} color={colors.primary} />
                        <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.primary, marginLeft: spacing.xs }}>
                          Volver al selector
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* ── Dropdown desplegable ── */
                  <View>
                    <TouchableOpacity
                      onPress={() => this.setState({ seleccionClienteAbierto: !this.state.seleccionClienteAbierto })}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: colors.chipInactive,
                        borderRadius: radius.sm,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        backgroundColor: colors.card,
                      }}
                    >
                      <Text
                        style={{
                          flex: 1,
                          fontSize: fontSize.body,
                          color: clienteSeleccionado ? colors.textPrimary : colors.textMuted,
                        }}
                      >
                        {clienteSeleccionado ? clienteSeleccionado.cliente : 'Selecciona un cliente'}
                      </Text>
                      {this.state.seleccionClienteAbierto
                        ? <IconChevronUp size={fontSize.body} color={colors.textPrimary} />
                        : <IconChevronDown size={fontSize.body} color={colors.textPrimary} />}
                    </TouchableOpacity>

                    {this.state.seleccionClienteAbierto && (
                      <View
                        style={{
                          borderWidth: 1,
                          borderColor: colors.chipInactive,
                          borderRadius: radius.sm,
                          marginTop: spacing.xs,
                          overflow: 'hidden',
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => this.setState({ estaNuevoCliente: true, clienteNombre: '', seleccionClienteAbierto: false })}
                          style={{ paddingHorizontal: spacing.md, paddingVertical: spacing.md }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <IconPlus size={fontSize.body} color={colors.primary} />
                            <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.primary, marginLeft: spacing.xs }}>
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
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingHorizontal: spacing.md,
                                paddingVertical: spacing.sm,
                                borderTopWidth: 1,
                                borderTopColor: colors.border,
                                backgroundColor: activo ? '#e8f4ff' : colors.card,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: fontSize.body,
                                  color: colors.textPrimary,
                                  flex: 1,
                                  fontWeight: activo ? 'bold' : 'normal',
                                }}
                              >
                                {c.cliente}
                              </Text>
                              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.danger }}>
                                ${c.saldo.toFixed(2)} 💳
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {clienteSeleccionado && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, flex: 1 }}>
                      Cliente: <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{clienteSeleccionado.cliente}</Text>
                    </Text>
                    <View
                      style={{
                        backgroundColor: '#fff3e0',
                        borderRadius: radius.sm,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs,
                      }}
                    >
                      <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.danger }}>
                        Pendiente: ${clienteSeleccionado.saldo.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Fila: "Productos" + botón Agregar */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.sm }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>
              Productos
            </Text>
            <TouchableOpacity
              onPress={() => this.setState({ showProductModal: true })}
              style={{
                height: buttonHeight.action, paddingHorizontal: spacing.xl,
                backgroundColor: colors.primary, borderRadius: radius.lg,
                justifyContent: 'center', alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Agregar
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Lista del carrito + estado vacío + total ── */}
        <FlatList
          data={this.state.cartProducts}
          keyExtractor={(item, index) => index.toString()}
          renderItem={({ item, index }) => this.renderCartItem({ item, index })}
          ListEmptyComponent={
            <View
              style={{
                marginHorizontal: spacing.lg,
                backgroundColor: colors.card, borderRadius: radius.md,
                alignItems: 'center', paddingVertical: spacing.xxl,
                elevation: 3, shadowOpacity: 0.08, shadowOffset: { width: 0, height: 2 },
              }}
            >
              <IconShoppingCart size={80} color={colors.chipInactive} />
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.md }}>
                Carrito vacío
              </Text>
              <Text style={{ fontSize: fontSize.body, color: colors.textMuted, marginTop: spacing.xs }}>
                Toca "Agregar" para comenzar
              </Text>
            </View>
          }
          ListFooterComponent={() => this.renderListFooter()}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }
}

export default Main;
