import { open } from '@op-engineering/op-sqlite';
import {
  CachesDirectoryPath, DocumentDirectoryPath, exists, unlink, moveFile, copyFile, stat, readDir,
} from '@dr.pogodin/react-native-fs';
import { getDB, esperarEscrituras, setMeta, getMeta, persistir } from './db';
import { aplicarMigraciones, VERSION_ACTUAL } from './migrations';
import { TABLAS_DE_DATOS } from './seed';
import { nowIso } from './ids';

// ─── Copia de seguridad (exportar / importar) ─────────────────────────────────
// La copia ES una base de datos SQLite: el mismo esquema que mitienda.db, con
// todas las filas (también las borradas con deleted_at, para que en V2 la
// sincronización sepa qué se borró).
//
//   exportarCopia()            → genera el .db en caché (luego se guarda o comparte)
//   revisarCopia(ruta)         → valida, migra y resume una copia ANTES de usarla
//   reemplazarConCopia(copia)  → cambia todos los datos por los de la copia
//
// Las tres esperan a que se vacíe la cola de escrituras: una copia no debe
// perder una venta que todavía se estaba guardando.
//
// La tabla `meta` NUNCA viaja: es la identidad de ESTE teléfono (device_id).
// Al importar en un teléfono nuevo, éste conserva su device_id (en V2 son dos
// dispositivos distintos de la misma tienda) y solo adopta la tienda de la copia.

// Tablas que se reemplazan al importar: los datos + la fila de la tienda.
const TABLAS_COPIA = ['tienda', ...TABLAS_DE_DATOS];

// Datos de antes de la última importación (para "Deshacer"). Va en documentos,
// no en caché: Android puede vaciar la caché cuando le falta espacio.
export const RUTA_ANTES_DE_IMPORTAR = `${DocumentDirectoryPath}/antes-de-importar.db`;

// Error con un mensaje pensado para el usuario (la pantalla lo muestra tal cual).
export class ErrorCopia extends Error {}

const NO_ES_COPIA = 'Este archivo no es una copia de seguridad.';

