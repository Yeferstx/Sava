import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { demoBusinessId, getActiveBusinessId, getDatabase } from '../../infrastructure/database/database';
import { listProducts } from '../inventory/data/inventoryRepository';
import { listBusinessOrders, updateOrderStatus } from '../orders/data/ordersRepository';
import { recordSale } from '../sales/data/salesRepository';

// una venta que la app le pregunta al vendedor si se hizo
export type Seguimiento = {
  tipo: 'contacto' | 'consulta';
  id: string;
  productId: string;
  producto: string;
  unidad: string;
  precio: number;
  cantidadSugerida: number;
  cliente: string;
  fecha: string;
};

// cuando alguien toca "whatsapp" se anota para preguntarle despues al vendedor.
// si la migracion no esta aplicada o no hay internet no pasa nada
export function registrarContacto(productId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  void supabase.rpc('registrar_contacto', { p_product_id: productId }).then(
    () => undefined,
    () => undefined,
  );
}

// consultas que el vendedor pidio recordar mas tarde (se guardan en el celular)
async function leerPospuestas() {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    'seguimiento_pospuesto',
  );
  if (!fila) return {} as Record<string, string>;
  return JSON.parse(fila.value) as Record<string, string>;
}

async function guardarPospuestas(datos: Record<string, string>) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    'seguimiento_pospuesto',
    JSON.stringify(datos),
  );
}

export async function pendientesDeSeguimiento() {
  const supabase = getSupabaseClient();
  if (!supabase) return [] as Seguimiento[];
  const businessId = await getActiveBusinessId();
  if (businessId === demoBusinessId) return [] as Seguimiento[];
  const productos = await listProducts();
  const pospuestas = await leerPospuestas();
  const ahora = new Date();
  const lista: Seguimiento[] = [];

  // 1. contactos por whatsapp sin respuesta
  const { data: contactos, error } = await supabase
    .from('contactos')
    .select('id,product_id,created_at')
    .eq('business_id', businessId)
    .is('resultado', null)
    .lte('preguntar_desde', ahora.toISOString())
    .order('created_at', { ascending: true })
    .limit(10);
  if (!error && contactos) {
    for (const contacto of contactos) {
      let producto = null;
      for (const item of productos) {
        if (item.id === contacto.product_id) producto = item;
      }
      if (!producto) continue;
      lista.push({
        tipo: 'contacto',
        id: contacto.id,
        productId: producto.id,
        producto: producto.name,
        unidad: producto.unit,
        precio: producto.price_cop,
        cantidadSugerida: 1,
        cliente: 'Alguien',
        fecha: contacto.created_at,
      });
    }
  }

  // 2. consultas en sava sin cerrar despues de 12 horas
  try {
    const consultas = await listBusinessOrders();
    const hace12Horas = ahora.getTime() - 12 * 60 * 60 * 1000;
    for (const consulta of consultas) {
      if (consulta.status !== 'pending' && consulta.status !== 'accepted') continue;
      if (new Date(consulta.created_at).getTime() > hace12Horas) continue;
      const hasta = pospuestas[consulta.id];
      if (hasta && new Date(hasta) > ahora) continue;
      if (!consulta.order_items || consulta.order_items.length === 0) continue;
      const item = consulta.order_items[0];
      lista.push({
        tipo: 'consulta',
        id: consulta.id,
        productId: item.product_id,
        producto: item.product_name,
        unidad: item.unit,
        precio: Number(item.unit_price_cop),
        cantidadSugerida: Number(item.quantity),
        cliente: consulta.customer_name,
        fecha: consulta.created_at,
      });
    }
  } catch {
    /* sin internet no se revisan las consultas */
  }
  return lista;
}

// si vendio: se registra la venta (baja el inventario) y se marca como vendida
export async function confirmarVendido(item: Seguimiento, cantidad: number, precio: number) {
  await recordSale(item.productId, cantidad, precio);
  const supabase = getSupabaseClient();
  if (!supabase) return;
  if (item.tipo === 'consulta') {
    await updateOrderStatus(item.id, 'completed');
    return;
  }
  const { error } = await supabase
    .from('contactos')
    .update({ resultado: 'vendido', cantidad, total_cop: Math.round(cantidad * precio) })
    .eq('id', item.id);
  if (error) throw error;
}

export async function confirmarNoVendido(item: Seguimiento) {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  if (item.tipo === 'consulta') {
    await updateOrderStatus(item.id, 'rejected');
    return;
  }
  const { error } = await supabase.from('contactos').update({ resultado: 'no_vendido' }).eq('id', item.id);
  if (error) throw error;
}

// "todavia estamos hablando": se vuelve a preguntar manana
export async function posponer(item: Seguimiento) {
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  if (item.tipo === 'consulta') {
    const pospuestas = await leerPospuestas();
    pospuestas[item.id] = manana;
    await guardarPospuestas(pospuestas);
    return;
  }
  const supabase = getSupabaseClient();
  if (!supabase) return;
  const { error } = await supabase.from('contactos').update({ preguntar_desde: manana }).eq('id', item.id);
  if (error) throw error;
}
