import React, { createContext, Component } from 'react';
import { Alert } from 'react-native';
import LoadingScreen from '../ui/LoadingScreen';
import { initDB, getDB, persistir, onErrorPersistencia, getMeta, setMeta } from '../data/db';
import { formatoDinero } from '../config/formatting';
import { debeSembrarAutomatico, sembrarAutomatico } from '../data/seed';
import { limpiarTemporales } from '../data/backup';
import { prepararTienda, cargarConfig, guardarConfig, CONFIG_POR_DEFECTO } from '../data/repositories/store';
import { cargarCategorias } from '../data/repositories/categories';
import { cargarProductos } from '../data/repositories/products';
import { cargarClientes } from '../data/repositories/customers';
import { crearEvento } from '../data/repositories/log';
import { nuevoEvento } from './activityLog';
import { aplicarEfecto } from './stockEffects';
import { accionesDatos } from './actions/dataManagement';
import { accionesProductos } from './actions/products';
import { accionesCompras } from './actions/purchases';
import { accionesCategorias, CATEGORIA_TODOS } from './actions/categories';
import { accionesVentas } from './actions/sales';
import { accionesClientes } from './actions/customers';

// Se reexportan para que las pantallas sigan importándolos desde aquí.
export { LOG_TIPOS, LOG_META } from './activityLog';

// Los datos de ejemplo viven en src/data/seed.js y se cargan en SQLite;
// el estado inicial ahora se hidrata desde la BD al arrancar (ver arrancar()).


// Reloj de alta resolución para las mediciones de rendimiento (solo desarrollo).
const ahoraMs = () => global.performance?.now?.() ?? Date.now();

export const StoreContext = createContext(null);

export class StoreProvider extends Component {
  // Estado "seco": se hidrata desde SQLite en arrancar(). Mientras
  // cargando = true, render() muestra LoadingScreen en vez de la app.
  // Solo lo pequeño vive en memoria (catálogo, clientes, config). Ventas,
  // abonos, compras y el registro de actividad se consultan bajo demanda
  // (src/data/queries/ y los repositorios), y las acciones que los
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

  // Las acciones de cada dominio viven en ./actions/: cada archivo exporta una
  // fábrica que recibe esta tienda y devuelve sus acciones. Aquí se copian a
  // la instancia, así `this.addSale`, `this.registrarAbono`… existen igual que
  // si estuvieran declaradas en esta clase (y render() las entrega por nombre).
  constructor(props) {
    super(props);
    Object.assign(
      this,
      accionesDatos(this),
      accionesProductos(this),
      accionesCompras(this),
      accionesCategorias(this),
      accionesVentas(this),
      accionesClientes(this),
    );
  }

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
          // consultan bajo demanda en src/data/queries/ y las acciones los
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
