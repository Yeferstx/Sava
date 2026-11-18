import { getSupabaseClient } from '../supabase/client';
import { getActiveBusinessId, getDatabase } from '../database/database';

type QueueItem = { id: string; entity: string; operation: string; payload: string; status: string };
type BusinessPayload = { id: string; name: string; category: string; description: string; phone: string; city: string; updated_at: string };
type ProductPayload = { id: string; business_id: string; name: string; category: string; description: string; price_cop: number; stock: number; unit: string; photo_uri?: string | null; is_published?: number | boolean; updated_at: string; municipality?: string; available_from?: string | null; delivery?: string; retired?: number | boolean; min_order?: number; extra_photos?: string };
type SalePayload = { id: string; item_id: string; business_id: string; product_id: string; quantity: number; unit_price_cop: number; total_cop: number; sold_at: string };
type MovimientoPayload = { id: string; business_id: string; tipo: string; product_id: string | null; producto: string; cantidad: number; unidad: string; monto: number; pagado: number; ref_id: string | null; persona: string; nota: string; fecha: string };

// solo una sincronizacion a la vez (evita enviar dos veces lo mismo)
let enCurso: Promise<{ synced: number; reason: 'not-configured' | 'signed-out' | 'complete' | 'conflict' }> | null = null;

// pantallas que quieren enterarse cuando termina una sincronizacion
const oyentes = new Set<() => void>();
export function alSincronizar(oyente: () => void) {
  oyentes.add(oyente);
  return () => { oyentes.delete(oyente); };
}
function avisarOyentes() {
  for (const oyente of oyentes) { try { oyente(); } catch { /* una pantalla con error no frena a las demas */ } }
}

// true mientras se esta enviando algo (para mostrar "Enviando…")
export function sincronizandoAhora() { return enCurso !== null; }

export function syncPendingChanges() {
  if (!enCurso) { enCurso = sincronizar().finally(() => { enCurso = null; avisarOyentes(); }); avisarOyentes(); }
  return enCurso;
}

async function guardarAjuste(clave: string, valor: string) {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', clave, valor);
}

