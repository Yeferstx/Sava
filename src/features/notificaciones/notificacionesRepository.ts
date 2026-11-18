// centro de notificaciones: solo eventos reales (consultas, contactos, respuestas y sincronizacion).
// las visitas no se notifican una por una ni se muestra quien vio
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { getActiveBusinessId, getDatabase } from '../../infrastructure/database/database';
import { getSupabaseClient } from '../../infrastructure/supabase/client';

export type TipoNotificacion = 'consulta' | 'contacto' | 'respuesta' | 'sincronizacion' | 'recordatorio';
export type Notificacion = { id: string; tipo: TipoNotificacion; titulo: string; texto: string; product_id: string | null; leida: number; fecha: string };

async function tabla() {
  const db = await getDatabase();
  await db.execAsync('CREATE TABLE IF NOT EXISTS notificaciones (id TEXT PRIMARY KEY NOT NULL, tipo TEXT NOT NULL, titulo TEXT NOT NULL, texto TEXT NOT NULL, product_id TEXT, leida INTEGER NOT NULL DEFAULT 0, fecha TEXT NOT NULL)');
  return db;
}

const oyentes = new Set<() => void>();
export function alCambiarNotificaciones(oyente: () => void) { oyentes.add(oyente); return () => { oyentes.delete(oyente); }; }
function avisar() { for (const o of oyentes) { try { o(); } catch { /* nada */ } } }

async function ajuste(clave: string) {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', clave);
  return fila ? fila.value : null;
}
async function guardarAjuste(clave: string, valor: string) {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', clave, valor);
}

// avisos del celular: solo si la persona los activo y dio permiso
export async function avisosActivos() { return (await ajuste('avisos_celular')) === 'si'; }
export async function activarAvisos(activar: boolean) {
  if (!activar) { await guardarAjuste('avisos_celular', 'no'); return true; }
  const permiso = await Notifications.requestPermissionsAsync();
  if (!permiso.granted) return false;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('novedades', { name: 'Novedades de Sava', importance: Notifications.AndroidImportance.DEFAULT });
  await guardarAjuste('avisos_celular', 'si');
  return true;
}
Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) });

// guarda una notificacion (el id evita repetirla) y, si estan activos, la muestra en el celular
export async function crearNotificacion(n: Omit<Notificacion, 'leida' | 'fecha'> & { fecha?: string }) {
  const db = await tabla();
  const resultado = await db.runAsync('INSERT OR IGNORE INTO notificaciones (id, tipo, titulo, texto, product_id, leida, fecha) VALUES (?, ?, ?, ?, ?, 0, ?)', n.id, n.tipo, n.titulo, n.texto, n.product_id, n.fecha ?? new Date().toISOString());
  if (resultado.changes === 0) return false;
  try {
    if (await avisosActivos()) await Notifications.scheduleNotificationAsync({ content: { title: n.titulo, body: n.texto }, trigger: null });
  } catch { /* el aviso del celular es opcional */ }
  return true;
}

export async function listarNotificaciones() {
  const db = await tabla();
  return db.getAllAsync<Notificacion>('SELECT * FROM notificaciones ORDER BY fecha DESC LIMIT 100');
}
export async function contarSinLeer() {
  const db = await tabla();
  const fila = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM notificaciones WHERE leida = 0');
  return fila ? fila.total : 0;
}
export async function contarSinLeerDe(tipo: TipoNotificacion) {
  const db = await tabla();
  const fila = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM notificaciones WHERE leida = 0 AND tipo = ?', tipo);
  return fila ? fila.total : 0;
}
export async function marcarLeida(id: string) { const db = await tabla(); await db.runAsync('UPDATE notificaciones SET leida = 1 WHERE id = ?', id); avisar(); }
export async function marcarTodasLeidas() { const db = await tabla(); await db.runAsync('UPDATE notificaciones SET leida = 1'); avisar(); }
export async function borrarNotificaciones() { const db = await tabla(); await db.runAsync('DELETE FROM notificaciones'); await db.runAsync("DELETE FROM app_settings WHERE key IN ('novedades_desde', 'avisos_celular')"); avisar(); }

// revisa en el servidor lo nuevo desde la ultima vez. vendedor: consultas y contactos. comprador: respuestas
let revisando = false;
export async function revisarNovedades(esVendedor: boolean) {
  const supabase = getSupabaseClient();
  if (!supabase || revisando) return;
  revisando = true;
  try {
    const { data } = await supabase.auth.getSession();
    const usuario = data.session?.user;
    if (!usuario) return;
    const ahora = new Date().toISOString();
    // la primera vez solo se miran los ultimos 3 dias (no se llena de avisos viejos)
    const desde = (await ajuste('novedades_desde')) ?? new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
    let nuevas = 0;
    if (esVendedor) {
      const negocio = await getActiveBusinessId();
      const consultas = await supabase.from('orders').select('id, created_at, order_items(product_id, product_name, quantity, unit)').eq('business_id', negocio).gt('created_at', desde).order('created_at');
      if (consultas.error) throw consultas.error;
      for (const c of (consultas.data ?? []) as Array<{ id: string; created_at: string; order_items: Array<{ product_id: string; product_name: string; quantity: number; unit: string }> }>) {
        const item = c.order_items[0];
        if (await crearNotificacion({ id: 'consulta-' + c.id, tipo: 'consulta', titulo: 'Nueva consulta', texto: item ? 'Alguien pregunta por ' + Number(item.quantity) + ' ' + item.unit + ' de ' + item.product_name + '.' : 'Alguien te envió una consulta.', product_id: item ? item.product_id : null, fecha: c.created_at })) nuevas += 1;
      }
      const contactos = await supabase.from('contactos').select('id, product_id, created_at, products(name)').eq('business_id', negocio).gt('created_at', desde).order('created_at');
      if (contactos.error) throw contactos.error;
      for (const c of (contactos.data ?? []) as unknown as Array<{ id: string; product_id: string; created_at: string; products: { name: string } | null }>) {
        if (await crearNotificacion({ id: 'contacto-' + c.id, tipo: 'contacto', titulo: 'Te escribieron por WhatsApp', texto: 'Un comprador abrió WhatsApp para hablarte de ' + (c.products ? c.products.name : 'tu cosecha') + '. Revisa tus mensajes.', product_id: c.product_id, fecha: c.created_at })) nuevas += 1;
      }
    } else {
      const respuestas = await supabase.from('orders').select('id, status, updated_at, order_items(product_name)').eq('customer_id', usuario.id).neq('status', 'pending').gt('updated_at', desde);
      if (respuestas.error) throw respuestas.error;
      const textos: Record<string, string> = { accepted: 'aceptó tu consulta', rejected: 'no puede atender tu consulta', completed: 'marcó tu consulta como completada' };
      for (const r of (respuestas.data ?? []) as Array<{ id: string; status: string; updated_at: string; order_items: Array<{ product_name: string }> }>) {
        const producto = r.order_items[0] ? r.order_items[0].product_name : 'tu pedido';
        if (await crearNotificacion({ id: 'respuesta-' + r.id + '-' + r.status, tipo: 'respuesta', titulo: 'Te respondieron', texto: 'El productor ' + (textos[r.status] ?? 'respondió tu consulta') + ' de ' + producto + '.', product_id: null, fecha: r.updated_at })) nuevas += 1;
      }
    }
    await guardarAjuste('novedades_desde', ahora);
    if (nuevas > 0) avisar();
  } catch { /* sin senal: se revisa la proxima vez */ }
  finally { revisando = false; }
}
