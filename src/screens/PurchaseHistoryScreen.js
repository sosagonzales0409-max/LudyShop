import React, { Component } from 'react';
import {
  View, Text, TouchableOpacity, FlatList,
  Alert, ActivityIndicator,
} from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { cargarComprasPagina } from '../data/repositories/compras';
import { resumenCompras, vendidasDespuesDe } from '../data/consultas/compras';
import { crearConsultaViva } from '../data/consultaViva';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { nombreProducto, formatoCantidad } from '../config/formato';
import { IconTrash, IconEdit, IconTruck } from '../ui/Icon';
import Header from '../ui/Header';
import { EstadoVacio } from '../ui/StatusViews';

const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

// Compras por página (se piden más al llegar al final de la lista).
const PAGINA = 30;

function fmtFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * PurchaseHistoryScreen — lista de todas las compras registradas.
 *
 * Acceso: fila "Compras" en SettingsScreen. Para registrar una compra nueva se usa
 * la fila "Registrar compra" independiente en SettingsScreen (no hay botón aquí,
 * para no duplicar esa entrada).
 * Cada compra muestra: proveedor, fecha, total, lista de ítems, un botón para
 * editarla (→ NewPurchaseScreen en modo edición) y uno para eliminarla.
 */
export default class PurchaseHistoryScreen extends Component {
  static contextType = StoreContext;

  state = {
    expandidaId: null,
    // Datos consultados (bajo demanda)
    compras: [],
    resumen: null,     // { count, total }
    cargando: true,
    cargandoMas: false,
    hayMas: true,
    error: null,
  };

  versionLista = 0; // descarta páginas que lleguen tarde tras una recarga

  componentDidMount() {
    // Se refresca sola al registrar, editar o eliminar una compra.
    this.consulta = crearConsultaViva({
      tablas: ['compras', 'compra_items'],
      cargar: async () => {
        this.versionLista++;
        const limite = Math.max(PAGINA, this.state.compras.length);
        const [compras, resumen] = await Promise.all([cargarComprasPagina({ limite }), resumenCompras()]);
        return { compras, resumen };
      },
      alCargar: ({ compras, resumen }) => this.setState({ compras, resumen, cargando: false, error: null, hayMas: compras.length < resumen.count }),
      alFallar: error => this.setState({ error: error?.message ?? String(error), cargando: false }),
    });
  }

  componentWillUnmount() {
    this.consulta?.detener();
  }

  cargarMas = async () => {
    const { compras, hayMas, cargandoMas, cargando } = this.state;
    if (!hayMas || cargandoMas || cargando || !compras.length) return;
    const version = this.versionLista;
    this.setState({ cargandoMas: true });
    try {
      const ultima = compras[compras.length - 1];
      const pagina = await cargarComprasPagina({ limite: PAGINA, antesDe: { fecha: ultima.fecha, id: ultima.id } });
      if (version !== this.versionLista) return;
      this.setState(prev => ({
        compras: [...prev.compras, ...pagina],
        hayMas: pagina.length === PAGINA && prev.compras.length + pagina.length < (prev.resumen?.count ?? 0),
      }));
    } catch (error) {
      console.error('HistorialComprasView.cargarMas', error);
    } finally {
      this.setState({ cargandoMas: false });
    }
  };

  getResumen() {
    return this.state.resumen ?? { count: 0, total: 0 };
  }

  // Unidades vendidas de cada producto de la compra, después de la fecha de
  // la compra. Sirve para advertir antes de revertir stock: si ya se vendió
  // parte de esa mercancía, restarla del stock actual puede dejarlo mal.
  // (Lo calcula SQLite; antes se recorrían todas las ventas por cada producto.)
  async getVentasPosteriores(compra) {
    const porPresentacion = await vendidasDespuesDe(compra);
    const resumen = {};
    (compra.items ?? []).forEach(item => {
      const vendidas = porPresentacion[item.presentacionId];
      if (vendidas > 0) resumen[nombreProducto(item.nombre, item.tamano)] = vendidas;
    });
    return resumen;
  }