async function sincronizar() {
  const supabase = getSupabaseClient();
  if (!supabase) return { synced: 0, reason: 'not-configured' as const };
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.user) return { synced: 0, reason: 'signed-out' as const };

  const db = await getDatabase();
  const activeBusinessId = await getActiveBusinessId();
  // los conflictos esperan a que la persona decida; lo demas se envia en orden
  const pending = await db.getAllAsync<QueueItem>("SELECT id, entity, operation, payload, status FROM sync_queue WHERE status <> 'conflict' ORDER BY created_at ASC");
  const enConflicto = new Set((await db.getAllAsync<{ payload: string }>("SELECT payload FROM sync_queue WHERE status = 'conflict' AND entity = 'product'")).map((f) => (JSON.parse(f.payload) as { id: string }).id));
  let synced = 0;
  for (const item of pending) {
    const payload = JSON.parse(item.payload) as BusinessPayload | ProductPayload | SalePayload | MovimientoPayload;
    const relatedBusinessId = item.entity === 'business' ? (payload as BusinessPayload).id : (payload as ProductPayload).business_id;
    if (relatedBusinessId !== activeBusinessId) continue;
    await db.runAsync("UPDATE sync_queue SET status = 'syncing' WHERE id = ?", item.id);
    try {
      if (item.entity === 'business') {
        const business = payload as BusinessPayload;
        const { error } = await supabase.from('businesses').upsert({ id: business.id, owner_id: session.user.id, name: business.name, category: business.category, description: business.description, phone: business.phone, municipality: business.city, updated_at: business.updated_at });
        if (error) throw error;
        await db.runAsync("UPDATE businesses SET sync_status = 'synced' WHERE id = ?", business.id);
      } else if (item.entity === 'product') {
        let product = payload as ProductPayload;
        // otro cambio del mismo producto ya esta en conflicto: este espera tambien
        if (enConflicto.has(product.id)) { await db.runAsync("UPDATE sync_queue SET status = 'conflict' WHERE id = ?", item.id); continue; }
        // conflicto: el producto cambio en el servidor (otro celular) despues de la ultima version que vio este celular
        const local = await db.getFirstAsync<{ server_updated_at: string | null }>('SELECT server_updated_at FROM products WHERE id = ?', product.id);
        const base = local ? local.server_updated_at : null;
        if (base) {
          const remoto = await supabase.from('products').select('updated_at').eq('id', product.id).maybeSingle();
          if (remoto.data && new Date(remoto.data.updated_at as string).getTime() !== new Date(base).getTime()) {
            enConflicto.add(product.id);
            await db.runAsync("UPDATE sync_queue SET status = 'conflict', last_error = 'Cambiado desde otro celular' WHERE id = ?", item.id);
            await db.runAsync("UPDATE products SET sync_status = 'conflict' WHERE id = ?", product.id);
            continue;
          }
        }
        // sube una foto del celular y devuelve su ruta en el servidor
        async function subirFoto(uri: string, nombre: string) {
          const response = await fetch(uri);
          if (!response.ok) throw new Error('No pudimos leer la foto guardada en este dispositivo.');
          const image = await response.arrayBuffer();
          const sourceExtension = uri.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
          // Fetching a local iOS image can produce a Blob with type text/plain. Upload bytes
          // directly so Supabase uses this explicit MIME type instead of the Blob's type.
          const extension = sourceExtension === 'png' ? 'png' : sourceExtension === 'webp' ? 'webp' : 'jpg';
          const contentType = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
          const storagePath = `${session!.user.id}/${product.business_id}/${nombre}.${extension}`;
          const { data: uploaded, error: uploadError } = await supabase!.storage.from('sava-media').upload(storagePath, image, { contentType, upsert: true });
          if (uploadError) throw uploadError;
          return uploaded.path;
        }
        const esLocal = (uri: string | null | undefined) => !!uri && (uri.startsWith('file://') || uri.startsWith('content://'));
        if (esLocal(product.photo_uri)) {
          const ruta = await subirFoto(product.photo_uri as string, product.id);
          product = { ...product, photo_uri: ruta };
          await db.runAsync('UPDATE products SET photo_uri = ? WHERE id = ?', ruta, product.id);
          await db.runAsync('UPDATE sync_queue SET payload = ? WHERE id = ?', JSON.stringify(product), item.id);
        }
        let extras: string[] = [];
        try { extras = JSON.parse(product.extra_photos ?? '[]') as string[]; } catch { extras = []; }
        if (extras.some(esLocal)) {
          const subidas: string[] = [];
          for (let i = 0; i < extras.length; i++) subidas.push(esLocal(extras[i]) ? await subirFoto(extras[i], product.id + '-' + (i + 1) + '-' + Date.now()) : extras[i]);
          extras = subidas;
          product = { ...product, extra_photos: JSON.stringify(extras) };
          await db.runAsync('UPDATE products SET extra_photos = ? WHERE id = ?', JSON.stringify(extras), product.id);
          await db.runAsync('UPDATE sync_queue SET payload = ? WHERE id = ?', JSON.stringify(product), item.id);
        }
        const fila = { id: product.id, business_id: product.business_id, name: product.name, category: product.category, description: product.description, price_cop: product.price_cop, stock: product.stock, unit: product.unit, photo_path: product.photo_uri ?? null, is_published: Boolean(product.is_published ?? true), updated_at: product.updated_at };
        const cosecha = { municipality: product.municipality ?? 'Yopal', available_from: product.available_from ?? undefined, delivery: product.delivery ?? 'A convenir', retired: Boolean(product.retired ?? false), min_order: Number(product.min_order ?? 0), photo_paths: extras };
        let { error } = await supabase.from('products').upsert({ ...fila, ...cosecha });
        // PGRST204 = falta una columna: alguna migracion aun no esta aplicada en supabase.
        // primero sin el pedido minimo, luego sin ningun dato de cosecha
        if (error && error.code === 'PGRST204') {
          const { min_order: _sinMinimo, photo_paths: _sinFotos, ...sinMinimo } = cosecha;
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
        // la version que ahora tiene el servidor es la que se acaba de enviar
        await db.runAsync("UPDATE products SET sync_status = CASE WHEN updated_at = ? THEN 'synced' ELSE sync_status END, server_updated_at = ? WHERE id = ?", product.updated_at, product.updated_at, product.id);
      } else if (item.entity === 'sale') {
        const sale = payload as SalePayload;
        const { error: saleError } = await supabase.from('sales').upsert({ id: sale.id, business_id: sale.business_id, total_cop: sale.total_cop, sold_at: sale.sold_at });
        if (saleError) throw saleError;
        const { error: itemError } = await supabase.from('sale_items').upsert({ id: sale.item_id, sale_id: sale.id, product_id: sale.product_id, quantity: sale.quantity, unit_price_cop: sale.unit_price_cop });
        if (itemError) throw itemError;
        await db.runAsync("UPDATE sales SET sync_status = 'synced' WHERE id = ?", sale.id);
      } else if (item.entity === 'movimiento') {
        const m = payload as MovimientoPayload;
        // upsert por id: si ya se habia enviado, no se duplica
        const { error } = await supabase.from('movimientos').upsert({ id: m.id, business_id: m.business_id, tipo: m.tipo, product_id: m.product_id, producto: m.producto, cantidad: m.cantidad, unidad: m.unidad, monto: m.monto, pagado: m.pagado === 1, ref_id: m.ref_id, persona: m.persona, nota: m.nota, fecha: m.fecha });
        if (error) throw error;
        await db.runAsync("UPDATE movimientos SET sync_status = 'synced' WHERE id = ?", m.id);
      }
      await db.runAsync('DELETE FROM sync_queue WHERE id = ?', item.id);
      synced += 1;
    } catch (error) {
      // se conserva en el celular para reintentar; se detiene para no enviar en desorden
      let mensaje = 'Error al sincronizar';
      if (error && typeof error === 'object' && 'message' in error) mensaje = String((error as { message: string }).message).slice(0, 200);
      await db.runAsync("UPDATE sync_queue SET status = 'error', attempts = attempts + 1, last_error = ? WHERE id = ?", mensaje, item.id);
      if (item.entity === 'movimiento') await db.runAsync("UPDATE movimientos SET sync_status = 'error' WHERE id = ?", (payload as MovimientoPayload).id);
      throw error;
    }
  }
  await guardarAjuste('ultima_sincronizacion', new Date().toISOString());
  if (enConflicto.size > 0) return { synced, reason: 'conflict' as const };
  return { synced, reason: 'complete' as const };
}

