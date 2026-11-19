import { getSupabaseClient } from '../../../infrastructure/supabase/client';
import { getDatabase } from '../../../infrastructure/database/database';
import { desdeRemoto, type RemoteProduct } from '../../inventory/data/inventoryRepository';
import type { Product } from '../../inventory/types';
import type { Business } from '../../business/types';

export type Mercado = { products: Product[]; negocios: Business[] };

// trae las publicaciones activas de supabase (cosechas e insumos)
export async function cargarMercado(): Promise<Mercado> {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('sin-servidor');
  // select * para que no falle si la migracion de cosechas aun no esta aplicada
  const respuesta = await supabase
    .from('products')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(150);
  if (respuesta.error) throw respuesta.error;
  const products: Product[] = [];
  const ids: string[] = [];
  for (const fila of respuesta.data) {
    const producto = desdeRemoto(fila as RemoteProduct);
    if (producto.retired === 1) continue;
    products.push(producto);
    if (!ids.includes(producto.business_id)) ids.push(producto.business_id);
  }
  let negocios: Business[] = [];
  if (ids.length > 0) {
    const respuestaNegocios = await supabase
      .from('businesses')
      .select('id,name,category,description,phone,municipality')
      .in('id', ids);
    if (respuestaNegocios.error) throw respuestaNegocios.error;
    negocios = respuestaNegocios.data;
  }
  const mercado = { products, negocios };
  await guardarCopia(mercado);
  return mercado;
}

// copia en el celular para ver lo ultimo cargado cuando no hay internet
async function guardarCopia(mercado: Mercado) {
  try {
    const db = await getDatabase();
    const valor = JSON.stringify({ ...mercado, fecha: new Date().toISOString() });
    await db.runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      'copia_mercado',
      valor,
    );
  } catch {
    /* si no se puede guardar la copia no pasa nada */
  }
}

export async function leerCopia() {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    'copia_mercado',
  );
  if (!fila) return null;
  const datos = JSON.parse(fila.value) as Mercado & { fecha: string };
  return datos;
}

export function negocioDe(mercado: Mercado, product: Product) {
  for (const negocio of mercado.negocios) {
    if (negocio.id === product.business_id) return negocio;
  }
  return null;
}

export function municipioDe(mercado: Mercado, product: Product) {
  if (product.municipality) return product.municipality;
  const negocio = negocioDe(mercado, product);
  if (negocio && negocio.municipality) return negocio.municipality;
  return '';
}
