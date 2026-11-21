// Acciones de categorías.
// Fábrica: recibe la tienda (el StoreProvider) y devuelve sus acciones; el
// constructor de StoreProvider las copia a la instancia (ver StoreContext.js).
// Dentro de cada acción, `tienda` es lo que en la clase sería `this`.
import { persistir } from '../../data/db';
import { newId } from '../../data/ids';
import { crearCategoria, renombrarCategoria, eliminarCategoria } from '../../data/repositories/categorias';
import { crearEvento } from '../../data/repositories/log';
import { nuevoEvento, LOG_TIPOS } from '../activityLog';

// Pseudo-categoría de la UI (filtro "todas"). No se guarda en la BD.
export const CATEGORIA_TODOS = { id: 0, nombre: 'Todos' };

export const accionesCategorias = tienda => ({
  // ─── Categorías ───────────────────────────────────────────────────────────

  addCategory: nombre => {
    const newCat = { id: newId(), nombre: nombre.trim() };
    const evento = nuevoEvento(LOG_TIPOS.CATEGORIA_CREADA, `Nueva categoría: ${nombre.trim()}`);
    tienda.setState(prev => ({
      categories:  [...prev.categories, newCat],
    }));
    persistir(async tx => {
      await crearCategoria(tx, newCat);
      await crearEvento(tx, evento);
    }, 'addCategory');
    return newCat;
  },

  // Protegida aquí también (no solo en CategoriesModal): no se permite un
  // nombre que ya tenga OTRA categoría (ni "Todos"). Devuelve true/false.
  renameCategory: (id, nuevoNombre) => {
    if (String(id) === String(CATEGORIA_TODOS.id)) return false;
    const nombreNorm = nuevoNombre.trim().toLowerCase();
    const duplicada = nombreNorm === CATEGORIA_TODOS.nombre.toLowerCase()
      || tienda.state.categories.some(c => String(c.id) !== String(id) && c.nombre.toLowerCase() === nombreNorm);
    if (!nombreNorm || duplicada) {
      console.warn('renameCategory: nombre vacío o de otra categoría, no se renombra', nuevoNombre);
      return false;
    }
    const cat = tienda.state.categories.find(c => String(c.id) === String(id));
    const evento = nuevoEvento(LOG_TIPOS.CATEGORIA_RENOMBRADA, `Categoría renombrada: "${cat?.nombre ?? id}" → "${nuevoNombre.trim()}"`);
    tienda.setState(prev => ({
      categories:  prev.categories.map(c => String(c.id) === String(id) ? { ...c, nombre: nuevoNombre.trim() } : c),
    }));
    persistir(async tx => {
      await renombrarCategoria(tx, id, nuevoNombre.trim());
      await crearEvento(tx, evento);
    }, 'renameCategory');
    return true;
  },

  // Protegida aquí (no solo en CategoriesModal): si algún producto sigue
  // asignado a esta categoría, no se borra — dejaría productos con
  // categoriaId huérfana. Para liberarla, primero se reasignan los productos
  // con updateProduct (botón ✏️ en ProductDetailScreen).
  deleteCategory: id => {
    if (String(id) === String(CATEGORIA_TODOS.id)) return false;
    const enUso = tienda.state.products.some(p => String(p.categoriaId) === String(id));
    if (enUso) {
      console.warn('deleteCategory: categoría en uso, no se elimina', id);
      return false;
    }
    const cat = tienda.state.categories.find(c => String(c.id) === String(id));
    const evento = nuevoEvento(LOG_TIPOS.CATEGORIA_ELIMINADA, `Categoría eliminada: ${cat?.nombre ?? id}`);
    tienda.setState(prev => ({
      categories:  prev.categories.filter(c => String(c.id) !== String(id)),
    }));
    persistir(async tx => {
      await eliminarCategoria(tx, id);
      await crearEvento(tx, evento);
    }, 'deleteCategory');
    return true;
  },
});
