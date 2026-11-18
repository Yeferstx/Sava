import { createLocalId, enqueueSync, getActiveBusinessId, getDatabase } from '../../../infrastructure/database/database';
import { syncPendingChanges } from '../../../infrastructure/sync/syncService';
import { getSupabaseClient } from '../../../infrastructure/supabase/client';
import type { Product } from '../types';
import { CANTIDAD_MAXIMA, PRECIO_MAXIMO, errorCantidad, municipios, redondear } from '../../../shared/validaciones';
import { fechaDesdeHoy } from '../../../shared/agro';

export type NewProduct = Pick<Product, 'name' | 'category' | 'description' | 'price_cop' | 'stock' | 'unit'> & {
  photo_uri?: string | null;
  municipality?: string;
  available_from?: string;
  delivery?: string;
  min_order?: number;
  // 0 = borrador (no se muestra a los compradores)
  is_published?: number;
  // hasta 3 fotos mas, ademas de la principal
  extra_photos?: string[];
};

// asi llegan los productos desde supabase (select *)
export type RemoteProduct = {
  id: string; business_id: string; name: string; category: string; description: string; price_cop: number; stock: number; unit: string;
  photo_path: string | null; is_published: boolean; updated_at: string;
  municipality?: string; available_from?: string; delivery?: string; retired?: boolean; created_at?: string; min_order?: number; photo_paths?: string[] | null;
};

// convierte un producto de supabase al formato de la app
export function desdeRemoto(remoto: RemoteProduct): Product {
  let retirado = 0;
  if (remoto.retired) retirado = 1;
  let publicado = 0;
  if (remoto.is_published) publicado = 1;
  return {
    id: remoto.id, business_id: remoto.business_id, name: remoto.name, category: remoto.category, description: remoto.description,
    price_cop: Number(remoto.price_cop), stock: Number(remoto.stock), unit: remoto.unit, photo_uri: remoto.photo_path,
    is_published: publicado, sync_status: 'synced', updated_at: remoto.updated_at,
    municipality: remoto.municipality, available_from: remoto.available_from, delivery: remoto.delivery, retired: retirado, created_at: remoto.created_at, min_order: Number(remoto.min_order ?? 0), extra_photos: JSON.stringify(remoto.photo_paths ?? []),
  };
}

export async function cacheRemoteProducts(remoteProducts: RemoteProduct[]) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const remoto of remoteProducts) {
      const product = desdeRemoto(remoto);
      await db.runAsync(`INSERT INTO products (id, business_id, name, category, description, price_cop, stock, unit, photo_uri, is_published, sync_status, updated_at, municipality, available_from, delivery, retired, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET business_id = excluded.business_id, name = excluded.name, category = excluded.category, description = excluded.description, price_cop = excluded.price_cop, stock = excluded.stock, unit = excluded.unit, photo_uri = excluded.photo_uri, is_published = excluded.is_published, sync_status = 'synced', updated_at = excluded.updated_at, municipality = excluded.municipality, available_from = excluded.available_from, delivery = excluded.delivery, retired = excluded.retired, created_at = excluded.created_at
        WHERE products.sync_status = 'synced'`,
      product.id, product.business_id, product.name, product.category, product.description, product.price_cop, product.stock, product.unit, product.photo_uri, product.is_published, product.updated_at,
      product.municipality ?? 'Yopal', product.available_from ?? null, product.delivery ?? 'A convenir', product.retired ?? 0, product.created_at ?? product.updated_at);
      // lo que llega del servidor no pisa cambios de este celular que aun no se han enviado
      await db.runAsync("UPDATE products SET min_order = ?, extra_photos = ?, server_updated_at = ? WHERE id = ? AND sync_status = 'synced'", product.min_order ?? 0, product.extra_photos ?? '[]', remoto.updated_at, product.id);
    }
  });
  void syncPendingChanges().catch(() => undefined);
}

// las publicaciones retiradas ya no se muestran al agricultor
export async function listProducts() {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  return db.getAllAsync<Product>('SELECT * FROM products WHERE business_id = ? AND retired = 0 ORDER BY name COLLATE NOCASE', businessId);
}

