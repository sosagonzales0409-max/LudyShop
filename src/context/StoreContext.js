import React, { createContext, Component } from 'react';

// ─── Datos semilla ────────────────────────────────────────────────────────────
// Los campos nuevos (precioCompra, esGranel, unidadGranel) son opcionales
// en presentaciones existentes — se tratan como null/false si no están presentes.

const initialProducts = [
  {
    id: '1', nombre: 'Arroz', marca: 'Verde Valle', categoriaId: '1',
    presentaciones: [
      { id: '1-1', tamano: '1 kg',   precio: 28.5, precioCompra: 22.0, stock: 4,  esGranel: false, unidadGranel: null },
      { id: '1-2', tamano: '1/2 kg', precio: 16.0, precioCompra: 12.0, stock: 10, esGranel: false, unidadGranel: null },
    ],
  },
  { id: '2',  nombre: 'Frijol',          marca: 'La Costeña', categoriaId: '1', presentaciones: [{ id: '2-1',  tamano: '1 kg',          precio: 32.0, precioCompra: 25.0, stock: 35, esGranel: false, unidadGranel: null }] },
  { id: '3',  nombre: 'Azúcar',          marca: 'Zulka',      categoriaId: '1', presentaciones: [{ id: '3-1',  tamano: '1 kg',          precio: 27.0, precioCompra: 20.5, stock: 50, esGranel: false, unidadGranel: null }] },
  { id: '4',  nombre: 'Aceite vegetal',  marca: '1-2-3',      categoriaId: '2', presentaciones: [{ id: '4-1',  tamano: '1 L',           precio: 38.9, precioCompra: 30.0, stock: 25, esGranel: false, unidadGranel: null }] },
  { id: '5',  nombre: 'Atún en lata',    marca: 'Dolores',    categoriaId: '2', presentaciones: [{ id: '5-1',  tamano: '140 g',         precio: 18.5, precioCompra: 13.0, stock: 45, esGranel: false, unidadGranel: null }] },
  { id: '6',  nombre: 'Leche entera',    marca: 'Lala',       categoriaId: '3', presentaciones: [{ id: '6-1',  tamano: '1 L',           precio: 24.5, precioCompra: 18.5, stock: 30, esGranel: false, unidadGranel: null }] },
  { id: '7',  nombre: 'Huevo',           marca: 'San Juan',   categoriaId: '3', presentaciones: [{ id: '7-1',  tamano: 'Cartón 12 pzas',precio: 36.0, precioCompra: 28.0, stock: 15, esGranel: false, unidadGranel: null }] },
  { id: '8',  nombre: 'Pan blanco',      marca: 'Bimbo',      categoriaId: '4', presentaciones: [{ id: '8-1',  tamano: 'Chico',         precio: 34.0, precioCompra: 26.0, stock: 20, esGranel: false, unidadGranel: null }] },
  { id: '9',  nombre: 'Agua embotellada',marca: 'Ciel',       categoriaId: '5', presentaciones: [{ id: '9-1',  tamano: '1.5 L',         precio: 15.0, precioCompra: 10.5, stock: 70, esGranel: false, unidadGranel: null }] },
  {
    id: '10', nombre: 'Coca-Cola', marca: 'Coca-Cola', categoriaId: '5',
    presentaciones: [
      { id: '10-1', tamano: '3 L',    precio: 45.0, precioCompra: 34.0, stock: 25, esGranel: false, unidadGranel: null },
      { id: '10-2', tamano: '600 ml', precio: 18.0, precioCompra: 12.5, stock: 40, esGranel: false, unidadGranel: null },
    ],
  },
  // Producto a granel de ejemplo — el toggle esGranel = true
  {
    id: '11', nombre: 'Frijol a granel', marca: 'Local', categoriaId: '1',
    presentaciones: [
      { id: '11-1', tamano: 'por kg', precio: 30.0, precioCompra: 22.0, stock: 8.5, esGranel: true, unidadGranel: 'kg' },
    ],
  },
];

const initialCategories = [
  { id: 0,   nombre: 'Todos' },
  { id: '1', nombre: 'Granos' },
  { id: '2', nombre: 'Despensa' },
  { id: '3', nombre: 'Lácteos' },
  { id: '4', nombre: 'Panadería' },
  { id: '5', nombre: 'Bebidas' },
];

// ─── Helpers de tiempo ────────────────────────────────────────────────────────

const diasAtras = (dias, hora = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
};

// ─── Generadores de IDs ───────────────────────────────────────────────────────

let abonoSeq   = 0;
let logSeq     = 0;
let compraSeq  = 0;

const nuevoIdAbono  = () => `abo-${Date.now().toString(36)}-${abonoSeq++}`;
const nuevoIdLog    = () => `log-${Date.now().toString(36)}-${logSeq++}`;
const nuevoIdCompra = () => `cmp-${Date.now().toString(36)}-${compraSeq++}`;

const MAX_LOG = 500;

// ─── Ventas semilla ───────────────────────────────────────────────────────────

