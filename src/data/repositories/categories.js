import { getDB } from '../db';
import { insertar, actualizar, borrarLogico } from './common';

// ─── Repositorio de categorías ────────────────────────────────────────────────
// Forma en memoria (la que usan las pantallas): { id, nombre }
// La pseudo-categoría "Todos" NO se guarda: la agrega StoreContext.

// Fila de SQLite → objeto de la app.
const desdeFila = fila => ({
  id:     fila.id,
  nombre: fila.nombre,
});

export const cargarCategorias = async () => {
  const { rows } = await getDB().execute(
    'SELECT id, nombre FROM categorias WHERE deleted_at IS NULL ORDER BY nombre',
  );
  return rows.map(desdeFila);
};

// Escrituras: reciben `tx` porque siempre se llaman dentro de persistir().

export const crearCategoria = (tx, categoria) =>
  insertar(tx, 'categorias', { id: categoria.id, nombre: categoria.nombre });

export const renombrarCategoria = (tx, id, nombre) =>
  actualizar(tx, 'categorias', id, { nombre });

export const eliminarCategoria = (tx, id) =>
  borrarLogico(tx, 'categorias', id);
