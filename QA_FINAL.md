# QA final — Mi Tienda (V1 offline)

Guía completa para validar la app antes de cerrar la V1: persistencia en SQLite, arquitectura "bajo demanda" (fases 1–6) y todas las pantallas.

| Parte | Qué es | Quién | Tiempo aprox. |
|---|---|---|---|
| [A](#parte-a--pruebas-automáticas) | Pruebas automáticas en Node (acciones reales de la app) | Script | 2 min |
| [B](#parte-b--app-desde-0) | Escenario **desde 0** con valores exactos, paso a paso | Tú, en el teléfono | 60–90 min |
| [C](#parte-c--con-datos-semilla-un-año-de-tienda) | **Datos semilla** (un año, ~31 000 ventas) contra la hoja generada | Tú + script | 45–60 min |
| [D](#parte-d--pruebas-transversales) | Persistencia, moneda, teclado, rendimiento | Tú | 20 min |
| [E](#parte-e--checklist-acumulado-129) | Checklist acumulado 1–29 (dónde se prueba cada punto) | — | — |
| [F](#parte-f--hallazgos-detectados-al-preparar-el-qa) | Hallazgos detectados al preparar el QA (no corregidos) | Decidir | — |
| [G](#parte-g--registro-de-resultados) | Registro de resultados | Tú | — |

## Pasos a seguir

Orden recomendado de principio a fin. Cada paso enlaza a su sección, donde está el detalle.

| # | Paso | Cómo | Tiempo |
|---|---|---|---|
| 1 | **Antes de empezar** | Node 22 o superior (`node --version`) · `adb devices` muestra el teléfono · Metro corriendo (`npx react-native start`) | 5 min |
| 2 | **Pruebas automáticas** | Los 4 comandos de la [Parte A](#parte-a--pruebas-automáticas) desde `mitienda/`. Todos deben terminar en ✅ | 3 min |
| 3 | **Preparar "desde 0"** | `SEED_AUTOMATICO = false` en `src/data/seed.js` → `adb shell pm clear com.mitienda` → abrir la app ([B·Preparación](#bpreparación)) | 3 min |
| 4 | **Escenario desde 0** | [B0](#b0--primer-arranque-todo-vacío) → [B9](#b9--estado-final-esperado-desde-0), en orden y **el mismo día** | 60–90 min |
| 5 | **Transversales con los datos de B9** | [D1](#d1--persistencia-checklist-10) persistencia · [D2](#d2--moneda-y-umbral-checklist-1-21) moneda y umbral (al terminar, regresa a $ y 5) · [D3](#d3--teclado-checklist-14-23--android-16-borde-a-borde) teclado | 20 min |
| 6 | **Verificar la base real** | [B10](#b10--verificación-con-la-base-real-del-teléfono): `qa\extraer-bd.cmd` → integridad y cruce en ✅ → comparar la hoja con B9 | 5 min |
| 7 | **Pruebas extra** | [B11](#b11--prueba-extra-cambia-los-valores-de-b9-hazla-al-final) (venta de 7.5 kg) y [B12](#b12--cambios-del-3009-después-de-b11-cambian-los-valores) (marca opcional, bulto, granel con decimales, modal con teclado) | 15 min |
| 8 | **Preparar la semilla** | `SEED_AUTOMATICO = true` → `adb shell pm clear com.mitienda` → abrir la app y esperar la siembra (~20–25 s) → copiar de Metro los logs `[semilla]` y `[rendimiento] arranque` ([C·Preparación](#cpreparación)) | 5 min |
| 9 | **Generar la hoja** | **Sin tocar nada en la app**: `qa\extraer-bd.cmd` → abrir `qa/datos/VALORES_ESPERADOS.md` → volver a abrir la app | 3 min |
| 10 | **Validar pantallas** | [C1](#c1--validar-pantallas-contra-la-hoja), sección por sección de la hoja | 30 min |
| 11 | **Pruebas con volumen y rendimiento** | [C2](#c2--pruebas-funcionales-con-volumen) · [D4](#d4--rendimiento-con-semilla-build-de-desarrollo) · repetir [D1](#d1--persistencia-checklist-10) | 30 min |
| 12 | **Integridad final** | `qa\extraer-bd.cmd` otra vez → **21 verificaciones en 0** después de todas las acciones | 3 min |
| 13 | **Cerrar** | Llenar la [Parte G](#parte-g--registro-de-resultados), marcar qué hallazgos de la [Parte F](#parte-f--hallazgos-detectados-al-preparar-el-qa) confirmaste y compartir los resultados | 10 min |

> Si un paso falla, anótalo en la Parte G y sigue con el **siguiente bloque**, no con el siguiente paso del mismo bloque: en la Parte B cada valor depende de los anteriores.

**Convenciones**
- `[ ]` = casilla para marcar. **Negritas** = valor exacto que debe verse en pantalla.
- Montos con la moneda por defecto **$**, salvo en la prueba de moneda.
- "Hoy", "7 días", "Semana"… dependen del día. **Haz la Parte B completa en un mismo día.**
- Si algo no coincide: anota la pantalla, el valor visto y el esperado en la [Parte G](#parte-g--registro-de-resultados). No sigas "arreglando" con más acciones, porque los valores siguientes dependen de los anteriores.

**Herramientas** (carpeta `qa/`)

| Archivo | Para qué |
|---|---|
| `qa/extraer-bd.cmd` | Copia la BD del teléfono a `qa/datos/`, genera la hoja de valores esperados y la cruza con las consultas de la app |
| `qa/valores-esperados.mjs` | **Oráculo independiente**: recorre las filas en JavaScript (como la app antes de SQLite) y escribe `qa/datos/VALORES_ESPERADOS.md` |
| `qa/integridad.sql` | Batería de 21 consultas de integridad (todas deben dar 0) |
| `qa/arnes/escenario-desde-cero.mjs` | Ejecuta la Parte B con las acciones reales y verifica cada valor de este documento |
| `qa/arnes/probar-acciones.mjs` | Siembra un año de datos y prueba todas las acciones de dinero |
| `qa/arnes/cruzar-oraculo.mjs` | Compara la hoja del oráculo con las consultas SQL reales de la app |

---

## Parte A — Pruebas automáticas

Desde `mitienda/` (Node 22 o superior):

- [ ] `npx eslint src` → **0 errores** (hay avisos de estilo ya existentes).
- [ ] `node qa/arnes/escenario-desde-cero.mjs` → termina en **✅ ESCENARIO "DESDE 0" VERIFICADO**.
- [ ] `node qa/arnes/probar-acciones.mjs` → **31 ✅**, "Integridad: 21 verificaciones · 0 problemas", **✅ ACCIONES VERIFICADAS**. Tarda ~1 min porque siembra un año.
- [ ] `node qa/valores-esperados.mjs qa/datos/semilla-node.db qa/datos/semilla-esperados.md` y luego `node qa/arnes/cruzar-oraculo.mjs qa/datos/semilla-node.db qa/datos/semilla-esperados.md` → **✅ El oráculo coincide con las consultas de la app** (51 comparaciones).

> Resultado al preparar este documento (29/09/2026): **todo ✅**.

Qué cubren. Corren el código real de `src/data` y `StoreContext` (acciones, cola de escritura, transacciones, consultas) sobre SQLite. Solo se sustituyen React, react-native y op-sqlite. **No** prueban la interfaz (textos, botones, teclado, avisos): eso es la Parte B.

---

## Parte B — App desde 0

### B·Preparación

1. En `src/data/seed.js` cambia `export const SEED_AUTOMATICO = true;` → **`false`**.
2. Borra los datos: `adb shell pm clear com.mitienda`.
3. Con Metro corriendo, abre la app (o `npx react-native run-android`).
4. Al terminar la Parte B y la Parte D, **regresa `SEED_AUTOMATICO` a `true`** antes de la Parte C.

> Todos los valores de esta parte se verificaron ejecutando exactamente estos pasos con las acciones reales de la app (`qa/arnes/escenario-desde-cero.mjs`).

### B0 · Primer arranque (todo vacío)

- [ ] **Ventas**: título "Nueva Venta", tarjeta "**Carrito vacío** — Toca "Agregar" para comenzar". El ícono de créditos no tiene badge.
- [ ] Ventas → **Agregar**: "Seleccionar producto" con solo el chip "Todos" y "**No se encontraron productos.**"
- [ ] Ventas → tipo **Crédito**: aparece directamente el campo "Nombre del cliente nuevo" (no hay selector porque no hay deudores).
- [ ] **Historial** (📋) con Hoy: INGRESOS **$0.00**, Contado **$0.00**, Abonos recibidos **$0.00**, Ventas **0**; lista "🗒️ **Sin ventas** — No hay ventas en el período seleccionado." No aparecen las filas de crédito.
- [ ] **Corte**: INGRESOS DEL DÍA **$0.00**; Contado vendido **$0.00**; Abonos recibidos **$0.00**; Ventas del día **0**; Ventas a crédito (hoy) **$0.00**; Pendiente por cobrar (total) **$0.00**; "Sin ventas registradas hoy."; no aparece "Abonos del día".
- [ ] **Créditos**: "✅ **Sin deudas pendientes** — Todos los clientes están al corriente." y sin total en el encabezado.
- [ ] **Reportes** (7 días): primero "Calculando…" y luego:
  - KPIs Ingreso real **$0.00**, Venta promedio **$0.00**, Ventas **0**, Balance **$0.00**;
  - gráfica "📭 Sin ingresos en este período";
  - Top "📦 Sin ventas en este período";
  - Flujo en $0.00, **sin** la sección "INVERSIÓN EN COMPRAS".
- [ ] **Inventario**: "Valor total: **$0.00**", sin badge en ⚠️, en el encabezado solo ⚠️ y ⚙️ (ya no está 🏷️); chips "Todos" y, fijo a la derecha, un chip **+**; "**No hay productos**".
- [ ] Inventario → ⚠️ **Stock bajo**: "0 Productos", "✅ **¡Todo en orden!**"
- [ ] **Configuración**: filas Personalizar la tienda, Reportes, Compras, Registrar compra, Consumo propio, Historial de actividad; "Copia de seguridad" y "Exportar reporte" con "🚧 Próximamente".
- [ ] Configuración → **Compras**: "🛒 **Sin compras registradas** — Toca "Registrar compra" para registrar tu primera compra." y el botón "Registrar compra".
- [ ] Configuración → **Historial de actividad**: "**0 eventos**", "Sin actividad registrada".
- [ ] Configuración → **Consumo propio**: "📦 Sin productos disponibles — Todos los productos tienen stock 0."
- [ ] Configuración → **Personalizar la tienda**: dueño vacío, tienda "**Mi Tienda**", moneda **$** activa, umbral **5**.

### B1 · Agregar producto sin categorías

Inventario → **Agregar Producto**. En la sección Categoría dice "**Aún no hay categorías. Crea la primera:**" y hay un chip punteado "**+ Nueva categoría**".

- [ ] Tocar "Guardar producto" vacío → "**Falta el nombre**".
- [ ] Llenar Nombre "Coca-Cola", Marca "Coca-Cola", Tamaño "600 ml", Precio de compra 14, Precio de venta 20, Stock 24, Proveedor "Coca-Cola FEMSA" → Guardar → "**Falta categoría**".
- [ ] "**+ Nueva categoría**" → aparece un campo con "Crear" y "✕". "Crear" vacío → "**Falta información**". Escribe "todos" → "**Ya existe**". Escribe **Bebidas** → "Crear" → aparece el chip **Bebidas ya seleccionado** y el chip "+ Nueva categoría" vuelve a mostrarse.
- [ ] Sal con ← **sin guardar el producto** (la categoría Bebidas sí queda creada).

### B2 · Categorías

Inventario → chip **+** (a la derecha de los chips de categoría) → modal "Categorías" con **Bebidas**.

- [ ] Agregar **Botanas** y **Abarrotes**.
- [ ] Agregar "bebidas" → "**Ya existe** — La categoría "bebidas" ya está en la lista." Lo mismo con "Todos".
- [ ] Agregar vacío → "**Falta información**".
- [ ] Chips de Inventario: **Todos · Abarrotes · Bebidas · Botanas** (alfabético).

### B3 · Productos

Inventario → **Agregar Producto** para cada uno:

| # | Nombre / Marca / Categoría | Presentación | Costo | Venta | Stock | ¿Registrar como compra? | Debe verse antes de guardar |
|---|---|---|---|---|---|---|---|
| P1 | Coca-Cola / Coca-Cola / Bebidas | Tamaño `600 ml` | 14 | 20 | 24 | Sí · proveedor escrito "Coca-Cola FEMSA" | "✅ Ganancia: **$6.00 por unidad (30% del precio)**" · "Total de la compra **$336.00**" |
| P1b | Nombre "Coca-Cola" (tocar la sugerencia: la marca se autocompleta) | Tamaño `2l` → "Se guardará como: **2 L**" | Paquete: ☑ "¿Lo compraste por paquete/reja?" 8 piezas · $232 · 1 paquete | 38 | (calculado) | Sí · tocar el chip **Coca-Cola FEMSA** | "→ Costo por unidad: **$29.00**", "→ Stock inicial: **8 unidades**", "✅ Ganancia: **$9.00 por unidad (24% del precio)**", "Total de la compra **$232.00**" |
| P2 | Gansito / Marinela / Botanas | Toggle **Presentación única** → "Se verá como: **Gansito**" | 12 | 18 | 10 | **No** (toggle apagado; el label dice "— opcional") | "✅ Ganancia: **$6.00 por unidad (33% del precio)**" |
| P3 | Arroz a granel / Local / Abarrotes | Toggle **¿Es producto a granel?**, unidad **kg** → "Se guardará como: **por kg**" | **Por bulto**: ☑ "¿Lo compraste por bulto/costal?" → kg por bulto **10** · precio del bulto **$200** · bultos **1** | 28 | (calculado) | Sí · chip punteado **Sin proveedor** | "→ Costo por kg: **$20.00**", "→ Stock inicial: **10 kg**", label "**Precio de venta (por kg)**", "✅ Ganancia: **$8.00 por kg (29% del precio)**", "Total de la compra **$200.00**" |
| P4 | Frijol / La Costeña / Abarrotes | Tamaño `1 kg` | (vacío) | 38 | 3 | **No** | Sin badge de margen |

Validaciones mientras capturas:
- [ ] La etiqueta de la marca dice "**Marca — opcional**".
- [ ] Nombre "Coca Cola" (sin guion) → aviso "⚠️ **¿Es el mismo producto?** Ya existe: Coca-Cola · Coca-Cola" con los botones "Sí, usar ese" y "No, crear nuevo".
- [ ] P1 con el toggle de compra encendido y proveedor vacío → "**Falta el proveedor**".
- [ ] Repetir P2 (Gansito · Marinela · Presentación única) → "**Ya existe** — "Gansito" de Marinela ya está en el inventario."
- [ ] Gansito · Marinela con tamaño "Paquete 3" → "**Primero nombra la presentación actual**".

Después de B3:
- [ ] **Inventario**:
  - "Valor total: **$1358.00**", badge ⚠️ **1**;
  - orden **Arroz a granel · Coca-Cola · Frijol · Gansito**;
  - Coca-Cola con dos filas: "600 ml $20.00 **24 u**" y "2 L $38.00 **8 u**";
  - Arroz "por kg $28.00 / kg **10 kg**";
  - Gansito "*Presentación única* $18.00 10 u";
  - Frijol "1 kg $38.00 **3 u**" en rojo.
- [ ] **Detalle** de cada presentación (Inventario → tocar el producto):

| Presentación | Precio | Badge | Precio de compra | Ganancia | Valor en inventario (a costo) | Última compra | Vendidas (30 d) |
|---|---|---|---|---|---|---|---|
| Coca-Cola 600 ml | $20.00 por unidad | 🟢 24 uds | $14.00 por unidad | **$6.00 (30%)** | **$336.00** | Coca-Cola FEMSA · $14.00 · (hoy) | 0 uds |
| Coca-Cola 2 L | $38.00 por unidad | 🟢 8 uds | $29.00 por unidad | **$9.00 (24%)** | **$232.00** | Coca-Cola FEMSA · $29.00 · (hoy) | 0 uds |
| Gansito (*Presentación única*) | $18.00 por unidad | 🟢 10 uds | $12.00 por unidad | **$6.00 (33%)** | **$120.00** | Sin compras registradas | 0 uds |
| Arroz a granel por kg | $28.00 por kg | 🟢 10 kg | $20.00 por kg | Ganancia por kg **$8.00 (29%)** | **$200.00** | Sin proveedor · $20.00 · (hoy) | 0 kg |
| Frijol 1 kg | $38.00 por unidad | 🟠 3 uds | **Sin registrar** | — | — | Sin compras registradas | 0 uds |

- [ ] Encabezado del detalle: "Coca-Cola · *Coca-Cola* · Bebidas", "**2 PRESENTACIONES**".
- [ ] **Compras**:
  - Total invertido **$768.00** · Compras registradas **3**;
  - orden: *Sin proveedor* **$200.00** · 1 producto → Coca-Cola FEMSA **$232.00** → Coca-Cola FEMSA **$336.00**;
  - al expandir la primera: "Arroz a granel — **Bulto de 10 kg × $200.00 · 10 kg × $20.00 por kg** — $200.00" y la nota "*Alta de producto: Arroz a granel por kg*";
  - al expandir la segunda: "Coca-Cola — **Paquete de 8 × $232.00 · 8 × $29.00 c/u** — $232.00" (las compras de alta ya guardan el paquete o bulto).
- [ ] **Historial de actividad**: **11 eventos**.
  - Un evento por producto nuevo, más uno de compra por P1, P1b y P3.
  - P1b se registra como "Nueva presentación: Coca-Cola 2 L · $38.00 (costo $29.00) · stock 8".

### B4 · Personalizar tienda

- [ ] Vaciar el nombre → Guardar → "**El nombre de la tienda no puede quedar vacío.**"
- [ ] Dueño "**Luis**", tienda "**Tienda QA**" → Guardar → "✓ Cambios guardados". No genera evento en el registro.

### B5 · Ventas

En el modal de productos: Coca 600 "Stock: 24" (gris), Frijol "Stock: 3" (naranja), Arroz "Stock: 10 kg" con etiqueta "A granel". Un producto ya en el carrito no vuelve a aparecer.

| # | Tipo | Carrito | Total | Qué debe pasar |
|---|---|---|---|---|
| V1 | Contado | Coca-Cola 600 ml × 3 + Gansito × 1 → subir a 2 con el stepper | **$96.00** | Alerta "Confirmar venta — Total: $96.00" → toast "Venta completada" |
| V2 | Contado | Arroz a granel, escribir **2.5** | **$70.00** | Antes prueba **12** → "**Cantidad inválida**" (solo hay 10 kg); también con 0 |
| V3 | Crédito · campo "Nombre del cliente nuevo": **Doña Rosa** | Coca-Cola 2 L × 2 + Frijol × 1 | **$114.00** | Modal "Confirmar venta a crédito · Cliente: Doña Rosa", switch "¿Deja abono ahora?" **apagado**, "Quedará debiendo **$114.00**" |
| V4 | Crédito · selector → "+ Nuevo cliente" → **Juan Pérez** | Gansito × 4 | **$72.00** | Enciende el switch y escribe 100 → "**Monto excede el total** — El total de la venta es $72.00." Escribe **30** → "Quedará debiendo **$42.00**" → toast "**Venta completada · Stock bajo: Gansito**" |
| V5 | Crédito · "+ Nuevo cliente" → **juan perez** (minúsculas, sin acento) | Coca-Cola 600 ml × 1 | **$20.00** | Se guarda en el MISMO cliente Juan Pérez |

- [ ] Crédito sin cliente → "**Falta información** — Selecciona o escribe el nombre del cliente…"
- [ ] Antes de V4, el selector muestra "Doña Rosa **$114.00 💳**". Al elegirla aparece "Cliente: Doña Rosa · Pendiente: $114.00".

Después de B5:
- [ ] Badge de Créditos **2**. Selector: **Doña Rosa $114.00 · Juan Pérez $62.00**.
- [ ] **Historial** con Hoy / Todos: INGRESOS **$196.00** · Contado **$166.00** · Abonos recibidos **$30.00** · Vendido a crédito **$206.00** · POR COBRAR (de esas ventas) **$176.00** · Ventas **5**.
- [ ] Historial → expandir V4: "4 × Gansito **$72.00**", "Cliente: **Juan Pérez**", "Abonado: $30.00 · Pendiente: **$42.00**".
- [ ] **Corte**:
  - INGRESOS DEL DÍA **$196.00** · Contado vendido **$166.00** · Abonos recibidos **$30.00**;
  - Abonos del día: **Juan Pérez $30.00**;
  - Ventas a crédito (hoy) **$206.00** · Pendiente por cobrar (total) **$176.00**;
  - Ventas del día **5**;
  - Más vendido: **Gansito — 6 unidades · en 2 ventas** (V1 y V4).
- [ ] **Créditos**:
  - encabezado "**$176.00 total**";
  - Doña Rosa "1 venta a crédito" · chip **Hoy** · **$114.00**;
  - Juan Pérez "2 ventas a crédito" · **Hoy** · **$62.00**.
  - Órdenes: Más antiguo = Doña Rosa → Juan · Más reciente = Juan → Doña Rosa · Mayor deuda = Doña Rosa → Juan · A-Z = Doña Rosa → Juan Pérez.
- [ ] **Inventario**: "Valor total: **$986.00**", badge **2**. **Stock bajo** "2 Productos": 🔴 **Frijol 1 kg 2 uds** → 🟠 **Gansito 4 uds**.
- [ ] **Reportes 7 días**:
  - KPIs Ingreso real **$196.00** · Venta promedio **$74.40** · Ventas **5** · Balance **-$572.00**. Subtítulos: "Dinero que ya cobraste", "Monto promedio por venta", "Número de ventas del período", "Cobrado − gastado en compras".
  - Gráfica **Ingreso real** $196.00, con la barra de hoy (la última) en verde. **Ventas totales** $372.00. Sin chip "vs semana anterior".
  - Top **Más vendidos**:

    | # | Nombre | Marca | Derecha | % |
    |---|---|---|---|---|
    | 1 | Gansito | Marinela | 6 uds · $108.00 | 29% |
    | 2 | Coca-Cola [600 ml] | Coca-Cola | 4 uds · $80.00 | 22% |
    | 3 | Arroz a granel [por kg] | Local | **2.5 kg** · $70.00 | 19% |
    | 4 | Coca-Cola [2 L] | Coca-Cola | 2 uds · $76.00 | 20% |
    | 5 | Frijol [1 kg] | La Costeña | 1 uds · $38.00 | 10% |

    Se ordena por unidades vendidas, pero el % es **sobre lo vendido en dinero** (Σ $372.00), porque kilos y piezas no se pueden sumar. Por eso el 4° (20%) puede tener más % que el 3° (19%). Debajo del 1° dice "% del total vendido (en dinero) en el período".

  - Top **Más rentables** (Frijol no aparece porque no tiene costo):

    | # | Nombre | Derecha | % |
    |---|---|---|---|
    | 1 | Gansito | $36.00 · 6 uds | 37% |
    | 2 | Coca-Cola 600 ml | $24.00 · 4 uds | 24% |
    | 3 | Arroz a granel | $20.00 · 2.5 kg | 20% |
    | 4 | Coca-Cola 2 L | $18.00 · 2 uds | 18% |

  - Flujo: INGRESO REAL **$196.00** · Contado cobrado **$166.00** · Abonos **$30.00** · Crédito otorgado **$206.00** · Pendiente total **$176.00** · Invertido en compras **$768.00** ("Compras a proveedores en el período") · Balance del período **-$572.00**.
- [ ] **Historial de actividad**: **16 eventos**.
  - V4 se registra como "Venta $72.00 a crédito · Juan Pérez · abono inicial $30.00".
  - V5 se registra como "Venta $20.00 a crédito · Juan Pérez", no como "juan perez".

### B6 · Créditos

| Paso | Acción | Qué debe verse |
|---|---|---|
| A1 | Créditos → Juan Pérez → **Registrar pago**. Escribe 100 → "**Monto excede la deuda** — El saldo pendiente es $62.00…". Escribe **50** | Vista previa "Nuevo saldo: **$12.00**" → Registrar abono. Juan pasa a **$12.00** |
| A2 | Tocar Juan Pérez (detalle) | Deuda total **$92.00** · Total abonado **$80.00** · Saldo pendiente **$12.00** · "Ventas a crédito (2)". Tarjeta 1: Total $20.00 · Pendiente **$12.00** · "1 × Coca-Cola 600 ml" · Abonado **$8.00** · [Editar abono]. Tarjeta 2: Total $72.00 · **Saldada** |
| A2b | Tocar el nombre → escribir "DOÑA ROSA" → OK | "**Nombre en uso**" |
| A2b | Escribir **Juan Pérez López** → OK | El encabezado cambia. En Créditos, Historial (V4 "Cliente: Juan Pérez López") y Corte ya aparece el nombre nuevo |
| A3 | Tarjeta 1 → **Editar abono**: "Venta del (hoy) · Total $20.00", "Abonado actual $8.00", "Nuevo monto abonado (0 – $20.00)". Escribe 25 → "**Monto excede la venta**". Escribe **5** | "Pendiente resultante: **$15.00**" → Guardar. Saldo de Juan **$15.00** |
| A4 | Créditos → Doña Rosa → **Registrar devolución**: "Coca-Cola 2 L · 2 vendidas · $38.00 c/u", "Frijol 1 kg · 1 vendidas · $38.00 c/u". Frijol en **1** → "1 producto a devolver" → Confirmar devolución → "**Sí, devolver al inventario**" | Venta Total **$76.00** · saldo de Doña Rosa **$76.00** · Frijol vuelve a **3 u** |
| A5 | Créditos → Doña Rosa → Registrar pago **26** | Doña Rosa **$50.00** |
| A6 | Detalle de Doña Rosa → 🗑️ en su venta → texto con "⚠️ Esta venta ya tiene $26.00 abonados…" → "**Condonar (no devolver mercancía)**" | Resumen: Deuda total **$76.00** · Abonado **$26.00** · Condonado **$50.00** · Saldo **$0.00**. Tarjeta "Saldada" y "Condonado: $50.00 — deuda perdonada". En Créditos solo queda Juan: "**$15.00 total**", badge **1** |
| A7 | Detalle de Juan → venta de $72.00 → Registrar devolución: Gansito **2** → "**No (solo ajustar deuda)**" | Alerta "**Hay que devolver dinero** — El cliente ya había pagado **$36.00** más…". La venta queda en Total **$36.00** · Saldada. Gansito sigue en **4** (no regresó al inventario) |
| A8 | Detalle de Juan → venta de $20.00 → Registrar devolución: Coca-Cola 600 ml **1** → "Sí, devolver al inventario" | Alerta "Hay que devolver dinero — **$5.00**". Esa venta **desaparece** (devolución total). Coca 600 vuelve a **21 u**. Créditos: "**Sin deudas pendientes**", sin badge |

Después de B6:
- [ ] **Historial** con Hoy / Todos: INGRESOS **$264.00** · Contado **$166.00** · Abonos **$98.00** · Vendido a crédito **$112.00** · POR COBRAR **$0.00** · Ventas **4**.
  - Por decisión de negocio, el excedente devuelto en efectivo (**$41**: $36 + $5) **no** se descuenta de los ingresos.
- [ ] **Corte**:
  - INGRESOS **$264.00** · Contado **$166.00** · Abonos **$98.00**;
  - Abonos del día (más reciente arriba): **Doña Rosa $26.00 · Juan Pérez López $42.00 · Juan Pérez López $30.00**. El pago de $50 de A1 se repartió: $42 a la venta más antigua y $8 a la otra; esos $8, corregidos a $5, se borraron con la devolución total.
  - Ventas a crédito (hoy) **$112.00** · Pendiente **$0.00**;
  - Ventas del día **4**;
  - Más vendido **Gansito — 4 unidades · en 2 ventas**.
- [ ] **Inventario**: "Valor total: **$1044.00**", badge **2**.

### B7 · Inventario, categorías y eliminar

| Paso | Acción | Qué debe verse |
|---|---|---|
| I1 | Detalle de Frijol → **Agregar unidades**: "Stock actual 3 unidades" y el aviso "⚠️ Estas unidades no se registran como compra ni como inversión." Escribe **5** | "Nuevo stock: **8 unidades**" → Agregar. Badge **8 uds** 🟢 |
| I2 | Detalle de Gansito → ✏️ (Editar presentación): "Gansito · Marinela", tamaño vacío con la nota "Es la única presentación…". Precio **20** → "✅ Ganancia: **$8.00 por unidad (40% del precio)**"; stock **3**; razón **Merma** → Guardar cambios | En el registro, **dos** eventos: "Gansito: $18.00 → $20.00" y "Stock ajustado: Gansito · 4 → 3 uds · Razón: Merma" (**uno solo** de stock) |
| I3 | Configuración → **Consumo propio**: Coca-Cola 600 ml **+2**, Frijol 1 kg **+1** | Panel "× 2 · **$28.00**", "× 1 · **sin costo**", "Costo de referencia **$28.00**", "Solo informativo, no se registra como gasto · no incluye 1 producto sin costo"; encabezado "**2 productos**"; botón "Confirmar consumo · 2 productos" → toast "**2 productos descontados del inventario**" (se cuentan productos porque piezas y kilos no se suman) |
| I4 | Detalle de Frijol → ✏️ del encabezado: Nombre "Coca-Cola", Marca "Coca-Cola" → Guardar | "No se pudo guardar — **Ya existe otro producto "Coca-Cola" de Coca-Cola.**" → Cancelar |
| I4 | Detalle de Arroz a granel → ✏️: marca **Granel Local** → Guardar | Encabezado "*Granel Local* · Abarrotes" |
| I4 | Inventario → chip **+**: 🗑️ **Abarrotes** | "**Categoría en uso** — … Cámbiales la categoría desde el detalle de cada producto (botón ✏️ junto al nombre)…" |
| I4 | Agregar **Temporal** → 🗑️ → Eliminar. ✏️ **Bebidas** → "abarrotes" → OK → "**Ya existe**" (lo mismo con "Todos"); ✕ para cancelar. Luego ✏️ **Botanas** → "Botanas y dulces" → OK | Chips: **Todos · Abarrotes · Bebidas · Botanas y dulces** |
| I5 | Detalle de Coca-Cola → 🗑️ en **2 L** | "Eliminar presentación — ¿Seguro que quieres eliminar "Coca-Cola 2 L"? **Se perderán 6 unidades de stock** sin registrar como merma. **El historial de ventas y compras … se conserva tal cual.**" → Eliminar. Queda "1 PRESENTACIÓN" |
| — | Historial → venta a crédito de **$76.00** (Doña Rosa) → Eliminar | Texto "…de $76.00 del (hoy)?", "⚠️ Esta venta ya tiene $26.00 abonados…". Tocar "**Eliminar y devolver al inventario**" → "**Stock no devuelto para algunos productos** — • Coca-Cola 2 L" |

Después de B7:
- [ ] Stocks: Coca-Cola 600 ml **19 u** · Gansito **3 u** · Arroz **7.5 kg** · Frijol **7 u**. "Valor total: **$916.00**", badge **1** (Gansito).
- [ ] **Historial** con Hoy / Todos: INGRESOS **$238.00** · Contado **$166.00** · Abonos **$72.00** · Vendido a crédito **$36.00** · POR COBRAR **$0.00** · Ventas **3**.

### B8 · Compras

**C1 · registrar.** Configuración → **Registrar compra**:
- Chips "Usados anteriormente": **Sin proveedor** (punteado) y **Coca-Cola FEMSA**.
- Escribe el proveedor en minúsculas: "coca-cola femsa".
- Busca "coca" → agrega Coca-Cola 600 ml (el costo aparece precargado en 14) → ☑ paquete: 24 piezas · $336 · 1 paquete → "→ Costo unitario calculado: **$14.00 c/u**", "→ Cantidad total: **24 uds**", Subtotal **$336.00**.
- Busca "gans" → agrega Gansito, cantidad **12**, costo **13** (venía en 12) → Subtotal **$156.00**.
- [ ] Barra inferior "Total de la compra **$492.00**", botón "Confirmar compra · 2 productos". La alerta muestra "Proveedor: **Coca-Cola FEMSA**" (mayúsculas corregidas) y "Total: $492.00".
- [ ] Después: Coca 600 **43 u**, Gansito **15 u**. Detalle de Gansito: Precio de compra **$13.00**, Ganancia **$7.00 (35%)**, Última compra "Coca-Cola FEMSA · $13.00 · (hoy)".

**Antes de C2:** cierra la app a la fuerza y vuelve a abrirla (checklist punto 4).

**C2 · editar.** Compras → ✏️ en la compra de **$492.00**:
- [ ] Título "Editar compra". El proveedor aparece cargado. Coca-Cola con el paquete **marcado** (24 · 336 · 1), Gansito con 12 · 13.
- [ ] Cambia Gansito a **10** → Total **$466.00** → "Guardar cambios".
- [ ] Después: Gansito **13 u**, Coca **43 u**, costo de Gansito **$13.00**.
- [ ] Al expandir la compra en la lista ($466.00 · 2 productos): "Coca-Cola — Paquete de 24 × $336.00 · 24 × $14.00 c/u — $336.00" y "Gansito — 10 × $13.00 — $130.00".

**V6 · vender.** Venta de contado: Gansito × 1 → **$20.00**.

**C3 · eliminar revirtiendo.** Compras → 🗑️ en la compra de **$466.00**:
- [ ] "¿Eliminar la compra de Coca-Cola FEMSA del (fecha) por $466.00?" → "**Eliminar y revertir stock**".
- [ ] "**Ya se vendió parte de esta mercancía** — • Gansito: 1 vendidas después…" → "Revertir de todas formas".
- [ ] Después: Coca **19 u**, Gansito **2 u**, costo de Gansito **$12.00** (restaurado).

### B9 · Estado final esperado (desde 0)

- [ ] **Ventas**: sin badge de créditos.
- [ ] **Inventario**:
  - "Valor total: **$896.00**", badge **1**;
  - chips Todos (4) · Abarrotes (2) · Bebidas (1) · Botanas y dulces (1);
  - Arroz a granel con marca *Granel Local*.
- [ ] **Stock bajo**: "**1 Producto**" · 🔴 **2 uds** · Gansito · Marinela · $20.00 c/u.
- [ ] **Detalle**:

| Presentación | Precio | Badge | Precio de compra | Ganancia | Valor a costo | Última compra | Vendidas 30 d |
|---|---|---|---|---|---|---|---|
| Arroz a granel por kg (Granel Local · Abarrotes) | $28.00 por kg | 🟢 7.5 kg | $20.00 por kg | $8.00 (29%) | $150.00 | Sin proveedor · $20.00 · (hoy) | 2.5 kg |
| Coca-Cola 600 ml (Bebidas) | $20.00 por unidad | 🟢 19 uds | $14.00 por unidad | $6.00 (30%) | $266.00 | Coca-Cola FEMSA · $14.00 · (hoy) | 3 uds |
| Frijol 1 kg (Abarrotes) | $38.00 por unidad | 🟢 7 uds | Sin registrar | — | — | Sin compras registradas | 0 uds |
| Gansito (Botanas y dulces) | $20.00 por unidad | 🟠 2 uds | $12.00 por unidad | $8.00 (40%) | $24.00 | Sin compras registradas | 5 uds |

- [ ] **Créditos**: "Sin deudas pendientes".
- [ ] **Historial**:

| Período (Hoy, Semana, Mes y Todo dan igual) | INGRESOS | Contado | Abonos | Vendido a crédito | POR COBRAR | Ventas |
|---|---|---|---|---|---|---|
| Todos | **$258.00** | $186.00 | $72.00 | $36.00 | $0.00 | 4 |
| Contado | **$186.00** | $186.00 | $0.00 | (oculto) | (oculto) | 3 |
| Crédito | **$72.00** | $0.00 | $72.00 | $36.00 | $0.00 | 1 |

  Tarjetas, de la más reciente a la más antigua:
  1. Contado $20.00 (1 × Gansito)
  2. **Crédito** $36.00 (2 × Gansito, Juan Pérez López, Abonado $36.00 · Pendiente **$0.00** en verde)
  3. Contado $70.00 (2.5 × Arroz a granel por kg)
  4. Contado $96.00 (3 × Coca-Cola 600 ml, 2 × Gansito)
- [ ] **Corte**:
  - INGRESOS **$258.00** · Contado **$186.00** · Abonos **$72.00**;
  - Abonos del día **Juan Pérez López $42.00 · Juan Pérez López $30.00**;
  - Ventas a crédito (hoy) **$36.00** · Pendiente **$0.00**;
  - Ventas del día **4**;
  - Más vendido **Gansito — 5 unidades · en 3 ventas**.
- [ ] **Reportes** (7 días, 30 días y Este año dan los mismos valores):
  - KPIs Ingreso real **$258.00** · Venta promedio **$55.50** · Ventas **4** · Balance **-$510.00**.
  - Gráfica Ingreso real **$258.00**. Ventas totales **$222.00**. Barra verde: hoy en 7 días, "Sem 5" en 30 días, el mes actual en Este año. Tooltip de esa barra, por ejemplo "… · $258.00".
  - Más vendidos:
    1. Gansito · Marinela · 5 uds · $92.00 · **41%**
    2. Coca-Cola [600 ml] · Coca-Cola · 3 uds · $60.00 · **27%**
    3. Arroz a granel [por kg] · **Local** · **2.5 kg** · $70.00 · **32%**

    El top muestra la marca con la que se vendió (Local), no la nueva.
  - Más rentables:
    1. Gansito · **$31.00** · 5 uds · 45% (la venta V6 se hizo con costo $13)
    2. Arroz a granel · $20.00 · 2.5 kg · 29%
    3. Coca-Cola 600 ml · $18.00 · 3 uds · 26%
  - Flujo: $258.00 · Contado $186.00 · Abonos $72.00 · Crédito otorgado $36.00 · Pendiente total $0.00 · Invertido **$768.00** · Balance del período **-$510.00**.
- [ ] **Compras**: Total invertido **$768.00** · **3** compras: *Sin proveedor* $200.00 · Coca-Cola FEMSA $232.00 · Coca-Cola FEMSA $336.00.
- [ ] **Consumo propio**: 4 productos en la lista.
- [ ] **Historial de actividad**: **38 eventos**. Por filtro: Ventas **7** · Créditos **7** · Compras **6** · Inventario **11** · Otros **7**. Del más antiguo al más reciente (en pantalla se ven al revés):

<details><summary>Los 38 eventos esperados</summary>

1. Nueva categoría: Bebidas
2. Nueva categoría: Botanas
3. Nueva categoría: Abarrotes
4. Nuevo producto: Coca-Cola 600 ml (Coca-Cola) · stock inicial 24 · costo $14.00
5. Compra $336.00 · 1 producto · Coca-Cola FEMSA (Contado)
6. Nueva presentación: Coca-Cola 2 L · $38.00 (costo $29.00) · stock 8
7. Compra $232.00 · 1 producto · Coca-Cola FEMSA (Contado)
8. Nuevo producto: Gansito (Marinela) · stock inicial 10 · costo $12.00
9. Nuevo producto: Arroz a granel por kg (Local) · stock inicial 10 · costo $20.00
10. Compra $200.00 · 1 producto · Sin proveedor (Contado)
11. Nuevo producto: Frijol 1 kg (La Costeña) · stock inicial 3
12. Venta $96.00 · 2 productos (Contado)
13. Venta $70.00 · 1 producto (Contado)
14. Venta $114.00 a crédito · Doña Rosa
15. Venta $72.00 a crédito · Juan Pérez · abono inicial $30.00
16. Venta $20.00 a crédito · Juan Pérez
17. Abono $50.00 · Juan Pérez
18. Cliente renombrado: "Juan Pérez" → "Juan Pérez López"
19. Abono corregido $8.00 → $5.00 · Juan Pérez López
20. Devolución $38.00 · 1 × Frijol 1 kg · stock devuelto
21. Abono $26.00 · Doña Rosa
22. Deuda condonada $50.00 · Doña Rosa
23. Devolución $36.00 · 2 × Gansito
24. Devolución total $20.00 · 1 × Coca-Cola 600 ml · stock devuelto · venta eliminada
25. +5 uds · Frijol 1 kg (stock anterior: 3)
26. Gansito: $18.00 → $20.00
27. Stock ajustado: Gansito · 4 → 3 uds · Razón: Merma
28. Consumo propio: 2 × Coca-Cola 600 ml, 1 × Frijol 1 kg
29. Producto editado: marca "Local" → "Granel Local"
30. Nueva categoría: Temporal
31. Categoría eliminada: Temporal
32. Categoría renombrada: "Botanas" → "Botanas y dulces"
33. Eliminada: Coca-Cola 2 L
34. Venta $76.00 eliminada (crédito) · sin stock que devolver: Coca-Cola 2 L (producto eliminado)
35. Compra $492.00 · 2 productos · Coca-Cola FEMSA (Contado)
36. Compra editada · $466.00 · Coca-Cola FEMSA
37. Venta $20.00 · 1 producto (Contado)
38. Compra $466.00 eliminada · Coca-Cola FEMSA · stock revertido

</details>

### B10 · Verificación con la base real del teléfono

- [ ] Ejecuta `qa\extraer-bd.cmd`. La consola debe decir "✅ Integridad: 21 verificaciones en 0" y "✅ El oráculo coincide con las consultas de la app".
- [ ] Abre `qa/datos/VALORES_ESPERADOS.md`: debe coincidir con B9. El script cerró la app, así que vuelve a abrirla para comparar.

### B11 · Prueba extra (cambia los valores de B9, hazla al final)

- [ ] Venta de contado: Arroz a granel **7.5** kg → **$210.00** y toast "Venta completada · Stock bajo: Arroz a granel por kg".
- [ ] Corte → Más vendido: "**Arroz a granel por kg — 10 kg · en 2 ventas**" (2.5 + 7.5; checklist punto 2), y Ventas del día **5**. Arroz queda en 0 y desaparece del modal de productos y de Consumo propio. Stock bajo: 🔴 "**Sin stock**".

### B12 · Cambios del 30/09 (después de B11; cambian los valores)

- [ ] **Marca opcional y categoría nueva:**
  - Agregar Producto: "Tortillas", marca **vacía**, "+ Nueva categoría" → **Tortillería** → Crear (queda seleccionada), tamaño "1 kg", venta 24, stock 10, sin compra → se guarda.
  - En Inventario aparece "Tortillas" **sin marca** (sin hueco ni guion); en el modal de productos, sin chip de marca; en el detalle, el encabezado dice solo "**Tortillería**".
  - Evento: "Nuevo producto: Tortillas 1 kg · stock inicial 10" (sin paréntesis vacíos).
  - Repetir el mismo alta → "**Ya existe** — "Tortillas 1 kg" (sin marca) ya está en el inventario."
- [ ] **Compra por bulto:**
  - Registrar compra → Arroz a granel → ☑ "¿Compraste por bulto/costal?" → kg por bulto **25** · precio **$500** · bultos **1**.
  - Debe verse "→ Costo unitario calculado: **$20.00 por kg**", "→ Cantidad total: **25 kg**", Subtotal **$500.00**.
  - En el historial: "Bulto de 25 kg × $500.00 · 25 kg × $20.00 por kg".
- [ ] **Consumo propio a granel:**
  - Arroz a granel tiene un **campo decimal** "0.000 kg" (no botones −/+). Escribe **30** → Confirmar → "**Cantidad inválida** — "Arroz a granel por kg": solo hay 25 kg disponibles."
  - Escribe **0.5** → panel "× 0.5 kg · $10.00", encabezado "1 producto" → toast "**1 producto descontado del inventario**". Arroz queda en **24.5 kg**.
- [ ] **Devolución a granel:**
  - Vende Arroz **1.5** kg de contado ($42.00).
  - Historial → Devolución: "1.5 kg vendidos · $28.00 por kg", campo decimal. Escribe **2** → "**Cantidad inválida** — … solo se vendieron 1.5 kg." Escribe **0.5** → "1 producto a devolver" → "Sí, devolver al inventario".
  - La venta queda en **$28.00**, el Arroz en **23.5 kg** y el evento dice "Devolución $14.00 · 0.5 kg × Arroz a granel por kg · stock devuelto".
- [ ] **Granel en Stock bajo:** Editar presentación de Arroz → stock **2.5**, razón "prueba" → Stock bajo muestra el chip 🟠 "**2.5 kg**" (no "uds").
- [ ] **Agregar unidades (granel):** detalle de Arroz → Agregar unidades **0.1** → "Nuevo stock: **2.6 kg**" (sin decimales de más).
- [ ] **Modal de productos con teclado:** Ventas → Agregar → tocar "Buscar productos". La tarjeta llega **justo hasta arriba del teclado**, sin hueco transparente, con carrito vacío y con productos.

---

## Parte C — Con datos semilla (un año de tienda)

### C·Preparación

1. `SEED_AUTOMATICO = true` en `src/data/seed.js`.
2. `adb shell pm clear com.mitienda` y abre la app.
3. La pantalla de carga dura unos 20–25 s la primera vez. En Metro debe salir:
   - `[semilla] 365 días · …`, con ~31 000 ventas, ~78 000 ítems, ~6 000 abonos, ~610 compras y ~32 000 eventos;
   - `[rendimiento] arranque · en memoria solo 39 productos y 15 clientes…`.
4. **Sin tocar nada más**, ejecuta `qa\extraer-bd.cmd`, que genera `qa/datos/VALORES_ESPERADOS.md`. Si la consola dice ❌ en integridad o en el cruce, detente y anótalo.
5. Vuelve a abrir la app y compara cada pantalla con la hoja, **el mismo día**.

> La semilla es determinista, pero los números cambian según el día en que se siembra (día de la semana, "hoy" cortado a la hora actual). Por eso no van escritos aquí: los calcula la hoja para tu base.

### C1 · Validar pantallas contra la hoja

| Sección de la hoja | Pantalla | Revisar |
|---|---|---|
| 0 | — | Integridad en 0 y conteos de filas |
| 1 | Ventas → Crédito | Badge de créditos y selector (cliente y saldo, mayor deuda primero) |
| 2 | Inventario | Valor total, badge ⚠️, número de productos en cada chip de categoría |
| 3 | Stock bajo | Número, orden y color de cada chip. **Sabritas no surte en los últimos 12 días**: deben aparecer papas/Doritos agotados o bajos |
| 4 | Detalle de producto | Revisa al menos: una con dos marcas (Frijol La Costeña / Isadora), un granel (Arroz, Frijol o Azúcar a granel), Presentación única (Gansito, Chocorroles), un refresco por paquete (Coca-Cola 600 ml) y uno agotado |
| 5 | Créditos | Total del encabezado; por cliente: "N ventas a crédito", chip de días, saldo; los 4 órdenes |
| 6 | Detalle del cliente | Deuda total, abonado, condonado (solo si > 0), saldo, "Ventas a crédito (N)", primera tarjeta. Los morosos (Roberto Díaz, Pedro Martínez) deben tener condonaciones |
| 7 | Historial | Las 12 combinaciones período × pago y las primeras 5 tarjetas de Hoy |
| 8 | Corte | Todas las filas, la lista de abonos del día y el más vendido |
| 9 | Reportes | Los 3 períodos: KPIs, total de cada gráfica y su chip ▲▼ %, tooltip de la barra más alta (con centavos), Top ×2, Flujo |
| 10 | Compras | Resumen, primeras 5 compras, chips de proveedores (Registrar compra y alta de producto) |
| 11 | Historial de actividad | Contador de cada filtro y los 5 más recientes |
| 12 | Consumo propio | Número de productos listados |

### C2 · Pruebas funcionales con volumen

Los valores exactos cambian a cada paso. Se valida **la relación** antes/después.

- [ ] **Paginación Historial** (Todo / Todos): baja hasta el final. Carga de 30 en 30 con spinner, sin saltos ni duplicados (fíjate en las horas). Al final: "**Fin del período**". El contador "Ventas" coincide con la hoja.
- [ ] **Paginación Registro de actividad**: carga de 50 en 50 y termina en "**Inicio del historial**". Cambiar de filtro recarga y el contador cambia.
- [ ] **Paginación Compras**: ~610 compras; baja sin duplicados.
- [ ] **Refresco en vivo** (checklist 24, 25, 27):
  1. Abre Historial (Hoy).
  2. Vuelve a la pestaña Ventas y vende algo de contado de $X.
  3. Regresa: INGRESOS sube exactamente $X y la venta aparece arriba, sin refrescar a mano.
  4. Con el Corte abierto… (no se puede vender con el modal abierto; basta con reabrirlo y ver el cambio).
  5. El Registro de actividad ya muestra "Venta $X…" arriba.
- [ ] **Registrar pago** a un cliente de saldo S con un monto M < S:
  - su saldo pasa a S − M;
  - el encabezado de Créditos baja M;
  - el Corte suma M a "Abonos recibidos" y agrega "Cliente $M" a "Abonos del día".
- [ ] **Pagar todo** a otro cliente: "Confirmar pago completo" → desaparece de la lista y el badge de Ventas baja 1.
- [ ] **Editar abono** de una venta con varios abonos: el total abonado cambia al valor nuevo. Si la venta era de otro día, el Corte de HOY no cambia (se corrige el abono original conservando su fecha).
- [ ] **Condonar** una venta: el saldo del cliente baja exactamente el pendiente de esa venta; el Corte no cambia.
- [ ] **Devolución parcial** en Historial (venta de contado de hoy): el total de la venta baja precio × cantidad, INGRESOS baja lo mismo y el stock sube si elegiste "Sí, devolver".
- [ ] **Eliminar venta** con "Eliminar y devolver al inventario": la venta y sus abonos desaparecen y el stock de cada producto sube la cantidad vendida.
- [ ] **Eliminar compra reciente** con revertir stock: si hubo ventas después, avisa "Ya se vendió parte…" con las unidades de cada producto; el stock baja lo comprado (nunca queda negativo).
- [ ] **Clientes** (checklist 9):
  - venta a crédito a "**doña rosa**" → cae en Doña Rosa;
  - a "**Dona Rosa**" (sin ñ) → crea un cliente **nuevo** (la ñ cuenta);
  - a "**juan  perez**" (doble espacio) → cae en Juan Pérez.
- [ ] **Créditos · chips de días** (checklist 11): ningún chip dice "-1". Un cliente con venta a crédito de ayer muestra "**1 día**" aunque hayan pasado menos de 24 h.
- [ ] **Top por presentación** (checklist 18):
  - en Reportes · Este año, "Frijol 1 kg La Costeña" y "Frijol 1 kg Isadora" aparecen **separados**, y "Leche entera 1 L" Lala y Alpura también, cada uno con su marca;
  - renombra "Leche entera" → "Leche entera Lala" (✏️ del detalle): en el Top **no** se parte en dos filas y muestra el nombre nuevo después de una venta nueva.
- [ ] **Consumo propio con 3 o más productos** (checklist 13): la lista no queda tapada por el panel inferior; se puede bajar hasta el último producto.
- [ ] **Reportes** (checklist 26):
  - al entrar y al cambiar de período aparece "Calculando…";
  - tocar barras, cambiar Ingreso real / Ventas totales y Más vendidos / Más rentables es **instantáneo**;
  - "Este año" se desliza horizontalmente con 12 meses ("← Desliza para ver todos los meses").
- [ ] **Registro de actividad con moneda** (checklist 21): cambia la moneda a € y haz una venta, un abono, una condonación, una devolución y una edición de precio. Los eventos nuevos dicen "€…" y los viejos conservan "$" (texto histórico).
- [ ] Al terminar, `qa\extraer-bd.cmd` otra vez → **integridad en 0** después de todas las acciones.

---

## Parte D — Pruebas transversales

### D5 · Copia de seguridad y sección Desarrollo (checklist 30–31)
La parte SQL ya está verificada en Node con la BD real (20 pruebas: filas e ids idénticos, totales, integridad en 0, rollback, archivos inválidos). Aquí se prueba lo que solo existe en el teléfono: el selector de archivos, Guardar/Compartir y la recarga de la app.

**Exportar**
- [ ] Configuración → **Exportar información**: aparece "Preparando la copia…" y luego "Copia lista" con el nombre `MiTienda-respaldo-AAAA-MM-DD.db`.
- [ ] **Guardar** → se abre el diálogo de Android → guarda en Descargas → Toast "Copia guardada". En el Historial de actividad (filtro Otros) aparece 💾 "Copia de seguridad guardada".
- [ ] **Compartir** → se abre la hoja de compartir (WhatsApp, Drive, correo…). Mándatelo por WhatsApp o Drive.
- [ ] Cancelar el diálogo de Guardar no muestra ningún error.

**Importar en el mismo teléfono (con datos)**
- [ ] Después de exportar, haz una venta nueva. Luego **Importar información** → elige la copia → "Revisando la copia…" → aparece "¿Reemplazar tus datos?" con tienda, productos, ventas, última venta y fecha de la copia.
- [ ] **Cancelar**: nada cambia.
- [ ] **Reemplazar**: "Importando tus datos…" → la app vuelve a Ventas con el carrito vacío → la venta nueva **ya no existe** → Toast "Datos importados" → en el log aparece 📥 "Datos importados de una copia…".
- [ ] Con un producto en el carrito y otra pantalla abierta en Inventario antes de importar: después de importar, las dos pestañas quedan en su pantalla inicial (sin errores).
- [ ] Aparece la fila **Deshacer última importación** con la fecha. Al usarla, vuelve la venta nueva. Usarla otra vez la vuelve a quitar: deshacer guarda los datos actuales.

**Teléfono recién instalado (el caso de pasar los datos a otro teléfono)**
- [ ] `SEED_AUTOMATICO = false` en `src/data/seed.js` + `adb shell pm clear com.mitienda` → la app abre vacía.
- [ ] Configuración → Importar → elige la copia (desde Descargas, Drive o WhatsApp) → el diálogo dice "¿Importar estos datos?" (sin el aviso de reemplazar) → **Importar**.
- [ ] Todos los datos del otro teléfono aparecen: nombre de la tienda, moneda, umbral, productos, créditos, historial y reportes. **No** aparece la fila "Deshacer última importación".
- [ ] Haz una venta, cierra la app a la fuerza y reábrela: la venta sigue ahí. `qa\extraer-bd.cmd` → **integridad en 0**, y en `meta` `tienda_id_actual` es el id de la tienda de la copia.

**Archivos inválidos (los datos no cambian en ninguno)**
- [ ] Una foto o un PDF → "Este archivo no es una copia de Mi Tienda."
- [ ] Un `.db` de otra app → el mismo mensaje.

**Recordatorio de copia** (se activa con ventas sin respaldar desde hace 7+ días)
- [ ] Con la semilla y sin haber exportado nunca: punto naranja en el engrane de Ventas. En Configuración aparece el aviso "Haz una copia de tus datos" con el número de ventas sin respaldar, y la fila Exportar dice "Nunca has hecho una copia".
- [ ] Tocar el aviso inicia la exportación. Al **Guardar** o **Compartir**: el aviso y el punto desaparecen solos, y la fila dice "Última copia: hoy". Si cancelas, siguen ahí.
- [ ] Desde 0 (`pm clear`, sin semilla): haz ventas → **no** hay punto ni aviso, porque las ventas tienen menos de 7 días.
- [ ] En un teléfono nuevo, después de importar: **no** hay aviso (cuenta desde la fecha de la copia importada) y la fila dice "Última copia: hace N días" según la copia.

**Limpieza de temporales**
- [ ] Exporta 2 veces en días distintos (o cambia la fecha del teléfono) → `adb shell run-as com.mitienda ls cache` muestra solo la copia más reciente.
- [ ] Importa una copia → tras reiniciar la app, en `cache` no quedan `importando.db` ni carpetas con nombre UUID.

**Desarrollo (solo build de desarrollo)**
- [ ] Al final de Configuración aparece la tarjeta "DESARROLLO". En un build release **no** aparece.
- [ ] **Vaciar datos** → confirmación → "Vaciando datos…" → app vacía, pero conserva el nombre de la tienda y la moneda.
- [ ] **Reiniciar con datos de ejemplo** → confirmación → "Generando datos de ejemplo…" (unos segundos) → vuelve el año de tienda.

### D1 · Persistencia (checklist 10)
- [ ] Después de B9 (y otra vez al final de C2): cierra la app a la fuerza (deslizar en recientes o `adb shell am force-stop com.mitienda`) y ábrela. **Todos** los valores de B9 siguen iguales, incluidos la moneda, el umbral, las categorías y el nombre de la tienda.
- [ ] Haz una venta y **en menos de 1 segundo** cierra la app a la fuerza. Al reabrir, la venta está completa (con sus productos y su stock descontado) o no está en absoluto. Nunca a medias. Confírmalo con la integridad (`qa\extraer-bd.cmd`).

### D2 · Moneda y umbral (checklist 1, 21)
- [ ] Personalizar tienda → moneda **€** → Guardar. Texto de ejemplo "Ej. €25.50 y €100.00". **Ningún "$" fijo** en:
  - Ventas (carrito, total, alerta de confirmar, selector de clientes);
  - modales (confirmar venta a crédito, registrar pago, editar abono, devolución);
  - Créditos y detalle del cliente;
  - Historial y Corte;
  - Reportes (eje Y, KPIs, tooltip, flujo);
  - Inventario, Stock bajo y selector de productos;
  - Detalle de producto, Agregar/Editar producto (precios de venta y compra; "Precio inválido — mayor a €0");
  - Compras, Registrar compra y Consumo propio.
- [ ] Umbral **3** → Stock bajo "Productos con menos de 3 unidades…", el badge se recalcula. Umbral **2** (con B9) → "¡Todo en orden! Ningún producto tiene stock bajo el umbral de 2 unidades." Umbral "-1" → "El umbral de stock bajo no puede ser negativo."
- [ ] Regresa a **$** y **5**.

### D3 · Teclado (checklist 14, 23 · Android 16, borde a borde)
- [ ] **Agregar producto / Editar presentación / Registrar compra**:
  - al enfocar campos de la parte baja (Proveedor, Stock, cantidad/costo del último producto), la vista sube y el campo queda **visible sobre el teclado**;
  - cambiar de campo con el teclado abierto también ajusta;
  - desplazarse a mano **no** regresa al campo;
  - al cerrar el teclado **no** queda un hueco al final.
- [ ] **Registrar compra** (nueva y en edición): con el teclado abierto se **oculta** la barra "Total de la compra" y reaparece al cerrarlo.
- [ ] **Personalizar tienda** (corregido el 29/09):
  - al tocar "Umbral de stock bajo", el campo sube y queda **visible sobre el teclado**;
  - con el teclado abierto, **un solo toque** en "Guardar cambios" guarda y cierra el teclado;
  - se ve "✓ Cambios guardados", o el recuadro rojo si dejaste el nombre vacío o pusiste un umbral negativo.
- [ ] **Modales con campo de texto** (no modificados; solo revisar si el teclado los tapa):
  - **Categorías** (hoja inferior, campo "Nueva categoría…" al fondo; es el más probable);
  - Registrar pago;
  - Editar abono;
  - Agregar unidades;
  - Confirmar venta a crédito con "¿Deja abono ahora?" encendido;
  - Editar producto (✏️ del detalle).

  Anota en la Parte G cuáles quedan tapados.

### D4 · Rendimiento (con semilla, build de desarrollo)
Copia los logs `[rendimiento]` de Metro a la Parte G.

| Medición | Antes (todo en memoria) | Esperado ahora |
|---|---|---|
| `[rendimiento] arranque` TOTAL | 3.5 s · heap 60 MB | < 1 s · heap mucho menor (solo catálogo y clientes) |
| Reportes "Este año": consulta | 7 062 ms **por toque** | ~0.5 s al entrar; los toques no consultan |
| Reportes "7 días": consulta | 741 ms por toque | < 0.2 s |
| Historial: por dibujado | 280–730 ms | unos pocos ms (los totales vienen de SQLite) |

- [ ] Ninguna pantalla se congela más de ~1 s al abrirla. Bajar por el Historial de un año es fluido.

---

## Parte E — Checklist acumulado (1–32)

| # | Punto | Dónde se prueba |
|---|---|---|
| 1 | Moneda: ningún "$" fijo | D2 |
| 2 | Granel 2.5 kg / Corte muestra "kg" | B5 (V2), B11 |
| 3 | Ajuste de stock con razón → UN evento | B7 (I2) |
| 4 | Compra por paquetes: tras reiniciar, editar conserva el paquete | B8 (reinicio antes de C2) |
| 5 | Alta de producto con "registrar como compra" | B3 (P1, P1b, P3) |
| 6 | Tooltip de Reportes con centavos | C1 (sección 9) |
| 7 | Historial: "Vendido a crédito" y "POR COBRAR" separados | B5, B6 |
| 8 | Devolución con excedente y devolución total | B6 (A7, A8) |
| 9 | "juan perez" = "Juan Pérez"; la ñ es distinta | B5 (V5), C2 |
| 10 | Persistencia + integridad | D1, B10, C2 |
| 11 | Créditos: días de calendario, nunca "-1" | C2 |
| 12 | Switch "¿Deja abono ahora?" apagado por defecto | B5 (V3, V4) |
| 13 | Consumo propio: costo de referencia; lista no tapada | B7 (I3), C2 |
| 14 | Registrar compra: barra oculta con teclado | D3 |
| 15 | Detalle de producto: categoría, ✏️, tarjetas de información | B3, B7, B9 |
| 16 | Borrar categoría en uso | B7 (I4) |
| 17 | Subtítulos de Reportes | B5 |
| 18 | Top por presentación, marcas separadas, renombrar no parte | B5, B9, C2 |
| 19 | Presentación única | B3 (P2), B7 (I2) |
| 20 | Chips de Créditos de ancho natural | B5 / C1 (visual) |
| 21 | Registro de actividad con la moneda configurada | C2 |
| 22 | "Sin proveedor" | B3 (P3), B8, B9 |
| 23 | Teclado (ScrollViewTeclado), ahora también en Personalizar tienda | D3 |
| 24 | Fase 1: Registro por páginas y en vivo | C2 |
| 25 | Fase 2: Historial y Corte desde SQLite | B5–B9, C1, C2 |
| 26 | Fase 3: Reportes | B5, B9, C1, C2 |
| 27 | Fase 4: Créditos | B6, C1, C2 |
| 28 | Fase 5: Compras y detalle de producto | B3, B8, C1 |
| 29 | Fase 6: acciones leen de la BD; arranque liviano | A, B6, B7, B8, D4 |
| 30 | Copia de seguridad: exportar / importar / deshacer, también en un teléfono recién instalado | D5 |
| 31 | Sección Desarrollo (reiniciar con ejemplos / vaciar) | D5 |
| 32 | Recordatorio de copia (punto en el engrane + aviso) y limpieza de temporales | D5 |

---

## Parte F — Hallazgos detectados al preparar el QA

Encontrados al revisar pantalla por pantalla. **No están corregidos**. Durante el QA confirma si los ves y decide cuáles arreglar.

| # | Dónde | Qué pasa | Cómo verlo | Gravedad |
|---|---|---|---|---|
| F1 | Agregar/Editar producto vs Detalle | ✅ **Corregido 30/09.** Ahora los tres muestran "Ganancia: $X por unidad (Y% del precio)" con la misma fórmula | B3, B7 (I2) | — |
| F2 | Stock bajo | ✅ **Corregido 30/09.** El chip de un granel dice "2.5 kg" | B12 | — |
| F3 | Reportes · Top | ✅ **Corregido 30/09.** Granel en "kg"; el % de Más vendidos es sobre el dinero | B5, B9 | — |
| F4 | Consumo propio y Devolución | ✅ **Corregido 30/09.** Granel con campo decimal y validación contra el stock o lo vendido | B12 | — |
| F5 | Consumo propio | ✅ **Corregido 30/09.** Encabezado, botón y toast cuentan productos | B7 (I3), B12 | — |
| F6 | Alta de producto con compra por paquete | ✅ **Corregido 30/09.** La compra de alta guarda el paquete o bulto | B3 → Compras | — |
| F7 | Compras vacía | ✅ **Corregido 30/09.** 'Toca "Registrar compra"…' | B0 | — |
| F8 | Eliminar venta | ✅ **Corregido 30/09.** Solo dice "stock devuelto" si se devolvió algo; nombra lo que no tenía a dónde volver | Evento 34 de B9 | — |
| F9 | Categorías | ✅ **Corregido 30/09.** Renombrar a un nombre que ya tiene otra categoría (o "Todos") → "Ya existe". Solo cambiar mayúsculas de la misma sí se permite | B7 (I4) | — |
| F10 | Personalizar tienda | ✅ **Corregido 30/09.** "Los productos con menos de esta cantidad aparecen en "Stock bajo"." | B4 | — |
| F11 | Créditos | El grupo "Sin nombre" (ventas a crédito sin cliente) no puede recibir abonos. Hoy no se puede crear desde la app | — | Muy baja · **decidido: no se corrige** |
| F13 | Corte · más vendido | ✅ **Corregido el 29/09.** Mostraba "· N transacciones" con el total de ventas del día, como si fueran del producto. Ahora dice "en N ventas" (las ventas donde apareció ese producto) y el total va en la fila nueva "Ventas del día" | B5, B9 | — |
| F12 | Agregar unidades (granel) | ✅ **Corregido 30/09.** "Nuevo stock" sin decimales de más | B12 | — |

---

## Parte G — Registro de resultados

Fecha: ____ · Teléfono / Android: ____ · Build: debug

| Parte / paso | ✅ / ❌ | Valor visto (si ❌) | Esperado | Notas |
|---|---|---|---|---|
| A | | | | |
| B0–B3 | | | | |
| B5 | | | | |
| B6 | | | | |
| B7–B8 | | | | |
| B9 | | | | |
| B10 (integridad / cruce) | | | | |
| C1 | | | | |
| C2 | | | | |
| D1 persistencia | | | | |
| D2 moneda | | | | |
| D3 teclado | | | | |
| D4 rendimiento (pega los logs) | | | | |
| Hallazgos F confirmados | | | | |
