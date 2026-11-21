// ─── Migraciones del esquema SQLite ───────────────────────────────────────────
// Cada migración lleva la BD de la versión (n-1) a la versión n. La versión
// actual se guarda en `PRAGMA user_version` (un entero en el encabezado del
// archivo .db, empieza en 0).
//
// REGLAS:
//   1. Nunca editar una migración ya publicada: un usuario ya la ejecutó.
//      Para corregir algo, agregar una migración nueva al final.
//   2. Cada migración corre completa dentro de una transacción (todo o nada).
//   3. Una sentencia SQL por elemento del arreglo `sql`.
//   4. Migraciones de DATOS (transformar filas existentes con reglas de JS):
//      función opcional `js(tx)`, que corre después de `sql` en la misma
//      transacción. Debe prever los datos reales (duplicados, nulos…): nunca
//      borrar ni fusionar datos del usuario para que la regla nueva quepa.
//      Cuidado con los estados intermedios: un índice único se revisa en
//      CADA UPDATE, no al final (resolver en dos fases si hace falta).
//
// Mientras la app NO esté publicada, se puede editar la migración 1 y borrar
// los datos de la app en el dispositivo de pruebas. Las reglas aplican desde
// la primera versión publicada.

// Columnas que llevan todas las tablas sincronizables:
//   id          UUIDv7 (ver ids.js)
//   tienda_id   a qué tienda pertenece (V2: una cuenta puede tener varias)
//   created_at / updated_at   fechas ISO; updated_at decide quién gana al combinar
//   deleted_at  NULL = vivo; con fecha = borrado ("soft delete")
const COMUNES = `
  id          TEXT PRIMARY KEY NOT NULL,
  tienda_id   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT`;

