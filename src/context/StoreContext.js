import React, { createContext, Component } from 'react';

/**
 * Datos "semilla" (hardcoded) mientras no existe backend.
 *
 * Modelo: un producto (nombre + marca + categoría) puede tener varias
 * "presentaciones" (tamaños), cada una con su propio precio y stock.
 * Ej: Arroz (Verde Valle) -> presentaciones: "1 kg", "1/2 kg".
 *
 * Cuando se conecte la base de datos, esto se reemplaza por:
 *  - un fetch inicial en componentDidMount (en vez de este arreglo fijo)
 *  - llamadas a la API dentro de addProduct/addPresentacion/deletePresentacion/
 *    decreaseStock/addSale (en vez de solo hacer setState local)
 *
 * Inventory.js y Main.js NO deberían cambiar cuando eso pase: siguen
 * leyendo/escribiendo a través de este mismo Context.
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

  // Crea un producto nuevo con su primera presentación.
  // TODO(backend): reemplazar por POST /products
  addProduct = product => {
    const { nombre, marca, categoriaId, tamano, precio, stock } = product;
    const newProduct = {
      id: Date.now().toString(),
      nombre,
      marca,
      categoriaId,
      presentaciones: [{ id: `${Date.now()}-1`, tamano, precio, stock }],
    };
    this.setState(prevState => ({
      products: [...prevState.products, newProduct],
    }));
    return newProduct;
  };

  // Agrega una presentación (tamaño) nueva a un producto que ya existe.
  // TODO(backend): reemplazar por POST /products/:id/presentaciones
  addPresentacion = (productId, presentacion) => {
    this.setState(prevState => ({
      products: prevState.products.map(p =>
        p.id === productId
          ? {
              ...p,
              presentaciones: [
                ...p.presentaciones,
                { id: Date.now().toString(), ...presentacion },
              ],
            }
          : p,
      ),
    }));
  };

  // Elimina una presentación puntual; si era la última del producto,
  // el producto completo desaparece del inventario.
  // TODO(backend): reemplazar por DELETE /products/:productId/presentaciones/:presentacionId
  deletePresentacion = (productId, presentacionId) => {
    this.setState(prevState => ({
      products: prevState.products
        .map(p =>
          p.id === productId
            ? {
                ...p,
                presentaciones: p.presentaciones.filter(
                  pres => pres.id !== presentacionId,
                ),
              }
            : p,
        )
        .filter(p => p.presentaciones.length > 0),
    }));
  };

  // items: [{ productId, presentacionId, cantidad }]
  // TODO(backend): normalmente esto lo hace el servidor al registrar la venta
  decreaseStock = items => {
    this.setState(prevState => ({
      products: prevState.products.map(p => ({
        ...p,
        presentaciones: p.presentaciones.map(pres => {
          const match = items.find(
            i => i.productId === p.id && i.presentacionId === pres.id,
          );
          return match ? { ...pres, stock: pres.stock - match.cantidad } : pres;
        }),
      })),
    }));
  };

  // TODO(backend): reemplazar por POST /sales
  addSale = sale => {
    const newSale = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      ...sale,
    };
    this.setState(prevState => ({
      sales: [newSale, ...prevState.sales],
    }));
    return newSale;
  };

  // Aplana productos + presentaciones en items vendibles individuales.
  // Lo usan el carrito y el modal de "seleccionar producto para vender",
  // que necesitan elegir una talla/tamaño concreta, no solo el producto base.
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

  render() {
    return (
      <StoreContext.Provider
        value={{
          products: this.state.products,
          categories: this.state.categories,
          sales: this.state.sales,
          sellableItems: this.getSellableItems(),
          addProduct: this.addProduct,
          addPresentacion: this.addPresentacion,
          deletePresentacion: this.deletePresentacion,
          decreaseStock: this.decreaseStock,
          addSale: this.addSale,
        }}
      >
        {this.props.children}
      </StoreContext.Provider>
    );
  }
}
