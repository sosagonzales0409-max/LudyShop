import React, { createContext, Component } from 'react';
import { Alert } from 'react-native';
import LoadingScreen from '../ui/LoadingScreen';
import Toast from '../ui/Toast';
import { initDB, getDB, persistir, esperarEscrituras, onErrorPersistencia, getMeta, setMeta } from '../data/db';
import { newId, nowIso } from '../data/ids';
import { nombreProducto, formatoDinero, formatoCantidad } from '../config/formato';
import { debeSembrarAutomatico, sembrarAutomatico, reiniciarConSemilla, vaciarDatos } from '../data/seed';
import { reemplazarConCopia, limpiarTemporales, borrarAntesDeImportar, ErrorCopia } from '../data/respaldo';
import { prepararTienda, cargarConfig, guardarConfig, CONFIG_POR_DEFECTO } from '../data/repositories/tienda';
import { cargarCategorias, crearCategoria, renombrarCategoria, eliminarCategoria } from '../data/repositories/categorias';
import {
  cargarProductos, crearProducto, crearPresentacion, editarPresentacion, editarProducto,
  eliminarPresentacion, eliminarProducto, registrarMovimiento, leerPresentaciones,
} from '../data/repositories/productos';
import {
  cargarClientes, crearCliente, renombrarCliente as renombrarClienteBD, limpiarNombre, normalizarNombre,
} from '../data/repositories/clientes';
import {
  crearVenta, actualizarTotalesVenta, obtenerVenta, ventasCreditoConSaldo,
  eliminarVenta as eliminarVentaBD, actualizarItemVenta, eliminarItemVenta,
  crearAbono, actualizarMontoAbono,
} from '../data/repositories/ventas';
import {
  crearCompra, obtenerCompra, editarCompra as editarCompraBD, eliminarCompra as eliminarCompraBD,
} from '../data/repositories/compras';
import { crearEvento } from '../data/repositories/log';

// Los datos de ejemplo viven en src/data/seed.js y se cargan en SQLite;
// el estado inicial ahora se hidrata desde la BD al arrancar (ver arrancar()).

// Pseudo-categoría de la UI (filtro "todas"). No se guarda en la BD.
const CATEGORIA_TODOS = { id: 0, nombre: 'Todos' };

// ─── Ayudantes ────────────────────────────────────────────────────────────────

// Evento del registro de actividad (se guarda en la BD con crearEvento).
const nuevoEvento = (tipo, desc) => ({ id: newId(), tipo, desc, fecha: nowIso() });

// Parte final del evento de una venta eliminada o devuelta: dice "stock
// devuelto" solo si de verdad volvió algo al inventario, y nombra los
// productos que no tenían a dónde volver (presentación eliminada).
const textoStock = (devolverStock, entradas, itemsNoEncontrados) => {
  if (!devolverStock) return '';
  const partes = [];
  if (entradas.length) partes.push('stock devuelto');
  if (itemsNoEncontrados.length) {
    partes.push(`sin stock que devolver: ${itemsNoEncontrados.map(i => nombreProducto(i.nombre, i.tamano)).join(', ')} (producto eliminado)`);
  }
  return partes.map(p => ` · ${p}`).join('');
};

// Misma regla que la BD (ROUND(stock, 3) en registrarMovimiento): memoria y
// disco deben calcular igual o divergen con los decimales del granel.
const redondearStock = n => Math.round(n * 1000) / 1000;

// Reloj de alta resolución para las mediciones de rendimiento (solo desarrollo).
const ahoraMs = () => global.performance?.now?.() ?? Date.now();

// ─── Tipos y meta del log ─────────────────────────────────────────────────────

export const LOG_TIPOS = {
  VENTA:                  'venta',
  VENTA_CREDITO:          'venta_credito',
  ABONO:                  'abono',
  ABONO_EDITADO:          'abono_editado',
  CONDONACION:            'condonacion',
  DEVOLUCION:             'devolucion',
  VENTA_ELIMINADA:        'venta_eliminada',
  COMPRA:                 'compra',
  COMPRA_EDITADA:         'compra_editada',
  COMPRA_ELIMINADA:       'compra_eliminada',
  PRECIO_EDITADO:         'precio_editado',
  STOCK_AGREGADO:         'stock_agregado',
  STOCK_AJUSTADO:         'stock_ajustado',
  CONSUMO_PROPIO:         'consumo_propio',
  PRODUCTO_NUEVO:         'producto_nuevo',
  PRODUCTO_EDITADO:       'producto_editado',
  PRESENTACION_NUEVA:     'presentacion_nueva',
  PRESENTACION_ELIMINADA: 'presentacion_eliminada',
  CLIENTE_RENOMBRADO:     'cliente_renombrado',
  CATEGORIA_CREADA:       'categoria_creada',
  CATEGORIA_RENOMBRADA:   'categoria_renombrada',
  CATEGORIA_ELIMINADA:    'categoria_eliminada',
  COPIA_EXPORTADA:        'copia_exportada',
  DATOS_IMPORTADOS:       'datos_importados',
  DATOS_BORRADOS:         'datos_borrados',
};

export const LOG_META = {
  venta:                  { icono: '🛒', filtro: 'ventas',     label: 'Venta' },
  venta_credito:          { icono: '💳', filtro: 'creditos',   label: 'Venta a crédito' },
  abono:                  { icono: '💵', filtro: 'creditos',   label: 'Abono' },
  abono_editado:          { icono: '✏️', filtro: 'creditos',   label: 'Abono editado' },
  condonacion:            { icono: '🤝', filtro: 'creditos',   label: 'Condonación' },
  devolucion:             { icono: '↩️', filtro: 'ventas',     label: 'Devolución' },
  venta_eliminada:        { icono: '🗑️', filtro: 'ventas',     label: 'Venta eliminada' },
  compra:                 { icono: '🛍️', filtro: 'compras',    label: 'Compra' },
  compra_editada:         { icono: '✏️', filtro: 'compras',    label: 'Compra editada' },
  compra_eliminada:       { icono: '🗑️', filtro: 'compras',    label: 'Compra eliminada' },
  precio_editado:         { icono: '🏷️', filtro: 'inventario', label: 'Precio editado' },
  stock_agregado:         { icono: '📦', filtro: 'inventario', label: 'Stock agregado' },
  stock_ajustado:         { icono: '🔧', filtro: 'inventario', label: 'Stock ajustado' },
  consumo_propio:         { icono: '🔸', filtro: 'inventario', label: 'Consumo propio' },
  producto_nuevo:         { icono: '✨', filtro: 'inventario', label: 'Producto nuevo' },
  producto_editado:       { icono: '✏️', filtro: 'inventario', label: 'Producto editado' },
  presentacion_nueva:     { icono: '➕', filtro: 'inventario', label: 'Presentación nueva' },
  presentacion_eliminada: { icono: '🗑️', filtro: 'inventario', label: 'Presentación eliminada' },
  cliente_renombrado:     { icono: '👤', filtro: 'otros',      label: 'Cliente renombrado' },
  categoria_creada:       { icono: '🏷️', filtro: 'otros',      label: 'Categoría creada' },
  categoria_renombrada:   { icono: '✏️', filtro: 'otros',      label: 'Categoría renombrada' },
  categoria_eliminada:    { icono: '🗑️', filtro: 'otros',      label: 'Categoría eliminada' },
  copia_exportada:        { icono: '💾', filtro: 'otros',      label: 'Copia de seguridad' },
  datos_importados:       { icono: '📥', filtro: 'otros',      label: 'Datos importados' },
  datos_borrados:         { icono: '🧹', filtro: 'otros',      label: 'Datos borrados' },
};

// ─── Utilidad: normalizar presentación con defaults de nuevos campos ──────────
// Garantiza retrocompatibilidad: presentaciones viejas sin precioCompra/esGranel
// funcionan igual que antes.

const normalizarPresentacion = pres => ({
  precioCompra: null,
  esGranel: false,
  unidadGranel: null,
  ...pres,
});

// ¿Sigue viva la presentación de este ítem? `actuales` es el mapa
// { presentacionId: { productId, stock, precioCompra } } que da
// leerPresentaciones (BD) o presentacionesEnMemoria.
const existeEn = (actuales, item) => actuales[item.presentacionId]?.productId === item.productId;

/**
 * Aplica al catálogo en memoria el efecto que ya se guardó en la BD:
 *   movimientos: [{ presentacionId, cantidad(±) }]  → se SUMAN al stock
 *   precios:     [{ presentacionId, precioCompra }] → valor final
 * Diferencias y no valores absolutos: si entre la decisión y este setState
 * se vendió algo, las dos cosas se suman bien (igual que ROUND(stock + ?) en
 * registrarMovimiento).
 */
const aplicarEfecto = (products, { movimientos = [], precios = [] }) => products.map(p => ({
  ...p,
  presentaciones: p.presentaciones.map(pres => {
    const delta = movimientos
      .filter(m => m.presentacionId === pres.id)
      .reduce((suma, m) => suma + m.cantidad, 0);
    const precio = precios.find(x => x.presentacionId === pres.id);
    if (!delta && !precio) return pres;
    return normalizarPresentacion({
      ...pres,
      stock: redondearStock(pres.stock + delta),
      ...(precio ? { precioCompra: precio.precioCompra } : {}),
    });
  }),
}));

