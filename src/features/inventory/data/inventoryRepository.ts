import { createLocalId, enqueueSync, getActiveBusinessId, getDatabase } from '../../../infrastructure/database/database';
import { syncPendingChanges } from '../../../infrastructure/sync/syncService';
import type { Product } from '../types';

export type NewProduct = Pick<Product, 'name' | 'category' | 'description' | 'price_cop' | 'stock' | 'unit'> & { photo_uri?: string | null };

export async function cacheRemoteProducts(remoteProducts: Array<Omit<Product, 'photo_uri' | 'sync_status' | 'is_published'> & { photo_path: string | null; is_published: boolean }>) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const product of remoteProducts) {
      await db.runAsync(`INSERT INTO products (id, business_id, name, category, description, price_cop, stock, unit, photo_uri, is_published, sync_status, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
        ON CONFLICT(id) DO UPDATE SET business_id = excluded.business_id, name = excluded.name, category = excluded.category, description = excluded.description, price_cop = excluded.price_cop, stock = excluded.stock, unit = excluded.unit, photo_uri = excluded.photo_uri, is_published = excluded.is_published, sync_status = 'synced', updated_at = excluded.updated_at`,
      product.id, product.business_id, product.name, product.category, product.description, product.price_cop, product.stock, product.unit, product.photo_path, product.is_published ? 1 : 0, product.updated_at);
    }
  });
  void syncPendingChanges().catch(() => undefined);
}

export async function listProducts() {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  return db.getAllAsync<Product>('SELECT * FROM products WHERE business_id = ? ORDER BY name COLLATE NOCASE', businessId);
}

export async function createProduct(input: NewProduct) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const id = createLocalId('product');
  const now = new Date().toISOString();
  const product: Product = { ...input, photo_uri: input.photo_uri ?? null, id, business_id: businessId, is_published: 1, sync_status: 'pending', updated_at: now };
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO products (id, business_id, name, category, description, price_cop, stock, unit, photo_uri, sync_status, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', product.id, product.business_id, product.name, product.category, product.description, product.price_cop, product.stock, product.unit, product.photo_uri, product.sync_status, product.updated_at);
    await enqueueSync(db, 'product', 'upsert', product);
  });
  void syncPendingChanges().catch(() => undefined);
  return product;
}

export async function adjustStock(productId: string, delta: number) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const product = await transaction.getFirstAsync<Product>('SELECT * FROM products WHERE id = ? AND business_id = ?', productId, businessId);
    if (!product) throw new Error('No encontramos ese producto.');
    const nextStock = product.stock + delta;
    if (nextStock < 0) throw new Error('El inventario no puede quedar en negativo.');
    await transaction.runAsync('UPDATE products SET stock = ?, sync_status = ?, updated_at = ? WHERE id = ?', nextStock, 'pending', now, productId);
    await enqueueSync(transaction, 'product', 'upsert', { ...product, stock: nextStock, sync_status: 'pending', updated_at: now });
  });
  void syncPendingChanges().catch(() => undefined);
}