const initialSales = [
  { id: 'seed-1',  fecha: diasAtras(0, 18),  tipoPago: 'Contado', cliente: null,                total: 83.0,   totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '8',  presentacionId: '8-1',  nombre: 'Pan blanco',      marca: 'Bimbo',       tamano: 'Chico',          precio: 34.0, numProducts: 2,  totalPrice: 68.0  }, { productId: '9',  presentacionId: '9-1',  nombre: 'Agua embotellada', marca: 'Ciel',        tamano: '1.5 L',          precio: 15.0, numProducts: 1,  totalPrice: 15.0  }] },
  { id: 'seed-2',  fecha: diasAtras(0, 14),  tipoPago: 'Contado', cliente: null,                total: 122.5,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '1',  presentacionId: '1-1',  nombre: 'Arroz',           marca: 'Verde Valle', tamano: '1 kg',           precio: 28.5, numProducts: 3,  totalPrice: 85.5  }, { productId: '5',  presentacionId: '5-1',  nombre: 'Atún en lata',    marca: 'Dolores',     tamano: '140 g',          precio: 18.5, numProducts: 2,  totalPrice: 37.0  }] },
  { id: 'seed-3',  fecha: diasAtras(0, 17),  tipoPago: 'Contado', cliente: null,                total: 154.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '10', presentacionId: '10-2', nombre: 'Coca-Cola',       marca: 'Coca-Cola',   tamano: '600 ml',         precio: 18.0, numProducts: 5,  totalPrice: 90.0  }, { productId: '2',  presentacionId: '2-1',  nombre: 'Frijol',          marca: 'La Costeña',  tamano: '1 kg',           precio: 32.0, numProducts: 2,  totalPrice: 64.0  }] },
  { id: 'seed-4',  fecha: diasAtras(0, 10),  tipoPago: 'Credito', cliente: 'Tienda La Esquina', total: 354.0,  totalAbonado: 100.0, condonado: 0, productos: [{ productId: '9',  presentacionId: '9-1',  nombre: 'Agua embotellada',marca: 'Ciel',        tamano: '1.5 L',          precio: 15.0, numProducts: 10, totalPrice: 150.0 }, { productId: '8',  presentacionId: '8-1',  nombre: 'Pan blanco',      marca: 'Bimbo',       tamano: 'Chico',          precio: 34.0, numProducts: 6,  totalPrice: 204.0 }] },
  { id: 'seed-5',  fecha: diasAtras(0, 12),  tipoPago: 'Credito', cliente: 'Doña Rosa',         total: 145.5,  totalAbonado: 0.0,   condonado: 50.0, productos: [{ productId: '7',  presentacionId: '7-1',  nombre: 'Huevo',           marca: 'San Juan',    tamano: 'Cartón 12 pzas', precio: 36.0, numProducts: 2,  totalPrice: 72.0  }, { productId: '6',  presentacionId: '6-1',  nombre: 'Leche entera',    marca: 'Lala',        tamano: '1 L',            precio: 24.5, numProducts: 3,  totalPrice: 73.5  }] },
  { id: 'seed-6',  fecha: diasAtras(2, 16),  tipoPago: 'Contado', cliente: null,                total: 126.5,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '3',  presentacionId: '3-1',  nombre: 'Azúcar',          marca: 'Zulka',       tamano: '1 kg',           precio: 27.0, numProducts: 4,  totalPrice: 108.0 }, { productId: '5',  presentacionId: '5-1',  nombre: 'Atún en lata',    marca: 'Dolores',     tamano: '140 g',          precio: 18.5, numProducts: 1,  totalPrice: 18.5  }] },
  { id: 'seed-7',  fecha: diasAtras(3, 15),  tipoPago: 'Contado', cliente: null,                total: 147.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '6',  presentacionId: '6-1',  nombre: 'Leche entera',    marca: 'Lala',        tamano: '1 L',            precio: 24.5, numProducts: 6,  totalPrice: 147.0 }] },
  { id: 'seed-8',  fecha: diasAtras(4, 13),  tipoPago: 'Contado', cliente: null,                total: 360.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '10', presentacionId: '10-1', nombre: 'Coca-Cola',       marca: 'Coca-Cola',   tamano: '3 L',            precio: 45.0, numProducts: 8,  totalPrice: 360.0 }] },
  { id: 'seed-9',  fecha: diasAtras(1, 11),  tipoPago: 'Credito', cliente: 'Juan Pérez',        total: 36.0,   totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '7',  presentacionId: '7-1',  nombre: 'Huevo',           marca: 'San Juan',    tamano: 'Cartón 12 pzas', precio: 36.0, numProducts: 1,  totalPrice: 36.0  }] },
  { id: 'seed-10', fecha: diasAtras(3, 9),   tipoPago: 'Credito', cliente: 'María García',      total: 116.7,  totalAbonado: 50.0,  condonado: 0, productos: [{ productId: '4',  presentacionId: '4-1',  nombre: 'Aceite vegetal',  marca: '1-2-3',       tamano: '1 L',            precio: 38.9, numProducts: 3,  totalPrice: 116.7 }] },
  { id: 'seed-11', fecha: diasAtras(8, 12),  tipoPago: 'Contado', cliente: null,                total: 113.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '9',  presentacionId: '9-1',  nombre: 'Agua embotellada',marca: 'Ciel',        tamano: '1.5 L',          precio: 15.0, numProducts: 3,  totalPrice: 45.0  }, { productId: '8',  presentacionId: '8-1',  nombre: 'Pan blanco',      marca: 'Bimbo',       tamano: 'Chico',          precio: 34.0, numProducts: 2,  totalPrice: 68.0  }] },
  { id: 'seed-12', fecha: diasAtras(10, 17), tipoPago: 'Contado', cliente: null,                total: 146.5,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '5',  presentacionId: '5-1',  nombre: 'Atún en lata',    marca: 'Dolores',     tamano: '140 g',          precio: 18.5, numProducts: 5,  totalPrice: 92.5  }, { productId: '3',  presentacionId: '3-1',  nombre: 'Azúcar',          marca: 'Zulka',       tamano: '1 kg',           precio: 27.0, numProducts: 2,  totalPrice: 54.0  }] },
  { id: 'seed-13', fecha: diasAtras(15, 14), tipoPago: 'Contado', cliente: null,                total: 128.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '2',  presentacionId: '2-1',  nombre: 'Frijol',          marca: 'La Costeña',  tamano: '1 kg',           precio: 32.0, numProducts: 4,  totalPrice: 128.0 }] },
  { id: 'seed-14', fecha: diasAtras(20, 10), tipoPago: 'Contado', cliente: null,                total: 145.5,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '6',  presentacionId: '6-1',  nombre: 'Leche entera',    marca: 'Lala',        tamano: '1 L',            precio: 24.5, numProducts: 3,  totalPrice: 73.5  }, { productId: '7',  presentacionId: '7-1',  nombre: 'Huevo',           marca: 'San Juan',    tamano: 'Cartón 12 pzas', precio: 36.0, numProducts: 2,  totalPrice: 72.0  }] },
  { id: 'seed-15', fecha: diasAtras(10, 15), tipoPago: 'Credito', cliente: 'María García',      total: 225.0,  totalAbonado: 225.0, condonado: 0, productos: [{ productId: '10', presentacionId: '10-1', nombre: 'Coca-Cola',       marca: 'Coca-Cola',   tamano: '3 L',            precio: 45.0, numProducts: 5,  totalPrice: 225.0 }] },
  { id: 'seed-16', fecha: diasAtras(2, 13),  tipoPago: 'Credito', cliente: 'Juan Pérez',        total: 81.5,   totalAbonado: 30.0,  condonado: 0, productos: [{ productId: '1',  presentacionId: '1-1',  nombre: 'Arroz',           marca: 'Verde Valle', tamano: '1 kg',           precio: 28.5, numProducts: 2,  totalPrice: 57.0  }, { productId: '6',  presentacionId: '6-1',  nombre: 'Leche entera',    marca: 'Lala',        tamano: '1 L',            precio: 24.5, numProducts: 1,  totalPrice: 24.5  }] },
  { id: 'seed-17', fecha: diasAtras(32, 11), tipoPago: 'Contado', cliente: null,                total: 261.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '3',  presentacionId: '3-1',  nombre: 'Azúcar',          marca: 'Zulka',       tamano: '1 kg',           precio: 27.0, numProducts: 8,  totalPrice: 216.0 }, { productId: '9',  presentacionId: '9-1',  nombre: 'Agua embotellada',marca: 'Ciel',        tamano: '1.5 L',          precio: 15.0, numProducts: 3,  totalPrice: 45.0  }] },
  { id: 'seed-18', fecha: diasAtras(45, 16), tipoPago: 'Contado', cliente: null,                total: 142.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '5',  presentacionId: '5-1',  nombre: 'Atún en lata',    marca: 'Dolores',     tamano: '140 g',          precio: 18.5, numProducts: 4,  totalPrice: 74.0  }, { productId: '8',  presentacionId: '8-1',  nombre: 'Pan blanco',      marca: 'Bimbo',       tamano: 'Chico',          precio: 34.0, numProducts: 2,  totalPrice: 68.0  }] },
  { id: 'seed-19', fecha: diasAtras(30, 9),  tipoPago: 'Credito', cliente: 'Roberto Díaz',      total: 128.0,  totalAbonado: 0.0,   condonado: 0, productos: [{ productId: '2',  presentacionId: '2-1',  nombre: 'Frijol',          marca: 'La Costeña',  tamano: '1 kg',           precio: 32.0, numProducts: 4,  totalPrice: 128.0 }] },
  { id: 'seed-20', fecha: diasAtras(45, 10), tipoPago: 'Credito', cliente: 'Lupita Torres',     total: 165.7,  totalAbonado: 50.0,  condonado: 0, productos: [{ productId: '4',  presentacionId: '4-1',  nombre: 'Aceite vegetal',  marca: '1-2-3',       tamano: '1 L',            precio: 38.9, numProducts: 3,  totalPrice: 116.7 }, { productId: '6',  presentacionId: '6-1',  nombre: 'Leche entera',    marca: 'Lala',        tamano: '1 L',            precio: 24.5, numProducts: 2,  totalPrice: 49.0  }] },
];

