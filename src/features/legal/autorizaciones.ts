import { getDatabase } from '../../infrastructure/database/database';
import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { AUTORIZACIONES, POLITICA_VERSION, type TipoAutorizacion } from './politica';

// el servidor guarda la evidencia (quien, que texto, que version y cuando).
// en el celular solo queda una copia para saber, sin internet, que ya se autorizo
function clave(usuario: string, tipo: TipoAutorizacion) {
  return 'autoriza_' + tipo + '_' + usuario;
}

async function guardarLocal(usuario: string, tipo: TipoAutorizacion, valor: string) {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    clave(usuario, tipo),
    valor,
  );
}

async function leerLocal(usuario: string, tipo: TipoAutorizacion) {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    clave(usuario, tipo),
  );
  return fila?.value ?? '';
}

export type EstadoAutorizacion = {
  otorgada: boolean;
  version_politica: string;
  version_texto: string;
  creado_en: string;
  origen: string;
};

// ultimo estado de cada autorizacion segun el servidor. null si no hay internet
export async function estadoEnServidor(): Promise<Record<
  TipoAutorizacion,
  EstadoAutorizacion | null
> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('autorizaciones_datos')
    .select('tipo, otorgada, version_politica, version_texto, creado_en, origen')
    .order('creado_en', { ascending: false })
    .limit(60);
  if (error || !data) return null;
  const estado: Record<TipoAutorizacion, EstadoAutorizacion | null> = {
    tratamiento_datos: null,
    comunicaciones: null,
    ia_externa: null,
  };
  for (const fila of data as Array<EstadoAutorizacion & { tipo: TipoAutorizacion }>) {
    if (estado[fila.tipo] === null) estado[fila.tipo] = fila;
  }
  return estado;
}

// historial completo (prueba de la autorizacion para la persona)
export async function historialAutorizaciones() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('autorizaciones_datos')
    .select('id, tipo, otorgada, version_politica, version_texto, creado_en, origen')
    .order('creado_en', { ascending: false })
    .limit(60);
  if (error) return null;
  return (data ?? []) as Array<EstadoAutorizacion & { id: string; tipo: TipoAutorizacion }>;
}

// true: falta autorizar la politica vigente. false: ya esta. null: no se pudo saber (sin internet)
export async function faltaAutorizarPolitica(usuario: string): Promise<boolean | null> {
  if ((await leerLocal(usuario, 'tratamiento_datos').catch(() => '')) === POLITICA_VERSION) return false;
  const estado = await estadoEnServidor().catch(() => null);
  if (!estado) return null;
  // de paso se copian al celular las autorizaciones opcionales
  for (const tipo of ['comunicaciones', 'ia_externa'] as const) {
    const fila = estado[tipo];
    await guardarLocal(usuario, tipo, fila && fila.otorgada ? fila.version_texto : '').catch(() => undefined);
  }
  const datos = estado.tratamiento_datos;
  if (datos && datos.otorgada && datos.version_politica === POLITICA_VERSION) {
    await guardarLocal(usuario, 'tratamiento_datos', POLITICA_VERSION).catch(() => undefined);
    return false;
  }
  return true;
}

// registra en el servidor (necesita internet). el servidor no duplica si el estado no cambia
export async function registrarAutorizacion(
  usuario: string,
  tipo: TipoAutorizacion,
  otorgada: boolean,
  origen: 'app' | 'chat' = 'app',
) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Sava no está conectada al servidor.');
  const { error } = await supabase.rpc('registrar_autorizacion', {
    p_tipo: tipo,
    p_otorgada: otorgada,
    p_version_politica: POLITICA_VERSION,
    p_version_texto: AUTORIZACIONES[tipo].version,
    p_origen: origen,
  });
  if (error) throw new Error('No se pudo guardar. Revisa tu conexión e intenta otra vez.');
  let valor = '';
  if (otorgada) valor = tipo === 'tratamiento_datos' ? POLITICA_VERSION : AUTORIZACIONES[tipo].version;
  await guardarLocal(usuario, tipo, valor);
}

// para usar gemini: la persona debe haberlo autorizado (copia local, funciona sin internet)
export async function autorizoIA(usuario: string) {
  const valor = await leerLocal(usuario, 'ia_externa').catch(() => '');
  return valor === AUTORIZACIONES.ia_externa.version;
}

export async function autorizoComunicaciones(usuario: string) {
  const valor = await leerLocal(usuario, 'comunicaciones').catch(() => '');
  return valor === AUTORIZACIONES.comunicaciones.version;
}

export type TipoSolicitud =
  | 'consulta'
  | 'actualizacion'
  | 'rectificacion'
  | 'supresion'
  | 'revocacion'
  | 'prueba_autorizacion';

export async function enviarSolicitud(usuario: string, tipo: TipoSolicitud, detalle: string) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Sava no está conectada al servidor.');
  const { error } = await supabase
    .from('solicitudes_titular')
    .insert({ user_id: usuario, tipo, detalle: detalle.trim().slice(0, 1000) });
  if (error) throw new Error('No se pudo enviar. Revisa tu conexión e intenta otra vez.');
}

export async function misSolicitudes() {
  const supabase = getSupabaseClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from('solicitudes_titular')
    .select('id, tipo, estado, creado_en')
    .order('creado_en', { ascending: false })
    .limit(20);
  return (data ?? []) as Array<{ id: string; tipo: TipoSolicitud; estado: string; creado_en: string }>;
}
