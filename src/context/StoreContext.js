import React, { createContext, Component } from 'react';

/**
 * Datos "semilla" (hardcoded) mientras no existe backend.
 *
 * Cuando se conecte la base de datos, este archivo es el único que cambia:
 * reemplazar los setState locales por llamadas a la API correspondiente.
 * Inventory.js, Main.js y todos los demás componentes siguen igual.
 */
const initialProducts = [
  {
    id: '1',
    nombre: 'Arroz',
    marca: 'Verde Valle',
    categoriaId: '1',
    presentaciones: [
      { id: '1-1', tamano: '1 kg', precio: 28.5, stock: 4 },
      { id: '1-2', tamano: '1/2 kg', precio: 16.0, stock: 10 },
    ],
  },
  {
    id: '2',
    nombre: 'Frijol',
    marca: 'La Costeña',
    categoriaId: '1',
    presentaciones: [{ id: '2-1', tamano: '1 kg', precio: 32.0, stock: 35 }],
  },
  {
    id: '3',
    nombre: 'Azúcar',
    marca: 'Zulka',
    categoriaId: '1',
    presentaciones: [{ id: '3-1', tamano: '1 kg', precio: 27.0, stock: 50 }],
  },
  {
    id: '4',
    nombre: 'Aceite vegetal',
    marca: '1-2-3',
    categoriaId: '2',
    presentaciones: [{ id: '4-1', tamano: '1 L', precio: 38.9, stock: 25 }],
  },
  {
    id: '5',
    nombre: 'Atún en lata',
    marca: 'Dolores',
    categoriaId: '2',
    presentaciones: [{ id: '5-1', tamano: '140 g', precio: 18.5, stock: 45 }],
  },
  {
    id: '6',
    nombre: 'Leche entera',
    marca: 'Lala',
    categoriaId: '3',
    presentaciones: [{ id: '6-1', tamano: '1 L', precio: 24.5, stock: 30 }],
  },
  {
    id: '7',
    nombre: 'Huevo',
    marca: 'San Juan',
    categoriaId: '3',
    presentaciones: [
      { id: '7-1', tamano: 'Cartón 12 pzas', precio: 36.0, stock: 15 },
    ],
  },
  {
    id: '8',
    nombre: 'Pan blanco',
    marca: 'Bimbo',
    categoriaId: '4',
    presentaciones: [{ id: '8-1', tamano: 'Chico', precio: 34.0, stock: 20 }],
  },
  {
    id: '9',
    nombre: 'Agua embotellada',
    marca: 'Ciel',
    categoriaId: '5',
    presentaciones: [{ id: '9-1', tamano: '1.5 L', precio: 15.0, stock: 70 }],
  },
  {
    id: '10',
    nombre: 'Coca-Cola',
    marca: 'Coca-Cola',
    categoriaId: '5',
    presentaciones: [
      { id: '10-1', tamano: '3 L', precio: 45.0, stock: 25 },
      { id: '10-2', tamano: '600 ml', precio: 18.0, stock: 40 },
    ],
  },
];

const initialCategories = [
  { id: 0, nombre: 'Todos' },
  { id: '1', nombre: 'Granos' },
  { id: '2', nombre: 'Despensa' },
  { id: '3', nombre: 'Lácteos' },
  { id: '4', nombre: 'Panadería' },
  { id: '5', nombre: 'Bebidas' },
];

// Fecha ISO relativa a hoy (para que los chips de antigüedad de CreditosView
// se vean realistas: Hoy, N días, +N días). La hora es configurable para
// ordenar cronológicamente las ventas del mismo día.
const diasAtras = (dias, hora = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
};

// IDs únicos para eventos de cobro (abonos / condonaciones).
let abonoSeq = 0;
const nuevoIdAbono = () => `${Date.now().toString(36)}-${abonoSeq++}`;

/**
 * Ventas semilla (solo para probar las vistas sin cargarlas a mano: créditos
 * en CreditosView e HistorialView). Cuando exista backend o ventas reales,
 * quitar y volver a sales: [].
 *
 * Mezcla ventas de contado (cliente: null) y a crédito, distribuidas en los
 * períodos que filtra el Historial: hoy, esta semana, este mes y más de un mes.
 * Los productId/presentacionId corresponden a initialProducts (necesario para
 * que "Devolver al inventario" funcione desde ClientDebtDetailView).
 */
