import { getDB } from '../db';
import { newId, nowIso } from '../ids';
import { insertar, actualizar, borrarLogico, aBooleano } from './comunes';

// ─── Repositorio de productos, presentaciones e inventario ────────────────────
// Forma en memoria (la que ya usan las pantallas):
//   { id, nombre, marca, categoriaId,
//     presentaciones: [{ id, tamano, precio, precioCompra, stock, esGranel, unidadGranel }] }
//
// En SQLite son dos tablas planas (productos, presentaciones) unidas por
// presentaciones.producto_id. El stock se mueve SIEMPRE con
// registrarMovimiento(), nunca escribiendo la columna stock directamente.

// ─── Lectura ──────────────────────────────────────────────────────────────────

const presentacionDesdeFila = fila => ({
  id:           fila.id,
  tamano:       fila.tamano,
  precio:       fila.precio,
  precioCompra: fila.precio_compra ?? null,
  stock:        fila.stock,
  esGranel:     aBooleano(fila.es_granel),
  unidadGranel: fila.unidad_granel ?? null,
});

/**
 * Carga todos los productos vivos con sus presentaciones anidadas.
 * Dos consultas en total (no una por producto) y se arman con un Map.
 * ORDER BY id = orden de creación, porque los UUIDv7 empiezan con la fecha.
 */
export const cargarProductos = async () => {
  const db = getDB();
  const [{ rows: filasProductos }, { rows: filasPresentaciones }] = await Promise.all([
    db.execute(
      'SELECT id, nombre, marca, categoria_id FROM productos WHERE deleted_at IS NULL ORDER BY id',
    ),
    db.execute(
      `SELECT id, producto_id, tamano, precio, precio_compra, stock, es_granel, unidad_granel
       FROM presentaciones WHERE deleted_at IS NULL ORDER BY id`,
    ),
  ]);

  const porId = new Map();
  filasProductos.forEach(fila => {
    porId.set(fila.id, {
      id:             fila.id,
      nombre:         fila.nombre,
      marca:          fila.marca,
      categoriaId:    fila.categoria_id,
      presentaciones: [],
    });
  });
  filasPresentaciones.forEach(fila => {
    porId.get(fila.producto_id)?.presentaciones.push(presentacionDesdeFila(fila));
  });

  // Un producto sin presentaciones vivas no se muestra (mismo criterio que
  // deletePresentacion en StoreContext).
  return [...porId.values()].filter(p => p.presentaciones.length > 0);
};

/**
 * Stock y precio de compra ACTUALES de estas presentaciones (solo las vivas),
 * leídos dentro de la transacción de una acción:
 *   { [presentacionId]: { productId, stock, precioCompra } }
 * Si una presentación no aparece es que se borró: no hay a dónde mover stock.
 */
export const leerPresentaciones = async (tx, ids) => {
  const unicos = [...new Set(ids.filter(Boolean))];
  const resultado = {};
  for (let i = 0; i < unicos.length; i += 500) {
    const lote = unicos.slice(i, i + 500);
    const { rows } = await tx.execute(
      `SELECT pr.id, pr.producto_id, pr.stock, pr.precio_compra
       FROM presentaciones pr
       JOIN productos p ON p.id = pr.producto_id AND p.deleted_at IS NULL
       WHERE pr.deleted_at IS NULL AND pr.id IN (${lote.map(() => '?').join(', ')})`,
      lote,
    );
    rows.forEach(fila => {
      resultado[fila.id] = { productId: fila.producto_id, stock: fila.stock, precioCompra: fila.precio_compra ?? null };
    });
  }
  return resultado;
};

// ─── Inventario ───────────────────────────────────────────────────────────────

/**
 * Único camino para cambiar stock: agrega una fila al registro de
 * movimientos Y actualiza la caché presentaciones.stock, en la misma
 * transacción.
 *   cantidad: + entra mercancía, − sale
 *   tipo:     inicial | venta | compra | ajuste | consumo | devolucion
 *             | reversion_compra | reversion_venta
 *   refId:    venta/compra que lo originó (opcional)
 */
