import { getDatabase } from '../../infrastructure/database/database';
import type { Product } from '../inventory/types';
import type { Business } from '../business/types';
import { registrarInteres } from '../../shared/intereses';
import { esInsumo } from '../../shared/agro';

// los guardados viven solo en este celular (no se suben a internet)
export type Favorito = { product: Product; business: Business | null };

type Fila = { product_id: string; producto: string; negocio: string | null };

export async function listarFavoritos() {
  const db = await getDatabase();
  const filas = await db.getAllAsync<Fila>(
    'SELECT product_id, producto, negocio FROM favoritos ORDER BY guardado_en DESC',
  );
  const lista: Favorito[] = [];
  for (const fila of filas) {
    let negocio: Business | null = null;
    if (fila.negocio) negocio = JSON.parse(fila.negocio);
    lista.push({ product: JSON.parse(fila.producto), business: negocio });
  }
  return lista;
}

export async function esFavorito(productId: string) {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ product_id: string }>(
    'SELECT product_id FROM favoritos WHERE product_id = ?',
    productId,
  );
  if (fila) return true;
  return false;
}

export async function guardarFavorito(product: Product, business: Business | null) {
  // guardar algo muestra mas interes que solo verlo
  void registrarInteres(esInsumo(product.category) ? 'insumos' : 'cosechas', 2);
  const db = await getDatabase();
  let negocio = null;
  if (business) negocio = JSON.stringify(business);
  await db.runAsync(
    'INSERT OR REPLACE INTO favoritos (product_id, producto, negocio, guardado_en) VALUES (?, ?, ?, ?)',
    product.id,
    JSON.stringify(product),
    negocio,
    new Date().toISOString(),
  );
}

export async function quitarFavorito(productId: string) {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM favoritos WHERE product_id = ?', productId);
}
