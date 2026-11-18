import { getSupabaseClient } from '../supabase/client';
import { getActiveBusinessId, getDatabase } from '../database/database';

type QueueItem = { id: string; entity: string; operation: string; payload: string };
type BusinessPayload = { id: string; name: string; category: string; description: string; phone: string; city: string; updated_at: string };
type ProductPayload = { id: string; business_id: string; name: string; category: string; description: string; price_cop: number; stock: number; unit: string; photo_uri?: string | null; is_published?: number | boolean; updated_at: string; municipality?: string; available_from?: string | null; delivery?: string; retired?: number | boolean; min_order?: number };
type SalePayload = { id: string; item_id: string; business_id: string; product_id: string; quantity: number; unit_price_cop: number; total_cop: number; sold_at: string };

export async function syncPendingChanges() {
  const supabase = getSupabaseClient();
  if (!supabase) return { synced: 0, reason: 'not-configured' as const };
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return { synced: 0, reason: 'signed-out' as const };

  const db = await getDatabase();
  const activeBusinessId = await getActiveBusinessId();
  const pending = await db.getAllAsync<QueueItem>('SELECT id, entity, operation, payload FROM sync_queue ORDER BY created_at ASC');
  let synced = 0;
  for (const item of pending) {
    const payload = JSON.parse(item.payload) as BusinessPayload | ProductPayload | SalePayload;
    const relatedBusinessId = item.entity === 'business' ? (payload as BusinessPayload).id : (payload as ProductPayload | SalePayload).business_id;
    if (relatedBusinessId !== activeBusinessId) continue;
    if (item.entity === 'business') {
      const business = payload as BusinessPayload;
      const { error } = await supabase.from('businesses').upsert({ id: business.id, owner_id: session.user.id, name: business.name, category: business.category, description: business.description, phone: business.phone, municipality: business.city, updated_at: business.updated_at });
      if (error) throw error;
      await db.runAsync("UPDATE businesses SET sync_status = 'synced' WHERE id = ?", business.id);
    } else if (item.entity === 'product') {
      let product = payload as ProductPayload;
      if (product.photo_uri?.startsWith('file://') || product.photo_uri?.startsWith('content://')) {
        const response = await fetch(product.photo_uri);
        if (!response.ok) throw new Error('No pudimos leer la foto guardada en este dispositivo.');
        const image = await response.arrayBuffer();
        const sourceExtension = product.photo_uri.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
        // Fetching a local iOS image can produce a Blob with type text/plain. Upload bytes
        // directly so Supabase uses this explicit MIME type instead of the Blob's type.
        const extension = sourceExtension === 'png' ? 'png' : sourceExtension === 'webp' ? 'webp' : 'jpg';
        const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
        const storagePath = `${session.user.id}/${product.business_id}/${product.id}.${extension}`;
        const { data: uploaded, error: uploadError } = await supabase.storage.from('sava-media').upload(storagePath, image, { contentType, upsert: true });
        if (uploadError) throw uploadError;
        product = { ...product, photo_uri: uploaded.path };
        await db.runAsync('UPDATE products SET photo_uri = ? WHERE id = ?', uploaded.path, product.id);
        await db.runAsync('UPDATE sync_queue SET payload = ? WHERE id = ?', JSON.stringify(product), item.id);
      }
      const fila = { id: product.id, business_id: product.business_id, name: product.name, category: product.category, description: product.description, price_cop: product.price_cop, stock: product.stock, unit: product.unit, photo_path: product.photo_uri ?? null, is_published: Boolean(product.is_published ?? true), updated_at: product.updated_at };
      const cosecha = { municipality: product.municipality ?? 'Yopal', available_from: product.available_from ?? undefined, delivery: product.delivery ?? 'A convenir', retired: Boolean(product.retired ?? false), min_order: Number(product.min_order ?? 0) };
      let { error } = await supabase.from('products').upsert({ ...fila, ...cosecha });
      // PGRST204 = falta la columna: la migracion de cosechas aun no esta aplicada en supabase.
      // se sube sin esos datos para no frenar la sincronizacion
      // primero sin el pedido minimo (migracion nueva), luego sin ningun dato de cosecha
      if (error && error.code === 'PGRST204') {
        const { min_order: _sinMinimo, ...sinMinimo } = cosecha;
        const intento = await supabase.from('products').upsert({ ...fila, ...sinMinimo });
        error = intento.error;
      }
      if (error && error.code === 'PGRST204') {
        let filaVieja = fila;
        if (cosecha.retired) filaVieja = { ...fila, is_published: false };
        const segundo = await supabase.from('products').upsert(filaVieja);
        error = segundo.error;
      }
      if (error) throw error;
      await db.runAsync("UPDATE products SET sync_status = 'synced' WHERE id = ?", product.id);
    } else if (item.entity === 'sale') {
      const sale = payload as SalePayload;
      const { error: saleError } = await supabase.from('sales').upsert({ id: sale.id, business_id: sale.business_id, total_cop: sale.total_cop, sold_at: sale.sold_at });
      if (saleError) throw saleError;
      const { error: itemError } = await supabase.from('sale_items').upsert({ id: sale.item_id, sale_id: sale.id, product_id: sale.product_id, quantity: sale.quantity, unit_price_cop: sale.unit_price_cop });
      if (itemError) throw itemError;
      await db.runAsync("UPDATE sales SET sync_status = 'synced' WHERE id = ?", sale.id);
    }
    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', item.id);
    synced += 1;
  }
  return { synced, reason: 'complete' as const };
}
