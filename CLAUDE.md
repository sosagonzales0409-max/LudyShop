# CLAUDE.md

Guía para Claude Code (y para cualquier persona) al trabajar en este repositorio: qué es la app, cómo se prueba, cómo está construida y qué reglas no se deben romper.

## Qué es

**LudyShop** (`com.ludyshop.app`): app React Native 0.83 para Android e iOS, sin internet, para tiendas de abarrotes: ventas al contado y a crédito, abonos, inventario (incluye granel), compras, reportes, corte del día y copias de seguridad. Android ya está en Google Play (prueba cerrada).

**Idioma:** el código (variables, funciones, tablas), los comentarios, los mensajes de commit y los textos de la app están en español; mantenlo. Los archivos y componentes **nuevos** se nombran en inglés. No renombres ni muevas archivos existentes sin pedirlo: el arnés depende de algunas rutas (ver `STUBS` en `qa/arnes/construir.mjs`).

## Comandos

- `npm start` (Metro) · `npm run android` · `npm run ios` (antes, en macOS: `bundle install` y `cd ios && bundle exec pod install`).
- Lint: `npm run lint` (`eslint src`) → debe dar **0 errores**. La regla `react-native/no-inline-styles` está desactivada **temporalmente** mientras se pasan los estilos en línea a `StyleSheet.create`; el código nuevo ya debe usar `StyleSheet.create`.
- Release Android: `cd android && ./gradlew bundleRelease`. Cada subida a Play: `versionCode` +1 en `android/app/build.gradle`.
- Borrar los datos de la app en el teléfono de pruebas: `adb shell pm clear com.ludyshop.app`.

### Pruebas (Node 22+)

No hay Jest: las pruebas son el arnés de `qa/`. `npm test` corre los dos primeros scripts de abajo, y GitHub Actions (`.github/workflows/ci.yml`) corre `npm run lint` + `npm test` en cada push a cualquier rama y en cada PR a `main`, con `TZ=America/Mexico_City`.

- `node qa/arnes/escenario-desde-cero.mjs` → termina en "✅ ESCENARIO "DESDE 0" VERIFICADO".
- `node qa/arnes/probar-acciones.mjs` → todas las verificaciones en ✅, "Integridad: 21 verificaciones · 0 problemas", "✅ ACCIONES VERIFICADAS" (~1 min, siembra un año de datos y deja la BD sembrada en `qa/datos/semilla-node.db`).
- Oráculo de las consultas de dinero (después de `probar-acciones.mjs`, que genera la BD): `node qa/valores-esperados.mjs qa/datos/semilla-node.db qa/datos/semilla-esperados.md` y después `node qa/arnes/cruzar-oraculo.mjs qa/datos/semilla-node.db qa/datos/semilla-esperados.md` → "✅ El oráculo coincide…".
- `qa/integridad.sql`: invariantes de la BD (todas deben devolver 0 problemas). `qa/extraer-bd.cmd` saca la BD real del teléfono para revisarla.

Cómo funciona el arnés: `qa/arnes/construir.mjs` copia el código **real** de `src/data`, `src/config/formato.js` y `src/context/StoreContext.js` a `qa/arnes/app/*.mjs` (generado, no editar) y sustituye los paquetes (react, react-native, op-sqlite → `node:sqlite`, uuid, react-native-fs) y algunos componentes (`ui/LoadingScreen`, `ui/Toast`) con `qa/arnes/stubs`. Si agregas en esos archivos un import de un paquete (cualquier import no relativo), agrega su sustituto en `STUBS`; si no, `construir.mjs` falla. Estas pruebas **no** cubren la interfaz.

## Arquitectura

**Flujo:** `App.tsx` → `src/navigation/router.js` (`StoreProvider` → `NavigationContainer` → pila raíz con la pantalla `Bienvenida` y las pestañas `App`; cada pestaña tiene su stack nativo: Ventas `MainStack` e Inventario `InventoryStack`, y varias pantallas están registradas en ambos) → pantallas en `src/screens/` (`…Screen`, componentes de **clase** que consumen `StoreContext`), modales en `src/modals/` (`…Modal`) y piezas reutilizables en `src/ui/`. `Toast` (`src/ui/Toast.js`) se monta una vez en `App.tsx` y se usa con `Toast.show(msg, tipo)`.