export const registrarMovimiento = async (tx, { presentacionId, cantidad, tipo, refId = null, fecha = nowIso() }) => {
  if (!cantidad) return; // 0 no es un movimiento
  await insertar(tx, 'movimientos_inventario', {
    id: newId(),
    presentacion_id: presentacionId,
    cantidad,
    tipo,
    ref_id: refId,
    fecha,
  });
  // Relativo (stock + cantidad), no absoluto: se aplica sobre el valor que
  // tenga la BD. ROUND evita arrastrar errores de punto flotante (granel).
  await tx.execute(
    'UPDATE presentaciones SET stock = ROUND(stock + ?, 3), updated_at = ? WHERE id = ?',
    [cantidad, nowIso(), presentacionId],
  );
};

// ─── Escritura: productos y presentaciones ────────────────────────────────────

const columnasPresentacion = (productoId, pres) => ({
  id:            pres.id,
  producto_id:   productoId,
  tamano:        pres.tamano,
  precio:        pres.precio,
  precio_compra: pres.precioCompra ?? null,
  stock:         0, // el stock inicial entra como movimiento (ver abajo)
  es_granel:     !!pres.esGranel,
  unidad_granel: pres.unidadGranel ?? null,
});

/**
 * Presentación nueva. Se inserta con stock 0 y el stock inicial se registra
 * como movimiento 'inicial': así SUM(movimientos) siempre = stock.
 */
export const crearPresentacion = async (tx, productoId, pres) => {
  await insertar(tx, 'presentaciones', columnasPresentacion(productoId, pres));
  await registrarMovimiento(tx, { presentacionId: pres.id, cantidad: pres.stock, tipo: 'inicial' });
};

// Producto nuevo con todas sus presentaciones (ids ya generados por StoreContext).
export const crearProducto = async (tx, producto) => {
  await insertar(tx, 'productos', {
    id:           producto.id,
    nombre:       producto.nombre,
    marca:        producto.marca ?? '',
    categoria_id: producto.categoriaId ?? null,
  });
  for (const pres of producto.presentaciones) {
    await crearPresentacion(tx, producto.id, pres);
  }
};

// Datos del PRODUCTO (no de sus presentaciones). Campo en memoria → columna;
// también es lista blanca: claves que no estén aquí se ignoran.
const COLUMNAS_PRODUCTO = {
  nombre:      'nombre',
  marca:       'marca',
  categoriaId: 'categoria_id',
};

export const editarProducto = (tx, productoId, cambios) => {
  const columnas = {};
  Object.entries(cambios).forEach(([campo, valor]) => {
    if (COLUMNAS_PRODUCTO[campo]) columnas[COLUMNAS_PRODUCTO[campo]] = valor;
  });
  if (!Object.keys(columnas).length) return Promise.resolve();
  return actualizar(tx, 'productos', productoId, columnas);
};

// Campo en memoria → columna. `stock` NO está a propósito: el stock solo se
// cambia con registrarMovimiento().
const COLUMNAS_PRESENTACION = {
  tamano:       'tamano',
  precio:       'precio',
  precioCompra: 'precio_compra',
  esGranel:     'es_granel',
  unidadGranel: 'unidad_granel',
};

// Edita datos de una presentación (precio, tamaño, granel…). Ignora `stock`.
export const editarPresentacion = (tx, presentacionId, cambios) => {
  const columnas = {};
  Object.entries(cambios).forEach(([campo, valor]) => {
    if (COLUMNAS_PRESENTACION[campo]) columnas[COLUMNAS_PRESENTACION[campo]] = valor;
  });
  if (!Object.keys(columnas).length) return Promise.resolve();
  return actualizar(tx, 'presentaciones', presentacionId, columnas);
};

export const eliminarPresentacion = (tx, presentacionId) =>
  borrarLogico(tx, 'presentaciones', presentacionId);

export const eliminarProducto = (tx, productoId) =>
  borrarLogico(tx, 'productos', productoId);
