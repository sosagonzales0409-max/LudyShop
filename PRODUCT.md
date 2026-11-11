# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Dueño(a) de una tienda de abarrotes que atiende solo(a) en el mostrador. Cobra rápido, a veces con una mano, mientras despacha y platica con el cliente. Usa el teléfono todo el día, de mañana a noche, con luz de día y con luz de lámpara.

## Product Purpose

LudyShop lleva la tienda en el teléfono, sin internet: ventas al contado y a crédito, abonos de clientes, inventario (incluye granel), compras a proveedores, reportes, corte del día y copias de seguridad. Éxito: cobrar sin hacer cuentas, saber quién debe y cuánto, y saber qué hay en el anaquel y qué falta.

## Positioning

Hecha para la tienda de la esquina, no para un supermercado: el "fiado" (crédito con abonos) es parte central del día, no un extra, y todo funciona offline en un solo teléfono.

## Operating Context

- Mostrador con fila de clientes: la venta debe cerrarse en segundos.
- Crédito informal: clientes conocidos por nombre, saldos que se abonan poco a poco.
- Productos con presentación (1 kg, 600 ml), a granel (kg, g, L, ml) o por paquete/reja.
- Compras a proveedores, en mercado u otra tienda (a veces sin proveedor).
- Corte al final del día: contado vendido, abonos recibidos, número de ventas.

## Capabilities and Constraints

- React Native 0.83, solo Android, offline (SQLite). Publicada en Play Store como `com.ludyshop.app`.
- El rediseño no cambia funcionalidad, flujos, validaciones ni datos.
- Dos pestañas hoy: Ventas e Inventario; varias pantallas viven en ambos stacks.
- Moneda configurable; dinero y cantidades se muestran con `formatoDinero` / `formatoCantidad` / `nombreProducto`.
- No agregar dependencias nativas sin consultarlo.
- Código, textos y nombres en español.

## Brand Commitments

- El nombre **LudyShop** se conserva.
- Todo lo visual (colores, tipografía, barra verde superior, íconos) queda libre para el rediseño.

## Evidence on Hand

- Datos de ejemplo de un año en `src/data/seed.js` (solo desarrollo). No hay clientes, testimonios ni cifras reales para usar en material público.

## Product Principles

1. Cobrar primero: la acción de venta nunca queda a más de un toque.
2. El dinero se lee sin esfuerzo: totales y saldos son lo más grande de su pantalla.
3. Lo que exige atención (deuda, stock bajo) se nota por forma y color, no solo por un número.
4. Una mano, luz cambiante: objetivos táctiles grandes y contraste que aguante sol y lámpara.

## Accessibility & Inclusion

Toques de al menos 48 dp, texto que respete el tamaño de fuente del sistema y contraste AA en ambos temas.