const initialSales = [
  // ── Hoy ─────────────────────────────────────────────────────────────────
  {
    id: 'seed-1', fecha: diasAtras(0, 18), tipoPago: 'Contado', cliente: null,
    total: 83.0, totalAbonado: 0.0,
    productos: [
      { productId: '8', presentacionId: '8-1', nombre: 'Pan blanco', marca: 'Bimbo', tamano: 'Chico', precio: 34.0, numProducts: 2, totalPrice: 68.0 },
      { productId: '9', presentacionId: '9-1', nombre: 'Agua embotellada', marca: 'Ciel', tamano: '1.5 L', precio: 15.0, numProducts: 1, totalPrice: 15.0 },
    ],
  },
  {
    id: 'seed-2', fecha: diasAtras(0, 14), tipoPago: 'Contado', cliente: null,
    total: 122.5, totalAbonado: 0.0,
    productos: [
      { productId: '1', presentacionId: '1-1', nombre: 'Arroz', marca: 'Verde Valle', tamano: '1 kg', precio: 28.5, numProducts: 3, totalPrice: 85.5 },
      { productId: '5', presentacionId: '5-1', nombre: 'Atún en lata', marca: 'Dolores', tamano: '140 g', precio: 18.5, numProducts: 2, totalPrice: 37.0 },
    ],
  },
  {
    id: 'seed-3', fecha: diasAtras(0, 17), tipoPago: 'Contado', cliente: null,
    total: 154.0, totalAbonado: 0.0,
    productos: [
      { productId: '10', presentacionId: '10-2', nombre: 'Coca-Cola', marca: 'Coca-Cola', tamano: '600 ml', precio: 18.0, numProducts: 5, totalPrice: 90.0 },
      { productId: '2', presentacionId: '2-1', nombre: 'Frijol', marca: 'La Costeña', tamano: '1 kg', precio: 32.0, numProducts: 2, totalPrice: 64.0 },
    ],
  },
  {
    id: 'seed-4', fecha: diasAtras(0, 10), tipoPago: 'Credito', cliente: 'Tienda La Esquina',
    total: 354.0, totalAbonado: 100.0,
    productos: [
      { productId: '9', presentacionId: '9-1', nombre: 'Agua embotellada', marca: 'Ciel', tamano: '1.5 L', precio: 15.0, numProducts: 10, totalPrice: 150.0 },
      { productId: '8', presentacionId: '8-1', nombre: 'Pan blanco', marca: 'Bimbo', tamano: 'Chico', precio: 34.0, numProducts: 6, totalPrice: 204.0 },
    ],
  },
  {
    id: 'seed-5', fecha: diasAtras(0, 12), tipoPago: 'Credito', cliente: 'Doña Rosa',
    total: 145.5, totalAbonado: 0.0, condonado: 50.0,
    productos: [
      { productId: '7', presentacionId: '7-1', nombre: 'Huevo', marca: 'San Juan', tamano: 'Cartón 12 pzas', precio: 36.0, numProducts: 2, totalPrice: 72.0 },
      { productId: '6', presentacionId: '6-1', nombre: 'Leche entera', marca: 'Lala', tamano: '1 L', precio: 24.5, numProducts: 3, totalPrice: 73.5 },
    ],
  },

  // ── Esta semana (hace 1-4 días) ─────────────────────────────────────────
  {
    id: 'seed-6', fecha: diasAtras(2, 16), tipoPago: 'Contado', cliente: null,
    total: 126.5, totalAbonado: 0.0,
    productos: [
      { productId: '3', presentacionId: '3-1', nombre: 'Azúcar', marca: 'Zulka', tamano: '1 kg', precio: 27.0, numProducts: 4, totalPrice: 108.0 },
      { productId: '5', presentacionId: '5-1', nombre: 'Atún en lata', marca: 'Dolores', tamano: '140 g', precio: 18.5, numProducts: 1, totalPrice: 18.5 },
    ],
  },
  {
    id: 'seed-7', fecha: diasAtras(3, 15), tipoPago: 'Contado', cliente: null,
    total: 147.0, totalAbonado: 0.0,
    productos: [
      { productId: '6', presentacionId: '6-1', nombre: 'Leche entera', marca: 'Lala', tamano: '1 L', precio: 24.5, numProducts: 6, totalPrice: 147.0 },
    ],
  },
  {
    id: 'seed-8', fecha: diasAtras(4, 13), tipoPago: 'Contado', cliente: null,
    total: 360.0, totalAbonado: 0.0,
    productos: [
      { productId: '10', presentacionId: '10-1', nombre: 'Coca-Cola', marca: 'Coca-Cola', tamano: '3 L', precio: 45.0, numProducts: 8, totalPrice: 360.0 },
    ],
  },
  {
    id: 'seed-9', fecha: diasAtras(1, 11), tipoPago: 'Credito', cliente: 'Juan Pérez',
    total: 36.0, totalAbonado: 0.0,
    productos: [
      { productId: '7', presentacionId: '7-1', nombre: 'Huevo', marca: 'San Juan', tamano: 'Cartón 12 pzas', precio: 36.0, numProducts: 1, totalPrice: 36.0 },
    ],
  },
  {
    id: 'seed-10', fecha: diasAtras(3, 9), tipoPago: 'Credito', cliente: 'María García',
    total: 116.7, totalAbonado: 50.0,
    productos: [
      { productId: '4', presentacionId: '4-1', nombre: 'Aceite vegetal', marca: '1-2-3', tamano: '1 L', precio: 38.9, numProducts: 3, totalPrice: 116.7 },
    ],
  },

  // ── Este mes (hace 8-20 días) ───────────────────────────────────────────
  {
    id: 'seed-11', fecha: diasAtras(8, 12), tipoPago: 'Contado', cliente: null,
    total: 113.0, totalAbonado: 0.0,
    productos: [
      { productId: '9', presentacionId: '9-1', nombre: 'Agua embotellada', marca: 'Ciel', tamano: '1.5 L', precio: 15.0, numProducts: 3, totalPrice: 45.0 },
      { productId: '8', presentacionId: '8-1', nombre: 'Pan blanco', marca: 'Bimbo', tamano: 'Chico', precio: 34.0, numProducts: 2, totalPrice: 68.0 },
    ],
  },
  {
    id: 'seed-12', fecha: diasAtras(10, 17), tipoPago: 'Contado', cliente: null,
    total: 146.5, totalAbonado: 0.0,
    productos: [
      { productId: '5', presentacionId: '5-1', nombre: 'Atún en lata', marca: 'Dolores', tamano: '140 g', precio: 18.5, numProducts: 5, totalPrice: 92.5 },
      { productId: '3', presentacionId: '3-1', nombre: 'Azúcar', marca: 'Zulka', tamano: '1 kg', precio: 27.0, numProducts: 2, totalPrice: 54.0 },
    ],
  },
  {
    id: 'seed-13', fecha: diasAtras(15, 14), tipoPago: 'Contado', cliente: null,
    total: 128.0, totalAbonado: 0.0,
    productos: [
      { productId: '2', presentacionId: '2-1', nombre: 'Frijol', marca: 'La Costeña', tamano: '1 kg', precio: 32.0, numProducts: 4, totalPrice: 128.0 },
    ],
  },
  {
    id: 'seed-14', fecha: diasAtras(20, 10), tipoPago: 'Contado', cliente: null,
    total: 145.5, totalAbonado: 0.0,
    productos: [
      { productId: '6', presentacionId: '6-1', nombre: 'Leche entera', marca: 'Lala', tamano: '1 L', precio: 24.5, numProducts: 3, totalPrice: 73.5 },
      { productId: '7', presentacionId: '7-1', nombre: 'Huevo', marca: 'San Juan', tamano: 'Cartón 12 pzas', precio: 36.0, numProducts: 2, totalPrice: 72.0 },
    ],
  },
  {
    id: 'seed-15', fecha: diasAtras(10, 15), tipoPago: 'Credito', cliente: 'María García',
    total: 225.0, totalAbonado: 225.0,
    productos: [
      { productId: '10', presentacionId: '10-1', nombre: 'Coca-Cola', marca: 'Coca-Cola', tamano: '3 L', precio: 45.0, numProducts: 5, totalPrice: 225.0 },
    ],
  },
  {
    id: 'seed-16', fecha: diasAtras(2, 13), tipoPago: 'Credito', cliente: 'Juan Pérez',
    total: 81.5, totalAbonado: 30.0,
    productos: [
      { productId: '1', presentacionId: '1-1', nombre: 'Arroz', marca: 'Verde Valle', tamano: '1 kg', precio: 28.5, numProducts: 2, totalPrice: 57.0 },
      { productId: '6', presentacionId: '6-1', nombre: 'Leche entera', marca: 'Lala', tamano: '1 L', precio: 24.5, numProducts: 1, totalPrice: 24.5 },
    ],
  },

  // ── Más de un mes (solo filtro "Todo") ──────────────────────────────────
  {
    id: 'seed-17', fecha: diasAtras(32, 11), tipoPago: 'Contado', cliente: null,
    total: 261.0, totalAbonado: 0.0,
    productos: [
      { productId: '3', presentacionId: '3-1', nombre: 'Azúcar', marca: 'Zulka', tamano: '1 kg', precio: 27.0, numProducts: 8, totalPrice: 216.0 },
      { productId: '9', presentacionId: '9-1', nombre: 'Agua embotellada', marca: 'Ciel', tamano: '1.5 L', precio: 15.0, numProducts: 3, totalPrice: 45.0 },
    ],
  },
  {
    id: 'seed-18', fecha: diasAtras(45, 16), tipoPago: 'Contado', cliente: null,
    total: 142.0, totalAbonado: 0.0,
    productos: [
      { productId: '5', presentacionId: '5-1', nombre: 'Atún en lata', marca: 'Dolores', tamano: '140 g', precio: 18.5, numProducts: 4, totalPrice: 74.0 },
      { productId: '8', presentacionId: '8-1', nombre: 'Pan blanco', marca: 'Bimbo', tamano: 'Chico', precio: 34.0, numProducts: 2, totalPrice: 68.0 },
    ],
  },
  {
    id: 'seed-19', fecha: diasAtras(30, 9), tipoPago: 'Credito', cliente: 'Roberto Díaz',
    total: 128.0, totalAbonado: 0.0,
    productos: [
      { productId: '2', presentacionId: '2-1', nombre: 'Frijol', marca: 'La Costeña', tamano: '1 kg', precio: 32.0, numProducts: 4, totalPrice: 128.0 },
    ],
  },
  {
    id: 'seed-20', fecha: diasAtras(45, 10), tipoPago: 'Credito', cliente: 'Lupita Torres',
    total: 165.7, totalAbonado: 50.0,
    productos: [
      { productId: '4', presentacionId: '4-1', nombre: 'Aceite vegetal', marca: '1-2-3', tamano: '1 L', precio: 38.9, numProducts: 3, totalPrice: 116.7 },
      { productId: '6', presentacionId: '6-1', nombre: 'Leche entera', marca: 'Lala', tamano: '1 L', precio: 24.5, numProducts: 2, totalPrice: 49.0 },
    ],
  },
];

