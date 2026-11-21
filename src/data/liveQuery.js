import { suscribirCambios } from './changes';

// ─── Consulta viva: datos de una pantalla que se recargan solos ───────────────
// Para pantallas que consultan la BD bajo demanda en vez de leer todo de
// memoria: carga al crearse y vuelve a cargar cada vez que una transacción
// escribe en alguna de sus `tablas`.
//
// Uso en un componente de clase:
//   componentDidMount() {
//     this.consulta = crearConsultaViva({
//       tablas:   ['activity_log'],
//       cargar:   () => cargarLog({ limite: 50 }),
//       alCargar: eventos => this.setState({ eventos, cargando: false }),
//       alFallar: error => this.setState({ error: error.message, cargando: false }),
//     });
//   }
//   componentWillUnmount() { this.consulta?.detener(); }
//
// Carrera de respuestas: si llegan dos recargas seguidas y la primera termina
// DESPUÉS que la segunda, sus datos (más viejos) se descartan — cada recarga
// lleva un turno y solo gana la última.

export const crearConsultaViva = ({ tablas, cargar, alCargar, alFallar = console.error }) => {
  let turno = 0;
  let activa = true;

  const recargar = async () => {
    const miTurno = ++turno;
    try {
      const datos = await cargar();
      if (activa && miTurno === turno) alCargar(datos);
    } catch (error) {
      if (activa && miTurno === turno) alFallar(error);
    }
  };

  const desuscribir = suscribirCambios(tablas, recargar);
  recargar();

  return {
    recargar,
    // Al desmontar la pantalla: dejar de escuchar y descartar respuestas pendientes.
    detener: () => { activa = false; desuscribir(); },
  };
};
