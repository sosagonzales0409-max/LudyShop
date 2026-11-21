import React, { Component } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LOG_META } from '../context/StoreContext';
import { cargarLog, contarLog } from '../data/repositories/log';
import { crearConsultaViva } from '../data/consultaViva';
import { colors, spacing, radius, fontSize, buttonHeight, tarjeta } from '../config/theme';
import { IconShoppingCart, IconCreditCard, IconTruck, IconPackage, IconHistory } from '../ui/Icon';
import Header, { EtiquetaEncabezado } from '../ui/Header';
import { EstadoVacio } from '../ui/StatusViews';

// Ícono de cada evento según su grupo de filtro (LOG_META[tipo].filtro).
// Reemplaza al emoji de LOG_META, que se sigue usando en otros lugares.
const ICONO_FILTRO = {
  ventas: IconShoppingCart,
  creditos: IconCreditCard,
  compras: IconTruck,
  inventario: IconPackage,
  otros: IconHistory,
};

// Eventos por página (se piden más al llegar al final de la lista).
const PAGINA = 50;

// Tipos de evento de cada filtro (el filtro se aplica en SQL, no en memoria).
const tiposDelFiltro = filtro =>
  filtro === 'todos' ? null : Object.keys(LOG_META).filter(t => LOG_META[t].filtro === filtro);

const FILTROS = [
  { key: 'todos',      label: 'Todos' },
  { key: 'ventas',     label: 'Ventas' },
  { key: 'creditos',   label: 'Créditos' },
  { key: 'compras',    label: 'Compras' },
  { key: 'inventario', label: 'Inventario' },
  { key: 'otros',      label: 'Otros' },
];

/**
 * ActivityLogScreen — historial cronológico de todos los cambios en la app.
 *
 * Acceso: fila "Historial de actividad" en SettingsScreen.
 * Los eventos se registran en StoreContext (misma transacción que cada acción).
 *
 * Datos BAJO DEMANDA (no viven en memoria): consulta la BD por páginas de
 * PAGINA eventos y pide la siguiente al llegar al final. Se refresca sola
 * cuando cualquier acción escribe en activity_log (consultaViva).
 *
 * Filtros: Todos · Ventas · Créditos · Compras · Inventario · Otros
 */
export default class ActivityLogScreen extends Component {
  state = {
    filtro: 'todos',
    eventos: [],
    total: 0,          // total con el filtro actual (para el contador)
    cargando: true,    // primera carga o cambio de filtro
    cargandoMas: false,
    hayMas: true,
    error: null,
  };

  // Cambia cada vez que la lista se recarga desde arriba: una página que
  // llegue tarde de una carga anterior se descarta (no se mezcla).
  versionLista = 0;

  componentDidMount() {
    this.consulta = crearConsultaViva({
      tablas: ['activity_log'],
      cargar: this.cargarDesdeArriba,
      alCargar: ({ eventos, total }) => this.setState({ eventos, total, hayMas: eventos.length < total, cargando: false, error: null }),
      alFallar: error => this.setState({ error: error?.message ?? String(error), cargando: false }),
    });
  }

  componentWillUnmount() {
    this.consulta?.detener();
  }

  // Primera página (o, si ya se habían cargado más, la misma cantidad, para
  // que un refresco no "encoja" la lista mientras se lee).
  cargarDesdeArriba = async () => {
    this.versionLista++;
    const tipos = tiposDelFiltro(this.state.filtro);
    const limite = Math.max(PAGINA, this.state.eventos.length);
    const [eventos, total] = await Promise.all([cargarLog({ limite, tipos }), contarLog({ tipos })]);
    return { eventos, total };
  };

  cargarMas = async () => {
    const { eventos, hayMas, cargandoMas, cargando, filtro } = this.state;
    if (!hayMas || cargandoMas || cargando || !eventos.length) return;
    const version = this.versionLista;
    this.setState({ cargandoMas: true });
    try {
      const ultimo = eventos[eventos.length - 1];
      const pagina = await cargarLog({ limite: PAGINA, antesDe: { fecha: ultimo.fecha, id: ultimo.id }, tipos: tiposDelFiltro(filtro) });
      if (version !== this.versionLista) return; // la lista se recargó mientras tanto
      this.setState(prev => ({
        eventos: [...prev.eventos, ...pagina],
        hayMas: pagina.length === PAGINA && prev.eventos.length + pagina.length < prev.total,
      }));
    } catch (error) {
      console.error('ActivityLogView.cargarMas', error);
    } finally {
      this.setState({ cargandoMas: false });
    }
  };

