import React, { Component } from 'react';
import {
  View, Text, Alert,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import KeyboardScrollView from '../ui/KeyboardScrollView';
import { colors, spacing } from '../config/theme';
import Header from '../ui/Header';
import {
  Seccion, Campo, FilaCampos, FilaInterruptor, SelectorSegmentado,
  BadgeGanancia, BarraGuardar, NotaConfirmacion, Etiqueta,
} from '../ui/FormFields';

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

// Ganancia = venta − costo y su % sobre el PRECIO DE VENTA: misma fórmula que
// el detalle del producto (antes aquí era sobre el costo y no coincidían).
function calcGanancia(precioCompra, precioVenta) {
  const c = parseFloat(precioCompra); const v = parseFloat(precioVenta);
  if (isNaN(c) || isNaN(v) || c <= 0 || v <= 0) return null;
  return { ganancia: v - c, pct: Math.round(((v - c) / v) * 100) };
}

const UNIDADES_GRANEL = ['kg', 'g', 'L', 'ml'];

/**
 * EditProductScreen — pantalla completa para editar una presentación existente.
 * Reemplaza EditProductModal.
 *
 * Params: { productId, presentacionId }
 *
 * Secciones:
 *   PRESENTACIÓN  — tamaño, granel + unidad
 *   PRECIOS       — precio compra, precio venta, badge margen
 *   STOCK         — stock actual, razón del ajuste (opcional)
 */
export default class EditProductScreen extends Component {
  static contextType = StoreContext;

  state = {
    tamano: '', tamanoNormalizado: '',
    esGranel: false, unidadGranel: 'kg',
    precioCompra: '', precioVenta: '',
    stock: '', razonAjuste: '',
    listo: false,
  };

  componentDidMount() {
    const pres = this.getPresentacion();
    if (!pres) return;
    this.setState({
      tamano:      pres.tamano ?? '',
      esGranel:    pres.esGranel ?? false,
      unidadGranel:pres.unidadGranel ?? 'kg',
      precioCompra:pres.precioCompra != null ? String(pres.precioCompra) : '',
      precioVenta: String(pres.precio ?? ''),
      stock:       String(pres.stock ?? ''),
      listo: true,
    });
  }

  getProduct() {
    const { productId } = this.props.route.params;
    return this.context.products.find(p => p.id === productId) ?? null;
  }

  getPresentacion() {
    const { presentacionId } = this.props.route.params;
    return this.getProduct()?.presentaciones.find(pr => pr.id === presentacionId) ?? null;
  }

  onTamanoChange = text => {
    const normalizado = normalizarTamano(text);
    this.setState({ tamano: text, tamanoNormalizado: normalizado !== text.trim() ? normalizado : '' });
  };

  handleGuardar = () => {
    const moneda = this.context.config?.moneda ?? '$';
    const { tamano, tamanoNormalizado, esGranel, unidadGranel, precioCompra, precioVenta, stock, razonAjuste } = this.state;
    const { productId, presentacionId } = this.props.route.params;

    const tamanoFinal = tamanoNormalizado || tamano.trim();
    const precioVentaNum = parseFloat(String(precioVenta).replace(',', '.'));
    const precioCompraNum = precioCompra.trim() ? parseFloat(String(precioCompra).replace(',', '.')) : null;
    const stockNum = esGranel
      ? parseFloat(String(stock).replace(',', '.'))
      : Math.floor(parseFloat(String(stock).replace(',', '.')) || 0);

    // Vacía solo si es la ÚNICA presentación del producto (p. ej. "Gansito"):
    // con varias, cada una necesita nombre para distinguirlas.
    const esUnica = (this.getProduct()?.presentaciones.length ?? 0) <= 1;
    if (!tamanoFinal && !esUnica) {
      Alert.alert('Falta el tamaño', 'Este producto tiene varias presentaciones: cada una necesita un nombre para distinguirlas (ej. 1 kg, 600 ml, Individual).');
      return;
    }
    if (esGranel && !unidadGranel) { Alert.alert('Falta la unidad', 'Selecciona la unidad de granel.'); return; }
    if (isNaN(precioVentaNum) || precioVentaNum <= 0) { Alert.alert('Precio inválido', `Ingresa un precio de venta mayor a ${moneda}0.`); return; }
    if (precioCompraNum !== null && (isNaN(precioCompraNum) || precioCompraNum < 0)) { Alert.alert('Precio de compra inválido', 'El precio de compra no puede ser negativo.'); return; }
    if (isNaN(stockNum) || stockNum < 0) { Alert.alert('Stock inválido', 'El stock no puede ser negativo.'); return; }

    const cambios = {
      tamano: tamanoFinal,
      precio: precioVentaNum,
      precioCompra: precioCompraNum,
      stock: stockNum,
      esGranel,
      unidadGranel: esGranel ? unidadGranel : null,
    };

    // La razón del ajuste (si la hay) va dentro del evento de stock ajustado
    // que registra updatePresentacion — antes se registraba un segundo evento.
    this.context.updatePresentacion(productId, presentacionId, cambios, razonAjuste);

    this.props.navigation.goBack();
  };

  render() {
    const product = this.getProduct();
    const { tamano, tamanoNormalizado, esGranel, unidadGranel, precioCompra, precioVenta, stock, razonAjuste, listo } = this.state;

    if (!product || !listo) return null;

    const moneda = this.context.config?.moneda ?? '$';
    const unidad = esGranel ? unidadGranel : 'unidad';

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          titulo="Editar presentación"
          subtitulo={`${product.nombre}${product.marca ? ` · ${product.marca}` : ''}`}
          onBack={() => this.props.navigation.goBack()}
        />

        <KeyboardScrollView contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* ── PRESENTACIÓN ── */}
          <Seccion titulo="Presentación">
            <Campo
              label="Tamaño / Presentación"
              placeholder="Ej. 1 kg, 600 ml, Chico"
              value={tamano}
              onChangeText={this.onTamanoChange}
              returnKeyType="next"
              ayuda={(product.presentaciones.length ?? 0) <= 1
                ? 'Es la única presentación: puedes dejarlo vacío y se mostrará solo el nombre del producto.'
                : null}
            >
              {!!tamanoNormalizado && <NotaConfirmacion>Se guardará como <Text style={{ fontWeight: 'bold' }}>{tamanoNormalizado}</Text></NotaConfirmacion>}
            </Campo>

            <FilaInterruptor
              separador
              label="¿Es producto a granel?"
              sublabel="Se vende y stockea por peso o volumen"
              value={esGranel}
              onValueChange={v => this.setState({ esGranel: v })}
            />

            {esGranel && (
              <View style={{ gap: spacing.sm }}>
                <Etiqueta texto="Unidad de medida" />
                <SelectorSegmentado opciones={UNIDADES_GRANEL} valor={unidadGranel} onChange={u => this.setState({ unidadGranel: u })} />
              </View>
            )}
          </Seccion>

          {/* ── PRECIOS ── */}
          <Seccion titulo="Precios">
            <FilaCampos>
              <Campo style={{ flex: 1 }} label={`Costo por ${unidad}`} opcional prefijo={moneda} placeholder="0.00" value={precioCompra} onChangeText={t => this.setState({ precioCompra: t })} keyboardType="decimal-pad" />
              <Campo style={{ flex: 1 }} label={esGranel ? `Venta por ${unidadGranel}` : 'Precio de venta'} prefijo={moneda} placeholder="0.00" value={precioVenta} onChangeText={t => this.setState({ precioVenta: t })} keyboardType="decimal-pad" />
            </FilaCampos>
            <BadgeGanancia g={calcGanancia(precioCompra, precioVenta)} unidad={unidad} moneda={moneda} />
          </Seccion>

          {/* ── STOCK ── */}
          <Seccion titulo="Stock">
            <Campo label="Stock actual" placeholder={esGranel ? '0.000' : '0'} sufijo={esGranel ? unidadGranel : 'unidades'} value={stock} onChangeText={t => this.setState({ stock: t })} keyboardType="decimal-pad" />
            <Campo
              label="Razón del ajuste"
              opcional
              placeholder="Ej. Merma, Error de conteo, Inventario físico"
              value={razonAjuste}
              onChangeText={t => this.setState({ razonAjuste: t })}
              ayuda="Solo se registra en el historial si el stock cambia."
            />
          </Seccion>
        </KeyboardScrollView>

        <BarraGuardar texto="Guardar cambios" onPress={this.handleGuardar} />
      </View>
    );
  }
}
