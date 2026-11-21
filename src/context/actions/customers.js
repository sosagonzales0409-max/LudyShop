// Acciones de clientes.
// Fábrica: recibe la tienda (el StoreProvider) y devuelve sus acciones; el
// constructor de StoreProvider las copia a la instancia (ver StoreContext.js).
// Dentro de cada acción, `tienda` es lo que en la clase sería `this`.
import { persistir } from '../../data/db';
import { renombrarCliente as renombrarClienteBD, limpiarNombre, normalizarNombre } from '../../data/repositories/customers';
import { crearEvento } from '../../data/repositories/log';
import { nuevoEvento, LOG_TIPOS } from '../activityLog';

export const accionesClientes = tienda => ({
  // Los clientes ya tienen id propio: renombrar cambia UNA fila en la BD.
  // Aun así se bloquea si el nombre nuevo pertenece a OTRO cliente (fusionaría
  // sin querer el historial de dos personas; además el índice único de la BD
  // lo rechazaría). Corregir mayúsculas/espacios del mismo cliente sí se permite.
  renombrarCliente: (nombreActual, nombreNuevo) => {
    const nuevo = limpiarNombre(nombreNuevo);
    if (!nuevo) return false;
    const actual = limpiarNombre(nombreActual);

    const cliente = tienda.state.clientes.find(c => normalizarNombre(c.nombre) === normalizarNombre(actual));
    if (!cliente) {
      console.warn('renombrarCliente: cliente no encontrado', actual);
      return false;
    }
    if (nuevo === cliente.nombre) return true; // sin cambio real: nada que guardar
    const perteneceAOtroCliente = tienda.state.clientes.some(c =>
      c.id !== cliente.id && normalizarNombre(c.nombre) === normalizarNombre(nuevo),
    );
    if (perteneceAOtroCliente) {
      console.warn('renombrarCliente: el nombre ya pertenece a otro cliente, renombrado bloqueado');
      return false;
    }

    const evento = nuevoEvento(LOG_TIPOS.CLIENTE_RENOMBRADO, `Cliente renombrado: "${cliente.nombre}" → "${nuevo}"`);

    // Una sola fila, en memoria y en la BD: ventas y abonos guardan el
    // cliente_id y las consultas traen el nombre con un JOIN.
    tienda.setState(prev => ({
      clientes:    prev.clientes.map(c => c.id === cliente.id ? { ...c, nombre: nuevo } : c),
    }));

    persistir(async tx => {
      await renombrarClienteBD(tx, cliente.id, nuevo);
      await crearEvento(tx, evento);
    }, 'renombrarCliente');

    return true;
  },
});