export type EstadoSync = { pendientes: number; errores: number; conflictos: number; ultima: string; ultimoError: string };

export async function estadoSincronizacion(): Promise<EstadoSync> {
  const db = await getDatabase();
  const filas = await db.getAllAsync<{ status: string; total: number }>('SELECT status, COUNT(*) AS total FROM sync_queue GROUP BY status');
  let pendientes = 0; let errores = 0; let conflictos = 0;
  for (const fila of filas) {
    if (fila.status === 'conflict') conflictos += fila.total;
    else { pendientes += fila.total; if (fila.status === 'error') errores += fila.total; }
  }
  const ultima = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'ultima_sincronizacion');
  const error = await db.getFirstAsync<{ last_error: string }>("SELECT last_error FROM sync_queue WHERE status = 'error' ORDER BY created_at LIMIT 1");
  return { pendientes, errores, conflictos, ultima: ultima ? ultima.value : '', ultimoError: error ? error.last_error : '' };
}

export type Conflicto = { productId: string; nombre: string; stockLocal: number; stockServidor: number | null };

export async function listarConflictos(): Promise<Conflicto[]> {
  const db = await getDatabase();
  const filas = await db.getAllAsync<{ id: string; name: string; stock: number }>("SELECT id, name, stock FROM products WHERE sync_status = 'conflict'");
  const supabase = getSupabaseClient();
  const lista: Conflicto[] = [];
  for (const fila of filas) {
    let stockServidor: number | null = null;
    if (supabase) {
      const remoto = await supabase.from('products').select('stock').eq('id', fila.id).maybeSingle();
      if (remoto.data) stockServidor = Number(remoto.data.stock);
    }
    lista.push({ productId: fila.id, nombre: fila.name, stockLocal: fila.stock, stockServidor });
  }
  return lista;
}

// la persona decide: 'mio' envia lo de este celular; 'servidor' trae lo del otro celular.
// los movimientos del cuaderno nunca se borran, solo cambia la cantidad del producto
export async function resolverConflicto(productId: string, eleccion: 'mio' | 'servidor') {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Necesitas conexión para resolver esto.');
  const db = await getDatabase();
  const remoto = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
  if (remoto.error) throw remoto.error;
  const filas = await db.getAllAsync<{ id: string; payload: string }>("SELECT id, payload FROM sync_queue WHERE status = 'conflict' AND entity = 'product'");
  const deEste = filas.filter((f) => (JSON.parse(f.payload) as { id: string }).id === productId);
  if (eleccion === 'mio') {
    await db.runAsync("UPDATE products SET sync_status = 'pending', server_updated_at = ? WHERE id = ?", remoto.data ? (remoto.data.updated_at as string) : null, productId);
    for (const f of deEste) await db.runAsync("UPDATE sync_queue SET status = 'pending', last_error = '' WHERE id = ?", f.id);
  } else {
    for (const f of deEste) await db.runAsync('DELETE FROM sync_queue WHERE id = ?', f.id);
    if (remoto.data) {
      await db.runAsync("UPDATE products SET stock = ?, price_cop = ?, is_published = ?, updated_at = ?, server_updated_at = ?, sync_status = 'synced' WHERE id = ?",
        Number(remoto.data.stock), Number(remoto.data.price_cop), remoto.data.is_published ? 1 : 0, remoto.data.updated_at as string, remoto.data.updated_at as string, productId);
    }
  }
  await syncPendingChanges().catch(() => undefined);
}