/**
 * Eventos de cobro semilla, coherentes con los totalAbonado/condonado de
 * initialSales. Cada evento tiene fecha propia: los ingresos del día y del
 * período se calculan a partir de estos eventos (el dinero entra el día del
 * abono, no el día de la venta a crédito).
 *   tipo 'abono'        → dinero que sí entró → suma a ingresos.
 *   tipo 'condonacion'  → deuda perdonada → NO suma a ingresos; solo reduce
 *                         el pendiente por cobrar.
 */
const initialAbonos = [
  { id: 'seed-a1', fecha: diasAtras(0, 11), cliente: 'Tienda La Esquina', ventaId: 'seed-4', monto: 100.0, tipo: 'abono' },
  { id: 'seed-a2', fecha: diasAtras(2, 15), cliente: 'María García', ventaId: 'seed-10', monto: 50.0, tipo: 'abono' },
  { id: 'seed-a3', fecha: diasAtras(10, 18), cliente: 'María García', ventaId: 'seed-15', monto: 225.0, tipo: 'abono' },
  { id: 'seed-a4', fecha: diasAtras(1, 12), cliente: 'Juan Pérez', ventaId: 'seed-16', monto: 30.0, tipo: 'abono' },
  { id: 'seed-a5', fecha: diasAtras(20, 12), cliente: 'Lupita Torres', ventaId: 'seed-20', monto: 50.0, tipo: 'abono' },
  { id: 'seed-a6', fecha: diasAtras(5, 11), cliente: 'Doña Rosa', ventaId: 'seed-5', monto: 50.0, tipo: 'condonacion' },
];