export const StoreContext = createContext(null);

export class StoreProvider extends Component {
  // Estado "seco": se hidrata desde SQLite en arrancar(). Mientras
  // cargando = true, render() muestra LoadingScreen en vez de la app.
  // Solo lo pequeño vive en memoria (catálogo, clientes, config). Ventas,
  // abonos, compras y el registro de actividad se consultan bajo demanda
  // (src/data/consultas/ y los repositorios), y las acciones que los
  // necesitan los leen dentro de su transacción (ver decidirEnBD).
  state = {
    cargando:    true,
    errorCarga:  null,
    mensajeCarga: null, // texto de LoadingScreen al reemplazar los datos
    products:    [],
    categories:  [],   // sin "Todos": se agrega en render()
    clientes:    [],
    config:      CONFIG_POR_DEFECTO,
    // Carrusel de bienvenida (WelcomeScreen): true si este teléfono aún no
    // lo ha visto. Se guarda en la tabla meta (dato del dispositivo, no va en
    // las copias de seguridad).
    mostrarBienvenida: false,
    // Avisos de primera vez ya cerrados (AvisoPrimeraVez): { pista_creditos: true, … }.
    // Se cargan UNA vez al arrancar para que el aviso salga desde el primer
    // dibujado de la pantalla, sin consultar la BD en cada una.
    pistasVistas: {},
  };

  // ─── Arranque e hidratación ───────────────────────────────────────────────

  componentDidMount() {
    // Si una escritura en segundo plano falla, la BD es la fuente de verdad:
    // avisar y recargar el estado desde ella.
    onErrorPersistencia(() => {
      Alert.alert('No se pudo guardar', 'El último cambio no se guardó. Se recargarán los datos.');
      this.recargarDesdeBD().catch(error => console.error('recargarDesdeBD', error));
    });
    // componentDidMount no puede esperar promesas: arrancar() atrapa sus
    // propios errores y los muestra en LoadingScreen.
    
    this.arrancar();
  }

  componentWillUnmount() {
    onErrorPersistencia(null);
  }

  arrancar = async () => {
    this.setState({ cargando: true, errorCarga: null });
    // Medición de rendimiento (solo desarrollo): tiempos en la consola de Metro.
    const t0 = ahoraMs();
    const tiempos = __DEV__ ? { inicio: t0 } : null;
    try {
      await initDB();                       // abrir + migraciones
      if (tiempos) tiempos.initDB = ahoraMs() - t0;
      this.tiendaId = await prepararTienda(); // crear tienda en el 1er arranque
      if (await debeSembrarAutomatico()) {  // solo __DEV__, una vez por instalación
        const tSemilla = ahoraMs();
        await persistir(sembrarAutomatico, 'semilla');
        if (tiempos) tiempos.semilla = ahoraMs() - tSemilla;
      }
      // Antes de recargarDesdeBD: ese setState quita LoadingScreen, y el
      // router decide con este valor si abre la bienvenida.
      const bienvenidaVista = await getMeta('onboarding_hecho');
      const { rows: pistas } = await getDB().execute(
        'SELECT clave FROM meta WHERE clave LIKE ? AND valor IS NOT NULL', ['pista_%'],
      );
      this.setState({
        mostrarBienvenida: !bienvenidaVista,
        pistasVistas: Object.fromEntries(pistas.map(p => [p.clave, true])),
      });
      await this.recargarDesdeBD(tiempos);
      // Copias exportadas/importadas que quedaron en la caché. En segundo
      // plano: no retrasa el arranque y nunca falla.
      limpiarTemporales();
    } catch (error) {
      console.error('arrancar', error);
      this.setState({ cargando: false, errorCarga: error?.message ?? String(error) });
    }
  };

  // Lee de SQLite (en paralelo) lo que vive en memoria y reemplaza el estado.
  // `tiempos` (solo desarrollo): registra cuándo terminó cada carga y el
  // primer dibujado, para medir el arranque.
  recargarDesdeBD = async (tiempos = null) => {
    const t0 = ahoraMs();
    const medir = (nombre, promesa) => (tiempos
      ? promesa.then(r => { tiempos[nombre] = ahoraMs() - t0; return r; })
      : promesa);
    const [config, categories, products, clientes] = await Promise.all([
      medir('config', cargarConfig(this.tiendaId)),
      medir('categorias', cargarCategorias()),
      medir('productos', cargarProductos()),
      medir('clientes', cargarClientes()),
    ]);
    const tCargas = ahoraMs() - t0;
    this.setState({
      cargando: false, errorCarga: null,
      config, categories, products, clientes,
    }, () => {
      if (!tiempos) return;
      const ms = n => `${Math.round(n)} ms`;
      const heap = global.HermesInternal?.getInstrumentedStats?.()?.js_heapSize;
      console.log(
        `[rendimiento] arranque · en memoria solo ${products.length} productos y ${clientes.length} clientes (ventas/compras bajo demanda)\n` +
        `  initDB ${ms(tiempos.initDB)}${tiempos.semilla != null ? ` · semilla ${ms(tiempos.semilla)}` : ''}\n` +
        `  cargas (terminó a los…): ${['config', 'categorias', 'productos', 'clientes'].map(k => `${k} ${ms(tiempos[k])}`).join(' · ')}\n` +
        `  todas las cargas ${ms(tCargas)} · + primer dibujado ${ms(ahoraMs() - t0 - tCargas)} · TOTAL del arranque ${ms(ahoraMs() - tiempos.inicio)}` +
        (heap ? `\n  memoria JS (heap) ${(heap / 1048576).toFixed(1)} MB` : ''),
      );
    });
  };

  // ─── Reemplazar todos los datos ───────────────────────────────────────────
  // Importar una copia, deshacer una importación, borrar todos los datos y
  // (en desarrollo) reiniciar con ejemplos cambian TODO. En vez de avisar pantalla por pantalla, se vuelve
  // a LoadingScreen: eso desmonta el árbol de navegación completo, y al
  // recargar se monta de cero (carrito vacío, pestañas en su raíz, ninguna
  // pantalla con ids que ya no existen). Por lo mismo, quien llama no debe
  // tocar su propio estado después: ya no estará montado.
  //
  // `operacion` corre con la cola de escrituras vacía. Devuelve true si salió
  // bien; si falla, avisa con un Alert (los datos no cambiaron: todas las
  // operaciones son una sola transacción).

  reemplazarDatos = async (mensaje, operacion) => {
    this.setState({ cargando: true, errorCarga: null, mensajeCarga: mensaje });
    let fallo = null;
    try {
      await esperarEscrituras();
      await operacion();
    } catch (error) {
      console.error(`reemplazarDatos(${mensaje})`, error);
      fallo = error;
    }
    try {
      // Importar adopta la tienda de la copia: hay que volver a leerla.
      this.tiendaId = await prepararTienda();
      await this.recargarDesdeBD();
    } catch (error) {
      console.error('reemplazarDatos: recargar', error);
      this.setState({ cargando: false, errorCarga: error?.message ?? String(error) });
      return false;
    }
    this.setState({ mensajeCarga: null });
    if (fallo) {
      Alert.alert(
        'No se pudo completar',
        fallo instanceof ErrorCopia ? fallo.message : 'Ocurrió un error. Tus datos no cambiaron.',
      );
      return false;
    }
    return true;
  };

  /**
   * Reemplaza todos los datos por los de una copia ya revisada
   * (respaldo.revisarCopia). `deshacer`: true si es la vuelta a los datos de
   * antes de la última importación (solo cambia los textos).
   */
  importarCopia = async (copia, { deshacer = false } = {}) => {
    const ok = await this.reemplazarDatos(
      deshacer ? 'Recuperando tus datos anteriores…' : 'Importando tus datos…',
      () => reemplazarConCopia(copia),
    );
    if (!ok) return;
    const { nombreTienda, productos, ventas } = copia.resumen;
    this.logEvent(
      LOG_TIPOS.DATOS_IMPORTADOS,
      deshacer
        ? 'Importación deshecha: se recuperaron los datos anteriores'
        : `Datos importados de una copia: ${nombreTienda} · ${productos} productos · ${ventas} ventas`,
    );
    Toast.show(deshacer ? 'Datos anteriores recuperados' : 'Datos importados', 'success');
  };

  // Solo desarrollo (sección "Desarrollo" de SettingsScreen).
  reiniciarConEjemplos = async () => {
    if (await this.reemplazarDatos('Generando datos de ejemplo…', () => getDB().transaction(reiniciarConSemilla))) {
      Toast.show('Datos de ejemplo listos', 'success');
    }
  };

