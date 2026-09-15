import React, { Component } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { StoreContext } from '../context/StoreContext';
import { colors, spacing, radius, fontSize, buttonHeight } from '../config/theme';

/**
 * CorteModal — resumen del día (corte de caja).
 *
 * Muestra lo vendido hoy, desglosado en contado / crédito, el pendiente por
 * cobrar, el número de transacciones y el producto más vendido del día.
 *
 * @param {boolean}  visible
 * @param {function} onCancel
 */
export default class CorteModal extends Component {
  static contextType = StoreContext;

  inicioHoy() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  getVentasHoy() {
    const inicio = this.inicioHoy().toISOString();
    return this.context.sales
      .filter(s => s.fecha >= inicio)
      .sort((a, b) => (a.fecha > b.fecha ? -1 : 1));
  }

  // Abonos reales de hoy (dinero que sí entró por cobros de crédito).
  getAbonosHoy() {
    const inicio = this.inicioHoy().toISOString();
    return (this.context.abonos ?? [])
      .filter(a => a.tipo === 'abono' && a.fecha >= inicio)
      .sort((a, b) => (a.fecha > b.fecha ? -1 : 1));
  }

  // Saldo global por cobrar: toda venta a crédito menos lo abonado, menos lo
  // condonado (lo condonado nunca se cobrará, así que ya no cuenta).
  getPendienteGlobal() {
    return this.context.sales
      .filter(s => s.tipoPago === 'Credito')
      .reduce((acc, s) => acc + s.total - (s.totalAbonado ?? 0) - (s.condonado ?? 0), 0);
  }

  getProductoMasVendido(ventas) {
    const acum = {};
    ventas.forEach(v => {
      if (!Array.isArray(v.productos)) return;
      v.productos.forEach(p => {
        const key = `${p.productId}::${p.presentacionId}`;
        if (!acum[key]) {
          acum[key] = { nombre: `${p.nombre} ${p.tamano ?? ''}`.trim(), cantidad: 0 };
        }
        acum[key].cantidad += p.numProducts || 1;
      });
    });

    let top = null;
    Object.values(acum).forEach(prod => {
      if (!top || prod.cantidad > top.cantidad) top = prod;
    });
    return top;
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
    const { visible, onCancel } = this.props;
    const ventas = this.getVentasHoy();
    const abonosHoy = this.getAbonosHoy();

    let totalContado = 0;
    let totalCredito = 0;

    ventas.forEach(s => {
      if (s.tipoPago === 'Credito') {
        totalCredito += s.total;
      } else {
        totalContado += s.total;
      }
    });

    const totalAbonos = abonosHoy.reduce((s, a) => s + a.monto, 0);
    const ingresos = totalContado + totalAbonos;
    const pendientePorCobrar = this.getPendienteGlobal();
    const masVendido = this.getProductoMasVendido(ventas);

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
            }}
          >
            <Text style={{ fontSize: fontSize.heading, fontWeight: 'bold', color: colors.textPrimary }}>
              💰 Corte del día
            </Text>
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.lg }}>
              {this.formatFecha(new Date().toISOString())}
            </Text>

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
                ${ingresos.toFixed(2)}
              </Text>
              {this.renderFila('Contado vendido', `$${totalContado.toFixed(2)}`, null, colors.textPrimary)}
              {this.renderFila('Abonos recibidos', `$${totalAbonos.toFixed(2)}`, null, colors.success, true)}
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
                      ${a.monto.toFixed(2)}
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
              {this.renderFila('Ventas a crédito (hoy)', `$${totalCredito.toFixed(2)}`, null, colors.textPrimary)}
              {this.renderFila(
                'Pendiente por cobrar (total)',
                `$${pendientePorCobrar.toFixed(2)}`,
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
                    {masVendido.cantidad} unidades · {ventas.length} transacciones
                  </Text>
                </View>
              ) : (
                <Text style={{ fontSize: fontSize.body, color: colors.textMuted }}>Sin ventas registradas hoy.</Text>
              )}
            </View>

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