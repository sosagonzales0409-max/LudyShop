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
//
// Paleta (rediseño nov 2026): la misma familia de colores de siempre,
// afinada para que se lea bien con sol (contraste AA sobre blanco):
//   - primary un poco más profundo: el texto blanco encima pasa de 3.5:1 a 4.7:1.
//   - grises con un toque azul para que combinen con el primario.
//   - success/danger más oscuros para usarse también como texto.
//   - warning es solo RELLENO (2:1 como texto); para texto usar warningDark.
//   - *Soft: fondos claros de las etiquetas de estado (ver Estados.js).

export const colors = {
  primary: '#0A72E0',
  primaryDark: '#0A5FBF',   // texto azul pequeño sobre blanco
  primarySoft: '#E6F0FC',   // fondo de botones tonales, pestaña activa
  success: '#1E8449',
  successDark: '#17693A',   // texto verde sobre successSoft
  successSoft: '#E3F3E9',
  danger: '#C9372C',
  dangerDark: '#A32B22',    // texto rojo sobre dangerSoft (deudas, agotado)
  dangerSoft: '#FBE7E5',
  warning: '#F29A2E',       // solo relleno (puntos, barras); nunca texto
  warningDark: '#9A560B',   // texto de aviso sobre warningSoft
  warningSoft: '#FDF0DE',
  background: '#F2F5F9',
  card: '#FFFFFF',
  border: '#ECF0F4',        // divisores dentro de tarjetas
  cardBorder: '#DFE5EC',    // borde de tarjetas y barras
  chipInactive: '#E4E9F0',
  textPrimary: '#16202B',
  textSecondary: '#5C6773',
  textMuted: '#6B7480',     // antes #999 (2.8:1); ahora cumple AA
  label: '#3A4552',         // etiquetas de campo
  placeholder: '#6B7480',   // placeholders, ayudas y sufijos
  inputBorder: '#D3D9E1',   // borde de campos de texto
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

// Encabezado azul compartido (Encabezado.js): alto de la fila del título,
// sin contar la barra de estado del sistema (se suma aparte).
export const HEADER_ALTO = 56;

// Tarjeta estándar: borde fino en vez de sombra (una sola forma de elevar).
export const tarjeta = {
  backgroundColor: colors.card,
  borderWidth: 1,
  borderColor: colors.cardBorder,
  borderRadius: radius.md,
};

export default { colors, spacing, radius, fontSize, buttonHeight, iconButton, HEADER_ALTO, tarjeta };