export const MIGRACIONES = [
  {
    version: 1,
    descripcion: 'Esquema inicial',
    sql: [
      // Datos de la tienda (lo que antes era `config`). Una fila por tienda.
      `CREATE TABLE tienda (
        id           TEXT PRIMARY KEY NOT NULL,
        created_at   TEXT NOT NULL,
        updated_at   TEXT NOT NULL,
        deleted_at   TEXT,
        nombre       TEXT NOT NULL,
        nombre_dueno TEXT NOT NULL DEFAULT '',
        moneda       TEXT NOT NULL DEFAULT '$',
        umbral_stock REAL NOT NULL DEFAULT 5
      )`,

      `CREATE TABLE categorias (${COMUNES},
        nombre TEXT NOT NULL
      )`,

      `CREATE TABLE productos (${COMUNES},
        nombre       TEXT NOT NULL,
        marca        TEXT NOT NULL DEFAULT '',
        categoria_id TEXT
      )`,

      // `stock` es una caché: la fuente de verdad es la suma de
      // movimientos_inventario. Se actualizan juntos en la misma transacción.
      `CREATE TABLE presentaciones (${COMUNES},
        producto_id   TEXT NOT NULL,
        tamano        TEXT NOT NULL,
        precio        REAL NOT NULL,
        precio_compra REAL,
        stock         REAL NOT NULL DEFAULT 0,
        es_granel     INTEGER NOT NULL DEFAULT 0,
        unidad_granel TEXT
      )`,
      `CREATE INDEX idx_presentaciones_producto ON presentaciones(producto_id)`,

      // Registro append-only (solo se insertan filas, nunca se editan): cada
      // entrada o salida de mercancía. En V2 permite unir los cambios de
      // varios dispositivos sin que uno pise el stock del otro.
      //   tipo: inicial | venta | compra | ajuste | consumo | devolucion
      //         | reversion_compra | reversion_venta
      //   ref_id: la venta/compra que lo originó (si aplica)
      `CREATE TABLE movimientos_inventario (${COMUNES},
        presentacion_id TEXT NOT NULL,
        cantidad        REAL NOT NULL,
        tipo            TEXT NOT NULL,
        ref_id          TEXT,
        fecha           TEXT NOT NULL
      )`,
      `CREATE INDEX idx_movimientos_presentacion ON movimientos_inventario(presentacion_id)`,

      // nombre_norm: nombre normalizado en JS (ver normalizarNombre en
      // repositories/customers.js). No usamos lower() de SQLite porque solo
      // convierte A-Z: 'DOÑA' quedaría 'doÑa'.
      `CREATE TABLE clientes (${COMUNES},
        nombre      TEXT NOT NULL,
        nombre_norm TEXT NOT NULL
      )`,
      // Único PARCIAL: no puede haber dos clientes VIVOS con el mismo nombre
      // en la misma tienda; los borrados (deleted_at) no cuentan.
      `CREATE UNIQUE INDEX idx_clientes_nombre ON clientes(tienda_id, nombre_norm) WHERE deleted_at IS NULL`,

      // total_abonado y condonado también son caché, recalculables desde abonos
      // (primero lo abonado, luego lo condonado con lo que sobre — igual que
      // registrarDevolucion en StoreContext):
      //   total_abonado = MIN(SUM(abonos tipo 'abono'), total)
      //   condonado     = MIN(SUM(abonos tipo 'condonacion'), total − total_abonado)
      // El MIN existe porque una devolución puede bajar el total por debajo de
      // lo ya abonado: el excedente se devuelve en efectivo y NO se registra
      // como abono negativo (decisión de negocio, sep 2026).
      `CREATE TABLE ventas (${COMUNES},
        fecha         TEXT NOT NULL,
        tipo_pago     TEXT NOT NULL,
        cliente_id    TEXT,
        total         REAL NOT NULL,
        total_abonado REAL NOT NULL DEFAULT 0,
        condonado     REAL NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX idx_ventas_fecha ON ventas(fecha)`,
      `CREATE INDEX idx_ventas_cliente ON ventas(cliente_id)`,

      // nombre/marca/tamano/precio/precio_compra/es_granel/unidad_granel son
      // una "foto" del producto al momento de vender: si luego cambia (o se
      // borra), la venta sigue diciendo cómo era. es_granel/unidad_granel
      // permiten mostrar "8.5 kg" en vez de "8.5 unidades".
      `CREATE TABLE venta_items (${COMUNES},
        venta_id        TEXT NOT NULL,
        producto_id     TEXT,
        presentacion_id TEXT,
        nombre          TEXT NOT NULL,
        marca           TEXT NOT NULL DEFAULT '',
        tamano          TEXT NOT NULL DEFAULT '',
        precio          REAL NOT NULL,
        precio_compra   REAL,
        es_granel       INTEGER NOT NULL DEFAULT 0,
        unidad_granel   TEXT,
        cantidad        REAL NOT NULL,
        total           REAL NOT NULL,
        orden           INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX idx_venta_items_venta ON venta_items(venta_id)`,

      //   tipo: abono | condonacion
      `CREATE TABLE abonos (${COMUNES},
        venta_id   TEXT NOT NULL,
        cliente_id TEXT,
        fecha      TEXT NOT NULL,
        monto      REAL NOT NULL,
        tipo       TEXT NOT NULL
      )`,
      `CREATE INDEX idx_abonos_venta ON abonos(venta_id)`,

      `CREATE TABLE compras (${COMUNES},
        fecha     TEXT NOT NULL,
        proveedor TEXT NOT NULL DEFAULT '',
        tipo_pago TEXT NOT NULL,
        notas     TEXT NOT NULL DEFAULT '',
        total     REAL NOT NULL
      )`,
      `CREATE INDEX idx_compras_fecha ON compras(fecha)`,

      `CREATE TABLE compra_items (${COMUNES},
        compra_id              TEXT NOT NULL,
        producto_id            TEXT,
        presentacion_id        TEXT,
        nombre                 TEXT NOT NULL,
        tamano                 TEXT NOT NULL DEFAULT '',
        cantidad               REAL NOT NULL,
        costo_unitario         REAL NOT NULL,
        subtotal               REAL NOT NULL,
        precio_compra_anterior REAL,
        piezas_paquete         REAL,
        precio_paquete         REAL,
        num_paquetes           REAL,
        orden                  INTEGER NOT NULL DEFAULT 0
      )`,
      `CREATE INDEX idx_compra_items_compra ON compra_items(compra_id)`,

      `CREATE TABLE activity_log (${COMUNES},
        tipo  TEXT NOT NULL,
        fecha TEXT NOT NULL,
        descr TEXT NOT NULL
      )`,
      `CREATE INDEX idx_activity_log_fecha ON activity_log(fecha)`,

      // Datos propios de ESTE dispositivo. No se respaldan ni se sincronizan.
      //   device_id, tienda_id_actual, onboarding_hecho, last_sync_at (V2)
      `CREATE TABLE meta (
        clave TEXT PRIMARY KEY NOT NULL,
        valor TEXT
      )`,
    ],
  },
];

export const VERSION_ACTUAL = MIGRACIONES[MIGRACIONES.length - 1].version;

/**
 * Aplica en orden las migraciones pendientes. Cada una en su propia
 * transacción junto con el cambio de user_version: si falla a la mitad, la
 * BD queda exactamente en la versión anterior.
 */
export const aplicarMigraciones = async db => {
  const { rows } = await db.execute('PRAGMA user_version');
  const versionBD = Number(rows[0]?.user_version ?? 0);

  if (versionBD > VERSION_ACTUAL) {
    // La BD la creó una versión más nueva de la app (p. ej. se instaló un
    // APK viejo encima). No sabemos leerla: mejor fallar que dañarla.
    throw new Error(`La base de datos (v${versionBD}) es más nueva que la app (v${VERSION_ACTUAL}).`);
  }

  for (const migracion of MIGRACIONES) {
    if (migracion.version <= versionBD) continue;
    await db.transaction(async tx => {
      for (const sentencia of migracion.sql) {
        await tx.execute(sentencia);
      }
      if (migracion.js) await migracion.js(tx);
      await tx.execute(`PRAGMA user_version = ${migracion.version}`);
    });
  }
};
