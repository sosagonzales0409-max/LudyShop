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

export const StoreContext = createContext(null);

export class StoreProvider extends Component {
  state = {
    products: initialProducts,
    categories: initialCategories,
    sales: [],
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
    const newSale = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      totalAbonado: 0,
      ...sale,
    };
    this.setState(prev => ({ sales: [newSale, ...prev.sales] }));
    return newSale;
  };

  // Registra un abono parcial o pago total de una venta a crédito.
  // Distribuye el monto entre las ventas pendientes del cliente, de la más
  // antigua a la más reciente (FIFO), hasta agotar el monto.
  registrarAbono = (clienteNombre, monto) => {
    this.setState(prev => {
      let restante = monto;
      const sales = prev.sales.map(sale => {
        if (
          sale.tipoPago !== 'Credito' ||
          (sale.cliente || '').trim() !== clienteNombre.trim() ||
          restante <= 0
        ) return sale;

        const pendiente = sale.total - (sale.totalAbonado ?? 0);
        if (pendiente <= 0) return sale;

        const aplicar = Math.min(pendiente, restante);
        restante -= aplicar;
        return { ...sale, totalAbonado: (sale.totalAbonado ?? 0) + aplicar };
      });
      return { sales };
    });
  };

  // Corrige el monto ya abonado de una venta en particular (0..total).
  ajustarAbonoVenta = (saleId, nuevoAbonado) => {
    this.setState(prev => ({
      sales: prev.sales.map(sale =>
        String(sale.id) === String(saleId)
          ? { ...sale, totalAbonado: Math.max(0, Math.min(nuevoAbonado, sale.total)) }
          : sale,
      ),
    }));
  };

  // Elimina una venta del historial. Si devolverStock es true, los productos
  // de esa venta regresan al inventario (la venta "nunca existió"); en caso
  // contrario la mercancía no vuelve (se usa junto con ajustarAbonoVenta para
  // condonar la deuda sin tocar el inventario).
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
      mapa[key] += s.total - (s.totalAbonado ?? 0);
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
          eliminarVenta: this.eliminarVenta,
          renombrarCliente: this.renombrarCliente,
        }}
      >
        {this.props.children}
      </StoreContext.Provider>
    );
  }
}
