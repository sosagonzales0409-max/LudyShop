import React, { Component } from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { resumenCorte } from '../data/consultas/corte';
import { crearConsultaViva } from '../data/consultaViva';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';
import { formatoCantidad, formatoDinero } from '../config/formato';
import { IconReceipt } from './Icon';

/**
 * CorteModal — resumen del día (corte de caja).
 *
 * Muestra lo vendido hoy, desglosado en contado / crédito, el pendiente por
 * cobrar, el número de transacciones y el producto más vendido del día.
 *
 * Datos BAJO DEMANDA: al abrirse consulta el corte a SQLite
 * (consultas/corte.js) y, mientras está abierto, se refresca solo si cambian
 * ventas o abonos. Al cerrarse deja de escuchar.
 *
 * @param {boolean}  visible
 * @param {function} onCancel
 */
export default class CorteModal extends Component {
  static contextType = StoreContext;

  state = { datos: null, error: null };

  componentDidMount() {
    if (this.props.visible) this.abrirConsulta();
  }

  componentDidUpdate(prevProps) {
    if (this.props.visible && !prevProps.visible) this.abrirConsulta();
    if (!this.props.visible && prevProps.visible) this.cerrarConsulta();
  }

  componentWillUnmount() {
    this.cerrarConsulta();
  }

  abrirConsulta() {
    this.cerrarConsulta();
    this.setState({ datos: null, error: null });
    this.consulta = crearConsultaViva({
      tablas: ['ventas', 'venta_items', 'abonos', 'clientes'],
      cargar: () => resumenCorte({ inicioHoy: this.inicioHoy().toISOString() }),
      alCargar: datos => this.setState({ datos, error: null }),
      alFallar: error => this.setState({ error: error?.message ?? String(error) }),
    });
  }

  cerrarConsulta() {
    this.consulta?.detener();
    this.consulta = null;
  }

  inicioHoy() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  formatFecha(iso) {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  renderFila(label, valor, labelColor, valorColor, ultima) {
    return (
      <View
        style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingVertical: spacing.sm,
          borderBottomWidth: ultima ? 0 : 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ fontSize: fontSize.body, color: labelColor || colors.textSecondary }}>{label}</Text>
        <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: valorColor || colors.textPrimary }}>{valor}</Text>
      </View>
    );
  }

  render() {
    const moneda = this.context.config?.moneda ?? '$';
    const { visible, onCancel } = this.props;
    const { datos, error } = this.state;
    // Todo viene de consultas/corte.js (mismas fórmulas que antes en memoria).
    const totalContado = datos?.contado ?? 0;
    const totalCredito = datos?.credito ?? 0;
    const totalAbonos = datos?.abonos ?? 0;
    const abonosHoy = datos?.abonosHoy ?? [];
    const numVentas = datos?.numVentas ?? 0;
    const ingresos = totalContado + totalAbonos;
    const pendientePorCobrar = datos?.pendienteTotal ?? 0;
    const masVendido = datos?.masVendido
      ? { ...datos.masVendido, nombre: `${datos.masVendido.nombre} ${datos.masVendido.tamano ?? ''}`.trim() }
      : null;

    return (
      <Modal animationType="fade" transparent visible={visible}>
        <View
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: '88%',
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              padding: spacing.xl,
              maxHeight: '85%',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IconReceipt size={fontSize.heading} color={colors.textPrimary} />
              <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary, marginLeft: spacing.sm }}>
                Corte del día
              </Text>
            </View>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              {this.formatFecha(new Date().toISOString())}
            </Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ flexShrink: 1 }}>
              {!datos && !error && <ActivityIndicator color={colors.primary} style={{ marginBottom: spacing.md }} />}
              {error && (
                <Text style={{ fontSize: fontSize.body, color: colors.danger, marginBottom: spacing.md }}>
                  No se pudo calcular el corte: {error}
                </Text>
              )}

              {/* Ingresos reales del día */}
              <View
                style={{
                  backgroundColor: colors.background,
                  borderRadius: radius.md,
                  padding: spacing.lg,
                  marginBottom: spacing.md,
                }}
              >
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center' }}>
                  INGRESOS DEL DÍA (contado + abonos)
                </Text>
                <Text
                  style={{
                    fontSize: 34,
                    fontWeight: 'bold',
                    color: colors.success,
                    textAlign: 'center',
                    marginVertical: spacing.sm,
                  }}
                >
                  {formatoDinero(ingresos, moneda)}
                </Text>
                {this.renderFila('Contado vendido', formatoDinero(totalContado, moneda), null, colors.textPrimary)}
                {this.renderFila('Abonos recibidos', formatoDinero(totalAbonos, moneda), null, colors.success)}
                {this.renderFila('Ventas del día', `${numVentas}`, null, colors.textPrimary, true)}
              </View>

              {/* Quién abonó hoy */}
              {abonosHoy.length > 0 && (
                <View style={{ marginBottom: spacing.md }}>
                  <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.sm }}>
                    Abonos del día
                  </Text>
                  {abonosHoy.map(a => (
                    <View
                      key={a.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        backgroundColor: colors.background,
                        borderRadius: radius.sm,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        marginBottom: spacing.xs,
                      }}
                    >
                      <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary }}>
                        {a.cliente || 'Sin nombre'}
                      </Text>
                      <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.success }}>
                        {formatoDinero(a.monto, moneda)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Por cobrar */}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md }}>
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.xs }}>
                  POR COBRAR
                </Text>
                {this.renderFila('Ventas a crédito (hoy)', formatoDinero(totalCredito, moneda), null, colors.textPrimary)}
                {this.renderFila(
                  'Pendiente por cobrar (total)',
                  formatoDinero(pendientePorCobrar, moneda),
                  null,
                  pendientePorCobrar > 0.009 ? colors.danger : colors.textPrimary,
                  true,
                )}
              </View>

              <View
                style={{
                  marginTop: spacing.md,
                  paddingTop: spacing.md,
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                }}
              >
                <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, marginBottom: spacing.sm }}>
                  Producto más vendido del día
                </Text>
                {masVendido ? (
                  <View style={{ backgroundColor: colors.background, borderRadius: radius.sm, padding: spacing.md }}>
                    <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.textPrimary }}>
                      {masVendido.nombre}
                    </Text>
                    <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs }}>
                      {masVendido.esGranel
                        ? formatoCantidad(masVendido.cantidad, true, masVendido.unidadGranel)
                        : `${formatoCantidad(masVendido.cantidad)} unidades`} · en {masVendido.numVentas} {masVendido.numVentas === 1 ? 'venta' : 'ventas'}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>Sin ventas registradas hoy.</Text>
                )}
              </View>
            </ScrollView>

            <TouchableOpacity
              onPress={onCancel}
              style={{
                marginTop: spacing.xl,
                height: buttonHeight.action,
                borderRadius: radius.lg,
                backgroundColor: colors.primary,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: colors.white }}>
                Cerrar
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }
}