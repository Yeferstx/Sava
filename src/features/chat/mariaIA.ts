import { getSupabaseClient } from '../../infrastructure/supabase/client';
import { listProducts } from '../inventory/data/inventoryRepository';
import { ventasDesde } from '../sales/data/salesRepository';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';

// lo que la ia puede proponer. la app lo muestra y la persona confirma
export type AccionIA =
  | { tipo: 'preparar_publicacion'; datos: { nombre: string; cantidad: number; unidad: string; precio_cop: number; categoria: string; descripcion: string } }
  | { tipo: 'registrar_venta'; datos: { producto: string; cantidad: number; precio_unitario_cop: number } }
  | { tipo: 'buscar_en_mercado'; datos: { producto: string; municipio: string; cantidad: number } };

export type RespuestaIA = { texto: string; accion: AccionIA | null };

const ESPERA_MAXIMA = 25000;

function sumar(lista: Array<{ total_cop: number }>) {
  let total = 0;
  for (const item of lista) total = total + item.total_cop;
  return total;
}

// resumen de los datos de la persona para que la ia responda con datos reales
async function armarContexto(tipo: 'agricultor' | 'tienda' | '') {
  const lineas: string[] = [];
  lineas.push('Fecha: ' + new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  if (tipo === '') {
    lineas.push('Rol: comprador (no vende en Sava).');
    return lineas.join('\n');
  }
  lineas.push('Rol: ' + (tipo === 'tienda' ? 'tienda del campo (vende insumos)' : 'campesino (vende su cosecha)'));
  try {
    const productos = await listProducts();
    if (productos.length === 0) lineas.push('Inventario: no tiene publicaciones todavía.');
    else {
      lineas.push('Inventario:');
      for (const item of productos.slice(0, 40)) {
        let estado = 'publicada';
        if (item.is_published === 0) estado = 'pausada';
        lineas.push('- ' + item.name + ': quedan ' + mostrarCantidad(item.stock) + ' ' + textoUnidad(item.stock, item.unit) + ', $' + item.price_cop + ' por ' + item.unit + ' (' + estado + ')');
      }
    }
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const semana = new Date(hoy); semana.setDate(semana.getDate() - 6);
    const mes = new Date(hoy); mes.setDate(1);
    const delMes = await ventasDesde(mes < semana ? mes : semana);
    const deHoy = delMes.filter((v) => new Date(v.sold_at) >= hoy);
    const deSemana = delMes.filter((v) => new Date(v.sold_at) >= semana);
    const deMes = delMes.filter((v) => new Date(v.sold_at) >= mes);
    lineas.push('Ventas registradas: hoy $' + sumar(deHoy) + ' (' + deHoy.length + '), últimos 7 días $' + sumar(deSemana) + ' (' + deSemana.length + '), este mes $' + sumar(deMes) + ' (' + deMes.length + ').');
    if (deSemana.length > 0) {
      lineas.push('Ventas de los últimos 7 días:');
      for (const venta of deSemana.slice(0, 20)) lineas.push('- ' + new Date(venta.sold_at).toLocaleDateString('es-CO') + ': ' + venta.product_name + ', ' + mostrarCantidad(venta.quantity) + ' ' + textoUnidad(venta.quantity, venta.unit) + ', $' + venta.total_cop);
    }
  } catch { lineas.push('No se pudo leer el inventario del celular.'); }
  return lineas.join('\n');
}

// pregunta a maria con ia. null si no hay ia disponible (se usan las reglas del celular)
export async function preguntarAMaria(mensaje: string, historial: Array<{ autor: 'user' | 'assistant'; texto: string }>, tipo: 'agricultor' | 'tienda' | ''): Promise<RespuestaIA | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  // la ia es solo para personas con cuenta
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  const contexto = await armarContexto(tipo);
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
    return typeof d.nombre === 'string' && d.nombre.length >= 2 && typeof d.cantidad === 'number' && d.cantidad > 0 && typeof d.precio_cop === 'number' && d.precio_cop > 0 && typeof d.unidad === 'string' && typeof d.categoria === 'string' && typeof d.descripcion === 'string';
  }
  if (accion.tipo === 'registrar_venta') {
    return typeof d.producto === 'string' && d.producto !== '' && typeof d.cantidad === 'number' && d.cantidad > 0 && typeof d.precio_unitario_cop === 'number' && d.precio_unitario_cop >= 0;
  }
  if (accion.tipo === 'buscar_en_mercado') {
    return typeof d.producto === 'string' && d.producto !== '' && typeof d.municipio === 'string' && typeof d.cantidad === 'number';
  }
  return false;
}