  confirmarEliminar(compra) {
    const moneda = this.context.config?.moneda ?? '$';
    Alert.alert(
      'Eliminar compra',
      `¿Eliminar la compra ${compra.proveedor ? `de ${compra.proveedor}` : 'sin proveedor'} del ${fmtFecha(compra.fecha)} por ${moneda}${compra.total?.toFixed(2)}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar (mantener stock)',
          onPress: () => this.context.eliminarCompra(compra.id, false),
        },
        {
          text: 'Eliminar y revertir stock',
          style: 'destructive',
          onPress: () => this.confirmarRevertirStock(compra),
        },
      ],
    );
  }

  // Si hubo ventas de estos productos después de la compra, avisa antes de
  // revertir el stock — restar a ciegas puede dejarlo incorrecto.
  async confirmarRevertirStock(compra) {
    let ventasPosteriores;
    try {
      ventasPosteriores = await this.getVentasPosteriores(compra);
    } catch (error) {
      Alert.alert('No se pudo revisar', `No se pudieron consultar las ventas posteriores: ${error?.message ?? error}`);
      return;
    }
    const entradas = Object.entries(ventasPosteriores);

    if (entradas.length === 0) {
      this.eliminarYAvisarSiFalta(compra);
      return;
    }

    const detalle = entradas.map(([nombre, unidades]) => `• ${nombre}: ${unidades} vendidas después`).join('\n');
    Alert.alert(
      'Ya se vendió parte de esta mercancía',
      `Después de esta compra se registraron ventas de los mismos productos:\n\n${detalle}\n\nRevertir el stock puede dejarlo incorrecto. ¿Quieres continuar de todas formas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Revertir de todas formas',
          style: 'destructive',
          onPress: () => this.eliminarYAvisarSiFalta(compra),
        },
      ],
    );
  }

  // Elimina la compra y, si algún ítem ya no tiene producto/presentación en
  // el inventario, avisa que ese stock no se pudo revertir (en vez de
  // fallar en silencio). eliminarCompra es asíncrona: lee la compra de la BD
  // dentro de su transacción.
  async eliminarYAvisarSiFalta(compra) {
    const resultado = await this.context.eliminarCompra(compra.id, true);
    if (resultado?.itemsNoEncontrados?.length > 0) {
      const detalle = resultado.itemsNoEncontrados.map(i => `• ${nombreProducto(i.nombre, i.tamano)}`).join('\n');
      Alert.alert(
        'Stock no revertido para algunos productos',
        `Estos productos ya no existen en el inventario, así que su stock no se pudo revertir:\n\n${detalle}`,
      );
    }
  }

  // ¿Esta línea de compra es de un producto a granel? (la compra no lo guarda:
  // se mira el catálogo; si la presentación ya no existe, se trata como piezas)
  granelDe(item) {
    const pres = this.context.products?.find(p => p.id === item.productId)?.presentaciones.find(pr => pr.id === item.presentacionId);
    return pres?.esGranel ? (pres.unidadGranel || 'kg') : null;
  }

  renderCompra({ item: compra }) {
    const moneda   = this.context.config?.moneda ?? '$';
    const expandida = this.state.expandidaId === compra.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => this.setState(prev => ({ expandidaId: prev.expandidaId === compra.id ? null : compra.id }))}
        style={{
          ...tarjeta,
          padding: spacing.lg,
          marginBottom: spacing.sm,
        }}
      >
        {/* Fila principal */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: compra.proveedor ? colors.textPrimary : colors.textMuted, fontStyle: compra.proveedor ? 'normal' : 'italic' }}>
              {compra.proveedor || 'Sin proveedor'}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
              {fmtFecha(compra.fecha)} · {compra.tipoPago === 'Credito' ? 'Crédito' : 'Contado'}
            </Text>
          </View>

          <View style={{ alignItems: 'flex-end', marginRight: spacing.md }}>
            <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary }}>
              {moneda}{compra.total?.toFixed(2)}
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
              {(compra.items ?? []).length} {compra.items?.length === 1 ? 'producto' : 'productos'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => this.props.navigation.navigate('RegistrarCompra', { compraId: compra.id })}
            accessibilityRole="button"
            accessibilityLabel="Editar compra"
            style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.primarySoft, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm }}
          >
            <IconEdit size={fontSize.label} color={colors.primaryDark} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => this.confirmarEliminar(compra)}
            accessibilityRole="button"
            accessibilityLabel="Eliminar compra"
            style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.dangerSoft, justifyContent: 'center', alignItems: 'center' }}
          >
            <IconTrash size={fontSize.label} color={colors.dangerDark} />
          </TouchableOpacity>
        </View>

        {/* Detalle expandible */}
        {expandida && (compra.items ?? []).length > 0 && (
          <View style={{ marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
            {(compra.items ?? []).map((it, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: idx < compra.items.length - 1 ? spacing.sm : 0 }}>
                <View style={{ flex: 1, marginRight: spacing.sm }}>
                  <Text style={{ fontSize: fontSize.body, color: colors.textPrimary }}>{it.nombre}</Text>
                  {(() => {
                    const u = this.granelDe(it);
                    if (it.piezasPaquete != null && it.precioPaquete != null) {
                      return (
                        <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
                          {u
                            ? `Bulto de ${formatoCantidad(it.piezasPaquete)} ${u} × ${moneda}${it.precioPaquete.toFixed(2)} · ${formatoCantidad(it.cantidad)} ${u} × ${moneda}${it.costoUnitario?.toFixed(2)} por ${u}`
                            : `Paquete de ${formatoCantidad(it.piezasPaquete)} × ${moneda}${it.precioPaquete.toFixed(2)} · ${formatoCantidad(it.cantidad)} × ${moneda}${it.costoUnitario?.toFixed(2)} c/u`}
                        </Text>
                      );
                    }
                    return (
                      <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
                        {formatoCantidad(it.cantidad)}{u ? ` ${u}` : ''} × {moneda}{it.costoUnitario?.toFixed(2)}{u ? ` por ${u}` : ''}
                      </Text>
                    );
                  })()}
                </View>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                  {moneda}{it.subtotal?.toFixed(2)}
                </Text>
              </View>
            ))}
            {compra.notas ? (
              <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' }}>
                {compra.notas}
              </Text>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  }

  renderPie = () => {
    if (this.state.cargandoMas) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />;
    return null;
  };

  render() {
    const moneda = this.context.config?.moneda ?? '$';
    const { count, total } = this.getResumen();
    const { compras, cargando, error } = this.state; // ya vienen ordenadas (más recientes primero)

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header titulo="Compras" onBack={() => this.props.navigation.goBack()} />

        {/* Resumen */}
        {count > 0 && (
          <View style={{ flexDirection: 'row', padding: spacing.lg, gap: spacing.sm }}>
            <View style={{ flex: 1, ...tarjeta, padding: spacing.md }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Total invertido</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: 2 }}>
                {moneda}{total.toFixed(2)}
              </Text>
            </View>
            <View style={{ flex: 1, ...tarjeta, padding: spacing.md }}>
              <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>Compras registradas</Text>
              <Text style={{ fontSize: fontSize.itemTitle, fontWeight: 'bold', color: colors.textPrimary, marginTop: 2 }}>
                {count}
              </Text>
            </View>
          </View>
        )}

        <FlatList
          data={compras}
          keyExtractor={item => item.id}
          renderItem={item => this.renderCompra(item)}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
          showsVerticalScrollIndicator={false}
          onEndReached={this.cargarMas}
          onEndReachedThreshold={0.5}
          ListFooterComponent={this.renderPie}
          ListEmptyComponent={() => (cargando ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
          ) : error ? (
            <Text style={{ fontSize: fontSize.body, color: colors.danger, textAlign: 'center', marginTop: 60 }}>
              No se pudieron cargar las compras: {error}
            </Text>
          ) : (
            <View style={{ alignItems: 'center' }}>
              <EstadoVacio
                Icono={IconTruck}
                tono="info"
                titulo="Sin compras registradas"
                texto={'Toca "Registrar compra" para registrar tu primera compra.'}
              />
              <TouchableOpacity
                onPress={() => this.props.navigation.navigate('RegistrarCompra')}
                style={{ marginTop: spacing.xl, height: buttonHeight.action, paddingHorizontal: spacing.xxl, backgroundColor: colors.primary, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center' }}
              >
                <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>Registrar compra</Text>
              </TouchableOpacity>
            </View>
          ))}
        />
      </View>
    );
  }
}