**Capa de datos (`src/data/`, SQLite con op-sqlite, archivo `mitienda.db`, modo WAL):**

- `db.js`: `initDB()` al arrancar; `getDB().execute` **solo para leer**; **toda escritura** pasa por `persistir(async tx => …, etiqueta)`, una cola serial donde cada escritura va en su propia transacción. `persistir` detecta qué tablas escribe cada sentencia y, tras el commit, avisa a los suscriptores (`cambios.js`).
- `consultaViva.js`: las pantallas que consultan la BD bajo demanda (historial, reportes, créditos, log…) usan `crearConsultaViva({ tablas, cargar, alCargar })` y se recargan solas cuando otra acción escribe en esas tablas (con protección contra respuestas desordenadas). Llamar a `detener()` en `componentWillUnmount`.
- `repositories/`: escrituras por entidad. Usan `insertar` / `actualizar` / `borrarLogico` de `comunes.js`, que llenan `tienda_id`, `created_at`, `updated_at` y `deleted_at`.
- `consultas/`: lecturas SQL agregadas por pantalla (corte, reportes, créditos, historial, compras, producto).
- `migrations.js` (versión en `PRAGMA user_version`), `ids.js` (UUIDv7, `nowIso`), `nombres.js` (`normalizarNombre`: única regla de "mismo cliente"), `seed.js` (datos de un año, solo en `__DEV__` y con `SEED_AUTOMATICO`), `respaldo.js` (exportar e importar la copia).

**`src/context/StoreContext.js`** contiene todas las acciones. En memoria solo guarda lo pequeño (`products`, `categories`, `clientes`, `config`); ventas, abonos y compras se consultan con SQL. Hay dos estilos de acción:
- **Optimista** (p. ej. `addSale`): actualiza la memoria primero y encola la escritura; si falla, `onErrorPersistencia` avisa y recarga desde la BD (la fuente de verdad).
- **"La BD decide"** (`decidirEnBD`: abonos, eliminar venta, editar compra…): lee y escribe dentro de la transacción y, después del commit, aplica a memoria el `efecto` con `aplicarEfecto`, que **suma deltas** de stock en vez de fijar valores.
- Cada acción relevante registra un evento en `activity_log` (`LOG_TIPOS` / `LOG_META`).

**Modelo:** todas las tablas tienen id UUIDv7, `tienda_id`, `created_at`/`updated_at` y borrado lógico (`deleted_at`), pensado para la sincronización en línea de la V2. `presentaciones.stock` es una **caché**: la fuente de verdad es `movimientos_inventario`, un registro al que solo se agregan filas. Las ventas y compras guardan una "foto" del producto, así que borrar un producto no altera el historial. Las fechas se guardan en UTC ISO y se convierten a hora local al mostrarlas.

## Reglas que no se deben romper

1. Escribir en la BD **solo** con `persistir()`; nunca con `getDB().execute`.
2. El stock cambia **solo** con `registrarMovimiento()` (escribe el movimiento y actualiza la caché con `ROUND(stock + ?, 3)`). En memoria se usa el mismo redondeo (`redondearStock`).
3. La app ya está en Google Play (prueba cerrada, versionCode 1, con la migración 1) y puede haber usuarios con datos, así que **no se editan migraciones existentes**. Los cambios de esquema van en una migración nueva al final de `MIGRACIONES`: una sentencia por elemento de `sql` y, si hace falta transformar datos, `js(tx)`. Nunca borrar ni fusionar datos del usuario. Si cambias `normalizarNombre`, agrega una migración que recalcule `nombre_norm`.
4. Los nombres de tabla y columna salen del código; los valores van **siempre** como parámetros `?`.
5. Las lecturas filtran con `deleted_at IS NULL`.
6. Mostrar dinero y cantidades con `formatoDinero`, `formatoCantidad` y `nombreProducto` de `src/config/formato.js`. Los colores y tamaños están en `src/config/theme.js`.
7. Si cambias una consulta de dinero, actualiza también el oráculo (`qa/valores-esperados.mjs`) y vuelve a cruzarlo.
8. No agregar dependencias nativas sin consultarlo antes.
9. Antes de cambiar una regla de negocio (devoluciones, abonos, clientes con el mismo nombre, granel, ganancia), pregunta: son decisiones del dueño del producto.