  cambiarFiltro = filtro => {
    if (filtro === this.state.filtro) return;
    this.setState({ filtro, eventos: [], cargando: true, hayMas: true }, () => this.consulta?.recargar());
  };

  formatFecha(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    const hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);

    const mismodia = (a, b) =>
      a.getDate() === b.getDate() &&
      a.getMonth() === b.getMonth() &&
      a.getFullYear() === b.getFullYear();

    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    if (mismodia(d, hoy)) return `Hoy ${hora}`;
    if (mismodia(d, ayer)) return `Ayer ${hora}`;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${hora}`;
  }

  renderEvento(evento) {
    const meta = LOG_META[evento.tipo] ?? { icono: '•', label: evento.tipo };
    const Icono = ICONO_FILTRO[meta.filtro] ?? IconHistory;

    return (
      <View
        style={{
          ...tarjeta,
          padding: spacing.lg,
          marginBottom: spacing.sm,
          flexDirection: 'row',
          alignItems: 'flex-start',
        }}
      >
        {/* Ícono del tipo de evento */}
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.sm,
            backgroundColor: colors.primarySoft,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
          }}
        >
          <Icono size={20} color={colors.primaryDark} />
        </View>

        {/* Descripción + fecha */}
        <View style={{ flex: 1 }}>
          <Text
            style={{ fontSize: fontSize.body, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs }}
            numberOfLines={2}
          >
            {evento.desc}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={{ fontSize: fontSize.caption, color: colors.textMuted }}>
              {this.formatFecha(evento.fecha)}
            </Text>
            <View
              style={{
                backgroundColor: colors.chipInactive,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
              }}
            >
              <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 'bold' }}>
                {meta.label}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  renderPie = () => {
    const { cargandoMas, hayMas, eventos } = this.state;
    if (cargandoMas) return <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />;
    if (!hayMas && eventos.length > 0) {
      return <Text style={{ fontSize: fontSize.caption, color: colors.textMuted, textAlign: 'center', marginVertical: spacing.lg }}>Inicio del historial</Text>;
    }
    return null;
  };

  render() {
    const { eventos, total, cargando, error } = this.state;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header
          titulo="Historial de actividad"
          onBack={() => this.props.navigation.goBack()}
          derecha={<EtiquetaEncabezado texto={`${total} eventos`} />}
        />

        {/* Filtros */}
        <View
          style={{
            backgroundColor: colors.card,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.lg,
          }}
        >
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={FILTROS}
            keyExtractor={f => f.key}
            renderItem={({ item: f }) => {
              const activo = this.state.filtro === f.key;
              return (
                <TouchableOpacity
                  onPress={() => this.cambiarFiltro(f.key)}
                  style={{
                    height: buttonHeight.chip,
                    paddingHorizontal: spacing.lg,
                    backgroundColor: activo ? colors.primary : colors.chipInactive,
                    borderRadius: radius.lg,
                    justifyContent: 'center',
                    alignItems: 'center',
                    marginRight: spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: fontSize.label, fontWeight: 'bold', color: activo ? colors.white : colors.textPrimary }}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>

        {/* Lista de eventos (por páginas) */}
        {cargando ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
        ) : error ? (
          <Text style={{ fontSize: fontSize.body, color: colors.danger, textAlign: 'center', margin: spacing.xl }}>
            No se pudo cargar el historial: {error}
          </Text>
        ) : (
        <FlatList
          data={eventos}
          keyExtractor={item => item.id}
          renderItem={({ item }) => this.renderEvento(item)}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.xxl,
          }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          showsVerticalScrollIndicator={false}
          onEndReached={this.cargarMas}
          onEndReachedThreshold={0.5}
          ListFooterComponent={this.renderPie}
          ListEmptyComponent={() => (
            <EstadoVacio
              Icono={IconHistory}
              tono="info"
              titulo="Sin actividad registrada"
              texto={this.state.filtro === 'todos'
                ? 'Los cambios que hagas en la app aparecerán aquí.'
                : 'No hay eventos de este tipo todavía.'}
            />
          )}
        />
        )}
      </View>
    );
  }
}