  // "Borrar todos los datos" (Configuración). Conserva la tienda (nombre,
  // moneda, umbral). La advertencia y la confirmación viven en SettingsScreen.
  vaciarTodo = async () => {
    const ok = await this.reemplazarDatos('Borrando datos…', async () => {
      await getDB().transaction(vaciarDatos);
      // Solo si el borrado salió bien (si falla, transaction lanza antes). Y
      // sin lanzar: los datos YA se borraron, el aviso de reemplazarDatos
      // ("tus datos no cambiaron") sería falso.
      await borrarAntesDeImportar().catch(error => console.warn('borrarAntesDeImportar', error));
    });
    if (!ok) return;
    // El registro de actividad también se borró: este es su primer evento.
    this.logEvent(LOG_TIPOS.DATOS_BORRADOS, 'Se borraron todos los datos para empezar de cero');
    Toast.show('Datos borrados', 'success');
  };

  // ─── Log ──────────────────────────────────────────────────────────────────
  // Las acciones guardan su evento EN LA MISMA transacción que su cambio
  // (nuevoEvento + crearEvento). El registro ya no vive en memoria:
  // ActivityLogScreen lo consulta por páginas y se refresca solo al cambiar la
  // tabla activity_log. logEvent queda para los eventos sueltos que
  // registran las pantallas (p. ej. EditProductScreen).

  // Monto con la moneda configurada, para los textos del registro de
  // actividad (antes decían "$" fijo aunque la moneda fuera otra).
  dinero = monto => formatoDinero(monto, this.state.config?.moneda ?? '$');

  logEvent = (tipo, desc) => {
    const evento = nuevoEvento(tipo, desc);
    persistir(tx => crearEvento(tx, evento), 'logEvent');
  };

  // ─── Acciones que deciden en la BD ────────────────────────────────────────
  // Las acciones sobre ventas, abonos y compras ya registradas NO tienen esos
  // datos en memoria: los leen DENTRO de su transacción, calculan y escriben
  // ahí mismo. `decidir(tx)` devuelve { resultado, efecto }:
  //   resultado: lo que la acción devuelve a la pantalla
  //   efecto:    { movimientos, precios } para el catálogo en memoria, que se
  //              aplica solo DESPUÉS del commit (la BD decide; la memoria se
  //              entera después)
  // op-sqlite descarta lo que devuelve el callback de transaction(), por eso
  // la decisión se saca por un cierre (`decision`).
  // Si la escritura falla, persistir ya avisó y recarga desde la BD
  // (onErrorPersistencia): aquí solo se devuelve null.
  decidirEnBD = async (etiqueta, decidir) => {
    let decision = null;
    try {
      await persistir(async tx => { decision = await decidir(tx); }, etiqueta);
    } catch {
      return null;
    }
    if (decision?.efecto) {
      this.setState(prev => ({ products: aplicarEfecto(prev.products, decision.efecto) }));
    }
    return decision?.resultado ?? null;
  };

  // Mismo formato que leerPresentaciones, pero desde el catálogo en memoria
  // (para addCompra, que no necesita leer historial).
  presentacionesEnMemoria = () => {
    const resultado = {};
    this.state.products.forEach(p => p.presentaciones.forEach(pres => {
      resultado[pres.id] = { productId: p.id, stock: pres.stock, precioCompra: pres.precioCompra ?? null };
    }));
    return resultado;
  };

  // ─── Configuración ────────────────────────────────────────────────────────

  // Al cerrar el carrusel de bienvenida (por cualquier camino). Si se abrió
  // otra vez desde Configuración ya está marcado: no hay nada que escribir.
  marcarBienvenidaVista = () => {
    if (!this.state.mostrarBienvenida) return;
    this.setState({ mostrarBienvenida: false });
    persistir(tx => setMeta(tx, 'onboarding_hecho', '1'), 'marcarBienvenidaVista');
  };

  // Avisos de primera vez (AvisoPrimeraVez, claves 'pista_<pantalla>'). Se
  // guardan en meta: dato del teléfono, no va en las copias de seguridad.
  marcarPistaVista = clave => {
    if (this.state.pistasVistas[clave]) return;
    this.setState(prev => ({ pistasVistas: { ...prev.pistasVistas, [clave]: true } }));
    persistir(tx => setMeta(tx, clave, '1'), 'marcarPistaVista');
  };

  updateConfig = cambios => {
    this.setState(prev => ({ config: { ...prev.config, ...cambios } }));
    persistir(tx => guardarConfig(tx, this.tiendaId, cambios), 'updateConfig');
  };

  // ─── Productos ────────────────────────────────────────────────────────────

  /**
   * Compra que acompaña el alta de una presentación nueva ("registrar como
   * compra" en AddProductScreen). Antes la pantalla llamaba a addCompra
   * por separado y fallaba: adivinaba el id de la presentación y validaba
   * contra un estado que aún no incluía el producto recién creado.
   * Devuelve null si no aplica (sin datos de compra, stock o costo en 0).
   *   datosCompra: { proveedor, tipoPago?, notas?, paquete? }
   *     paquete: { piezasPaquete, precioPaquete, numPaquetes } si se compró
   *              por paquete/reja (o bulto, en granel): se guarda el desglose
   *              para que el historial muestre "Paquete de 8 × $232.00"
   */
  armarCompraDeAlta = (productId, pres, nombre, datosCompra) => {
    if (!datosCompra || !(pres.stock > 0) || !(pres.precioCompra > 0)) return null;
    const subtotal = Math.round(pres.stock * pres.precioCompra * 100) / 100;
    return {
      id:        newId(),
      fecha:     nowIso(),
      proveedor: datosCompra.proveedor,
      tipoPago:  datosCompra.tipoPago ?? 'Contado',
      notas:     datosCompra.notas ?? `Alta de producto: ${nombreProducto(nombre, pres.tamano)}`,
      total:     subtotal,
      items: [{
        id: newId(), productId, presentacionId: pres.id, nombre, tamano: pres.tamano,
        cantidad: pres.stock, costoUnitario: pres.precioCompra, subtotal,
        precioCompraAnterior: null, // presentación nueva: no había costo anterior
        ...(datosCompra.paquete ?? {}),
      }],
    };
  };

  eventoDeCompra = compra => {
    const moneda = this.state.config?.moneda ?? '$';
    const nProd = compra.items.length;
    return nuevoEvento(
      LOG_TIPOS.COMPRA,
      `Compra ${moneda}${compra.total.toFixed(2)} · ${nProd} ${nProd === 1 ? 'producto' : 'productos'} · ${compra.proveedor || 'Sin proveedor'} (${compra.tipoPago})`,
    );
  };

  /**
   * Guarda una presentación nueva. Sin compra, su stock entra como movimiento
   * 'inicial'. Con compra, se inserta con stock 0 y el stock entra UNA vez
   * como movimiento 'compra' ligado a esa compra (así no se duplica).
   */
  persistirPresentacionNueva = async (tx, productId, pres, compraAlta) => {
    await crearPresentacion(tx, productId, compraAlta ? { ...pres, stock: 0 } : pres);
    if (compraAlta) {
      await crearCompra(tx, compraAlta);
      await registrarMovimiento(tx, { presentacionId: pres.id, cantidad: pres.stock, tipo: 'compra', refId: compraAlta.id, fecha: compraAlta.fecha });
    }
  };

  /**
   * Agrega un producto nuevo con su primera presentación.
   * Campos nuevos aceptados: precioCompra, esGranel, unidadGranel.
   * datosCompra (opcional): { proveedor, tipoPago?, notas? } para registrar el
   * stock inicial como una compra, todo en la misma transacción.
   */
  addProduct = (product, datosCompra = null) => {
    const {
      nombre, marca, categoriaId,
      tamano, precio, precioCompra = null, stock,
      esGranel = false, unidadGranel = null,
    } = product;

    const pres = normalizarPresentacion({ id: newId(), tamano, precio, precioCompra, stock, esGranel, unidadGranel });
    const newProduct = { id: newId(), nombre, marca, categoriaId, presentaciones: [pres] };
    const compraAlta = this.armarCompraDeAlta(newProduct.id, pres, nombre, datosCompra);

    const eventos = [nuevoEvento(
      LOG_TIPOS.PRODUCTO_NUEVO,
      `Nuevo producto: ${nombreProducto(nombre, tamano)}${marca ? ` (${marca})` : ''} · stock inicial ${stock}${precioCompra ? ` · costo ${this.dinero(precioCompra)}` : ''}`,
    )];
    if (compraAlta) eventos.push(this.eventoDeCompra(compraAlta));

    this.setState(prev => ({
      products:    [...prev.products, newProduct],
    }));
    persistir(async tx => {
      await crearProducto(tx, { ...newProduct, presentaciones: [] });
      await this.persistirPresentacionNueva(tx, newProduct.id, pres, compraAlta);
      for (const evento of eventos) await crearEvento(tx, evento);
    }, 'addProduct');
    return newProduct;
  };