// ─── Abonos semilla ───────────────────────────────────────────────────────────

const initialAbonos = [
  { id: 'seed-a1', fecha: diasAtras(0, 11),  cliente: 'Tienda La Esquina', ventaId: 'seed-4',  monto: 100.0, tipo: 'abono' },
  { id: 'seed-a2', fecha: diasAtras(2, 15),  cliente: 'María García',      ventaId: 'seed-10', monto: 50.0,  tipo: 'abono' },
  { id: 'seed-a3', fecha: diasAtras(10, 18), cliente: 'María García',      ventaId: 'seed-15', monto: 225.0, tipo: 'abono' },
  { id: 'seed-a4', fecha: diasAtras(1, 12),  cliente: 'Juan Pérez',        ventaId: 'seed-16', monto: 30.0,  tipo: 'abono' },
  { id: 'seed-a5', fecha: diasAtras(20, 12), cliente: 'Lupita Torres',     ventaId: 'seed-20', monto: 50.0,  tipo: 'abono' },
  { id: 'seed-a6', fecha: diasAtras(5, 11),  cliente: 'Doña Rosa',         ventaId: 'seed-5',  monto: 50.0,  tipo: 'condonacion' },
];

// ─── Compras semilla ──────────────────────────────────────────────────────────
// Representan compras reales con distintos proveedores, incluyendo un caso
// de compra por paquete/reja (el costoUnitario ya viene calculado).

const initialCompras = [
  {
    id: 'seed-c1',
    fecha: diasAtras(1, 9),
    proveedor: 'Distribuidora García',
    tipoPago: 'Contado',
    notas: '',
    total: 502.5,
    items: [
      { productId: '1',  presentacionId: '1-1',  nombre: 'Arroz',          tamano: '1 kg',          cantidad: 10, costoUnitario: 22.0,  subtotal: 220.0 },
      { productId: '9',  presentacionId: '9-1',  nombre: 'Agua embotellada',tamano: '1.5 L',         cantidad: 24, costoUnitario: 10.5,  subtotal: 252.0 },
      { productId: '3',  presentacionId: '3-1',  nombre: 'Azúcar',         tamano: '1 kg',          cantidad: 1,  costoUnitario: 20.5,  subtotal: 20.5  },
    ],
  },
  {
    id: 'seed-c2',
    fecha: diasAtras(3, 10),
    proveedor: 'Coca-Cola FEMSA',
    tipoPago: 'Contado',
    notas: 'Compra por reja de 24 pzas 600ml — costo unitario calculado',
    total: 300.0,
    // Reja de 24 Coca-Cola 600ml por $300 → $12.50 c/u
    items: [
      { productId: '10', presentacionId: '10-2', nombre: 'Coca-Cola', tamano: '600 ml', cantidad: 24, costoUnitario: 12.5, subtotal: 300.0 },
    ],
  },
  {
    id: 'seed-c3',
    fecha: diasAtras(7, 8),
    proveedor: 'Distribuidora García',
    tipoPago: 'Credito',
    notas: 'Pago a 15 días',
    total: 575.0,
    items: [
      { productId: '5',  presentacionId: '5-1',  nombre: 'Atún en lata',   tamano: '140 g',         cantidad: 20, costoUnitario: 13.0, subtotal: 260.0 },
      { productId: '4',  presentacionId: '4-1',  nombre: 'Aceite vegetal', tamano: '1 L',           cantidad: 10, costoUnitario: 30.0, subtotal: 300.0 },
      { productId: '6',  presentacionId: '6-1',  nombre: 'Leche entera',   tamano: '1 L',           cantidad: 5,  costoUnitario: 18.5, subtotal: 92.5  },
    ],
  },
  {
    id: 'seed-c4',
    fecha: diasAtras(15, 11),
    proveedor: 'Panadería El Molino',
    tipoPago: 'Contado',
    notas: '',
    total: 520.0,
    items: [
      { productId: '8',  presentacionId: '8-1',  nombre: 'Pan blanco', tamano: 'Chico', cantidad: 20, costoUnitario: 26.0, subtotal: 520.0 },
    ],
  },
  {
    id: 'seed-c5',
    fecha: diasAtras(20, 9),
    proveedor: 'Lácteos del Norte',
    tipoPago: 'Contado',
    notas: '',
    total: 532.0,
    items: [
      { productId: '6',  presentacionId: '6-1',  nombre: 'Leche entera', tamano: '1 L',           cantidad: 18, costoUnitario: 18.5, subtotal: 333.0 },
      { productId: '7',  presentacionId: '7-1',  nombre: 'Huevo',        tamano: 'Cartón 12 pzas',cantidad: 7,  costoUnitario: 28.0, subtotal: 196.0 },
    ],
  },
  {
    id: 'seed-c6',
    fecha: diasAtras(32, 14),
    proveedor: 'Distribuidora García',
    tipoPago: 'Contado',
    notas: '',
    total: 380.0,
    items: [
      { productId: '2',  presentacionId: '2-1',  nombre: 'Frijol', tamano: '1 kg', cantidad: 10, costoUnitario: 25.0, subtotal: 250.0 },
      { productId: '1',  presentacionId: '1-1',  nombre: 'Arroz',  tamano: '1 kg', cantidad: 6,  costoUnitario: 22.0, subtotal: 132.0 },
    ],
  },
];

