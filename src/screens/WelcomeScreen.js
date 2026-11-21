import React, { Component } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ScrollView, StatusBar, BackHandler, AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { formatoDinero, formatoCantidad, nombreProducto } from '../config/formatting';
import Header, { EtiquetaEncabezado } from '../ui/Header';
import NumericStepper from '../ui/NumericStepper';
import { BarraGuardar } from '../ui/FormFields';
import { ChipEstado } from '../ui/StatusViews';
import {
  IconClipboard, IconCreditCard, IconSettings, IconWarning, IconShoppingBag,
  IconReceipt, IconTrendingUp, IconClose, IconChevron, IconStore,
} from '../ui/Icon';

/**
 * Carrusel de bienvenida: 4 pasos con lo principal de la app.
 *
 * Se abre solo la primera vez (StoreContext.mostrarBienvenida, guardado en la
 * tabla meta) y desde Configuración → "Ver tutorial de bienvenida". El router
 * la pone ENCIMA de la app, así que cerrarla deja Ventas debajo.
 *
 * Cada paso enseña una VENTANA con la pantalla real en miniatura: el
 * Encabezado de verdad (modo `miniatura`) y debajo la tarjeta tal como se ve
 * en la app. Donde se puede se usan las piezas reales (Header,
 * NumericStepper, BarraGuardar, ChipEstado); las tarjetas que viven dentro de
 * cada pantalla están copiadas — si cambias una de esas pantallas, actualiza
 * aquí la réplica (cada una dice de dónde sale).
 *
 * Las ventanas son solo dibujo: no se tocan y el lector de pantalla las salta
 * (el texto de abajo ya explica qué es y dónde está).
 */

const nada = () => {};

// ─── Ventana: marco que recorta la réplica como si fuera el teléfono ─────────

function Ventana({ children }) {
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        borderRadius: radius.xl, borderWidth: 1, borderColor: colors.cardBorder,
        backgroundColor: colors.background, overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

// Ícono del encabezado dentro del texto ("toca [▭] arriba en Ventas"): el
// mismo ícono blanco sobre azul que la persona va a buscar.
function IconoEnTexto({ Icono, fondo = colors.primary, color = colors.white }) {
  return (
    <View style={{ width: 26, height: 22, borderRadius: radius.sm, backgroundColor: fondo, justifyContent: 'center', alignItems: 'center', transform: [{ translateY: 4 }] }}>
      <Icono size={15} color={color} />
    </View>
  );
}

const Negrita = ({ children }) => <Text style={{ fontWeight: 'bold', color: colors.textPrimary }}>{children}</Text>;

// ─── 1. Nueva Venta (NewSaleScreen.js: encabezado, renderCartItem y BarraGuardar) ─────

function EscenaVenta({ moneda }) {
  return (
    <Ventana>
      <Header
        miniatura
        titulo="Nueva Venta"
        acciones={[
          { Icono: IconClipboard, etiqueta: 'Historial de ventas', onPress: nada },
          { Icono: IconCreditCard, etiqueta: 'Créditos', onPress: nada },
          { Icono: IconSettings, etiqueta: 'Configuración', onPress: nada },
        ]}
      />
      <View style={{ padding: spacing.lg }}>
        <View style={{ ...tarjeta, paddingHorizontal: spacing.lg }}>
          <View style={{ paddingVertical: spacing.md, gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
              <Text style={{ flex: 1, fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                {nombreProducto('Coca-Cola', '600 ml')}
              </Text>
              <IconClose size={20} color={colors.dangerDark} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ fontSize: fontSize.caption + 1, color: colors.textMuted, flex: 1 }}>
                {formatoDinero(18, moneda)} c/u
              </Text>
              <NumericStepper value={2} onChange={nada} min={1} />
              <Text style={{ fontSize: fontSize.label + 1, fontWeight: 'bold', color: colors.textPrimary, minWidth: 66, textAlign: 'right' }}>
                {formatoDinero(36, moneda)}
              </Text>
            </View>
          </View>
        </View>
      </View>
      <BarraGuardar texto={`Cobrar ${formatoDinero(36, moneda)}`} onPress={nada}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Text style={{ fontSize: fontSize.body, color: colors.label }}>Total</Text>
          <Text style={{ fontSize: fontSize.splash, fontWeight: 'bold', color: colors.textPrimary }}>{formatoDinero(36, moneda)}</Text>
        </View>
      </BarraGuardar>
    </Ventana>
  );
}

// ─── 2. Créditos (CreditsScreen.js: encabezado y renderCliente) ───────────────

function EscenaFiado({ moneda }) {
  return (
    <Ventana>
      <Header
        miniatura
        titulo="Créditos"
        onBack={nada}
        derecha={<EtiquetaEncabezado texto={`${formatoDinero(350, moneda)} total`} color={colors.dangerDark} />}
      />
      <View style={{ padding: spacing.lg }}>
        <View style={{ ...tarjeta, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1, marginRight: spacing.sm }}>
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>Doña Carmen</Text>
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.xs }}>3 ventas a crédito</Text>
            </View>
            <ChipEstado tono="warn" texto="5 días" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, marginTop: spacing.xs, marginBottom: spacing.sm }}>
            <Text style={{ flex: 1, fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.dangerDark }}>
              {formatoDinero(350, moneda)}
            </Text>
            <IconChevron size={fontSize.itemTitle} color={colors.placeholder} />
          </View>
          <View style={{ height: buttonHeight.action, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Registrar pago</Text>
          </View>
        </View>
      </View>
    </Ventana>
  );
}

// ─── 3. Inventario (InventoryScreen.js: encabezado y renderProductItem) ────────────

function FilaPresentacion({ tamano, precio, estado }) {
  return (
    <View
      style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        borderTopWidth: 1, borderTopColor: colors.border,
        paddingTop: spacing.sm, marginTop: spacing.sm,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary }}>{tamano}</Text>
        <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>{precio}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
        {estado}
        <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.successSoft, justifyContent: 'center', alignItems: 'center' }}>
          <IconShoppingBag size={20} color={colors.successDark} />
        </View>
      </View>
    </View>
  );
}