  /**
   * Edita los datos del PRODUCTO (nombre, marca, categoría), no de sus
   * presentaciones. Es la forma de reasignar la categoría (p. ej. para poder
   * borrar una categoría en uso). Las ventas y compras viejas conservan el
   * nombre anterior en su "foto", como debe ser.
   * Devuelve { ok: true } o { ok: false, error } para que la pantalla avise.
   */
  updateProduct = (productId, cambios) => {
    const product = this.state.products.find(p => p.id === productId);
    if (!product) return { ok: false, error: 'El producto ya no existe.' };

    const nombre = (cambios.nombre ?? product.nombre).trim();
    const marca = (cambios.marca ?? product.marca).trim();
    const categoriaId = cambios.categoriaId ?? product.categoriaId;

    if (!nombre) return { ok: false, error: 'El nombre no puede quedar vacío.' };
    // La marca es opcional (granel, tortillas, pan del día…).
    if (!this.state.categories.some(c => String(c.id) === String(categoriaId))) {
      return { ok: false, error: 'Selecciona una categoría válida.' };
    }
    // Misma regla de duplicado que el alta (AddProductScreen): nombre + marca.
    const duplicado = this.state.products.some(p =>
      p.id !== productId &&
      p.nombre.trim().toLowerCase() === nombre.toLowerCase() &&
      p.marca.trim().toLowerCase() === marca.toLowerCase(),
    );
    if (duplicado) return { ok: false, error: marca ? `Ya existe otro producto "${nombre}" de ${marca}.` : `Ya existe otro producto "${nombre}" sin marca.` };

    const cambiosReales = {};
    if (nombre !== product.nombre) cambiosReales.nombre = nombre;
    if (marca !== (product.marca ?? '')) cambiosReales.marca = marca;
    if (String(categoriaId) !== String(product.categoriaId)) cambiosReales.categoriaId = categoriaId;
    if (!Object.keys(cambiosReales).length) return { ok: true }; // sin cambio real: nada que guardar

    const nombreCat = id => this.state.categories.find(c => String(c.id) === String(id))?.nombre ?? '—';
    const detalle = [
      cambiosReales.nombre && `nombre "${product.nombre}" → "${nombre}"`,
      cambiosReales.marca !== undefined && `marca ${product.marca ? `"${product.marca}"` : '(sin marca)'} → ${marca ? `"${marca}"` : '(sin marca)'}`,
      cambiosReales.categoriaId && `categoría ${nombreCat(product.categoriaId)} → ${nombreCat(categoriaId)}`,
    ].filter(Boolean).join(' · ');
    const evento = nuevoEvento(LOG_TIPOS.PRODUCTO_EDITADO, `Producto editado: ${detalle}`);

    this.setState(prev => ({
      products:    prev.products.map(p => p.id === productId ? { ...p, ...cambiosReales } : p),
    }));
    persistir(async tx => {
      await editarProducto(tx, productId, cambiosReales);
      await crearEvento(tx, evento);
    }, 'updateProduct');
    return { ok: true };
  };

