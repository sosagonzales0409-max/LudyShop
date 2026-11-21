import React, { Component } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { pick, keepLocalCopy, saveDocuments, types, errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import Share from 'react-native-share';
import { StoreContext, LOG_TIPOS } from '../context/StoreContext';
import {
  exportarCopia, revisarCopia, descartarCopia, fechaAntesDeImportar,
  RUTA_ANTES_DE_IMPORTAR, ErrorCopia, estadoCopia, registrarCopiaHecha, resumenDatos,
} from '../data/backup';
import { crearConsultaViva } from '../data/liveQuery';
import { colors, spacing, radius, fontSize, tarjeta } from '../config/theme';
import Toast from '../ui/Toast';
import DeleteDataModal from '../modals/DeleteDataModal';
import Header from '../ui/Header';
import {
  IconStore, IconTrendingUp, IconCoffee, IconClipboard,
  IconSave, IconFile, IconChevron, IconShoppingBag, IconPlus,
  IconHistory, IconWarning, IconTrash, IconInfo,
} from '../ui/Icon';

// Tipo genérico a propósito: con 'application/vnd.sqlite3' algunos destinos
// (Drive, el diálogo de Guardar) cambian la extensión o rechazan el archivo.
const MIME_COPIA = 'application/octet-stream';

const fechaHora = valor => {
  const d = new Date(valor);
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${hora}`;
};

const cancelado = error => isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED;

const textoUltimaCopia = dias => {
  if (dias === null) return 'Nunca has hecho una copia';
  if (dias === 0) return 'Última copia: hoy';
  if (dias === 1) return 'Última copia: ayer';
  return `Última copia: hace ${dias} días`;
};

const cuantos = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

// "12 productos, 340 ventas y 5 clientes" (omite lo que está en cero).
const listaDatos = ({ productos, ventas, clientes, compras }) => {
  const partes = [
    productos && cuantos(productos, 'producto', 'productos'),
    ventas    && cuantos(ventas, 'venta', 'ventas'),
    clientes  && cuantos(clientes, 'cliente', 'clientes'),
    compras   && cuantos(compras, 'compra', 'compras'),
  ].filter(Boolean);
  return partes.length > 1
    ? `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
    : partes[0] ?? 'tus categorías';
};

export default class SettingsScreen extends Component {
  static contextType = StoreContext;

  state = {
    ocupado: null,          // texto del indicador mientras se prepara/revisa una copia
    antesDeImportar: null,  // Date de los datos guardados antes de la última importación
    copia: null,            // estadoCopia(): días desde la última, ventas sin respaldar, recordar
    confirmandoBorrado: false, // modal de "escribe BORRAR" (segundo paso)
  };

  componentDidMount() {
    this.revisarAntesDeImportar();
    // Se refresca solo: al vender (ventas) y al registrar una copia (meta).
    this.consultaCopia = crearConsultaViva({
      tablas:   ['ventas', 'meta'],
      cargar:   estadoCopia,
      alCargar: copia => this.setState({ copia }),
      alFallar: error => console.error('ConfigView.estadoCopia', error),
    });
    this.abrirPendiente();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.route?.params?.abrir !== this.props.route?.params?.abrir) this.abrirPendiente();
  }

  // navigate('ConfigView', { abrir: 'TiendaView' }) abre esa pantalla encima
  // (lo usa la bienvenida: "Configurar mi tienda"). Así, al regresar, se pasa
  // por Configuración como si la persona hubiera llegado sola.
  abrirPendiente = () => {
    const destino = this.props.route?.params?.abrir;
    if (!destino) return;
    this.props.navigation.setParams({ abrir: undefined });
    this.props.navigation.navigate(destino);
  };

  revisarAntesDeImportar = async () => {
    try {
      const fecha = await fechaAntesDeImportar();
      if (!this.desmontado) this.setState({ antesDeImportar: fecha });
    } catch (error) {
      console.error('fechaAntesDeImportar', error);
    }
  };

  componentWillUnmount() {
    this.desmontado = true;
    this.consultaCopia?.detener();
  }

  // ─── Exportar ──────────────────────────────────────────────────────────

  exportar = async () => {
    let archivo;
    this.setState({ ocupado: 'Preparando la copia…' });
    try {
      archivo = await exportarCopia();
    } catch (error) {
      console.error('exportarCopia', error);
      Alert.alert('No se pudo crear la copia', 'Inténtalo de nuevo.');
      return;
    } finally {
      this.setState({ ocupado: null });
    }
    Alert.alert(
      'Copia lista',
      `${archivo.nombre}\n\nGuárdala fuera del teléfono (Drive, correo, WhatsApp) para no perder tus datos si el teléfono se pierde o se daña.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Compartir', onPress: () => this.compartirCopia(archivo) },
        { text: 'Guardar', onPress: () => this.guardarCopia(archivo) },
      ],
    );
  };

  // Diálogo "Guardar en…" de Android: el usuario elige carpeta (Descargas, Drive…).
  guardarCopia = async archivo => {
    try {
      const [resultado] = await saveDocuments({
        sourceUris: [`file://${archivo.ruta}`],
        mimeType:   MIME_COPIA,
        fileName:   archivo.nombre,
      });
      if (resultado.error) throw new Error(resultado.error);
      registrarCopiaHecha(archivo.fecha);
      this.context.logEvent(LOG_TIPOS.COPIA_EXPORTADA, `Copia de seguridad guardada: ${resultado.name ?? archivo.nombre}`);
      Toast.show('Copia guardada', 'success');
    } catch (error) {
      if (cancelado(error)) return;
      console.error('guardarCopia', error);
      Alert.alert('No se pudo guardar la copia', 'Inténtalo de nuevo o usa "Compartir".');
    }
  };

  compartirCopia = async archivo => {
    try {
      const resultado = await Share.open({
        url:          `file://${archivo.ruta}`,
        type:         MIME_COPIA,
        filename:     archivo.nombre,
        failOnCancel: false,
      });
      if (resultado?.dismissedAction) return;
      registrarCopiaHecha(archivo.fecha);
      this.context.logEvent(LOG_TIPOS.COPIA_EXPORTADA, `Copia de seguridad compartida: ${archivo.nombre}`);
    } catch (error) {
      console.error('compartirCopia', error);
      Alert.alert('No se pudo compartir la copia', 'Inténtalo de nuevo o usa "Guardar".');
    }
  };

  // ─── Importar ──────────────────────────────────────────────────────────

  importar = async () => {
    let elegido;
    try {
      // Cualquier tipo: según de dónde venga (WhatsApp, Drive, Descargas) un
      // .db llega con tipos distintos. El contenido se valida al revisarla.
      [elegido] = await pick({ type: [types.allFiles] });
    } catch (error) {
      if (!cancelado(error)) {
        console.error('pick', error);
        Alert.alert('No se pudo abrir el archivo', 'Inténtalo de nuevo.');
      }
      return;
    }

    this.setState({ ocupado: 'Revisando la copia…' });
    let copia;
    try {
      // Android entrega un content://, que SQLite no puede abrir: primero se
      // trae una copia a la caché de la app.
      const [local] = await keepLocalCopy({
        files:       [{ uri: elegido.uri, fileName: elegido.name ?? 'copia.db' }],
        destination: 'cachesDirectory',
      });
      if (local.status !== 'success') throw new Error(local.copyError);
      copia = await revisarCopia(local.localUri, { mover: true });
    } catch (error) {
      this.mostrarErrorCopia(error);
      return;
    } finally {
      this.setState({ ocupado: null });
    }

    const { nombreTienda, productos, ventas, ultimaVenta, fechaCopia } = copia.resumen;
    const lineas = [
      `Tienda: ${nombreTienda}`,
      `${productos} productos · ${ventas} ventas`,
      ultimaVenta ? `Última venta: ${fechaHora(ultimaVenta)}` : 'Sin ventas',
      fechaCopia ? `Copia del ${fechaHora(fechaCopia)}` : null,
    ].filter(Boolean);
    // Teléfono recién instalado: no hay nada que reemplazar ni que guardar
    // (backup.js tampoco guarda el "antes" si la app está vacía).
    const { products, clientes } = this.context;
    const appVacia = !products.length && !clientes.length;
    Alert.alert(
      appVacia ? '¿Importar estos datos?' : '¿Reemplazar tus datos?',
      appVacia
        ? lineas.join('\n')
        : `${lineas.join('\n')}\n\nEsto reemplazará TODOS los datos de este teléfono por los de la copia. Tus datos actuales se guardarán y podrás volver a ellos con "Deshacer última importación".`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => descartarCopia(copia) },
        {
          text: appVacia ? 'Importar' : 'Reemplazar',
          style: appVacia ? 'default' : 'destructive',
          onPress: () => this.context.importarCopia(copia),
        },
      ],
      { cancelable: true, onDismiss: () => descartarCopia(copia) },
    );
  };

  deshacerImportacion = async () => {
    this.setState({ ocupado: 'Revisando tus datos anteriores…' });
    let copia;
    try {
      copia = await revisarCopia(RUTA_ANTES_DE_IMPORTAR);
    } catch (error) {
      this.mostrarErrorCopia(error);
      return;
    } finally {
      this.setState({ ocupado: null });
    }
    const { productos, ventas } = copia.resumen;
    Alert.alert(
      '¿Deshacer la última importación?',
      `Volverás a tus datos de antes de importar (${productos} productos · ${ventas} ventas).\n\nLos datos actuales se guardarán, por si cambias de opinión.`,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => descartarCopia(copia) },
        { text: 'Deshacer', style: 'destructive', onPress: () => this.context.importarCopia(copia, { deshacer: true }) },
      ],
      { cancelable: true, onDismiss: () => descartarCopia(copia) },
    );
  };

  mostrarErrorCopia = error => {
    if (error instanceof ErrorCopia) {
      Alert.alert('No se puede usar esta copia', error.message);
    } else {
      console.error('revisarCopia', error);
      Alert.alert('No se pudo leer el archivo', 'Inténtalo de nuevo o prueba con otra copia.');
    }
  };

  // ─── Borrar todos los datos ────────────────────────────────────────────
  // Paso 1 (aquí): qué se perdería + ofrecer exportar antes.
  // Paso 2 (DeleteDataModal): escribir BORRAR.

  borrarDatos = async () => {
    let resumen;
    try {
      resumen = await resumenDatos();
    } catch (error) {
      console.error('resumenDatos', error);
      Alert.alert('No se pudo continuar', 'Inténtalo de nuevo.');
      return;
    }
    if (resumen.vacia) {
      Alert.alert('No hay datos que borrar', 'La app ya está como recién instalada.');
      return;
    }
    Alert.alert(
      '¿Borrar todos los datos?',
      `Se borrarán ${listaDatos(resumen)}, además del historial de actividad. ` +
        'Se conservan el nombre de la tienda y la moneda.\n\n' +
        'Esto no se puede deshacer. Si crees que podrías necesitarlos, exporta una copia antes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Exportar primero', onPress: this.exportar },
        { text: 'Continuar', style: 'destructive', onPress: () => this.setState({ confirmandoBorrado: true }) },
      ],
    );
  };

  confirmarBorrado = () => {
    this.setState({ confirmandoBorrado: false });
    // Vuelve a LoadingScreen: esta pantalla se desmonta (ver reemplazarDatos).
    this.context.vaciarTodo();
  };

  // ─── Desarrollo ────────────────────────────────────────────────────────

  confirmarDesarrollo = (titulo, mensaje, boton, accion) => {
    Alert.alert(titulo, mensaje, [
      { text: 'Cancelar', style: 'cancel' },
      { text: boton, style: 'destructive', onPress: accion },
    ]);
  };

  renderCard(children) {
    return (
      <View
        style={{
          ...tarjeta,
          paddingHorizontal: spacing.lg,
          marginHorizontal: spacing.lg,
          marginBottom: spacing.lg,
        }}
      >
        {children}
      </View>
    );
  }

  // `peligro`: título en rojo (acciones destructivas).
  renderFila(icono, titulo, subtitulo, onPress = null, { peligro = false } = {}) {
    const activa = onPress !== null;
    const contenido = (
      <>
        <View style={{ width: 40, alignItems: 'center' }}>
          {icono}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: peligro ? colors.danger : colors.textPrimary }}>
            {titulo}
          </Text>
          {!!subtitulo && (
            <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
              {subtitulo}
            </Text>
          )}
        </View>
        {activa ? (
          <IconChevron size={fontSize.itemTitle} color={colors.textMuted} />
        ) : (
          <View
            style={{
              backgroundColor: colors.chipInactive,
              borderRadius: radius.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: 2,
            }}
          >
            <Text style={{ fontSize: fontSize.small, fontWeight: 'bold', color: colors.textSecondary }}>
              Próximamente
            </Text>
          </View>
        )}
      </>
    );

    if (activa) {
      return (
        <TouchableOpacity
          onPress={onPress}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md }}
        >
          {contenido}
        </TouchableOpacity>
      );
    }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, opacity: 0.55 }}>
        {contenido}
      </View>
    );
  }

  renderDivider() {
    return <View style={{ height: 1, backgroundColor: colors.border }} />;
  }

  render() {
    const nav = this.props.navigation;
    const { copia } = this.state;

    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Header titulo="Configuración" onBack={() => nav.goBack()} />

        <ScrollView contentContainerStyle={{ paddingVertical: spacing.lg, paddingBottom: spacing.xxl }}>

          {/* ── Recordatorio de copia (ventas sin respaldar hace DIAS_RECORDATORIO+ días) ── */}
          {!!copia?.recordar && (
            <TouchableOpacity
              onPress={this.exportar}
              style={{
                flexDirection: 'row', alignItems: 'center',
                marginHorizontal: spacing.lg, marginBottom: spacing.lg, padding: spacing.lg,
                borderRadius: radius.md, borderWidth: 1, borderColor: colors.warning,
                backgroundColor: colors.warningSoft,
              }}
            >
              <IconWarning size={22} color={colors.warningDark} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={{ fontSize: fontSize.body, fontWeight: 'bold', color: colors.textPrimary }}>
                  Haz una copia de tus datos
                </Text>
                <Text style={{ fontSize: fontSize.caption, color: colors.textSecondary, marginTop: 2 }}>
                  {copia.ventasSinCopia} {copia.ventasSinCopia === 1 ? 'venta' : 'ventas'} sin respaldar.
                  {' '}Si el teléfono se pierde o se daña, se perderían. Toca para exportar.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* ── Tienda ── */}
          {this.renderCard(
            this.renderFila(<IconStore size={20} />, 'Personalizar la tienda', 'Nombre, moneda, stock bajo',
              () => nav.navigate('TiendaView'),
            ),
          )}

          {/* ── Negocio ── */}
          {this.renderCard(
            <View>
              {this.renderFila(<IconTrendingUp size={20} />, 'Reportes', 'Analítica del negocio',
                () => nav.navigate('Reportes'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconShoppingBag size={20} />, 'Compras', 'Historial de compras a proveedores',
                () => nav.navigate('HistorialCompras'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconPlus size={20} />, 'Registrar compra', 'Nueva compra a proveedor',
                () => nav.navigate('RegistrarCompra'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconCoffee size={20} />, 'Consumo propio', 'Llevarte producto sin registrar venta',
                () => nav.navigate('ConsumoPropioView'),
              )}
              {this.renderDivider()}
              {this.renderFila(<IconClipboard size={20} />, 'Historial de actividad', 'Registro de todos los cambios en la app',
                () => nav.navigate('ActivityLogView'),
              )}
            </View>,
          )}

          {/* ── Datos ── */}
          {this.renderCard(
            <View>
              {this.renderFila(<IconSave size={20} />, 'Exportar información',
                copia ? `Guarda una copia de todos tus datos · ${textoUltimaCopia(copia.diasUltimaCopia)}` : 'Guarda una copia de todos tus datos',
                this.exportar,
              )}
              {this.renderDivider()}
              {this.renderFila(<IconFile size={20} />, 'Importar información', 'Reemplaza tus datos con una copia (p. ej. de otro teléfono)',
                this.importar,
              )}
              {!!this.state.antesDeImportar && (
                <>
                  {this.renderDivider()}
                  {this.renderFila(<IconHistory size={20} />, 'Deshacer última importación',
                    `Volver a tus datos del ${fechaHora(this.state.antesDeImportar)}`,
                    this.deshacerImportacion,
                  )}
                </>
              )}
              {this.renderDivider()}
              {this.renderFila(<IconTrash size={20} color={colors.danger} />, 'Borrar todos los datos',
                'Empezar de cero (conserva el nombre de la tienda y la moneda)',
                this.borrarDatos,
                { peligro: true },
              )}
            </View>,
          )}

          {/* ── Ayuda ── */}
          {this.renderCard(
            this.renderFila(<IconInfo size={20} />, 'Ver tutorial de bienvenida', 'Lo principal de la app en 4 pasos',
              () => nav.navigate('Bienvenida'),
            ),
          )}

          {/* ── Desarrollo (solo en builds de desarrollo) ── */}
          {__DEV__ && this.renderCard(
            <View>
              <Text style={{ fontSize: fontSize.caption, fontWeight: 'bold', color: colors.textSecondary, paddingTop: spacing.md }}>
                DESARROLLO (no aparece en la app publicada)
              </Text>
              {this.renderFila(<IconWarning size={20} />, 'Reiniciar con datos de ejemplo', 'Borra todo y genera un año de tienda',
                () => this.confirmarDesarrollo(
                  '¿Reiniciar con datos de ejemplo?',
                  'Se borrarán TODOS los datos y se generará la semilla (tarda unos segundos).',
                  'Reiniciar',
                  this.context.reiniciarConEjemplos,
                ),
              )}
            </View>,
          )}

        </ScrollView>

        <DeleteDataModal
          visible={this.state.confirmandoBorrado}
          onCancel={() => this.setState({ confirmandoBorrado: false })}
          onConfirmar={this.confirmarBorrado}
        />

        {/* Bloquea la pantalla mientras se prepara o revisa una copia */}
        {!!this.state.ocupado && (
          <View
            style={{
              position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
              backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center',
            }}
          >
            <View style={{ backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.xl, alignItems: 'center', minWidth: 220 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ fontSize: fontSize.body, color: colors.textPrimary, marginTop: spacing.md }}>
                {this.state.ocupado}
              </Text>
            </View>
          </View>
        )}
      </View>
    );
  }
}