// "file:///data/.../x.db" → "/data/.../x.db"
const rutaLocal = uri => decodeURIComponent(uri.replace(/^file:\/\//, ''));

// op-sqlite abre por carpeta + nombre; la carpeta puede ser absoluta.
const abrirArchivo = ruta => {
  const corte = ruta.lastIndexOf('/');
  return open({ location: ruta.slice(0, corte), name: ruta.slice(corte + 1) });
};

const borrarSiExiste = async ruta => {
  if (await exists(ruta)) await unlink(ruta);
};

const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Copia consistente de la BD en `ruta` (que no debe existir).
 *
 * ¿Por qué no copiar mitienda.db con copyFile? Por el modo WAL: los últimos
 * cambios pueden seguir en mitienda.db-wal y no en el archivo principal, así
 * que la copia saldría incompleta. VACUUM INTO le pide a SQLite un archivo
 * nuevo que ya incluye lo del WAL, y además compactado (sin el hueco que
 * dejan las filas borradas).
 */
const volcarBD = ruta => getDB().execute('VACUUM INTO ?', [ruta]);

// ─── Exportar ─────────────────────────────────────────────────────────────────

/**
 * Genera la copia en la caché de la app. Devuelve { ruta, nombre }; la
 * pantalla decide si se guarda (diálogo "Guardar en…") o se comparte.
 */
export const exportarCopia = async () => {
  await esperarEscrituras();
  // Las copias de exportaciones anteriores (≈ tamaño de la BD cada una) ya
  // se guardaron o compartieron: no tiene caso acumularlas.
  await limpiarTemporales();
  const nombre = `MiTienda-respaldo-${hoyLocal()}.db`;
  const ruta = `${CachesDirectoryPath}/${nombre}`;
  await borrarSiExiste(ruta); // VACUUM INTO falla si el archivo ya existe
  const fecha = nowIso();
  await volcarBD(ruta);

  // La copia sale con la tabla meta de este teléfono: se vacía y se anota
  // solo cuándo se hizo (para mostrarlo al importar).
  const copia = abrirArchivo(ruta);
  try {
    await copia.execute('DELETE FROM meta');
    await copia.execute("INSERT INTO meta (clave, valor) VALUES ('copia_fecha', ?)", [fecha]);
  } finally {
    copia.close();
  }
  return { ruta, nombre, fecha };
};

// ─── Temporales ───────────────────────────────────────────────────────────────

// En la caché: copias exportadas (MiTienda-respaldo-….db), la copia en
// revisión (importando.db) y sus archivos auxiliares de SQLite (-wal…).
const TEMPORAL = /^(MiTienda-respaldo-.+\.db|importando\.db)(-wal|-shm|-journal)?$/;
// Carpetas que crea el selector de archivos para su copia (una por archivo
// elegido, con nombre UUID); el archivo se mueve a importando.db y la
// carpeta queda vacía.
const CARPETA_SELECTOR = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Borra los temporales del respaldo. Se llama al arrancar la app y antes de
 * cada exportación (nunca justo después de compartir: la app que recibe el
 * archivo puede seguir leyéndolo). Nunca falla: un temporal que no se pudo
 * borrar se intenta la próxima vez.
 */
export const limpiarTemporales = async () => {
  const borrar = ruta => unlink(ruta).catch(error => console.warn('limpiarTemporales', ruta, error));
  try {
    for (const item of await readDir(CachesDirectoryPath)) {
      const esTemporal = item.isFile() ? TEMPORAL.test(item.name) : CARPETA_SELECTOR.test(item.name);
      if (esTemporal) await borrar(item.path);
    }
    // Una importación interrumpida (app cerrada a la mitad) deja este.
    const antesTemporal = `${DocumentDirectoryPath}/antes-de-importar.tmp.db`;
    if (await exists(antesTemporal)) await borrar(antesTemporal);
  } catch (error) {
    console.warn('limpiarTemporales', error);
  }
};

// ─── Recordatorio de copia ────────────────────────────────────────────────────
// Se recuerda cuando hay ventas SIN respaldar desde hace DIAS_RECORDATORIO o
// más (la más vieja posterior a la última copia). No "desde la última copia":
// así un usuario nuevo no ve el aviso en su primera venta, y quien no vendió
// nada en semanas no tiene nada que perder.
// La fecha vive en `meta` (de este teléfono): no viaja dentro de las copias.

export const DIAS_RECORDATORIO = 7;
const CLAVE_ULTIMA_COPIA = 'ultima_copia_fecha';

// Días de calendario entre una fecha ISO y hoy (ayer a las 23:59 = 1 día).
const diasDesde = iso => {
  const a = new Date(iso); a.setHours(0, 0, 0, 0);
  const b = new Date();    b.setHours(0, 0, 0, 0);
  return Math.round((b - a) / 86400000);
};

// Al guardar o compartir una copia. `fecha`: cuándo se generó (exportarCopia).
export const registrarCopiaHecha = fecha =>
  persistir(tx => setMeta(tx, CLAVE_ULTIMA_COPIA, fecha), 'registrarCopiaHecha');

/**
 * @returns {{ diasUltimaCopia: number|null, ventasSinCopia: number, recordar: boolean }}
 *   diasUltimaCopia: null si nunca se ha hecho una copia en este teléfono
 */
export const estadoCopia = async () => {
  const ultima = await getMeta(CLAVE_ULTIMA_COPIA);
  const { rows } = await getDB().execute(
    `SELECT COUNT(*) AS n, MIN(fecha) AS primera FROM ventas
      WHERE deleted_at IS NULL AND (? IS NULL OR fecha > ?)`,
    [ultima, ultima],
  );
  const ventasSinCopia = rows[0]?.n ?? 0;
  const primera = rows[0]?.primera;
  return {
    diasUltimaCopia: ultima ? diasDesde(ultima) : null,
    ventasSinCopia,
    recordar: ventasSinCopia > 0 && diasDesde(primera) >= DIAS_RECORDATORIO,
  };
};

// ─── Importar, paso 1: revisar ────────────────────────────────────────────────

/**
 * Valida una copia y, si viene de una versión anterior de la app, la migra.
 * NUNCA toca los datos actuales; trabaja sobre su propia copia en caché
 * (el archivo que eligió el usuario queda intacto).
 *
 * @param {string}  origen  ruta o file:// del archivo elegido
 * @param {boolean} mover   true si `origen` ya es un temporal nuestro (la copia
 *                          que trae el selector de archivos): se mueve en vez
 *                          de duplicarlo
 * @returns {{ ruta, tiendaId, resumen: { nombreTienda, productos, ventas, ultimaVenta, fechaCopia } }}
 * @throws  ErrorCopia con un mensaje para el usuario
 */
export const revisarCopia = async (origen, { mover = false } = {}) => {
  const ruta = `${CachesDirectoryPath}/importando.db`;
  await borrarSiExiste(ruta);
  await (mover ? moveFile : copyFile)(rutaLocal(origen), ruta);

  let copia = null;
  try {
    copia = abrirArchivo(ruta);
    let version;
    try {
      // Si no es SQLite, aquí falla ("file is not a database").
      const { rows } = await copia.execute('PRAGMA user_version');
      version = Number(rows[0]?.user_version ?? 0);
    } catch {
      throw new ErrorCopia(NO_ES_COPIA);
    }
    if (version > VERSION_ACTUAL) {
      throw new ErrorCopia('Esta copia se hizo con una versión más nueva de Mi Tienda. Actualiza la app e inténtalo de nuevo.');
    }

    const { rows: tablas } = await copia.execute("SELECT name FROM sqlite_master WHERE type = 'table'");
    const nombres = new Set(tablas.map(t => t.name));
    if (version < 1 || !TABLAS_COPIA.every(t => nombres.has(t))) {
      throw new ErrorCopia(NO_ES_COPIA);
    }

    // quick_check: detecta un archivo dañado (descarga cortada, etc.).
    const { rows: chequeo } = await copia.execute('PRAGMA quick_check');
    if (chequeo[0]?.quick_check !== 'ok') {
      throw new ErrorCopia('La copia está dañada y no se puede usar. Prueba con otra.');
    }

    // Copia de una versión anterior: se lleva al esquema actual con las
    // MISMAS migraciones que corren al actualizar la app.
    if (version < VERSION_ACTUAL) await aplicarMigraciones(copia);

    const { rows: tiendas } = await copia.execute(
      'SELECT id, nombre FROM tienda WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
    );
    if (!tiendas.length) throw new ErrorCopia(NO_ES_COPIA);

    const uno = async sql => Object.values((await copia.execute(sql)).rows[0] ?? {})[0] ?? null;
    const resumen = {
      nombreTienda: tiendas[0].nombre,
      productos:    await uno('SELECT COUNT(*) FROM productos WHERE deleted_at IS NULL'),
      ventas:       await uno('SELECT COUNT(*) FROM ventas WHERE deleted_at IS NULL'),
      ultimaVenta:  await uno('SELECT MAX(fecha) FROM ventas WHERE deleted_at IS NULL'),
      fechaCopia:   nombres.has('meta') ? await uno("SELECT valor FROM meta WHERE clave = 'copia_fecha'") : null,
    };
    return { ruta, tiendaId: tiendas[0].id, resumen };
  } catch (error) {
    copia?.close();
    copia = null;
    await borrarSiExiste(ruta);
    throw error;
  } finally {
    copia?.close(); // cerrar antes de ATTACH: deja el archivo sin WAL pendiente
  }
};

// Si el usuario cancela después de revisar. Puede llamarse más de una vez
// (botón Cancelar y cierre del diálogo): nunca falla.
export const descartarCopia = copia =>
  borrarSiExiste(copia.ruta).catch(error => console.warn('descartarCopia', error));

// ─── Importar, paso 2: reemplazar ─────────────────────────────────────────────

// ¿Hay algo que valga la pena guardar antes de importar? En un teléfono
// recién instalado solo existe la tienda vacía: no se guarda nada (y así
// "Deshacer" no ofrece volver a una app vacía).
const tieneDatos = async () => {
  const { rows } = await getDB().execute(
    `SELECT EXISTS(SELECT 1 FROM productos) OR EXISTS(SELECT 1 FROM ventas)
         OR EXISTS(SELECT 1 FROM clientes)  OR EXISTS(SELECT 1 FROM compras)
         OR EXISTS(SELECT 1 FROM categorias) AS hay`,
  );
  return !!rows[0]?.hay;
};

// ─── Borrar todos los datos ───────────────────────────────────────────────────

// Lo que se perdería al borrar, para la advertencia de SettingsScreen.
// `vacia`: no hay nada que borrar (mismo criterio que tieneDatos).
export const resumenDatos = async () => {
  const uno = async sql => Object.values((await getDB().execute(sql)).rows[0] ?? {})[0] ?? 0;
  const [productos, ventas, clientes, compras, vacia] = await Promise.all([
    uno('SELECT COUNT(*) FROM productos WHERE deleted_at IS NULL'),
    uno('SELECT COUNT(*) FROM ventas WHERE deleted_at IS NULL'),
    uno('SELECT COUNT(*) FROM clientes WHERE deleted_at IS NULL'),
    uno('SELECT COUNT(*) FROM compras WHERE deleted_at IS NULL'),
    tieneDatos().then(hay => !hay),
  ]);
  return { productos, ventas, clientes, compras, vacia };
};

// Al borrar todo también se va el "antes" de la última importación: si no,
// "Deshacer última importación" seguiría ofreciendo los datos que el usuario
// acaba de borrar a propósito.
export const borrarAntesDeImportar = () => borrarSiExiste(RUTA_ANTES_DE_IMPORTAR);

/**
 * Reemplaza TODOS los datos por los de una copia ya revisada (revisarCopia).
 * Quien llama debe recargar el estado después (StoreContext lo hace).
 *
 * Cómo: ATTACH monta la copia como una segunda BD en la MISMA conexión
 * ("respaldo.ventas") y, en UNA transacción, por cada tabla:
 *   DELETE FROM ventas;  INSERT INTO ventas (cols) SELECT cols FROM respaldo.ventas
 * Es todo o nada: si algo falla a la mitad, SQLite deshace todo y los datos
 * actuales quedan intactos. Y no hay que cerrar la conexión que usa la app
 * (reemplazar el archivo mitienda.db con la app abierta la corrompería).
 */
export const reemplazarConCopia = async copia => {
  await esperarEscrituras();
  const db = getDB();

  // 1. Guardar los datos actuales, por si hay que deshacer. Primero en un
  //    archivo temporal: el "antes" anterior solo se reemplaza si la
  //    importación termina bien.
  const temporal = `${DocumentDirectoryPath}/antes-de-importar.tmp.db`;
  await borrarSiExiste(temporal);
  const guardarAntes = await tieneDatos();
  if (guardarAntes) await volcarBD(temporal);

  // Columnas de cada tabla según ESTA app (ATTACH y PRAGMA no pueden ir
  // dentro de la transacción). Lista explícita en vez de SELECT *: no
  // depende del orden de las columnas.
  const columnas = {};
  for (const tabla of TABLAS_COPIA) {
    const { rows } = await db.execute(`PRAGMA main.table_info(${tabla})`);
    columnas[tabla] = rows.map(r => r.name).join(', ');
  }

  await db.execute('ATTACH DATABASE ? AS respaldo', [copia.ruta]);
  try {
    // Directo con transaction(), no con persistir(): la app está en la
    // pantalla de carga (no hay pantallas suscritas ni escrituras nuevas) y
    // el error lo maneja quien llama, sin el aviso genérico de persistir.
    await db.transaction(async tx => {
      for (const tabla of TABLAS_COPIA) {
        await tx.execute(`DELETE FROM main.${tabla}`);
        await tx.execute(
          `INSERT INTO main.${tabla} (${columnas[tabla]}) SELECT ${columnas[tabla]} FROM respaldo.${tabla}`,
        );
      }
      // El teléfono adopta la tienda de la copia (su id original). Sin esto,
      // las filas nuevas se sellarían con la tienda que acabamos de borrar.
      await setMeta(tx, 'tienda_id_actual', copia.tiendaId);
      // Estos datos ya existen en una copia (la que se importó): el
      // recordatorio cuenta desde ella. Al deshacer no aplica (el "antes" vive
      // solo en este teléfono), así que se conserva la fecha que hubiera.
      if (copia.resumen.fechaCopia) await setMeta(tx, CLAVE_ULTIMA_COPIA, copia.resumen.fechaCopia);
    });
  } catch (error) {
    await borrarSiExiste(temporal);
    throw error;
  } finally {
    await db.execute('DETACH DATABASE respaldo');
    await borrarSiExiste(copia.ruta);
  }

  if (guardarAntes) {
    await borrarSiExiste(RUTA_ANTES_DE_IMPORTAR);
    await moveFile(temporal, RUTA_ANTES_DE_IMPORTAR);
  }
};

// ─── Deshacer la última importación ───────────────────────────────────────────

// Fecha (Date) de los datos guardados antes de importar, o null si no hay.
export const fechaAntesDeImportar = async () => {
  if (!(await exists(RUTA_ANTES_DE_IMPORTAR))) return null;
  const info = await stat(RUTA_ANTES_DE_IMPORTAR);
  return new Date(info.mtime);
};