// se revisa aqui tambien porque maria guarda sin pasar por el formulario
function revisarProducto(input: NewProduct) {
  if (input.name.trim().length < 3) throw new Error('El nombre debe tener al menos 3 letras.');
  // precio 0 = a convenir
  if (!Number.isInteger(input.price_cop) || input.price_cop < 0 || input.price_cop > PRECIO_MAXIMO) throw new Error('Revisa el precio.');
  if (input.min_order !== undefined && (input.min_order < 0 || input.min_order > input.stock)) throw new Error('El pedido mínimo no puede ser mayor que la cantidad disponible.');
  const errorStock = errorCantidad(input.stock, input.unit);
  if (errorStock !== '') throw new Error(errorStock);
  if (input.stock > CANTIDAD_MAXIMA) throw new Error('La cantidad no puede pasar de ' + CANTIDAD_MAXIMA + '.');
  if (input.municipality && municipios.includes(input.municipality) === false) throw new Error('Elige un municipio de Casanare.');
}

// municipio de la finca para cuando no se elige uno (borradores de maria)
async function municipioDeLaFinca() {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const finca = await db.getFirstAsync<{ city: string }>('SELECT city FROM businesses WHERE id = ?', businessId);
  if (finca) return finca.city;
  return 'Yopal';
}

export async function createProduct(input: NewProduct) {
  revisarProducto(input);
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const id = createLocalId('product');
  const now = new Date().toISOString();
  let municipio = input.municipality;
  if (!municipio) municipio = await municipioDeLaFinca();
  const product: Product = {
    name: input.name, category: input.category, description: input.description, price_cop: input.price_cop, stock: input.stock, unit: input.unit,
    photo_uri: input.photo_uri ?? null, id, business_id: businessId, is_published: input.is_published ?? 1, sync_status: 'pending', updated_at: now,
    municipality: municipio, available_from: input.available_from ?? fechaDesdeHoy(0), delivery: input.delivery ?? 'A convenir', retired: 0, created_at: now, min_order: input.min_order ?? 0, extra_photos: JSON.stringify((input.extra_photos ?? []).slice(0, 3)),
  };
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO products (id, business_id, name, category, description, price_cop, stock, unit, photo_uri, sync_status, updated_at, municipality, available_from, delivery, retired, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)',
      product.id, product.business_id, product.name, product.category, product.description, product.price_cop, product.stock, product.unit, product.photo_uri, product.sync_status, product.updated_at,
      product.municipality ?? 'Yopal', product.available_from ?? null, product.delivery ?? 'A convenir', now);
    await db.runAsync('UPDATE products SET min_order = ?, is_published = ?, extra_photos = ? WHERE id = ?', product.min_order ?? 0, product.is_published, product.extra_photos ?? '[]', product.id);
    await enqueueSync(db, 'product', 'upsert', product);
  });
  void syncPendingChanges().catch(() => undefined);
  return product;
}

// editar una publicacion que ya existe
export async function updateProduct(productId: string, input: NewProduct) {
  revisarProducto(input);
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const actual = await transaction.getFirstAsync<Product>('SELECT * FROM products WHERE id = ? AND business_id = ?', productId, businessId);
    if (!actual) throw new Error('No encontramos esa publicación.');
    let foto = actual.photo_uri;
    if (input.photo_uri !== undefined) foto = input.photo_uri;
    const nuevo: Product = {
      ...actual, name: input.name, category: input.category, description: input.description, price_cop: input.price_cop, stock: input.stock, unit: input.unit,
      photo_uri: foto, municipality: input.municipality ?? actual.municipality, available_from: input.available_from ?? actual.available_from, delivery: input.delivery ?? actual.delivery, min_order: input.min_order ?? actual.min_order ?? 0,
      extra_photos: input.extra_photos ? JSON.stringify(input.extra_photos.slice(0, 3)) : actual.extra_photos ?? '[]',
      sync_status: 'pending', updated_at: now,
    };
    await transaction.runAsync('UPDATE products SET name = ?, category = ?, description = ?, price_cop = ?, stock = ?, unit = ?, photo_uri = ?, municipality = ?, available_from = ?, delivery = ?, sync_status = ?, updated_at = ? WHERE id = ?',
      nuevo.name, nuevo.category, nuevo.description, nuevo.price_cop, nuevo.stock, nuevo.unit, nuevo.photo_uri, nuevo.municipality ?? 'Yopal', nuevo.available_from ?? null, nuevo.delivery ?? 'A convenir', 'pending', now, productId);
    await transaction.runAsync('UPDATE products SET min_order = ?, extra_photos = ? WHERE id = ?', nuevo.min_order ?? 0, nuevo.extra_photos ?? '[]', productId);
    await enqueueSync(transaction, 'product', 'upsert', nuevo);
  });
  void syncPendingChanges().catch(() => undefined);
}