function EscenaInventario({ moneda }) {
  return (
    <Ventana>
      <Header
        miniatura
        titulo="Inventario"
        subtitulo={`Valor total: ${formatoDinero(18452.5, moneda)}`}
        acciones={[
          { Icono: IconWarning, etiqueta: 'Stock bajo', badge: 1, onPress: nada },
          { Icono: IconSettings, etiqueta: 'Configuración', onPress: nada },
        ]}
      />
      <View style={{ padding: spacing.lg }}>
        <View style={{ ...tarjeta, padding: spacing.lg }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, flex: 1 }}>Frijol</Text>
            <IconChevron size={fontSize.itemTitle} color={colors.textMuted} />
          </View>
          <FilaPresentacion
            tamano="1 kg"
            precio={formatoDinero(38, moneda)}
            estado={<ChipEstado tono="warn" texto={`${formatoCantidad(3)} u · bajo`} />}
          />
          <FilaPresentacion
            tamano="A granel"
            precio={`${formatoDinero(32, moneda)} / kg`}
            estado={(
              <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.successDark }}>
                {formatoCantidad(12.5, true, 'kg')}
              </Text>
            )}
          />
        </View>
      </View>
    </Ventana>
  );
}

// ─── 4. Corte del día (SalesHistoryScreen.js: encabezado; EndOfDayModal.js: ingresos) ─

function FilaCorte({ label, valor, color = colors.textPrimary, ultima = false }) {
  return (
    <View
      style={{
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: spacing.sm, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: colors.border,
      }}
    >
      <Text style={{ fontSize: fontSize.body, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color }}>{valor}</Text>
    </View>
  );
}

