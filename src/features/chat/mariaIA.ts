import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { autorizoIA } from '../legal/autorizaciones';

// lo que la ia puede proponer. la app lo muestra y la persona confirma
export type AccionIA =
  | {
      tipo: 'preparar_publicacion';
      datos: {
        nombre: string;
        cantidad: number;
        unidad: string;
        precio_cop: number;
        categoria: string;
        descripcion: string;
      };
    }
  | { tipo: 'registrar_venta'; datos: { producto: string; cantidad: number; precio_unitario_cop: number } }
  | { tipo: 'buscar_en_mercado'; datos: { producto: string; municipio: string; cantidad: number } };

export type RespuestaIA = { texto: string; accion: AccionIA | null };

const ESPERA_MAXIMA = 25000;

// solo la fecha y el rol: las cuentas, ventas e inventario nunca salen del celular hacia la ia
function armarContexto(tipo: 'agricultor' | 'tienda' | '') {
  const lineas: string[] = [];
  lineas.push(
    'Fecha: ' +
      new Date().toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
  );
  if (tipo === '') lineas.push('Rol: comprador (no vende en Sava).');
  else
    lineas.push(
      'Rol: ' + (tipo === 'tienda' ? 'tienda del campo (vende insumos)' : 'campesino (vende su cosecha)'),
    );
  return lineas.join('\n');
}

// pregunta a maria con ia. null si no hay ia disponible (se usan las reglas del celular)
export async function preguntarAMaria(
  mensaje: string,
  historial: Array<{ autor: 'user' | 'assistant'; texto: string }>,
  tipo: 'agricultor' | 'tienda' | '',
): Promise<RespuestaIA | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  // la ia es solo para personas con cuenta
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  // la persona debe haber autorizado que sus preguntas vayan a gemini (es opcional)
  if (!(await autorizoIA(data.session.user.id))) return null;
  const contexto = armarContexto(tipo);
  try {
    const llamada = supabase.functions.invoke('maria', { body: { mensaje, historial, contexto } });
    const espera = new Promise<null>((resolver) => setTimeout(() => resolver(null), ESPERA_MAXIMA));
    const resultado = await Promise.race([llamada, espera]);
    if (!resultado || resultado.error || !resultado.data) return null;
    const cuerpo = resultado.data as { texto?: string; accion?: AccionIA | null };
    let texto = '';
    if (typeof cuerpo.texto === 'string') texto = cuerpo.texto;
    let accion: AccionIA | null = null;
    if (cuerpo.accion && validarAccion(cuerpo.accion)) accion = cuerpo.accion;
    return { texto, accion };
  } catch {
    return null;
  }
}

// se revisa lo que llega antes de usarlo (nunca se confia a ciegas en la respuesta)
function validarAccion(accion: AccionIA) {
  const d = accion.datos as Record<string, unknown>;
  if (accion.tipo === 'preparar_publicacion') {
    return (
      typeof d.nombre === 'string' &&
      d.nombre.length >= 2 &&
      typeof d.cantidad === 'number' &&
      d.cantidad > 0 &&
      typeof d.precio_cop === 'number' &&
      d.precio_cop > 0 &&
      typeof d.unidad === 'string' &&
      typeof d.categoria === 'string' &&
      typeof d.descripcion === 'string'
    );
  }
  if (accion.tipo === 'registrar_venta') {
    return (
      typeof d.producto === 'string' &&
      d.producto !== '' &&
      typeof d.cantidad === 'number' &&
      d.cantidad > 0 &&
      typeof d.precio_unitario_cop === 'number' &&
      d.precio_unitario_cop >= 0
    );
  }
  if (accion.tipo === 'buscar_en_mercado') {
    return (
      typeof d.producto === 'string' &&
      d.producto !== '' &&
      typeof d.municipio === 'string' &&
      typeof d.cantidad === 'number'
    );
  }
  return false;
}
