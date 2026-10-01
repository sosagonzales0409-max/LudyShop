-- Batería de integridad de mitienda.db. Cada fila cuenta PROBLEMAS: todo debe dar 0.
-- Solo mira filas vivas (deleted_at IS NULL) salvo donde se indica.
SELECT 'stock != SUM(movimientos)' AS verificacion, COUNT(*) AS problemas FROM presentaciones p
  WHERE p.stock != (SELECT ROUND(COALESCE(SUM(m.cantidad),0),3) FROM movimientos_inventario m WHERE m.presentacion_id = p.id AND m.deleted_at IS NULL)
UNION ALL SELECT 'movimiento sin presentacion', COUNT(*) FROM movimientos_inventario m
  WHERE NOT EXISTS (SELECT 1 FROM presentaciones p WHERE p.id = m.presentacion_id)
UNION ALL SELECT 'presentacion viva sin producto vivo', COUNT(*) FROM presentaciones p
  WHERE p.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM productos x WHERE x.id = p.producto_id AND x.deleted_at IS NULL)
UNION ALL SELECT 'producto vivo sin presentaciones vivas', COUNT(*) FROM productos x
  WHERE x.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM presentaciones p WHERE p.producto_id = x.id AND p.deleted_at IS NULL)
UNION ALL SELECT 'producto vivo con categoria borrada/inexistente', COUNT(*) FROM productos x
  WHERE x.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM categorias c WHERE c.id = x.categoria_id AND c.deleted_at IS NULL)
UNION ALL SELECT 'item vivo de venta sin venta viva', COUNT(*) FROM venta_items i
  WHERE i.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM ventas v WHERE v.id = i.venta_id AND v.deleted_at IS NULL)
UNION ALL SELECT 'venta viva sin items vivos', COUNT(*) FROM ventas v
  WHERE v.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM venta_items i WHERE i.venta_id = v.id AND i.deleted_at IS NULL)
UNION ALL SELECT 'venta a credito sin cliente', COUNT(*) FROM ventas v
  WHERE v.deleted_at IS NULL AND v.tipo_pago = 'Credito' AND NOT EXISTS (SELECT 1 FROM clientes c WHERE c.id = v.cliente_id)
UNION ALL SELECT 'venta de contado CON cliente', COUNT(*) FROM ventas WHERE deleted_at IS NULL AND tipo_pago = 'Contado' AND cliente_id IS NOT NULL
UNION ALL SELECT 'abono vivo sin venta viva', COUNT(*) FROM abonos a
  WHERE a.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM ventas v WHERE v.id = a.venta_id AND v.deleted_at IS NULL)
UNION ALL SELECT 'abono con cliente distinto al de su venta', COUNT(*) FROM abonos a JOIN ventas v ON v.id = a.venta_id
  WHERE a.deleted_at IS NULL AND a.cliente_id IS NOT v.cliente_id
UNION ALL SELECT 'total_abonado != MIN(SUM(abonos), total)', COUNT(*) FROM ventas v
  WHERE v.deleted_at IS NULL AND ABS(v.total_abonado - MIN((SELECT COALESCE(SUM(monto),0) FROM abonos a WHERE a.venta_id = v.id AND a.tipo = 'abono' AND a.deleted_at IS NULL), v.total)) > 0.001
UNION ALL SELECT 'condonado != MIN(SUM(condonaciones), total-abonado)', COUNT(*) FROM ventas v
  WHERE v.deleted_at IS NULL AND ABS(v.condonado - MIN((SELECT COALESCE(SUM(monto),0) FROM abonos a WHERE a.venta_id = v.id AND a.tipo = 'condonacion' AND a.deleted_at IS NULL), v.total - v.total_abonado)) > 0.001
UNION ALL SELECT 'total de venta != SUM(items)', COUNT(*) FROM ventas v
  WHERE v.deleted_at IS NULL AND ABS(v.total - (SELECT COALESCE(SUM(total),0) FROM venta_items i WHERE i.venta_id = v.id AND i.deleted_at IS NULL)) > 0.001
UNION ALL SELECT 'saldo de venta negativo', COUNT(*) FROM ventas
  WHERE deleted_at IS NULL AND total - total_abonado - condonado < -0.001
UNION ALL SELECT 'item vivo de compra sin compra viva', COUNT(*) FROM compra_items i
  WHERE i.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM compras c WHERE c.id = i.compra_id AND c.deleted_at IS NULL)
UNION ALL SELECT 'compra viva sin items vivos', COUNT(*) FROM compras c
  WHERE c.deleted_at IS NULL AND NOT EXISTS (SELECT 1 FROM compra_items i WHERE i.compra_id = c.id AND i.deleted_at IS NULL)
UNION ALL SELECT 'clientes vivos duplicados (nombre_norm)', COUNT(*) FROM (
    SELECT nombre_norm FROM clientes WHERE deleted_at IS NULL GROUP BY tienda_id, nombre_norm HAVING COUNT(*) > 1)
UNION ALL SELECT 'fila con tienda_id ajeno', (
  SELECT COUNT(*) FROM (
    SELECT tienda_id FROM categorias UNION ALL SELECT tienda_id FROM productos UNION ALL SELECT tienda_id FROM presentaciones
    UNION ALL SELECT tienda_id FROM movimientos_inventario UNION ALL SELECT tienda_id FROM clientes UNION ALL SELECT tienda_id FROM ventas
    UNION ALL SELECT tienda_id FROM venta_items UNION ALL SELECT tienda_id FROM abonos UNION ALL SELECT tienda_id FROM compras
    UNION ALL SELECT tienda_id FROM compra_items UNION ALL SELECT tienda_id FROM activity_log
  ) WHERE tienda_id != (SELECT valor FROM meta WHERE clave = 'tienda_id_actual'))
UNION ALL SELECT 'id que no es UUIDv7 (todas las tablas)', (
  SELECT COUNT(*) FROM (
    SELECT id FROM categorias UNION ALL SELECT id FROM productos UNION ALL SELECT id FROM presentaciones
    UNION ALL SELECT id FROM movimientos_inventario UNION ALL SELECT id FROM clientes UNION ALL SELECT id FROM ventas
    UNION ALL SELECT id FROM venta_items UNION ALL SELECT id FROM abonos UNION ALL SELECT id FROM compras
    UNION ALL SELECT id FROM compra_items UNION ALL SELECT id FROM activity_log
  ) WHERE length(id) != 36 OR substr(id, 15, 1) != '7')
UNION ALL SELECT 'updated_at anterior a created_at', (
  SELECT COUNT(*) FROM (
    SELECT created_at c, updated_at u FROM productos UNION ALL SELECT created_at, updated_at FROM presentaciones
    UNION ALL SELECT created_at, updated_at FROM categorias UNION ALL SELECT created_at, updated_at FROM ventas
    UNION ALL SELECT created_at, updated_at FROM abonos UNION ALL SELECT created_at, updated_at FROM compras
  ) WHERE u < c);