  /**
   * Agrega una presentación nueva a un producto existente.
   * Acepta precioCompra, esGranel, unidadGranel, y datosCompra como addProduct.
   */
  addPresentacion = (productId, presentacion, datosCompra = null) => {
    const { tamano, precio, precioCompra = null, stock, esGranel = false, unidadGranel = null } = presentacion;
    const nueva = normalizarPresentacion({ id: newId(), tamano, precio, precioCompra, stock, esGranel, unidadGranel });
    const product = this.state.products.find(p => p.id === productId);
    const compraAlta = this.armarCompraDeAlta(productId, nueva, product?.nombre ?? '', datosCompra);

    const eventos = [nuevoEvento(
      LOG_TIPOS.PRESENTACION_NUEVA,
      `Nueva presentación: ${nombreProducto(product?.nombre ?? productId, tamano)} · ${this.dinero(precio)}${precioCompra ? ` (costo ${this.dinero(precioCompra)})` : ''} · stock ${stock}`,
    )];
    if (compraAlta) eventos.push(this.eventoDeCompra(compraAlta));

    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId ? { ...p, presentaciones: [...p.presentaciones, nueva] } : p,
      ),
    }));
    persistir(async tx => {
      await this.persistirPresentacionNueva(tx, productId, nueva, compraAlta);
      for (const evento of eventos) await crearEvento(tx, evento);
    }, 'addPresentacion');
    return nueva;
  };

  /**
   * Edita campos de una presentación existente.
   * Ahora acepta precioCompra, esGranel, unidadGranel además de precio y stock.
   * Solo genera log si precio o stock cambiaron — los demás cambios son silenciosos.
   *
   * El stock llega como valor absoluto ("ahora hay 15"); en la BD se guarda
   * como movimiento 'ajuste' con la diferencia (15 − 10 = +5).
   * razonAjuste (opcional): se agrega al evento de stock ajustado, en vez de
   * registrar un segundo evento aparte.
   */
  updatePresentacion = (productId, presentacionId, cambios, razonAjuste = '') => {
    const product = this.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    if (!pres) return;

    const eventos = [];
    if (cambios.precio !== undefined && cambios.precio !== pres.precio) {
      eventos.push(nuevoEvento(LOG_TIPOS.PRECIO_EDITADO, `${nombreProducto(product?.nombre, pres.tamano)}: ${this.dinero(pres.precio)} → ${this.dinero(Number(cambios.precio))}`));
    }
    const delta = cambios.stock !== undefined ? redondearStock(cambios.stock - pres.stock) : 0;
    if (delta !== 0) {
      const razon = razonAjuste.trim() ? ` · Razón: ${razonAjuste.trim()}` : '';
      eventos.push(nuevoEvento(LOG_TIPOS.STOCK_AJUSTADO, `Stock ajustado: ${nombreProducto(product?.nombre, pres.tamano)} · ${pres.stock} → ${cambios.stock} uds${razon}`));
    }

    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pr => pr.id === presentacionId ? normalizarPresentacion({ ...pr, ...cambios }) : pr) }
          : p,
      ),
    }));
    persistir(async tx => {
      await editarPresentacion(tx, presentacionId, cambios); // ignora `stock` a propósito
      await registrarMovimiento(tx, { presentacionId, cantidad: delta, tipo: 'ajuste' });
      for (const evento of eventos) await crearEvento(tx, evento);
    }, 'updatePresentacion');
  };

  agregarStock = (productId, presentacionId, cantidad) => {
    const product = this.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    const evento = nuevoEvento(
      LOG_TIPOS.STOCK_AGREGADO,
      `+${cantidad} ${pres?.esGranel ? (pres?.unidadGranel ?? 'uds') : 'uds'} · ${nombreProducto(product?.nombre ?? productId, pres?.tamano)} (stock anterior: ${pres?.stock ?? '?'})`,
    );
    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pr => pr.id === presentacionId ? { ...pr, stock: redondearStock(pr.stock + cantidad) } : pr) }
          : p,
      ),
    }));
    persistir(async tx => {
      await registrarMovimiento(tx, { presentacionId, cantidad, tipo: 'ajuste' });
      await crearEvento(tx, evento);
    }, 'agregarStock');
  };

  deletePresentacion = (productId, presentacionId) => {
    const product = this.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    // Si era la última presentación, el producto también desaparece.
    const eraLaUltima = product?.presentaciones.length === 1;
    const evento = nuevoEvento(LOG_TIPOS.PRESENTACION_ELIMINADA, `Eliminada: ${nombreProducto(product?.nombre ?? productId, pres?.tamano)}`);
    this.setState(prev => ({
      products: prev.products
        .map(p => p.id === productId ? { ...p, presentaciones: p.presentaciones.filter(pr => pr.id !== presentacionId) } : p)
        .filter(p => p.presentaciones.length > 0),
    }));
    persistir(async tx => {
      await eliminarPresentacion(tx, presentacionId);
      if (eraLaUltima) await eliminarProducto(tx, productId);
      await crearEvento(tx, evento);
    }, 'deletePresentacion');
  };

  /**
   * Descuenta stock. Hoy solo lo usa OwnConsumptionScreen (esConsumoPropio =
   * true, registra su evento). Las ventas descuentan su stock dentro de
   * addSale, en la misma transacción que la venta.
   */
  decreaseStock = (items, esConsumoPropio = false) => {
    let evento = null;
    if (esConsumoPropio) {
      const resumen = items.map(i => {
        const product = this.state.products.find(p => p.id === i.productId);
        const pres = product?.presentaciones.find(pr => pr.id === i.presentacionId);
        const unidad = pres?.esGranel ? (pres?.unidadGranel ?? '') : '×';
        return `${i.cantidad}${pres?.esGranel ? ' ' + unidad : ' ×'} ${nombreProducto(product?.nombre ?? i.productId, pres?.tamano)}`;
      }).join(', ');
      evento = nuevoEvento(LOG_TIPOS.CONSUMO_PROPIO, `Consumo propio: ${resumen}`);
    }
    this.setState(prev => ({
      products: prev.products.map(p => ({
        ...p,
        presentaciones: p.presentaciones.map(pres => {
          const match = items.find(i => i.productId === p.id && i.presentacionId === pres.id);
          return match ? { ...pres, stock: redondearStock(pres.stock - match.cantidad) } : pres;
        }),
      })),
    }));
    persistir(async tx => {
      for (const item of items) {
        await registrarMovimiento(tx, {
          presentacionId: item.presentacionId,
          cantidad:       -item.cantidad,
          tipo:           esConsumoPropio ? 'consumo' : 'venta',
        });
      }
      if (evento) await crearEvento(tx, evento);
    }, 'decreaseStock');
  };

  // ─── Compras ──────────────────────────────────────────────────────────────

  /**
   * Cálculo único que usan addCompra, editarCompra y eliminarCompra.
   * Función pura: no toca el estado, solo devuelve lo que hay que aplicar.
   *
   *   revertir: ítems de una compra ya registrada cuyo efecto se deshace
   *             (stock − cantidad, sin bajar de 0; precioCompra restaurado si
   *             nadie lo cambió después de esa compra)
   *   aplicar:  ítems cuyo efecto se aplica (stock + cantidad, precioCompra =
   *             costoUnitario). Se les agrega id y precioCompraAnterior.
   *
   *   actuales: { presentacionId: { productId, stock, precioCompra } } —
   *             de la BD (leerPresentaciones, dentro de la transacción) o de
   *             memoria (presentacionesEnMemoria, en addCompra)
   *
   * Devuelve { movimientos, precios, itemsAplicados }:
   *   movimientos: [{ presentacionId, cantidad, tipo }] con la diferencia REAL
   *                de stock (si el tope de 0 recortó la reversión, se registra
   *                lo que de verdad bajó, para que SUM(movimientos) = stock)
   *   precios:     [{ presentacionId, precioCompra }] final de cada presentación tocada
   * (El catálogo en memoria se actualiza aparte con aplicarEfecto.)
   * Como antes, si una presentación aparece dos veces en la misma lista,
   * solo cuenta la primera.
   */
  calcularEfectoCompra = (actuales, revertir = [], aplicar = []) => {
    // Copia de trabajo: la reversión cambia stock/precio antes de aplicar.
    const pres = {};
    Object.entries(actuales).forEach(([id, p]) => { pres[id] = { ...p }; });
    const movimientos = [];
    const tocadas = new Set();

    // 1. Revertir los ítems anteriores
    const revertidas = new Set();
    revertir.forEach(item => {
      if (!existeEn(pres, item) || revertidas.has(item.presentacionId)) return;
      revertidas.add(item.presentacionId);
      const p = pres[item.presentacionId];
      const stock = redondearStock(Math.max(0, p.stock - item.cantidad));
      if (p.precioCompra === item.costoUnitario) p.precioCompra = item.precioCompraAnterior ?? p.precioCompra;
      movimientos.push({ presentacionId: item.presentacionId, cantidad: redondearStock(stock - p.stock), tipo: 'reversion_compra' });
      p.stock = stock;
      tocadas.add(item.presentacionId);
    });

    // 2. Capturar precioCompraAnterior (post-reversión) y aplicar los ítems nuevos
    const itemsAplicados = aplicar.map(item => ({
      ...item,
      id: newId(),
      precioCompraAnterior: existeEn(pres, item) ? pres[item.presentacionId].precioCompra : null,
    }));

    const aplicadas = new Set();
    itemsAplicados.forEach(item => {
      if (!existeEn(pres, item) || aplicadas.has(item.presentacionId)) return;
      aplicadas.add(item.presentacionId);
      const p = pres[item.presentacionId];
      movimientos.push({ presentacionId: item.presentacionId, cantidad: item.cantidad, tipo: 'compra' });
      p.stock = redondearStock(p.stock + item.cantidad);
      p.precioCompra = item.costoUnitario;
      tocadas.add(item.presentacionId);
    });

    const precios = [...tocadas].map(presentacionId => ({
      presentacionId,
      precioCompra: pres[presentacionId].precioCompra ?? null,
    }));

    return { movimientos, precios, itemsAplicados };
  };

  // Guarda en la transacción los movimientos y precios que calculó calcularEfectoCompra.
  persistirEfectoCompra = async (tx, { movimientos, precios }, compraId, fecha) => {
    for (const m of movimientos) {
      await registrarMovimiento(tx, { presentacionId: m.presentacionId, cantidad: m.cantidad, tipo: m.tipo, refId: compraId, fecha });
    }
    for (const p of precios) {
      await editarPresentacion(tx, p.presentacionId, { precioCompra: p.precioCompra });
    }
  };

  /**
   * Registra una compra de mercancía.
   *
   * compra: {
   *   proveedor: string,
   *   tipoPago: 'Contado' | 'Credito',
   *   notas: string,
   *   total: number,
   *   items: [{ productId, presentacionId, nombre, tamano, cantidad, costoUnitario, subtotal,
   *              piezasPaquete?, precioPaquete? }]
   * }
   *
   * `precioCompraAnterior` se agrega internamente a cada ítem guardado (no se
   * espera en el `compra` de entrada) para que `editarCompra` pueda restaurar
   * el precio de compra previo si esta compra se corrige más adelante.
   *
   * Efectos colaterales (memoria y BD, todo o nada):
   *   1. Suma stock a cada presentación involucrada (movimientos 'compra').
   *   2. Actualiza precioCompra de cada presentación con el costoUnitario de esta compra.
   *   3. Registra el evento 'compra'.
   *
   * Si algún ítem referencia un producto/presentación que ya no existe, la
   * función no cambia nada y devuelve null, en vez de guardar la compra a
   * medias con el inventario desincronizado.
   */
  addCompra = compra => {
    // Validar ANTES de tocar cualquier estado.
    const sinPresentacion = compra.items.find(item => !this.existePresentacion(item.productId, item.presentacionId));
    if (sinPresentacion) {
      console.warn('addCompra: presentación no encontrada, compra cancelada', sinPresentacion);
      return null;
    }

    // Una compra nueva no necesita historial: se calcula con el catálogo en
    // memoria y se aplica al momento (como addSale).
    const fecha = nowIso();
    const efecto = this.calcularEfectoCompra(this.presentacionesEnMemoria(), [], compra.items);
    const nuevaCompra = { ...compra, id: newId(), fecha, items: efecto.itemsAplicados };

    const nProd = nuevaCompra.items.length;
    const moneda = this.state.config?.moneda ?? '$';
    const evento = nuevoEvento(
      LOG_TIPOS.COMPRA,
      `Compra ${moneda}${compra.total.toFixed(2)} · ${nProd} ${nProd === 1 ? 'producto' : 'productos'} · ${compra.proveedor || 'Sin proveedor'} (${compra.tipoPago})`,
    );

    this.setState(prev => ({
      products:    aplicarEfecto(prev.products, efecto),
    }));

    persistir(async tx => {
      await crearCompra(tx, nuevaCompra);
      await this.persistirEfectoCompra(tx, efecto, nuevaCompra.id, fecha);
      await crearEvento(tx, evento);
    }, 'addCompra');

    return nuevaCompra;
  };

  /**
   * Edita una compra ya registrada: revierte el efecto en stock/precioCompra
   * de los ítems anteriores y vuelve a aplicar los ítems nuevos, en una sola
   * transacción. En la BD los ítems se REEMPLAZAN (ver repositories/compras.js).
   *
   * El precioCompra solo se restaura al valor anterior si nadie más lo
   * cambió después de esta compra (si ya no coincide con el costoUnitario
   * que esta compra fijó, lo dejamos como está para no pisar un dato más
   * reciente).
   *
   * Asíncrona: la compra y el stock/precio actuales se leen de la BD dentro
   * de la transacción. Devuelve (promesa) true si se guardó, false si la
   * compra o algún producto ya no existe (no se cambia nada), o null si
   * falló la escritura (ya se avisó).
   */
  editarCompra = (compraId, cambios) => this.decidirEnBD('editarCompra', async tx => {
    const compraAnterior = await obtenerCompra(compraId, tx);
    if (!compraAnterior) return { resultado: false };

    const itemsAnteriores = compraAnterior.items ?? [];
    const itemsNuevos = cambios.items ?? [];
    const actuales = await leerPresentaciones(tx, [...itemsAnteriores, ...itemsNuevos].map(i => i.presentacionId));

    // Validar ANTES de escribir — mismo criterio que addCompra: si un ítem
    // nuevo ya no tiene producto/presentación, no se aplica nada.
    const itemInvalido = itemsNuevos.find(item => !existeEn(actuales, item));
    if (itemInvalido) {
      console.warn('editarCompra: presentación no encontrada, edición cancelada', itemInvalido);
      return { resultado: false };
    }

    const efecto = this.calcularEfectoCompra(actuales, itemsAnteriores, itemsNuevos);
    const compraActualizada = { ...compraAnterior, ...cambios, id: compraAnterior.id, items: efecto.itemsAplicados };

    const moneda = this.state.config?.moneda ?? '$';
    const evento = nuevoEvento(
      LOG_TIPOS.COMPRA_EDITADA,
      `Compra editada · ${moneda}${compraActualizada.total.toFixed(2)} · ${compraActualizada.proveedor || 'Sin proveedor'}`,
    );

    await editarCompraBD(tx, compraActualizada); // cabecera + reemplazo de ítems
    await this.persistirEfectoCompra(tx, efecto, compraId, nowIso());
    await crearEvento(tx, evento);
    return { resultado: true, efecto };
  });

  /**
   * Elimina una compra del historial.
   * Si revertirStock es true, descuenta del inventario las cantidades que entró la compra
   * y, cuando es seguro (nadie cambió el precio desde entonces), restaura el
   * precioCompra que tenía la presentación antes de esta compra — misma lógica que
   * usa editarCompra (calcularEfectoCompra).
   * Asíncrona (lee la compra en la transacción). Devuelve (promesa)
   * { itemsNoEncontrados }, o null si la compra ya no existe o falló.
   */
  eliminarCompra = (compraId, revertirStock) => this.decidirEnBD('eliminarCompra', async tx => {
    const compra = await obtenerCompra(compraId, tx);
    if (!compra) return { resultado: null };

    const items = compra.items ?? [];
    const actuales = revertirStock ? await leerPresentaciones(tx, items.map(i => i.presentacionId)) : {};

    // Detectar (sin bloquear el borrado) ítems cuya presentación ya no
    // existe — para esos no hay nada que revertir; se avisa en vez de
    // fallar en silencio.
    const itemsNoEncontrados = revertirStock ? items.filter(item => !existeEn(actuales, item)) : [];

    const efecto = revertirStock
      ? this.calcularEfectoCompra(actuales, items, [])
      : { movimientos: [], precios: [] };

    const moneda = this.state.config?.moneda ?? '$';
    const stock = revertirStock ? ' · stock revertido' : '';
    const evento = nuevoEvento(
      LOG_TIPOS.COMPRA_ELIMINADA,
      `Compra ${moneda}${compra.total.toFixed(2)} eliminada · ${compra.proveedor || 'Sin proveedor'}${stock}`,
    );

    await eliminarCompraBD(tx, compraId); // cascada: compra + ítems
    await this.persistirEfectoCompra(tx, efecto, compraId, nowIso());
    await crearEvento(tx, evento);
    return { resultado: { itemsNoEncontrados }, efecto };
  });

  // ─── Categorías ───────────────────────────────────────────────────────────

  addCategory = nombre => {
    const newCat = { id: newId(), nombre: nombre.trim() };
    const evento = nuevoEvento(LOG_TIPOS.CATEGORIA_CREADA, `Nueva categoría: ${nombre.trim()}`);
    this.setState(prev => ({
      categories:  [...prev.categories, newCat],
    }));
    persistir(async tx => {
      await crearCategoria(tx, newCat);
      await crearEvento(tx, evento);
    }, 'addCategory');
    return newCat;
  };

  // Protegida aquí también (no solo en CategoriesModal): no se permite un
  // nombre que ya tenga OTRA categoría (ni "Todos"). Devuelve true/false.
  renameCategory = (id, nuevoNombre) => {
    if (String(id) === String(CATEGORIA_TODOS.id)) return false;
    const nombreNorm = nuevoNombre.trim().toLowerCase();
    const duplicada = nombreNorm === CATEGORIA_TODOS.nombre.toLowerCase()
      || this.state.categories.some(c => String(c.id) !== String(id) && c.nombre.toLowerCase() === nombreNorm);
    if (!nombreNorm || duplicada) {
      console.warn('renameCategory: nombre vacío o de otra categoría, no se renombra', nuevoNombre);
      return false;
    }
    const cat = this.state.categories.find(c => String(c.id) === String(id));
    const evento = nuevoEvento(LOG_TIPOS.CATEGORIA_RENOMBRADA, `Categoría renombrada: "${cat?.nombre ?? id}" → "${nuevoNombre.trim()}"`);
    this.setState(prev => ({
      categories:  prev.categories.map(c => String(c.id) === String(id) ? { ...c, nombre: nuevoNombre.trim() } : c),
    }));
    persistir(async tx => {
      await renombrarCategoria(tx, id, nuevoNombre.trim());
      await crearEvento(tx, evento);
    }, 'renameCategory');
    return true;
  };

  // Protegida aquí (no solo en CategoriesModal): si algún producto sigue
  // asignado a esta categoría, no se borra — dejaría productos con
  // categoriaId huérfana. Para liberarla, primero se reasignan los productos
  // con updateProduct (botón ✏️ en ProductDetailScreen).
  deleteCategory = id => {
    if (String(id) === String(CATEGORIA_TODOS.id)) return false;
    const enUso = this.state.products.some(p => String(p.categoriaId) === String(id));
    if (enUso) {
      console.warn('deleteCategory: categoría en uso, no se elimina', id);
      return false;
    }
    const cat = this.state.categories.find(c => String(c.id) === String(id));
    const evento = nuevoEvento(LOG_TIPOS.CATEGORIA_ELIMINADA, `Categoría eliminada: ${cat?.nombre ?? id}`);
    this.setState(prev => ({
      categories:  prev.categories.filter(c => String(c.id) !== String(id)),
    }));
    persistir(async tx => {
      await eliminarCategoria(tx, id);
      await crearEvento(tx, evento);
    }, 'deleteCategory');
    return true;
  };

  // ─── Ventas ───────────────────────────────────────────────────────────────
  // addSale sigue el patrón "calcular primero, aplicar después": todo lo que
  // necesita está en memoria (catálogo y clientes), así que calcula una vez y
  // aplica ese resultado en memoria (setState) y en disco (persistir).
  // Las acciones sobre ventas YA registradas (abonar, corregir, condonar,
  // eliminar, devolver) leen la venta de la BD dentro de su transacción
  // (decidirEnBD) y son asíncronas.

  /**
   * Resuelve el nombre escrito a un cliente existente (misma normalización
   * que la BD) o prepara uno nuevo con id ya generado.
   * Devuelve { cliente, clienteNuevo } — clienteNuevo solo si hay que crearlo.
   */
  resolverCliente = nombre => {
    const limpio = limpiarNombre(nombre);
    if (!limpio) return { cliente: null, clienteNuevo: null };
    const norm = normalizarNombre(limpio);
    const existente = this.state.clientes.find(c => normalizarNombre(c.nombre) === norm);
    if (existente) return { cliente: existente, clienteNuevo: null };
    const nuevo = { id: newId(), nombre: limpio };
    return { cliente: nuevo, clienteNuevo: nuevo };
  };

  // ¿Existe (viva) esta presentación en el catálogo en memoria? Si no, no
  // hay a dónde mover stock. (Las acciones que deciden en la BD usan
  // existeEn con leerPresentaciones.)
  existePresentacion = (productId, presentacionId) => {
    const producto = this.state.products.find(p => p.id === productId);
    return !!producto?.presentaciones.find(pr => pr.id === presentacionId);
  };

  /**
   * Registra una venta Y descuenta su stock, todo en una transacción
   * (antes NewSaleScreen.js llamaba a decreaseStock por separado: si la app se cerraba
   * entre las dos, quedaba stock descontado sin venta).
   */
  addSale = sale => {
    const fecha = nowIso();
    const esCredito = sale.tipoPago === 'Credito';
    const { cliente, clienteNuevo } = esCredito ? this.resolverCliente(sale.cliente) : { cliente: null, clienteNuevo: null };

    const newSale = {
      totalAbonado: 0, condonado: 0, ...sale,
      id:        newId(),
      fecha,
      cliente:   cliente?.nombre ?? null,
      clienteId: cliente?.id ?? null,
      // Solo la "foto" del producto; lo demás del carrito (stock,
      // cantidadTexto…) no es parte de la venta.
      productos: (sale.productos ?? []).map(p => ({
        id:             newId(),
        productId:      p.productId,
        presentacionId: p.presentacionId,
        nombre:         p.nombre,
        marca:          p.marca ?? '',
        tamano:         p.tamano ?? '',
        precio:         p.precio,
        precioCompra:   p.precioCompra ?? null,
        esGranel:       !!p.esGranel,
        unidadGranel:   p.unidadGranel ?? null,
        numProducts:    p.numProducts,
        totalPrice:     p.totalPrice,
      })),
    };

    const abonoInicial = newSale.totalAbonado > 0.009
      ? { id: newId(), fecha, clienteId: newSale.clienteId, ventaId: newSale.id, monto: newSale.totalAbonado, tipo: 'abono' }
      : null;

    const salidas = newSale.productos
      .filter(p => this.existePresentacion(p.productId, p.presentacionId))
      .map(p => ({ productId: p.productId, presentacionId: p.presentacionId, cantidad: -p.numProducts }));

    const numProd = newSale.productos.length;
    const evento = esCredito
      ? nuevoEvento(
          LOG_TIPOS.VENTA_CREDITO,
          abonoInicial
            ? `Venta ${this.dinero(newSale.total)} a crédito · ${newSale.cliente} · abono inicial ${this.dinero(newSale.totalAbonado)}`
            : `Venta ${this.dinero(newSale.total)} a crédito · ${newSale.cliente}`,
        )
      : nuevoEvento(LOG_TIPOS.VENTA, `Venta ${this.dinero(newSale.total)} · ${numProd} ${numProd === 1 ? 'producto' : 'productos'} (Contado)`);

    this.setState(prev => ({
      clientes:    clienteNuevo ? [...prev.clientes, clienteNuevo] : prev.clientes,
      products:    aplicarEfecto(prev.products, { movimientos: salidas }),
    }));

    persistir(async tx => {
      if (clienteNuevo) await crearCliente(tx, clienteNuevo);
      await crearVenta(tx, newSale);
      if (abonoInicial) await crearAbono(tx, abonoInicial);
      for (const s of salidas) {
        await registrarMovimiento(tx, { presentacionId: s.presentacionId, cantidad: s.cantidad, tipo: 'venta', refId: newSale.id, fecha });
      }
      await crearEvento(tx, evento);
    }, 'addSale');

    return newSale;
  };

  /**
   * Abono de un cliente: se reparte entre sus ventas a crédito pendientes,
   * liquidando primero las más antiguas (aging real de la deuda).
   * Asíncrona: las ventas con saldo se leen de la BD en la transacción.
   * El cliente se identifica por id (el nombre se resuelve con la misma
   * normalización que la BD); nombre vacío = ventas a crédito sin cliente.
   */
  registrarAbono = (clienteNombre, monto) => {
    const limpio = limpiarNombre(clienteNombre ?? '');
    const cliente = limpio
      ? this.state.clientes.find(c => normalizarNombre(c.nombre) === normalizarNombre(limpio))
      : null;
    if (limpio && !cliente) {
      console.warn('registrarAbono: cliente no encontrado', limpio);
      return Promise.resolve(null);
    }
    const evento = nuevoEvento(LOG_TIPOS.ABONO, `Abono ${this.dinero(monto)} · ${clienteNombre}`);

    return this.decidirEnBD('registrarAbono', async tx => {
      const fecha = nowIso();
      let restante = monto;
      const ventas = await ventasCreditoConSaldo(tx, cliente?.id ?? null);
      for (const sale of ventas) {
        if (restante <= 0) break;
        const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
        if (pendiente <= 0) continue;
        const aplicar = Math.min(pendiente, restante);
        restante -= aplicar;
        await actualizarTotalesVenta(tx, sale.id, { totalAbonado: (sale.totalAbonado ?? 0) + aplicar });
        await crearAbono(tx, { id: newId(), fecha, clienteId: sale.clienteId ?? null, ventaId: sale.id, monto: aplicar, tipo: 'abono' });
      }
      await crearEvento(tx, evento);
      return { resultado: true };
    });
  };

  ajustarAbonoVenta = (saleId, nuevoAbonado) => this.decidirEnBD('ajustarAbonoVenta', async tx => {
    const sale = await obtenerVenta(tx, saleId);
    if (!sale) return { resultado: null };
    const abonoAnterior = sale.totalAbonado ?? 0;

    const techo  = Math.max(0, sale.total - (sale.condonado ?? 0));
    const nuevo  = Math.max(0, Math.min(nuevoAbonado, techo));
    const delta  = nuevo - abonoAnterior;
    if (Math.abs(delta) < 0.0005) return { resultado: true }; // sin cambio real: nada que guardar

    // "Editar abono" es CORREGIR un error de captura (decisión de negocio,
    // sep 2026): la diferencia se aplica a los abonos existentes, del más
    // reciente al más viejo, CONSERVANDO su fecha — el corte de ese día
    // cambia. Solo si la venta no tenía ningún abono se crea uno con fecha de hoy.
    const eventosDeVenta = sale.abonos
      .filter(a => a.tipo === 'abono')
      .sort((x, y) => (x.fecha > y.fecha ? -1 : x.fecha < y.fecha ? 1 : x.id > y.id ? -1 : 1));
    const montosCorregidos = {}; // abonoId -> monto nuevo
    let pendiente = delta;
    for (const a of eventosDeVenta) {
      if (Math.abs(pendiente) < 0.0005) break;
      const cambio = pendiente > 0 ? pendiente : Math.max(pendiente, -a.monto);
      montosCorregidos[a.id] = a.monto + cambio;
      pendiente -= cambio;
    }
    // Sin abonos previos: el dinero se registra hoy (fecha de HOY, no la de
    // la venta), y así lo cuenta el corte de caja del día en que se captura.
    const abonoNuevo = eventosDeVenta.length === 0 && nuevo > 0.0005
      ? { id: newId(), fecha: nowIso(), clienteId: sale.clienteId ?? null, ventaId: sale.id, monto: nuevo, tipo: 'abono' }
      : null;

    const sumaEventos = eventosDeVenta.reduce((s, a) => s + (montosCorregidos[a.id] ?? a.monto), 0) + (abonoNuevo?.monto ?? 0);
    const totalFinal  = sumaEventos >= nuevo - 0.0005 ? nuevo : sumaEventos;

    const evento = nuevoEvento(LOG_TIPOS.ABONO_EDITADO, `Abono corregido ${this.dinero(abonoAnterior)} → ${this.dinero(nuevoAbonado)} · ${sale.cliente ?? 'cliente'}`);

    await actualizarTotalesVenta(tx, sale.id, { totalAbonado: totalFinal });
    for (const [abonoId, monto] of Object.entries(montosCorregidos)) await actualizarMontoAbono(tx, abonoId, monto);
    if (abonoNuevo) await crearAbono(tx, abonoNuevo);
    await crearEvento(tx, evento);
    return { resultado: true };
  });

  condonarVenta = saleId => this.decidirEnBD('condonarVenta', async tx => {
    const sale = await obtenerVenta(tx, saleId);
    if (!sale) return { resultado: null };
    const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
    if (pendiente <= 0.009) return { resultado: true };

    const condonado = (sale.condonado ?? 0) + pendiente;
    const condonacion = { id: newId(), fecha: nowIso(), clienteId: sale.clienteId ?? null, ventaId: sale.id, monto: pendiente, tipo: 'condonacion' };
    const evento = nuevoEvento(LOG_TIPOS.CONDONACION, `Deuda condonada ${this.dinero(pendiente)} · ${sale.cliente ?? 'cliente'}`);

    await actualizarTotalesVenta(tx, sale.id, { condonado });
    await crearAbono(tx, condonacion);
    await crearEvento(tx, evento);
    return { resultado: true };
  });

  /**
   * Elimina una venta (cascada: ítems y abonos) y, si se pide, devuelve su
   * stock. Asíncrona: la venta se lee de la BD en la transacción.
   * Devuelve (promesa) { itemsNoEncontrados }, o null si ya no existe o falló.
   */
  eliminarVenta = (saleId, devolverStock) => this.decidirEnBD('eliminarVenta', async tx => {
    const sale = await obtenerVenta(tx, saleId);
    if (!sale) return { resultado: null };
    const productos = sale.productos ?? [];
    const actuales = devolverStock ? await leerPresentaciones(tx, productos.map(p => p.presentacionId)) : {};

    // Si algún producto de la venta ya no existe en el inventario (se borró
    // la presentación), no hay dónde devolverle el stock — se detecta para
    // avisar en vez de fallar en silencio, igual que en eliminarCompra.
    const itemsNoEncontrados = devolverStock ? productos.filter(item => !existeEn(actuales, item)) : [];
    const entradas = devolverStock
      ? productos
          .filter(item => existeEn(actuales, item))
          .map(item => ({ presentacionId: item.presentacionId, cantidad: item.numProducts || 1 }))
      : [];

    const tipo  = sale.tipoPago === 'Credito' ? 'crédito' : 'contado';
    const stock = textoStock(devolverStock, entradas, itemsNoEncontrados);
    const evento = nuevoEvento(LOG_TIPOS.VENTA_ELIMINADA, `Venta ${this.dinero(sale.total)} eliminada (${tipo})${stock}`);

    await eliminarVentaBD(tx, sale.id); // cascada: venta + ítems + abonos
    for (const e of entradas) {
      await registrarMovimiento(tx, { presentacionId: e.presentacionId, cantidad: e.cantidad, tipo: 'reversion_venta', refId: sale.id });
    }
    await crearEvento(tx, evento);
    return { resultado: { itemsNoEncontrados }, efecto: { movimientos: entradas } };
  });

  /**
   * Devolución parcial o total de una venta. Asíncrona (lee la venta en la
   * transacción). Devuelve (promesa)
   * { valorDevuelto, excedente, itemsNoEncontrados, ventaEliminada },
   * o null si la venta ya no existe o falló.
   */
  registrarDevolucion = (saleId, items, devolverStock) => {
    if (!items.length) return Promise.resolve(null);
    return this.decidirEnBD('registrarDevolucion', async tx => {
      const sale = await obtenerVenta(tx, saleId);
      if (!sale) return { resultado: null };

      const valorDevuelto = Math.round(items.reduce((sum, item) => {
        const prod = (sale.productos ?? []).find(p => p.productId === item.productId && p.presentacionId === item.presentacionId);
        return sum + (prod ? prod.precio * item.cantidad : 0);
      }, 0) * 100) / 100; // a granel: 0.5 kg × $28 — redondeo a centavos

      // Si el cliente ya había pagado más de lo que debe después de esta
      // devolución, ese excedente no se puede "guardar" en la venta (su deuda
      // ya no puede ser negativa) — hay que devolverle ese dinero en efectivo.
      // No hay módulo de nota de crédito todavía, así que al menos avisamos.
      const nuevoTotal     = Math.max(0, sale.total - valorDevuelto);
      const excedente      = Math.max(0, (sale.totalAbonado ?? 0) - nuevoTotal);
      const nuevoAbonado   = Math.min(sale.totalAbonado ?? 0, nuevoTotal);
      const nuevoCondonado = Math.min(sale.condonado ?? 0, Math.max(0, nuevoTotal - nuevoAbonado));

      // Mismo chequeo que en eliminarCompra/eliminarVenta: ítems cuya
      // presentación ya no existe no tienen dónde devolver el stock.
      const actuales = devolverStock ? await leerPresentaciones(tx, items.map(i => i.presentacionId)) : {};
      const itemsNoEncontrados = devolverStock ? items.filter(item => !existeEn(actuales, item)) : [];
      const entradas = devolverStock
        ? items
            .filter(item => existeEn(actuales, item))
            .map(item => ({ presentacionId: item.presentacionId, cantidad: item.cantidad }))
        : [];

      // Ítems de la venta: los que quedan en 0 se borran, los demás se reducen.
      const itemsActualizados = [];
      const itemsBorrados = [];
      const productos = (sale.productos ?? []).map(p => {
        const devuelto = items.find(i => i.productId === p.productId && i.presentacionId === p.presentacionId);
        if (!devuelto) return p;
        // redondearStock: a granel 1.5 − 0.4 no debe quedar en 1.0999999.
        const nuevaCantidad = redondearStock(Math.max(0, p.numProducts - devuelto.cantidad));
        const actualizado = { ...p, numProducts: nuevaCantidad, totalPrice: Math.round(p.precio * nuevaCantidad * 100) / 100 };
        (nuevaCantidad > 0 ? itemsActualizados : itemsBorrados).push(actualizado);
        return actualizado;
      }).filter(p => p.numProducts > 0);

      // Devolución TOTAL (no queda ningún producto): la venta se elimina, igual
      // que eliminarVenta — cascada de venta, ítems y abonos (decisión de
      // negocio, sep 2026). Si no, solo se actualiza.
      const ventaEliminada = productos.length === 0;

      const resumen = items.map(i => `${formatoCantidad(i.cantidad, i.esGranel, i.unidadGranel)} × ${nombreProducto(i.nombre, i.tamano)}`).join(', ');
      const stock   = textoStock(devolverStock, entradas, itemsNoEncontrados);
      const evento  = nuevoEvento(
        LOG_TIPOS.DEVOLUCION,
        `Devolución${ventaEliminada ? ' total' : ''} ${this.dinero(valorDevuelto)} · ${resumen}${stock}${ventaEliminada ? ' · venta eliminada' : ''}`,
      );

      if (ventaEliminada) {
        await eliminarVentaBD(tx, sale.id); // cascada: venta + ítems + abonos
      } else {
        await actualizarTotalesVenta(tx, sale.id, { total: nuevoTotal, totalAbonado: nuevoAbonado, condonado: nuevoCondonado });
        for (const item of itemsActualizados) await actualizarItemVenta(tx, item.id, item);
        for (const item of itemsBorrados) await eliminarItemVenta(tx, item.id);
      }
      for (const e of entradas) {
        await registrarMovimiento(tx, { presentacionId: e.presentacionId, cantidad: e.cantidad, tipo: 'devolucion', refId: sale.id });
      }
      await crearEvento(tx, evento);
      return {
        resultado: { valorDevuelto, excedente, itemsNoEncontrados, ventaEliminada },
        efecto:    { movimientos: entradas },
      };
    });
  };

  // Los clientes ya tienen id propio: renombrar cambia UNA fila en la BD.
  // Aun así se bloquea si el nombre nuevo pertenece a OTRO cliente (fusionaría
  // sin querer el historial de dos personas; además el índice único de la BD
  // lo rechazaría). Corregir mayúsculas/espacios del mismo cliente sí se permite.
  renombrarCliente = (nombreActual, nombreNuevo) => {
    const nuevo = limpiarNombre(nombreNuevo);
    if (!nuevo) return false;
    const actual = limpiarNombre(nombreActual);

    const cliente = this.state.clientes.find(c => normalizarNombre(c.nombre) === normalizarNombre(actual));
    if (!cliente) {
      console.warn('renombrarCliente: cliente no encontrado', actual);
      return false;
    }
    if (nuevo === cliente.nombre) return true; // sin cambio real: nada que guardar
    const perteneceAOtroCliente = this.state.clientes.some(c =>
      c.id !== cliente.id && normalizarNombre(c.nombre) === normalizarNombre(nuevo),
    );
    if (perteneceAOtroCliente) {
      console.warn('renombrarCliente: el nombre ya pertenece a otro cliente, renombrado bloqueado');
      return false;
    }

    const evento = nuevoEvento(LOG_TIPOS.CLIENTE_RENOMBRADO, `Cliente renombrado: "${cliente.nombre}" → "${nuevo}"`);

    // Una sola fila, en memoria y en la BD: ventas y abonos guardan el
    // cliente_id y las consultas traen el nombre con un JOIN.
    this.setState(prev => ({
      clientes:    prev.clientes.map(c => c.id === cliente.id ? { ...c, nombre: nuevo } : c),
    }));

    persistir(async tx => {
      await renombrarClienteBD(tx, cliente.id, nuevo);
      await crearEvento(tx, evento);
    }, 'renombrarCliente');

    return true;
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getSellableItems = () => {
    const items = [];
    this.state.products.forEach(product => {
      product.presentaciones.forEach(pres => {
        items.push({
          id: `${product.id}::${pres.id}`,
          productId:       product.id,
          presentacionId:  pres.id,
          nombre:          product.nombre,
          marca:           product.marca,
          tamano:          pres.tamano,
          precio:          pres.precio,
          precioCompra:    pres.precioCompra ?? null,
          stock:           pres.stock,
          esGranel:        pres.esGranel ?? false,
          unidadGranel:    pres.unidadGranel ?? null,
          categoriaId:     product.categoriaId,
        });
      });
    });
    return items.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es') ||
      a.tamano.localeCompare(b.tamano, 'es') ||
      a.marca.localeCompare(b.marca, 'es'),
    );
  };

  render() {
    // Compuerta: las pantallas no se montan hasta tener los datos de la BD.
    if (this.state.cargando || this.state.errorCarga) {
      return <LoadingScreen error={this.state.errorCarga} mensaje={this.state.mensajeCarga} onReintentar={this.arrancar} />;
    }
    return (
      <StoreContext.Provider
        value={{
          // Estado
          products:              this.state.products,
          categories:            [CATEGORIA_TODOS, ...this.state.categories],
          clientes:              this.state.clientes,
          // (ventas, abonos y compras no viven en memoria: las pantallas los
          // consultan bajo demanda en src/data/consultas/ y las acciones los
          // leen dentro de su transacción.)
          config:                this.state.config,
          mostrarBienvenida:     this.state.mostrarBienvenida,
          marcarBienvenidaVista: this.marcarBienvenidaVista,
          pistasVistas:          this.state.pistasVistas,
          marcarPistaVista:      this.marcarPistaVista,
          // Derivados
          sellableItems:         this.getSellableItems(),
          // Log
          logEvent:              this.logEvent,
          // Config
          updateConfig:          this.updateConfig,
          // Productos
          addProduct:            this.addProduct,
          addPresentacion:       this.addPresentacion,
          updateProduct:         this.updateProduct,
          updatePresentacion:    this.updatePresentacion,
          agregarStock:          this.agregarStock,
          deletePresentacion:    this.deletePresentacion,
          decreaseStock:         this.decreaseStock,
          // Compras
          addCompra:             this.addCompra,
          editarCompra:          this.editarCompra,
          eliminarCompra:        this.eliminarCompra,
          // Categorías
          addCategory:           this.addCategory,
          renameCategory:        this.renameCategory,
          deleteCategory:        this.deleteCategory,
          // Ventas
          addSale:               this.addSale,
          registrarAbono:        this.registrarAbono,
          ajustarAbonoVenta:     this.ajustarAbonoVenta,
          condonarVenta:         this.condonarVenta,
          eliminarVenta:         this.eliminarVenta,
          registrarDevolucion:   this.registrarDevolucion,
          renombrarCliente:      this.renombrarCliente,
          // Datos completos (copia de seguridad / desarrollo)
          importarCopia:         this.importarCopia,
          reiniciarConEjemplos:  this.reiniciarConEjemplos,
          vaciarTodo:            this.vaciarTodo,
        }}
      >
        {this.props.children}
      </StoreContext.Provider>
    );
  }
}
