import { getSupabaseClient } from '../../../infrastructure/supabase/client';
import { createLocalId } from '../../../infrastructure/database/database';

export type NotaVoz = { id: string; order_id: string; autor_id: string; audio_path: string; duracion_seg: number; created_at: string };

// sube el audio grabado en el celular y lo pega a la consulta
export async function enviarNotaVoz(orderId: string, uri: string, duracionSeg: number) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Necesitas internet para enviar la nota de voz.');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Inicia sesión para enviar notas de voz.');
  const respuesta = await fetch(uri);
  if (!respuesta.ok) throw new Error('No pudimos leer el audio grabado.');
  const bytes = await respuesta.arrayBuffer();
  // la carpeta debe empezar con el id del usuario (regla del almacenamiento)
  const ruta = user.id + '/notas/' + createLocalId('nota') + '.m4a';
  const subida = await supabase.storage.from('sava-media').upload(ruta, bytes, { contentType: 'audio/mp4', upsert: false });
  if (subida.error) throw subida.error;
  let segundos = Math.round(duracionSeg);
  if (segundos > 120) segundos = 120;
  const { error } = await supabase.from('notas_voz').insert({ order_id: orderId, audio_path: ruta, duracion_seg: segundos });
  if (error) {
    await supabase.storage.from('sava-media').remove([ruta]);
    throw error;
  }
}

// notas de voz de varias consultas a la vez
export async function listarNotasVoz(orderIds: string[]) {
  const supabase = getSupabaseClient();
  if (!supabase || orderIds.length === 0) return [] as NotaVoz[];
  const { data, error } = await supabase.from('notas_voz').select('id,order_id,autor_id,audio_path,duracion_seg,created_at').in('order_id', orderIds).order('created_at', { ascending: true });
  // si la migracion de notas de voz no esta aplicada, simplemente no hay notas
  if (error) return [] as NotaVoz[];
  return data as NotaVoz[];
}

export function urlNotaVoz(ruta: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return '';
  return supabase.storage.from('sava-media').getPublicUrl(ruta).data.publicUrl;
}