function EscenaCorte({ moneda }) {
  return (
    <Ventana>
      <Header
        miniatura
        titulo="Historial"
        onBack={nada}
        derecha={(
          <View style={{ height: 36, paddingHorizontal: spacing.md, marginHorizontal: spacing.xs, backgroundColor: colors.white, borderRadius: radius.lg, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
            <IconReceipt size={15} color={colors.primaryDark} />
            <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.primaryDark, marginLeft: spacing.xs }}>Corte</Text>
          </View>
        )}
        acciones={[{ Icono: IconTrendingUp, etiqueta: 'Reportes', onPress: nada }]}
      />
      {/* El corte es un modal sobre el historial: tarjeta blanca encima del fondo */}
      <View style={{ padding: spacing.lg }}>
        <View style={{ backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.lg }}>
            <IconReceipt size={fontSize.heading} color={colors.textPrimary} />
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, marginLeft: spacing.sm }}>Corte del día</Text>
          </View>
          <View style={{ backgroundColor: colors.background, borderRadius: radius.md, padding: spacing.lg }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center' }}>
              INGRESOS DEL DÍA (contado + abonos)
            </Text>
            <Text style={{ fontSize: 34, fontWeight: 'bold', color: colors.success, textAlign: 'center', marginVertical: spacing.sm }}>
              {formatoDinero(1540, moneda)}
            </Text>
            <FilaCorte label="Contado vendido" valor={formatoDinero(1240, moneda)} />
            <FilaCorte label="Abonos recibidos" valor={formatoDinero(300, moneda)} color={colors.success} />
            <FilaCorte label="Ventas del día" valor="28" ultima />
          </View>
        </View>
      </View>
    </Ventana>
  );
}

// ─── Pasos ────────────────────────────────────────────────────────────────────

const PASOS = [
  {
    clave: 'venta',
    titulo: 'Cobra en segundos',
    Escena: EscenaVenta,
    Texto: () => (
      <>En <Negrita>Ventas</Negrita> toca <Negrita>Agregar</Negrita>, elige el producto y cobra. Funciona sin internet.</>
    ),
  },
  {
    clave: 'fiado',
    titulo: 'El fiado, en orden',
    Escena: EscenaFiado,
    Texto: () => (
      <>
        Al vender, elige <Negrita>Crédito</Negrita> y el cliente. Para registrar sus pagos, toca{' '}
        <IconoEnTexto Icono={IconCreditCard} /> arriba en Ventas.
      </>
    ),
  },
  {
    clave: 'inventario',
    titulo: 'Tu anaquel, al día',
    Escena: EscenaInventario,
    Texto: () => (
      <>
        En <Negrita>Inventario</Negrita>, el stock baja solo al vender. Con{' '}
        <IconoEnTexto Icono={IconShoppingBag} fondo={colors.successSoft} color={colors.successDark} />{' '}
        registras una compra y se suma.
      </>
    ),
  },
  {
    clave: 'corte',
    titulo: 'Cierra el día tranquilo',
    Escena: EscenaCorte,
    Texto: () => (
      <>
        Mira cuánto entró hoy, de contado y en abonos. En Ventas toca{' '}
        <IconoEnTexto Icono={IconClipboard} /> y luego <Negrita>Corte</Negrita>.
      </>
    ),
  },
];

const ULTIMO = PASOS.length - 1;

// ─── Pantalla ─────────────────────────────────────────────────────────────────

class WelcomeScreen extends Component {
  static contextType = StoreContext;

  state = {
    indice: 0,
    ancho: 0,              // se mide con onLayout (cada paso ocupa el ancho completo)
    sinAnimaciones: false, // "Quitar animaciones" de Android
  };

  componentDidMount() {
    // El Atrás del sistema regresa al paso anterior; en el primero deja pasar
    // el evento y la navegación cierra la bienvenida.
    this.atras = BackHandler.addEventListener('hardwareBackPress', () => {
      if (this.state.indice === 0) return false;
      this.irA(this.state.indice - 1);
      return true;
    });
    AccessibilityInfo.isReduceMotionEnabled()
      .then(sinAnimaciones => this.setState({ sinAnimaciones }))
      .catch(() => {});
  }

  componentWillUnmount() {
    this.atras?.remove();
    // Cualquier salida (Saltar, Atrás, botones del final) cuenta como vista.
    this.context.marcarBienvenidaVista();
  }

  irA = indice => {
    this.setState({ indice });
    this.lista?.scrollToOffset({ offset: indice * this.state.ancho, animated: !this.state.sinAnimaciones });
  };

  // Al soltar el deslizamiento: qué paso quedó a la vista.
  alTerminarDeslizar = e => {
    const { ancho } = this.state;
    if (!ancho) return;
    const indice = Math.round(e.nativeEvent.contentOffset.x / ancho);
    if (indice !== this.state.indice) this.setState({ indice });
  };

  cerrar = () => this.props.navigation.goBack();

