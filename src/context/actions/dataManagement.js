// Acciones de reemplazar todos los datos (importar copia, ejemplos, vaciar).
// Fábrica: recibe la tienda (el StoreProvider) y devuelve sus acciones; el
// constructor de StoreProvider las copia a la instancia (ver StoreContext.js).
// Dentro de cada acción, `tienda` es lo que en la clase sería `this`.
import { Alert } from 'react-native';
import Toast from '../../ui/Toast';
import { getDB, esperarEscrituras } from '../../data/db';
import { reiniciarConSemilla, vaciarDatos } from '../../data/seed';
import { reemplazarConCopia, borrarAntesDeImportar, ErrorCopia } from '../../data/backup';
import { prepararTienda } from '../../data/repositories/store';
import { LOG_TIPOS } from '../activityLog';

export const accionesDatos = tienda => ({
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

  reemplazarDatos: async (mensaje, operacion) => {
    tienda.setState({ cargando: true, errorCarga: null, mensajeCarga: mensaje });
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
      tienda.tiendaId = await prepararTienda();
      await tienda.recargarDesdeBD();
    } catch (error) {
      console.error('reemplazarDatos: recargar', error);
      tienda.setState({ cargando: false, errorCarga: error?.message ?? String(error) });
      return false;
    }
    tienda.setState({ mensajeCarga: null });
    if (fallo) {
      Alert.alert(
        'No se pudo completar',
        fallo instanceof ErrorCopia ? fallo.message : 'Ocurrió un error. Tus datos no cambiaron.',
      );
      return false;
    }
    return true;
  },

  /**
   * Reemplaza todos los datos por los de una copia ya revisada
   * (respaldo.revisarCopia). `deshacer`: true si es la vuelta a los datos de
   * antes de la última importación (solo cambia los textos).
   */
  importarCopia: async (copia, { deshacer = false } = {}) => {
    const ok = await tienda.reemplazarDatos(
      deshacer ? 'Recuperando tus datos anteriores…' : 'Importando tus datos…',
      () => reemplazarConCopia(copia),
    );
    if (!ok) return;
    const { nombreTienda, productos, ventas } = copia.resumen;
    tienda.logEvent(
      LOG_TIPOS.DATOS_IMPORTADOS,
      deshacer
        ? 'Importación deshecha: se recuperaron los datos anteriores'
        : `Datos importados de una copia: ${nombreTienda} · ${productos} productos · ${ventas} ventas`,
    );
    Toast.show(deshacer ? 'Datos anteriores recuperados' : 'Datos importados', 'success');
  },

  // Solo desarrollo (sección "Desarrollo" de SettingsScreen).
  reiniciarConEjemplos: async () => {
    if (await tienda.reemplazarDatos('Generando datos de ejemplo…', () => getDB().transaction(reiniciarConSemilla))) {
      Toast.show('Datos de ejemplo listos', 'success');
    }
  },

  // "Borrar todos los datos" (Configuración). Conserva la tienda (nombre,
  // moneda, umbral). La advertencia y la confirmación viven en SettingsScreen.
  vaciarTodo: async () => {
    const ok = await tienda.reemplazarDatos('Borrando datos…', async () => {
      await getDB().transaction(vaciarDatos);
      // Solo si el borrado salió bien (si falla, transaction lanza antes). Y
      // sin lanzar: los datos YA se borraron, el aviso de reemplazarDatos
      // ("tus datos no cambiaron") sería falso.
      await borrarAntesDeImportar().catch(error => console.warn('borrarAntesDeImportar', error));
    });
    if (!ok) return;
    // El registro de actividad también se borró: este es su primer evento.
    tienda.logEvent(LOG_TIPOS.DATOS_BORRADOS, 'Se borraron todos los datos para empezar de cero');
    Toast.show('Datos borrados', 'success');
  },
});
