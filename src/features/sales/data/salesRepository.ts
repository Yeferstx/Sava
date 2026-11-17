import { createLocalId, enqueueSync, getActiveBusinessId, getDatabase } from '../../../infrastructure/database/database';
import type { Product } from '../../inventory/types';
import type { SaleSummary } from '../types';
import { syncPendingChanges } from '../../../infrastructure/sync/syncService';
import { errorCantidad, redondear } from '../../../shared/validaciones';

export async function listSales() {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  return db.getAllAsync<SaleSummary>(`SELECT sales.id, products.name AS product_name, products.unit, sale_items.quantity, sales.total_cop, sales.sold_at
    FROM sales JOIN sale_items ON sale_items.sale_id = sales.id JOIN products ON products.id = sale_items.product_id
    WHERE sales.business_id = ? ORDER BY sales.sold_at DESC LIMIT 50`, businessId);
}

export async function cacheRemoteSales(remoteSales: Array<{ id: string; business_id: string; total_cop: number; sold_at: string }>, remoteItems: Array<{ id: string; sale_id: string; product_id: string; quantity: number; unit_price_cop: number }>) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const sale of remoteSales) {
      await db.runAsync(`INSERT INTO sales (id, business_id, total_cop, sold_at, sync_status) VALUES (?, ?, ?, ?, 'synced')
        ON CONFLICT(id) DO UPDATE SET total_cop = excluded.total_cop, sold_at = excluded.sold_at, sync_status = 'synced'`, sale.id, sale.business_id, sale.total_cop, sale.sold_at);
    }
    for (const item of remoteItems) {
      await db.runAsync(`INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price_cop) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET quantity = excluded.quantity, unit_price_cop = excluded.unit_price_cop`, item.id, item.sale_id, item.product_id, item.quantity, item.unit_price_cop);
    }
  });
}

// precioUnitario es opcional: si la venta fue a otro precio (lo dice maria) se usa ese
export async function recordSale(productId: string, quantity = 1, precioUnitario = 0) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const saleId = createLocalId('sale');
  const itemId = createLocalId('item');
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const product = await transaction.getFirstAsync<Product>('SELECT * FROM products WHERE id = ? AND business_id = ?', productId, businessId);
    if (!product) throw new Error('No encontramos ese producto.');
    const errorVenta = errorCantidad(quantity, product.unit);
    if (errorVenta !== '') throw new Error(errorVenta);
    if (redondear(product.stock) < redondear(quantity)) throw new Error('No hay suficiente inventario para registrar esta venta.');
    // en supabase el total es entero, por eso se redondea
    let precio = product.price_cop;
    if (precioUnitario > 0) precio = Math.round(precioUnitario);
    const total = Math.round(precio * quantity);
    const nuevoStock = redondear(product.stock - quantity);
    await transaction.runAsync('INSERT INTO sales (id, business_id, total_cop, sold_at, sync_status) VALUES (?, ?, ?, ?, ?)', saleId, businessId, total, now, 'pending');
    await transaction.runAsync('INSERT INTO sale_items (id, sale_id, product_id, quantity, unit_price_cop) VALUES (?, ?, ?, ?, ?)', itemId, saleId, productId, quantity, precio);
    await transaction.runAsync('UPDATE products SET stock = ?, sync_status = ?, updated_at = ? WHERE id = ?', nuevoStock, 'pending', now, productId);
    await enqueueSync(transaction, 'product', 'upsert', { ...product, stock: nuevoStock, sync_status: 'pending', updated_at: now });
    await enqueueSync(transaction, 'sale', 'create', { id: saleId, item_id: itemId, business_id: businessId, product_id: productId, quantity, unit_price_cop: precio, total_cop: total, sold_at: now });
  });
  void syncPendingChanges().catch(() => undefined);
}

// ventas desde una fecha, para el resumen de maria
export async function ventasDesde(desde: Date) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  return db.getAllAsync<SaleSummary>(`SELECT sales.id, products.name AS product_name, products.unit, sale_items.quantity, sales.total_cop, sales.sold_at
    FROM sales JOIN sale_items ON sale_items.sale_id = sales.id JOIN products ON products.id = sale_items.product_id
    WHERE sales.business_id = ? AND sales.sold_at >= ? ORDER BY sales.sold_at DESC`, businessId, desde.toISOString());
}

// cuanto se ha vendido de cada producto (para el inventario)
export type VendidoPorProducto = { product_id: string; vendido: number; total: number };

export async function vendidoPorProducto() {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  return db.getAllAsync<VendidoPorProducto>(`SELECT sale_items.product_id, SUM(sale_items.quantity) AS vendido, SUM(sales.total_cop) AS total
    FROM sale_items JOIN sales ON sales.id = sale_items.sale_id
    WHERE sales.business_id = ? GROUP BY sale_items.product_id`, businessId);
}