// ─── Log de actividad semilla ─────────────────────────────────────────────────

const initialActivityLog = [
  { id: 'slog-1',  tipo: 'venta',                  fecha: diasAtras(0, 18),  desc: 'Venta $83.00 · 2 productos (Contado)' },
  { id: 'slog-2',  tipo: 'venta',                  fecha: diasAtras(0, 17),  desc: 'Venta $154.00 · 2 productos (Contado)' },
  { id: 'slog-3',  tipo: 'venta',                  fecha: diasAtras(0, 14),  desc: 'Venta $122.50 · 2 productos (Contado)' },
  { id: 'slog-4',  tipo: 'venta_credito',          fecha: diasAtras(0, 12),  desc: 'Venta $145.50 a crédito · Doña Rosa' },
  { id: 'slog-5',  tipo: 'abono',                  fecha: diasAtras(0, 11),  desc: 'Abono $100.00 · Tienda La Esquina' },
  { id: 'slog-6',  tipo: 'venta_credito',          fecha: diasAtras(0, 10),  desc: 'Venta $354.00 a crédito · Tienda La Esquina · abono inicial $100.00' },
  { id: 'slog-7',  tipo: 'stock_agregado',         fecha: diasAtras(1, 18),  desc: '+24 uds · Coca-Cola 600 ml (stock anterior: 16)' },
  { id: 'slog-8',  tipo: 'abono',                  fecha: diasAtras(1, 12),  desc: 'Abono $30.00 · Juan Pérez' },
  { id: 'slog-9',  tipo: 'venta_credito',          fecha: diasAtras(1, 11),  desc: 'Venta $36.00 a crédito · Juan Pérez' },
  // ─── Compras semilla en el log ───
  { id: 'slog-c1', tipo: 'compra',                 fecha: diasAtras(1, 9),   desc: 'Compra $502.50 · 3 productos · Distribuidora García (Contado)' },
  { id: 'slog-10', tipo: 'precio_editado',         fecha: diasAtras(1, 10),  desc: 'Arroz 1 kg: $27.00 → $28.50' },
  { id: 'slog-11', tipo: 'consumo_propio',         fecha: diasAtras(2, 19),  desc: 'Consumo propio: 2 × Coca-Cola 600 ml' },
  { id: 'slog-12', tipo: 'venta',                  fecha: diasAtras(2, 16),  desc: 'Venta $126.50 · 2 productos (Contado)' },
  { id: 'slog-13', tipo: 'abono',                  fecha: diasAtras(2, 15),  desc: 'Abono $50.00 · María García' },
  { id: 'slog-14', tipo: 'venta_credito',          fecha: diasAtras(2, 13),  desc: 'Venta $81.50 a crédito · Juan Pérez · abono inicial $30.00' },
  { id: 'slog-15', tipo: 'stock_ajustado',         fecha: diasAtras(2, 12),  desc: 'Stock ajustado: Huevo Cartón 12 pzas · 18 → 15 uds' },
  { id: 'slog-c2', tipo: 'compra',                 fecha: diasAtras(3, 10),  desc: 'Compra $300.00 · 1 producto · Coca-Cola FEMSA (Contado) · reja 24 pzas 600ml' },
  { id: 'slog-16', tipo: 'abono_editado',          fecha: diasAtras(3, 17),  desc: 'Abono corregido $30.00 → $50.00 · Juan Pérez' },
  { id: 'slog-17', tipo: 'venta',                  fecha: diasAtras(3, 15),  desc: 'Venta $147.00 · 1 producto (Contado)' },
  { id: 'slog-18', tipo: 'venta_credito',          fecha: diasAtras(3, 9),   desc: 'Venta $116.70 a crédito · María García · abono inicial $50.00' },
  { id: 'slog-19', tipo: 'venta',                  fecha: diasAtras(4, 13),  desc: 'Venta $360.00 · 1 producto (Contado)' },
  { id: 'slog-20', tipo: 'producto_nuevo',         fecha: diasAtras(4, 10),  desc: 'Nuevo producto: Galletas María 170 g (Gamesa) · stock inicial 30' },
  { id: 'slog-21', tipo: 'cliente_renombrado',     fecha: diasAtras(5, 12),  desc: 'Cliente renombrado: "Juan" → "Juan Pérez"' },
  { id: 'slog-22', tipo: 'condonacion',            fecha: diasAtras(5, 11),  desc: 'Deuda condonada $50.00 · Doña Rosa' },
  { id: 'slog-c3', tipo: 'compra',                 fecha: diasAtras(7, 8),   desc: 'Compra $575.00 · 3 productos · Distribuidora García (Crédito 15 días)' },
  { id: 'slog-23', tipo: 'presentacion_nueva',     fecha: diasAtras(6, 14),  desc: 'Nueva presentación: Galletas María 340 g · $52.00 · stock 12' },
  { id: 'slog-24', tipo: 'presentacion_eliminada', fecha: diasAtras(7, 16),  desc: 'Eliminada: Coca-Cola 1.5 L' },
  { id: 'slog-25', tipo: 'categoria_creada',       fecha: diasAtras(8, 11),  desc: 'Nueva categoría: Snacks' },
  { id: 'slog-26', tipo: 'categoria_renombrada',   fecha: diasAtras(9, 15),  desc: 'Categoría renombrada: "Bebidas" → "Refrescos y agua"' },
  { id: 'slog-27', tipo: 'categoria_eliminada',    fecha: diasAtras(12, 13), desc: 'Categoría eliminada: Dulces' },
];

// ─── Configuración por defecto ────────────────────────────────────────────────

const defaultConfig = {
  nombreTienda: 'Mi Tienda',
  nombreDueno: '',
  moneda: '$',
  umbralStock: 5,
};

// ─── Tipos y meta del log ─────────────────────────────────────────────────────