  // Quita la bienvenida y deja Ventas → Configuración → Personalizar tienda
  // (SettingsScreen abre StoreSettingsScreen con el parámetro `abrir`). Al regresar se
  // pasa por Configuración, como si la persona hubiera llegado sola.
  configurarTienda = () => {
    this.props.navigation.navigate('App', {
      screen: 'MainTab',
      params: { screen: 'ConfigView', initial: false, params: { abrir: 'TiendaView' } },
    });
  };

  renderPaso = ({ item }) => {
    const { Escena, Texto } = item;
    const moneda = this.context.config?.moneda ?? '$';
    return (
      <ScrollView
        style={{ width: this.state.ancho }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth: 420, alignSelf: 'center' }}>
          <Escena moneda={moneda} />
          <Text
            accessibilityRole="header"
            style={{ fontSize: fontSize.splash, fontWeight: 'bold', color: colors.textPrimary, marginTop: spacing.xxl + spacing.sm }}
          >
            {item.titulo}
          </Text>
          <Text style={{ fontSize: fontSize.label, lineHeight: 26, color: colors.textSecondary, marginTop: spacing.sm }}>
            <Texto />
          </Text>
        </View>
      </ScrollView>
    );
  };

  renderPuntos() {
    const { indice } = this.state;
    return (
      <View
        accessible
        accessibilityLabel={`Paso ${indice + 1} de ${PASOS.length}`}
        style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.lg }}
      >
        {PASOS.map((p, i) => (
          <View
            key={p.clave}
            style={{
              height: 8, borderRadius: 4,
              width: i === indice ? 24 : 8,
              backgroundColor: i === indice ? colors.primary : colors.inputBorder,
            }}
          />
        ))}
      </View>
    );
  }

  renderBotones() {
    const esUltimo = this.state.indice === ULTIMO;
    const principal = {
      height: buttonHeight.action, borderRadius: radius.lg, backgroundColor: colors.primary,
      flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm,
    };
    const textoPrincipal = { fontSize: fontSize.label, fontWeight: 'bold', color: colors.white };

    if (!esUltimo) {
      return (
        <TouchableOpacity accessibilityRole="button" onPress={() => this.irA(this.state.indice + 1)} style={principal}>
          <Text style={textoPrincipal}>Siguiente</Text>
        </TouchableOpacity>
      );
    }
    return (
      <View>
        <TouchableOpacity accessibilityRole="button" onPress={this.configurarTienda} style={principal}>
          <IconStore size={fontSize.itemTitle} color={colors.white} />
          <Text style={textoPrincipal}>Configurar mi tienda</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={this.cerrar}
          style={{ height: buttonHeight.action, justifyContent: 'center', alignItems: 'center', marginTop: spacing.xs }}
        >
          <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primaryDark }}>Ir a vender</Text>
        </TouchableOpacity>
      </View>
    );
  }

  render() {
    const { ancho, indice } = this.state;
    return (
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Fondo claro: íconos oscuros en la barra de estado. Al cerrar, vuelve
            lo de App.tsx (íconos claros sobre el encabezado azul). */}
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* "Saltar" arriba a la derecha; en el último paso sobra. */}
        <View style={{ height: buttonHeight.action, flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.sm }}>
          {indice !== ULTIMO && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={this.cerrar}
              style={{ height: buttonHeight.action, minWidth: buttonHeight.action, paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center' }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.primaryDark }}>Saltar</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ flex: 1 }} onLayout={e => this.setState({ ancho: e.nativeEvent.layout.width })}>
          {ancho > 0 && (
            <FlatList
              ref={ref => { this.lista = ref; }}
              data={PASOS}
              keyExtractor={p => p.clave}
              renderItem={this.renderPaso}
              extraData={ancho}
              horizontal
              pagingEnabled
              bounces={false}
              overScrollMode="never"
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, i) => ({ length: ancho, offset: ancho * i, index: i })}
              initialScrollIndex={indice}
              onMomentumScrollEnd={this.alTerminarDeslizar}
            />
          )}
        </View>

        <View style={{ paddingHorizontal: spacing.xxl, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          {this.renderPuntos()}
          {this.renderBotones()}
        </View>
      </SafeAreaView>
    );
  }
}

export default WelcomeScreen;
