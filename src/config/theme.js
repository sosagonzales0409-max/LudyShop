// Design tokens compartidos por toda la app.
//
// Objetivo: que el mismo TIPO de elemento (título de pantalla, nombre de
// producto, texto de marca, botón principal, etc.) se vea exactamente igual
// sin importar en qué pantalla o modal aparezca. Antes de este archivo,
// cada componente definía sus propios números "a ojo" (fontSize 12, 13, 14...
// height 45, 48... borderRadius 10, 12, 15, 20...), lo que hacía que la app
// se sintiera inconsistente.
//
// Jerarquía tipográfica (de mayor a menor):
//   heading (20)   -> título de pantalla / título de modal
//   itemTitle (18) -> nombre de producto, total del carrito
//   label (16)     -> labels de formulario, texto de botones
//   body (15)      -> texto normal, precios, stock
//   caption (13)   -> marca, subtítulos secundarios, ayudas
//   small (12)     -> badges chicos, texto de íconos inline

export const colors = {
  primary: '#0088ff',
  success: '#2E9E5B',
  danger: '#D9534F',
  warning: '#FC9E3A',
  background: '#F5F5F5',
  card: '#FFFFFF',
  border: '#EEEEEE',
  chipInactive: '#E5E5E5',
  textPrimary: '#1A1A1A',
  textSecondary: '#7A7C80',
  textMuted: '#999999',
  white: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const radius = {
  sm: 8,   // botones de ícono pequeños
  md: 12,  // tarjetas
  lg: 14,  // botones y chips
  xl: 20,  // modales / bottom sheets
};

export const fontSize = {
  small: 12,
  caption: 13,
  body: 15,
  label: 16,
  itemTitle: 18,
  heading: 20,
  splash: 24,
};

export const buttonHeight = {
  chip: 44,   // categorías, tipo de pago
  action: 48, // botones principales (CTA) y los que los acompañan
};

// Botones de ícono chicos e inline (+, ✏️, D, etc.) — mismo tamaño de toque
// en toda la app en vez de que cada uno tenga su propio padding/tamaño.
export const iconButton = {
  size: 32,
  radius: radius.sm,
};

export default { colors, spacing, radius, fontSize, buttonHeight, iconButton };