export const LOG_TIPOS = {
  VENTA:                  'venta',
  VENTA_CREDITO:          'venta_credito',
  ABONO:                  'abono',
  ABONO_EDITADO:          'abono_editado',
  CONDONACION:            'condonacion',
  DEVOLUCION:             'devolucion',
  VENTA_ELIMINADA:        'venta_eliminada',
  COMPRA:                 'compra',
  COMPRA_ELIMINADA:       'compra_eliminada',
  PRECIO_EDITADO:         'precio_editado',
  STOCK_AGREGADO:         'stock_agregado',
  STOCK_AJUSTADO:         'stock_ajustado',
  CONSUMO_PROPIO:         'consumo_propio',
  PRODUCTO_NUEVO:         'producto_nuevo',
  PRESENTACION_NUEVA:     'presentacion_nueva',
  PRESENTACION_ELIMINADA: 'presentacion_eliminada',
  CLIENTE_RENOMBRADO:     'cliente_renombrado',
  CATEGORIA_CREADA:       'categoria_creada',
  CATEGORIA_RENOMBRADA:   'categoria_renombrada',
  CATEGORIA_ELIMINADA:    'categoria_eliminada',
};

export const LOG_META = {
  venta:                  { icono: '🛒', filtro: 'ventas',     label: 'Venta' },
  venta_credito:          { icono: '💳', filtro: 'creditos',   label: 'Venta a crédito' },
  abono:                  { icono: '💵', filtro: 'creditos',   label: 'Abono' },
  abono_editado:          { icono: '✏️', filtro: 'creditos',   label: 'Abono editado' },
  condonacion:            { icono: '🤝', filtro: 'creditos',   label: 'Condonación' },
  devolucion:             { icono: '↩️', filtro: 'ventas',     label: 'Devolución' },
  venta_eliminada:        { icono: '🗑️', filtro: 'ventas',     label: 'Venta eliminada' },
  compra:                 { icono: '🛍️', filtro: 'compras',    label: 'Compra' },
  compra_eliminada:       { icono: '🗑️', filtro: 'compras',    label: 'Compra eliminada' },
  precio_editado:         { icono: '🏷️', filtro: 'inventario', label: 'Precio editado' },
  stock_agregado:         { icono: '📦', filtro: 'inventario', label: 'Stock agregado' },
  stock_ajustado:         { icono: '🔧', filtro: 'inventario', label: 'Stock ajustado' },
  consumo_propio:         { icono: '🔸', filtro: 'inventario', label: 'Consumo propio' },
  producto_nuevo:         { icono: '✨', filtro: 'inventario', label: 'Producto nuevo' },
  presentacion_nueva:     { icono: '➕', filtro: 'inventario', label: 'Presentación nueva' },
  presentacion_eliminada: { icono: '🗑️', filtro: 'inventario', label: 'Presentación eliminada' },
  cliente_renombrado:     { icono: '👤', filtro: 'otros',      label: 'Cliente renombrado' },
  categoria_creada:       { icono: '🏷️', filtro: 'otros',      label: 'Categoría creada' },
  categoria_renombrada:   { icono: '✏️', filtro: 'otros',      label: 'Categoría renombrada' },
  categoria_eliminada:    { icono: '🗑️', filtro: 'otros',      label: 'Categoría eliminada' },
};

// ─── Utilidad: normalizar presentación con defaults de nuevos campos ──────────
// Garantiza retrocompatibilidad: presentaciones viejas sin precioCompra/esGranel
// funcionan igual que antes.

const normalizarPresentacion = pres => ({
  precioCompra: null,
  esGranel: false,
  unidadGranel: null,
  ...pres,
});

export const StoreContext = createContext(null);

export class StoreProvider extends Component {
  state = {
    products:    initialProducts,
    categories:  initialCategories,
    sales:       initialSales,
    abonos:      initialAbonos,
    compras:     initialCompras,
    activityLog: initialActivityLog,
    config:      defaultConfig,
  };

  // ─── Log ──────────────────────────────────────────────────────────────────

  logEvent = (tipo, desc) => {
    const evento = { id: nuevoIdLog(), tipo, desc, fecha: new Date().toISOString() };
    this.setState(prev => ({ activityLog: [evento, ...prev.activityLog].slice(0, MAX_LOG) }));
  };

  // ─── Configuración ────────────────────────────────────────────────────────

  updateConfig = cambios => {
    this.setState(prev => ({ config: { ...prev.config, ...cambios } }));
  };

  // ─── Productos ────────────────────────────────────────────────────────────

  /**
   * Agrega un producto nuevo con su primera presentación.
   * Campos nuevos aceptados: precioCompra, esGranel, unidadGranel.
   */
  addProduct = product => {
    const {
      nombre, marca, categoriaId,
      tamano, precio, precioCompra = null, stock,
      esGranel = false, unidadGranel = null,
    } = product;

    const newProduct = {
      id: Date.now().toString(),
      nombre, marca, categoriaId,
      presentaciones: [normalizarPresentacion({ id: `${Date.now()}-1`, tamano, precio, precioCompra, stock, esGranel, unidadGranel })],
    };
    this.setState(prev => ({ products: [...prev.products, newProduct] }));
    this.logEvent(
      LOG_TIPOS.PRODUCTO_NUEVO,
      `Nuevo producto: ${nombre} ${tamano} (${marca}) · stock inicial ${stock}${precioCompra ? ` · costo $${precioCompra.toFixed(2)}` : ''}`,
    );
    return newProduct;
  };