export const StoreContext = createContext(null);

export class StoreProvider extends Component {
  state = {
    products: initialProducts,
    categories: initialCategories,
    sales: initialSales,
    abonos: initialAbonos,
  };

  // ─── Productos ────────────────────────────────────────────────────────────

  addProduct = product => {
    const { nombre, marca, categoriaId, tamano, precio, stock } = product;
    const newProduct = {
      id: Date.now().toString(),
      nombre, marca, categoriaId,
      presentaciones: [{ id: `${Date.now()}-1`, tamano, precio, stock }],
    };
    this.setState(prev => ({ products: [...prev.products, newProduct] }));
    return newProduct;
  };

  addPresentacion = (productId, presentacion) => {
    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: [...p.presentaciones, { id: Date.now().toString(), ...presentacion }] }
          : p,
      ),
    }));
  };

  updatePresentacion = (productId, presentacionId, cambios) => {
    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pres => pres.id === presentacionId ? { ...pres, ...cambios } : pres) }
          : p,
      ),
    }));
  };

  agregarStock = (productId, presentacionId, cantidad) => {
    this.setState(prev => ({
      products: prev.products.map(p =>
        p.id === productId
          ? { ...p, presentaciones: p.presentaciones.map(pres => pres.id === presentacionId ? { ...pres, stock: pres.stock + cantidad } : pres) }
          : p,
      ),
    }));
  };

  deletePresentacion = (productId, presentacionId) => {
    this.setState(prev => ({
      products: prev.products
        .map(p => p.id === productId
          ? { ...p, presentaciones: p.presentaciones.filter(pres => pres.id !== presentacionId) }
          : p)
        .filter(p => p.presentaciones.length > 0),
    }));
  };

  decreaseStock = items => {
    this.setState(prev => ({
      products: prev.products.map(p => ({
        ...p,
        presentaciones: p.presentaciones.map(pres => {
          const match = items.find(i => i.productId === p.id && i.presentacionId === pres.id);
          return match ? { ...pres, stock: pres.stock - match.cantidad } : pres;
        }),
      })),
    }));
  };

  // ─── Categorías ───────────────────────────────────────────────────────────

  addCategory = nombre => {
    const newCat = { id: Date.now().toString(), nombre: nombre.trim() };
    this.setState(prev => ({ categories: [...prev.categories, newCat] }));
  };

  renameCategory = (id, nuevoNombre) => {
    this.setState(prev => ({
      categories: prev.categories.map(c =>
        String(c.id) === String(id) ? { ...c, nombre: nuevoNombre.trim() } : c,
      ),
    }));
  };

  deleteCategory = id => {
    this.setState(prev => ({
      categories: prev.categories.filter(c => String(c.id) !== String(id)),
    }));
  };

  // ─── Ventas ───────────────────────────────────────────────────────────────

  addSale = sale => {
    const fecha = new Date().toISOString();
    const newSale = {
      id: Date.now().toString(),
      fecha,
      totalAbonado: 0,
      condonado: 0,
      ...sale,
    };
    const abonoInicial = newSale.totalAbonado > 0.009;
    this.setState(prev => ({
      sales: [newSale, ...prev.sales],
      abonos: abonoInicial
        ? [
            ...prev.abonos,
            {
              id: nuevoIdAbono(),
              fecha,
              cliente: (newSale.cliente || '').trim(),
              ventaId: newSale.id,
              monto: newSale.totalAbonado,
              tipo: 'abono',
            },
          ]
        : prev.abonos,
    }));
    return newSale;
  };

  // Registra un abono parcial o pago total de una venta a crédito.
  // Distribuye el monto entre las ventas pendientes del cliente, de la más
  // antigua a la más reciente (FIFO), hasta agotar el monto. Por cada porción
  // aplicada registra un evento de cobro con la fecha de HOY: el dinero entra
  // el día que se cobra, no el día de la venta.
  registrarAbono = (clienteNombre, monto) => {
    const fecha = new Date().toISOString();
    this.setState(prev => {
      let restante = monto;
      const eventos = [];
      const sales = prev.sales.map(sale => {
        if (
          sale.tipoPago !== 'Credito' ||
          (sale.cliente || '').trim() !== clienteNombre.trim() ||
          restante <= 0
        ) return sale;

        const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
        if (pendiente <= 0) return sale;

        const aplicar = Math.min(pendiente, restante);
        restante -= aplicar;
        eventos.push({
          id: nuevoIdAbono(),
          fecha,
          cliente: (sale.cliente || '').trim(),
          ventaId: sale.id,
          monto: aplicar,
          tipo: 'abono',
        });
        return { ...sale, totalAbonado: (sale.totalAbonado ?? 0) + aplicar };
      });
      return { sales, abonos: [...prev.abonos, ...eventos] };
    });
  };

  // Corrige el monto ya abonado de una venta en particular (0..lo cobrable).
  // El delta se aplica a los eventos de cobro de esa venta (del más reciente
  // hacia atrás), por lo que los ingresos del día en que se registró el abono
  // se recalculan coherentemente.
  ajustarAbonoVenta = (saleId, nuevoAbonado) => {
    this.setState(prev => {
      const sale = prev.sales.find(s => String(s.id) === String(saleId));
      if (!sale) return null;

      const techo = Math.max(0, sale.total - (sale.condonado ?? 0));
      const nuevo = Math.max(0, Math.min(nuevoAbonado, techo));
      const actual = sale.totalAbonado ?? 0;
      const delta = nuevo - actual;
      if (Math.abs(delta) < 0.0005) return null;

      // Eventos de abono de la venta, del más reciente al más antiguo.
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

      // Sin eventos reales (semilla inconsistente) se crea uno con la fecha de
      // la venta para no romper el invariante eventos = saldo abonado.
      if (eventosDeVenta.length === 0 && nuevo > 0.0005) {
        abonos.push({
          id: nuevoIdAbono(),
          fecha: sale.fecha || new Date().toISOString(),
          cliente: (sale.cliente || '').trim(),
          ventaId: sale.id,
          monto: nuevo,
          tipo: 'abono',
        });
      }

      // Saldo real = suma de eventos; si el ajuste excede lo que los eventos
      // podían absorber (p. ej. bajar más de lo abonado), se reconcilia.
      const sumaEventos = abonos
        .filter(a => String(a.ventaId) === String(saleId) && a.tipo === 'abono')
        .reduce((s, a) => s + a.monto, 0);
      const totalFinal = sumaEventos >= nuevo - 0.0005 ? nuevo : sumaEventos;

      return {
        sales: prev.sales.map(s =>
          String(s.id) === String(saleId) ? { ...s, totalAbonado: totalFinal } : s,
        ),
        abonos,
      };
    });
  };

  // Condona (perdona) el saldo restante de una venta a crédito. La deuda deja
  // de estar pendiente de cobro, pero NO genera ingreso: se registra un evento
  // tipo 'condonacion' que solo reduce el pendiente por cobrar.
  condonarVenta = saleId => {
    this.setState(prev => {
      const sale = prev.sales.find(s => String(s.id) === String(saleId));
      if (!sale) return null;

      const pendiente = sale.total - (sale.totalAbonado ?? 0) - (sale.condonado ?? 0);
      if (pendiente <= 0.009) return null;

      return {
        sales: prev.sales.map(s =>
          String(s.id) === String(saleId)
            ? { ...s, condonado: (s.condonado ?? 0) + pendiente }
            : s,
        ),
        abonos: [
          ...prev.abonos,
          {
            id: nuevoIdAbono(),
            fecha: new Date().toISOString(),
            cliente: (sale.cliente || '').trim(),
            ventaId: sale.id,
            monto: pendiente,
            tipo: 'condonacion',
          },
        ],
      };
    });
  };

  // Elimina una venta del historial. Si devolverStock es true, los productos
  // de esa venta regresan al inventario (la venta "nunca existió"). En ese
  // caso también se revierten sus eventos de cobro (el ingreso de ese monto se
  // descuenta de las cifras del día). Para perdonar una deuda sin tocar el
  // inventario usar condonarVenta, no eliminarVenta.
  eliminarVenta = (saleId, devolverStock) => {
    this.setState(prev => {
      const sale = prev.sales.find(s => String(s.id) === String(saleId));
      if (!sale) return null;

      let products = prev.products;
      if (devolverStock && Array.isArray(sale.productos)) {
        products = products.map(p => ({
          ...p,
          presentaciones: p.presentaciones.map(pres => {
            const match = sale.productos.find(
              i => i.productId === p.id && i.presentacionId === pres.id,
            );
            return match
              ? { ...pres, stock: pres.stock + (match.numProducts || 1) }
              : pres;
          }),
        }));
      }

      return {
        sales: prev.sales.filter(s => String(s.id) !== String(saleId)),
        products,
        abonos: prev.abonos.filter(a => String(a.ventaId) !== String(saleId)),
      };
    });
  };

  // Cambia el nombre del cliente en todas sus ventas (para unificar deudas mal escritas).
  renombrarCliente = (nombreActual, nombreNuevo) => {
    const nuevo = nombreNuevo.trim();
    if (!nuevo) return;
    const actual = (nombreActual || '').trim();
    this.setState(prev => ({
      sales: prev.sales.map(sale =>
        (sale.cliente || '').trim() === actual ? { ...sale, cliente: nuevo } : sale,
      ),
    }));
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  getSellableItems = () => {
    const items = [];
    this.state.products.forEach(product => {
      product.presentaciones.forEach(pres => {
        items.push({
          id: `${product.id}::${pres.id}`,
          productId: product.id,
          presentacionId: pres.id,
          nombre: product.nombre,
          marca: product.marca,
          tamano: pres.tamano,
          precio: pres.precio,
          stock: pres.stock,
          categoriaId: product.categoriaId,
        });
      });
    });
    return items.sort(
      (a, b) =>
        a.nombre.localeCompare(b.nombre, 'es') ||
        a.tamano.localeCompare(b.tamano, 'es') ||
        a.marca.localeCompare(b.marca, 'es'),
    );
  };

  // Número de clientes con saldo pendiente (para el badge del header).
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

  render() {
    return (
      <StoreContext.Provider
        value={{
          products: this.state.products,
          categories: this.state.categories,
          sales: this.state.sales,
          abonos: this.state.abonos,
          sellableItems: this.getSellableItems(),
          clientesConDeudaCount: this.getClientesConDeudaCount(),
          // productos
          addProduct: this.addProduct,
          addPresentacion: this.addPresentacion,
          updatePresentacion: this.updatePresentacion,
          agregarStock: this.agregarStock,
          deletePresentacion: this.deletePresentacion,
          decreaseStock: this.decreaseStock,
          // categorías
          addCategory: this.addCategory,
          renameCategory: this.renameCategory,
          deleteCategory: this.deleteCategory,
          // ventas
          addSale: this.addSale,
          registrarAbono: this.registrarAbono,
          ajustarAbonoVenta: this.ajustarAbonoVenta,
          condonarVenta: this.condonarVenta,
          eliminarVenta: this.eliminarVenta,
          renombrarCliente: this.renombrarCliente,
        }}
      >
        {this.props.children}
      </StoreContext.Provider>
    );
  }
}
