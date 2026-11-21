// Sustituto de ui/Toast para el arnés: no hay pantalla, así que solo
// guarda los mensajes (por si una prueba quiere revisar qué se avisó).
const Toast = {
  mensajes: [],
  show(mensaje, tipo = 'success') { Toast.mensajes.push({ mensaje, tipo }); },
  setRef() {},
};
export default Toast;