  /**
   * Agrega una presentación nueva a un producto existente.
   * Acepta precioCompra, esGranel, unidadGranel.
   */
  addPresentacion = (productId, presentacion) => {
    const { tamano, precio, precioCompra = null, stock, esGranel = false, unidadGranel = null } = presentacion;
    const nueva = normalizarPresentacion({ id: Date.now().toString(), tamano, precio, precioCompra, stock, esGranel, unidadGranel });
    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId ? { ...p, presentaciones: [...p.presentaciones, nueva] } : p,
      ),
    }));
    const product = this.state.products.find(p => p.id === productId);
    this.logEvent(
      LOG_TIPOS.PRESENTACION_NUEVA,
      `Nueva presentación: ${product?.nombre ?? productId} ${tamano} · $${precio}${precioCompra ? ` (costo $${precioCompra.toFixed(2)})` : ''} · stock ${stock}`,
    );
  };

  /**
   * Edita campos de una presentación existente.
   * Ahora acepta precioCompra, esGranel, unidadGranel además de precio y stock.
   * Solo genera log si precio o stock cambiaron — los demás cambios son silenciosos.
   */
  updatePresentacion = (productId, presentacionId, cambios) => {
    const product = this.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pr => pr.id === presentacionId ? normalizarPresentacion({ ...pr, ...cambios }) : pr) }
          : p,
      ),
    }));
    if (pres) {
      if (cambios.precio !== undefined && cambios.precio !== pres.precio) {
        this.logEvent(LOG_TIPOS.PRECIO_EDITADO, `${product?.nombre} ${pres.tamano}: $${pres.precio.toFixed(2)} → $${Number(cambios.precio).toFixed(2)}`);
      }
      if (cambios.stock !== undefined && cambios.stock !== pres.stock) {
        this.logEvent(LOG_TIPOS.STOCK_AJUSTADO, `Stock ajustado: ${product?.nombre} ${pres.tamano} · ${pres.stock} → ${cambios.stock} uds`);
      }
    }
  };

  agregarStock = (productId, presentacionId, cantidad) => {
    const product = this.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pr => pr.id === presentacionId ? { ...pr, stock: pr.stock + cantidad } : pr) }
          : p,
      ),
    }));
    this.logEvent(
      LOG_TIPOS.STOCK_AGREGADO,
      `+${cantidad} ${pres?.esGranel ? (pres?.unidadGranel ?? 'uds') : 'uds'} · ${product?.nombre ?? productId} ${pres?.tamano ?? ''} (stock anterior: ${pres?.stock ?? '?'})`,
    );
  };

  deletePresentacion = (productId, presentacionId) => {
    const product = this.state.products.find(p => p.id === productId);
    const pres = product?.presentaciones.find(pr => pr.id === presentacionId);
    this.setState(prev => ({
      products: prev.products
        .map(p => p.id === productId ? { ...p, presentaciones: p.presentaciones.filter(pr => pr.id !== presentacionId) } : p)
        .filter(p => p.presentaciones.length > 0),
    }));
    this.logEvent(LOG_TIPOS.PRESENTACION_ELIMINADA, `Eliminada: ${product?.nombre ?? productId} ${pres?.tamano ?? presentacionId}`);
  };

  decreaseStock = (items, esConsumoPropio = false) => {
    this.setState(prev => ({
      products: prev.products.map(p => ({
        ...p,
        presentaciones: p.presentaciones.map(pres => {
          const match = items.find(i => i.productId === p.id && i.presentacionId === pres.id);
          return match ? { ...pres, stock: pres.stock - match.cantidad } : pres;
        }),
      })),
    }));
    if (esConsumoPropio) {
      const resumen = items.map(i => {
        const product = this.state.products.find(p => p.id === i.productId);
        const pres = product?.presentaciones.find(pr => pr.id === i.presentacionId);
        const unidad = pres?.esGranel ? (pres?.unidadGranel ?? '') : '×';
        return `${i.cantidad}${pres?.esGranel ? ' ' + unidad : ' ×'} ${product?.nombre ?? i.productId} ${pres?.tamano ?? ''}`;
      }).join(', ');
      this.logEvent(LOG_TIPOS.CONSUMO_PROPIO, `Consumo propio: ${resumen}`);
    }
  };

  // ─── Compras ──────────────────────────────────────────────────────────────

  /**
   * Registra una compra de mercancía.
   *
   * compra: {
   *   proveedor: string,
   *   tipoPago: 'Contado' | 'Credito',
   *   notas: string,
   *   total: number,
   *   items: [{ productId, presentacionId, nombre, tamano, cantidad, costoUnitario, subtotal }]
   * }
   *
   * Efectos colaterales:
   *   1. Suma stock a cada presentación involucrada (agregarStock).
   *   2. Actualiza precioCompra de cada presentación con el costoUnitario de esta compra.
   *   3. Registra logEvent 'compra'.
   */
  addCompra = compra => {
    const fecha = new Date().toISOString();
    const nuevaCompra = { id: nuevoIdCompra(), fecha, ...compra };

    // 1. Guardar la compra
    this.setState(prev => ({ compras: [nuevaCompra, ...prev.compras] }));

    // 2. Por cada ítem: sumar stock + actualizar precioCompra
    compra.items.forEach(item => {
      // Sumar stock (usa agregarStock para que se logee individualmente si se desea)
      this.setState(prev => ({
        products: prev.products.map(p =>
          p.id === item.productId
            ? {
                ...p,
                presentaciones: p.presentaciones.map(pres =>
                  pres.id === item.presentacionId
                    ? normalizarPresentacion({
                        ...pres,
                        stock: pres.stock + item.cantidad,
                        precioCompra: item.costoUnitario, // actualiza al precio de esta compra
                      })
                    : pres,
                ),
              }
            : p,
        ),
      }));
    });

    // 3. Log de la compra completa
    const nProd = compra.items.length;
    const moneda = this.state.config?.moneda ?? '$';
    this.logEvent(
      LOG_TIPOS.COMPRA,
      `Compra ${moneda}${compra.total.toFixed(2)} · ${nProd} ${nProd === 1 ? 'producto' : 'productos'} · ${compra.proveedor} (${compra.tipoPago})`,
    );

    return nuevaCompra;
  };

  /**
   * Elimina una compra del historial.
   * Si revertirStock es true, descuenta del inventario las cantidades que entró la compra.
   */
  eliminarCompra = (compraId, revertirStock) => {
    const compra = this.state.compras.find(c => c.id === compraId);
    if (!compra) return;

    if (revertirStock && Array.isArray(compra.items)) {
      this.setState(prev => ({
        products: prev.products.map(p => ({
          ...p,
          presentaciones: p.presentaciones.map(pres => {
            const match = compra.items.find(i => i.productId === p.id && i.presentacionId === pres.id);
            return match
              ? { ...pres, stock: Math.max(0, pres.stock - match.cantidad) }
              : pres;
          }),
        })),
      }));
    }

    this.setState(prev => ({ compras: prev.compras.filter(c => c.id !== compraId) }));

    const moneda = this.state.config?.moneda ?? '$';
    const stock = revertirStock ? ' · stock revertido' : '';
    this.logEvent(
      LOG_TIPOS.COMPRA_ELIMINADA,
      `Compra ${moneda}${compra.total.toFixed(2)} eliminada · ${compra.proveedor}${stock}`,
    );
  };

  // ─── Categorías ───────────────────────────────────────────────────────────

  addCategory = nombre => {
    const newCat = { id: Date.now().toString(), nombre: nombre.trim() };
    this.setState(prev => ({ categories: [...prev.categories, newCat] }));
    this.logEvent(LOG_TIPOS.CATEGORIA_CREADA, `Nueva categoría: ${nombre.trim()}`);
  };

  renameCategory = (id, nuevoNombre) => {
    const cat = this.state.categories.find(c => String(c.id) === String(id));
    this.setState(prev => ({
      categories: prev.categories.map(c => String(c.id) === String(id) ? { ...c, nombre: nuevoNombre.trim() } : c),
    }));
    this.logEvent(LOG_TIPOS.CATEGORIA_RENOMBRADA, `Categoría renombrada: "${cat?.nombre ?? id}" → "${nuevoNombre.trim()}"`);
  };

  deleteCategory = id => {
    const cat = this.state.categories.find(c => String(c.id) === String(id));
    this.setState(prev => ({ categories: prev.categories.filter(c => String(c.id) !== String(id)) }));
    this.logEvent(LOG_TIPOS.CATEGORIA_ELIMINADA, `Categoría eliminada: ${cat?.nombre ?? id}`);
  };

  // ─── Ventas ───────────────────────────────────────────────────────────────

  addSale = sale => {
    const fecha = new Date().toISOString();
    const newSale = { id: Date.now().toString(), fecha, totalAbonado: 0, condonado: 0, ...sale };
    const abonoInicial = newSale.totalAbonado > 0.009;
    this.setState(prev => ({
      sales: [newSale, ...prev.sales],
      abonos: abonoInicial
        ? [...prev.abonos, { id: nuevoIdAbono(), fecha, cliente: (newSale.cliente || '').trim(), ventaId: newSale.id, monto: newSale.totalAbonado, tipo: 'abono' }]
        : prev.abonos,
    }));
    const numProd = Array.isArray(newSale.productos) ? newSale.productos.length : 0;
    if (newSale.tipoPago === 'Credito') {
      this.logEvent(
        LOG_TIPOS.VENTA_CREDITO,
        abonoInicial
          ? `Venta $${newSale.total.toFixed(2)} a crédito · ${newSale.cliente} · abono inicial $${newSale.totalAbonado.toFixed(2)}`
          : `Venta $${newSale.total.toFixed(2)} a crédito · ${newSale.cliente}`,
      );
    } else {
      this.logEvent(LOG_TIPOS.VENTA, `Venta $${newSale.total.toFixed(2)} · ${numProd} ${numProd === 1 ? 'producto' : 'productos'} (Contado)`);
    }
    return newSale;
  };

  registrarAbono = (clienteNombre, monto) => {
    const fecha = new Date().toISOString();
    this.setState(prev => {
      let restante = monto;
      const eventos = [];
      const sales = prev.sales.map(sale => {
        if (sale.tipoPago !== 'Credito' || (sale.cliente || '').trim() !== clienteNombre.trim() || restante <= 0) return sale;
        const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
        if (pendiente <= 0) return sale;
        const aplicar = Math.min(pendiente, restante);
        restante -= aplicar;
        eventos.push({ id: nuevoIdAbono(), fecha, cliente: (sale.cliente || '').trim(), ventaId: sale.id, monto: aplicar, tipo: 'abono' });
        return { ...sale, totalAbonado: (sale.totalAbonado ?? 0) + aplicar };
      });
      return { sales, abonos: [...prev.abonos, ...eventos] };
    });
    this.logEvent(LOG_TIPOS.ABONO, `Abono $${monto.toFixed(2)} · ${clienteNombre}`);
  };

  ajustarAbonoVenta = (saleId, nuevoAbonado) => {
    const sale = this.state.sales.find(s => String(s.id) === String(saleId));
    const abonoAnterior = sale?.totalAbonado ?? 0;
    this.setState(prev => {
      const saleLocal = prev.sales.find(s => String(s.id) === String(saleId));
      if (!saleLocal) return null;
      const techo = Math.max(0, saleLocal.total - (saleLocal.condonado ?? 0));
      const nuevo  = Math.max(0, Math.min(nuevoAbonado, techo));
      const actual = saleLocal.totalAbonado ?? 0;
      const delta  = nuevo - actual;
      if (Math.abs(delta) < 0.0005) return null;
      const eventosDeVenta = prev.abonos
        .map((a, idx) => ({ a, idx }))
        .filter(x => String(x.a.ventaId) === String(saleId) && x.a.tipo === 'abono')
        .sort((x, y) => (x.a.fecha > y.a.fecha ? -1 : 1));
      const abonos = prev.abonos.slice();
      let pendiente = delta;
      for (const { a, idx } of eventosDeVenta) {
        if (Math.abs(pendiente) < 0.0005) break;
        const cambio = pendiente > 0 ? pendiente : Math.max(pendiente, -a.monto);
        abonos[idx] = { ...a, monto: a.monto + cambio };
        pendiente -= cambio;
      }
      if (eventosDeVenta.length === 0 && nuevo > 0.0005) {
        abonos.push({ id: nuevoIdAbono(), fecha: saleLocal.fecha || new Date().toISOString(), cliente: (saleLocal.cliente || '').trim(), ventaId: saleLocal.id, monto: nuevo, tipo: 'abono' });
      }
      const sumaEventos = abonos.filter(a => String(a.ventaId) === String(saleId) && a.tipo === 'abono').reduce((s, a) => s + a.monto, 0);
      const totalFinal  = sumaEventos >= nuevo - 0.0005 ? nuevo : sumaEventos;
      return { sales: prev.sales.map(s => String(s.id) === String(saleId) ? { ...s, totalAbonado: totalFinal } : s), abonos };
    });
    if (sale) this.logEvent(LOG_TIPOS.ABONO_EDITADO, `Abono corregido $${abonoAnterior.toFixed(2)} → $${nuevoAbonado.toFixed(2)} · ${sale.cliente ?? 'cliente'}`);
  };

  condonarVenta = saleId => {
    const sale = this.state.sales.find(s => String(s.id) === String(saleId));
    this.setState(prev => {
      const saleLocal = prev.sales.find(s => String(s.id) === String(saleId));
      if (!saleLocal) return null;
      const pendiente = saleLocal.total - (saleLocal.totalAbonado ?? 0) - (saleLocal.condonado ?? 0);
      if (pendiente <= 0.009) return null;
      return {
        sales: prev.sales.map(s => String(s.id) === String(saleId) ? { ...s, condonado: (s.condonado ?? 0) + pendiente } : s),
        abonos: [...prev.abonos, { id: nuevoIdAbono(), fecha: new Date().toISOString(), cliente: (saleLocal.cliente || '').trim(), ventaId: saleLocal.id, monto: pendiente, tipo: 'condonacion' }],
      };
    });
    if (sale) {
      const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
      this.logEvent(LOG_TIPOS.CONDONACION, `Deuda condonada $${pendiente.toFixed(2)} · ${sale.cliente ?? 'cliente'}`);
    }
  };

  eliminarVenta = (saleId, devolverStock) => {
    const sale = this.state.sales.find(s => String(s.id) === String(saleId));
    this.setState(prev => {
      const saleLocal = prev.sales.find(s => String(s.id) === String(saleId));
      if (!saleLocal) return null;
      let products = prev.products;
      if (devolverStock && Array.isArray(saleLocal.productos)) {
        products = products.map(p => ({
          ...p,
          presentaciones: p.presentaciones.map(pres => {
            const match = saleLocal.productos.find(i => i.productId === p.id && i.presentacionId === pres.id);
            return match ? { ...pres, stock: pres.stock + (match.numProducts || 1) } : pres;
          }),
        }));
      }
      return {
        sales:  prev.sales.filter(s => String(s.id) !== String(saleId)),
        products,
        abonos: prev.abonos.filter(a => String(a.ventaId) !== String(saleId)),
      };
    });
    if (sale) {
      const tipo  = sale.tipoPago === 'Credito' ? 'crédito' : 'contado';
      const stock = devolverStock ? ' · stock devuelto' : '';
      this.logEvent(LOG_TIPOS.VENTA_ELIMINADA, `Venta $${sale.total.toFixed(2)} eliminada (${tipo})${stock}`);
    }
  };

  registrarDevolucion = (saleId, items, devolverStock) => {
    const sale = this.state.sales.find(s => String(s.id) === String(saleId));
    if (!sale || !items.length) return;

    const valorDevuelto = items.reduce((sum, item) => {
      const prod = (sale.productos ?? []).find(p => p.productId === item.productId && p.presentacionId === item.presentacionId);
      return sum + (prod ? prod.precio * item.cantidad : 0);
    }, 0);

    this.setState(prev => {
      const sales = prev.sales.map(s => {
        if (String(s.id) !== String(saleId)) return s;
        const nuevoTotal    = Math.max(0, s.total - valorDevuelto);
        const nuevoAbonado  = Math.min(s.totalAbonado ?? 0, nuevoTotal);
        const nuevoCondonado= Math.min(s.condonado ?? 0, Math.max(0, nuevoTotal - nuevoAbonado));
        const productos = Array.isArray(s.productos)
          ? s.productos.map(p => {
              const devuelto = items.find(i => i.productId === p.productId && i.presentacionId === p.presentacionId);
              if (!devuelto) return p;
              const nuevaCantidad = Math.max(0, p.numProducts - devuelto.cantidad);
              return { ...p, numProducts: nuevaCantidad, totalPrice: p.precio * nuevaCantidad };
            }).filter(p => p.numProducts > 0)
          : s.productos;
        return { ...s, total: nuevoTotal, totalAbonado: nuevoAbonado, condonado: nuevoCondonado, productos };
      });

      let products = prev.products;
      if (devolverStock) {
        products = products.map(p => ({
          ...p,
          presentaciones: p.presentaciones.map(pres => {
            const match = items.find(i => i.productId === p.id && i.presentacionId === pres.id);
            return match ? { ...pres, stock: pres.stock + match.cantidad } : pres;
          }),
        }));
      }

      return { sales, products };
    });

    const resumen = items.map(i => `${i.cantidad} × ${i.nombre} ${i.tamano}`).join(', ');
    const stock   = devolverStock ? ' · stock devuelto' : '';
    this.logEvent(LOG_TIPOS.DEVOLUCION, `Devolución $${valorDevuelto.toFixed(2)} · ${resumen}${stock}`);
  };

  renombrarCliente = (nombreActual, nombreNuevo) => {
    const nuevo  = nombreNuevo.trim();
    if (!nuevo) return;
    const actual = (nombreActual || '').trim();
    this.setState(prev => ({
      sales: prev.sales.map(sale => (sale.cliente || '').trim() === actual ? { ...sale, cliente: nuevo } : sale),
    }));
    this.logEvent(LOG_TIPOS.CLIENTE_RENOMBRADO, `Cliente renombrado: "${actual}" → "${nuevo}"`);
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getSellableItems = () => {
    const items = [];
    this.state.products.forEach(product => {
      product.presentaciones.forEach(pres => {
        items.push({
          id: `${product.id}::${pres.id}`,
          productId:       product.id,
          presentacionId:  pres.id,
          nombre:          product.nombre,
          marca:           product.marca,
          tamano:          pres.tamano,
          precio:          pres.precio,
          precioCompra:    pres.precioCompra ?? null,
          stock:           pres.stock,
          esGranel:        pres.esGranel ?? false,
          unidadGranel:    pres.unidadGranel ?? null,
          categoriaId:     product.categoriaId,
        });
      });
    });
    return items.sort((a, b) =>
      a.nombre.localeCompare(b.nombre, 'es') ||
      a.tamano.localeCompare(b.tamano, 'es') ||
      a.marca.localeCompare(b.marca, 'es'),
    );
  };

  getClientesConDeudaCount = () => {
    const { sales } = this.state;
    const mapa = {};
    sales.filter(s => s.tipoPago === 'Credito').forEach(s => {
      const key = (s.cliente || '').trim();
      if (!mapa[key]) mapa[key] = 0;
      mapa[key] += s.total - (s.totalAbonado ?? 0) - (s.condonado ?? 0);
    });
    return Object.values(mapa).filter(saldo => saldo > 0.009).length;
  };

  /**
   * Lista de proveedores únicos usados en compras anteriores,
   * ordenada por el más reciente primero. Útil para el autocompletado
   * en RegistrarCompraView.
   */
  getProveedores = () => {
    const vistos = new Set();
    return this.state.compras
      .sort((a, b) => (a.fecha > b.fecha ? -1 : 1))
      .map(c => c.proveedor)
      .filter(p => {
        if (!p || vistos.has(p)) return false;
        vistos.add(p);
        return true;
      });
  };

  render() {
    return (
      <StoreContext.Provider
        value={{
          // Estado
          products:              this.state.products,
          categories:            this.state.categories,
          sales:                 this.state.sales,
          abonos:                this.state.abonos,
          compras:               this.state.compras,
          activityLog:           this.state.activityLog,
          config:                this.state.config,
          // Derivados
          sellableItems:         this.getSellableItems(),
          clientesConDeudaCount: this.getClientesConDeudaCount(),
          proveedores:           this.getProveedores(),
          // Log
          logEvent:              this.logEvent,
          // Config
          updateConfig:          this.updateConfig,
          // Productos
          addProduct:            this.addProduct,
          addPresentacion:       this.addPresentacion,
          updatePresentacion:    this.updatePresentacion,
          agregarStock:          this.agregarStock,
          deletePresentacion:    this.deletePresentacion,
          decreaseStock:         this.decreaseStock,
          // Compras
          addCompra:             this.addCompra,
          eliminarCompra:        this.eliminarCompra,
          // Categorías
          addCategory:           this.addCategory,
          renameCategory:        this.renameCategory,
          deleteCategory:        this.deleteCategory,
          // Ventas
          addSale:               this.addSale,
          registrarAbono:        this.registrarAbono,
          ajustarAbonoVenta:     this.ajustarAbonoVenta,
          condonarVenta:         this.condonarVenta,
          eliminarVenta:         this.eliminarVenta,
          registrarDevolucion:   this.registrarDevolucion,
          renombrarCliente:      this.renombrarCliente,
        }}
      >
        {this.props.children}
      </StoreContext.Provider>
    );
  }
}