// activa: se ve en el mercado. pausada: se esconde un tiempo. retirada: se quita del todo
export async function cambiarEstadoPublicacion(productId: string, estado: 'activa' | 'pausada' | 'retirada') {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const now = new Date().toISOString();
  let publicado = 0;
  if (estado === 'activa') publicado = 1;
  let retirado = 0;
  if (estado === 'retirada') retirado = 1;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const actual = await transaction.getFirstAsync<Product>('SELECT * FROM products WHERE id = ? AND business_id = ?', productId, businessId);
    if (!actual) throw new Error('No encontramos esa publicación.');
    await transaction.runAsync('UPDATE products SET is_published = ?, retired = ?, sync_status = ?, updated_at = ? WHERE id = ?', publicado, retirado, 'pending', now, productId);
    await enqueueSync(transaction, 'product', 'upsert', { ...actual, is_published: publicado, retired: retirado, sync_status: 'pending', updated_at: now });
  });
  void syncPendingChanges().catch(() => undefined);
}

export async function adjustStock(productId: string, delta: number) {
  const db = await getDatabase();
  const businessId = await getActiveBusinessId();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const product = await transaction.getFirstAsync<Product>('SELECT * FROM products WHERE id = ? AND business_id = ?', productId, businessId);
    if (!product) throw new Error('No encontramos ese producto.');
    const nextStock = redondear(product.stock + delta);
    if (nextStock < 0) throw new Error('El inventario no puede quedar en negativo.');
    await transaction.runAsync('UPDATE products SET stock = ?, sync_status = ?, updated_at = ? WHERE id = ?', nextStock, 'pending', now, productId);
    await enqueueSync(transaction, 'product', 'upsert', { ...product, stock: nextStock, sync_status: 'pending', updated_at: now });
  });
  void syncPendingChanges().catch(() => undefined);
}

// cuantos cambios faltan por subir a internet
export async function contarPendientes() {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM sync_queue');
  if (!fila) return 0;
  return fila.total;
}

// interes real por cada publicacion: consultas enviadas en sava y contactos por whatsapp.
// necesita internet; sin senal devuelve null (la pantalla sigue funcionando)
export type Interes = Record<string, { consultas: number; contactos: number }>;

export async function interesPorProducto(): Promise<Interes | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const businessId = await getActiveBusinessId();
  try {
    const [contactos, consultas] = await Promise.all([
      supabase.from('contactos').select('product_id').eq('business_id', businessId),
      supabase.from('order_items').select('product_id, orders!inner(business_id)').eq('orders.business_id', businessId),
    ]);
    const mapa: Interes = {};
    for (const fila of (contactos.data ?? []) as Array<{ product_id: string }>) {
      if (!mapa[fila.product_id]) mapa[fila.product_id] = { consultas: 0, contactos: 0 };
      mapa[fila.product_id].contactos += 1;
    }
    for (const fila of (consultas.data ?? []) as Array<{ product_id: string }>) {
      if (!mapa[fila.product_id]) mapa[fila.product_id] = { consultas: 0, contactos: 0 };
      mapa[fila.product_id].consultas += 1;
    }
    return mapa;
  } catch { return null; }
}
