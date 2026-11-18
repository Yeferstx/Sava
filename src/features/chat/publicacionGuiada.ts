// publicacion guiada: el asistente pregunta paso a paso y arma el borrador.
// nada se publica hasta que la persona confirma
import { extraerCantidad, extraerPrecio, leerNumero, municipioEn, normalizar, soloPrecio, unidadDe } from './maria';
import { fechaDesdeHoy } from '../../shared/agro';
import { mostrarCantidad, textoUnidad } from '../../shared/validaciones';

export type Paso = 'producto' | 'cantidad' | 'unidad' | 'municipio' | 'minimo' | 'fecha' | 'precio' | 'descripcion';

// null = todavia no se ha preguntado
export type DatosGuia = {
  nombre: string | null; cantidad: number | null; unidad: string | null; municipio: string | null;
  minimo: number | null; fecha: string | null; precio: number | null; descripcion: string | null;
};

export const guiaVacia: DatosGuia = { nombre: null, cantidad: null, unidad: null, municipio: null, minimo: null, fecha: null, precio: null, descripcion: null };

const orden: Paso[] = ['producto', 'cantidad', 'unidad', 'municipio', 'minimo', 'fecha', 'precio', 'descripcion'];
const campoDe: Record<Paso, keyof DatosGuia> = { producto: 'nombre', cantidad: 'cantidad', unidad: 'unidad', municipio: 'municipio', minimo: 'minimo', fecha: 'fecha', precio: 'precio', descripcion: 'descripcion' };

export function siguientePaso(datos: DatosGuia): Paso | null {
  for (const paso of orden) { if (datos[campoDe[paso]] === null) return paso; }
  return null;
}

function mayuscula(texto: string) {
  const limpio = texto.trim();
  return limpio.charAt(0).toLocaleUpperCase('es-CO') + limpio.slice(1);
}

function plural(unidad: string) {
  return textoUnidad(2, unidad);
}

// la pregunta de cada paso, con botones de respuesta rapida
export function preguntar(paso: Paso, datos: DatosGuia, municipiosSugeridos: string[], unidades: string[]): { texto: string; opciones: string[] } {
  const nombre = (datos.nombre ?? '').toLocaleLowerCase('es-CO');
  const unidad = datos.unidad ?? 'kg';
  if (paso === 'producto') return { texto: '¡Claro! Vamos a hacerlo juntos. ¿Qué producto tienes disponible?', opciones: [] };
  if (paso === 'cantidad') return { texto: '¿Cuánto ' + nombre + ' tienes disponible? Por ejemplo: «500 kilos».', opciones: [] };
  if (paso === 'unidad') return { texto: '¿En qué lo mides?', opciones: unidades };
  if (paso === 'municipio') return { texto: '¿En qué municipio está la cosecha?', opciones: municipiosSugeridos };
  if (paso === 'minimo') return { texto: '¿Desde qué cantidad lo ofreces? Si vendes cualquier cantidad, dímelo.', opciones: ['Cualquier cantidad', 'Desde 10 ' + plural(unidad), 'Desde 100 ' + plural(unidad)] };
  if (paso === 'fecha') return { texto: '¿Desde cuándo está disponible?', opciones: ['Desde hoy', 'Mañana', 'En una semana', 'En dos semanas'] };
  if (paso === 'precio') return { texto: '¿A cómo vendes cada ' + unidad + '? Si prefieres negociarlo, dime «a convenir».', opciones: ['A convenir'] };
  return { texto: '¿Quieres agregar algo más? Por ejemplo la variedad o cómo entregas. Si no, toca «Sin descripción».', opciones: ['Sin descripción'] };
}

// palabras para corregir un dato ya dado: "cambiar el precio", "corregir municipio"
const nombresPaso: Array<{ palabras: string[]; paso: Paso }> = [
  { palabras: ['producto', 'nombre'], paso: 'producto' },
  { palabras: ['cantidad', 'cuanto tengo'], paso: 'cantidad' },
  { palabras: ['unidad', 'medida'], paso: 'unidad' },
  { palabras: ['municipio', 'lugar', 'pueblo'], paso: 'municipio' },
  { palabras: ['minimo', 'pedido minimo'], paso: 'minimo' },
  { palabras: ['fecha', 'disponible', 'cuando'], paso: 'fecha' },
  { palabras: ['precio', 'valor'], paso: 'precio' },
  { palabras: ['descripcion', 'detalle'], paso: 'descripcion' },
];

export function pasoACorregir(mensaje: string): Paso | null {
  const t = normalizar(mensaje);
  if (!/^(cambiar|cambia|cambiale|corregir|corrige|corrijo|editar|me equivoque en)\b/.test(t)) return null;
  for (const grupo of nombresPaso) {
    for (const palabra of grupo.palabras) { if (t.includes(palabra)) return grupo.paso; }
  }
  return null;
}

export function quiereCancelar(mensaje: string) {
  return /^(cancelar|cancela|ya no|dejalo|olvidalo|no quiero publicar|salir)\b/.test(normalizar(mensaje));
}

// lee la respuesta a un paso. devuelve los datos nuevos o un mensaje para volver a preguntar
export function responder(paso: Paso, mensaje: string, datos: DatosGuia, municipios: string[]): { datos: DatosGuia } | { error: string } {
  const t = normalizar(mensaje);
  const nuevo = { ...datos };
  if (paso === 'producto') {
    // "tengo 500 kilos de pina" tambien sirve: se toman la cantidad y la unidad
    const conCantidad = extraerCantidad(t);
    let nombre = conCantidad.producto;
    if (conCantidad.cantidad > 0 && nombre !== '') {
      nuevo.cantidad = conCantidad.cantidad;
      if (conCantidad.unidad !== '') nuevo.unidad = conCantidad.unidad;
    } else {
      nombre = t.replace(/^(tengo|vendo|es|son|ofrezco|unos?|unas?|de|del|la|el|los|las)\s+/g, '').replace(/^(de|del|la|el|los|las|unos?|unas?)\s+/, '');
    }
    nombre = nombre.trim();
    if (nombre.length < 3) return { error: 'No te entendí el producto. Dime solo el nombre, por ejemplo «piña» o «yuca».' };
    nuevo.nombre = mayuscula(mensaje.toLocaleLowerCase('es-CO').includes(nombre) ? nombre : nombreConTildes(mensaje, nombre));
    return { datos: nuevo };
  }
  if (paso === 'cantidad') {
    const conCantidad = extraerCantidad(t);
    let cantidad = conCantidad.cantidad;
    if (cantidad <= 0) {
      const primero = t.split(' ').map(leerNumero).find((n) => n > 0);
      if (primero) cantidad = primero;
    }
    if (!cantidad || cantidad <= 0) return { error: 'Dime la cantidad con un número, por ejemplo «500 kilos» o «20 bultos».' };
    nuevo.cantidad = cantidad;
    let unidad = conCantidad.unidad;
    if (unidad === '') for (const palabra of t.split(' ')) { if (unidadDe(palabra) !== '') { unidad = unidadDe(palabra); break; } }
    if (unidad !== '') nuevo.unidad = unidad;
    return { datos: nuevo };
  }
  if (paso === 'unidad') {
    let unidad = '';
    for (const palabra of t.split(' ')) { if (unidadDe(palabra) !== '') { unidad = unidadDe(palabra); break; } }
    if (unidad === '' && ['kg', 'tonelada', 'bulto', 'canastilla', 'caja', 'racimo', 'unidad', 'libra', 'litro', 'galon'].includes(t)) unidad = t === 'galon' ? 'galón' : t;
    if (unidad === '') return { error: 'Elige una medida: kilos, toneladas, bultos, canastillas, racimos o unidades.' };
    nuevo.unidad = unidad;
    return { datos: nuevo };
  }
  if (paso === 'municipio') {
    const municipio = municipioEn(t);
    if (municipio === '' || !municipios.includes(municipio)) return { error: 'No reconocí ese municipio de Casanare. Dime, por ejemplo, «Yopal» o «Aguazul».' };
    nuevo.municipio = municipio;
    return { datos: nuevo };
  }
  if (paso === 'minimo') {
    if (/\b(cualquier|no|ninguno|ninguna|todo|lo que sea|poquito|al detal)\b/.test(t)) { nuevo.minimo = 0; return { datos: nuevo }; }
    const numero = t.split(' ').map(leerNumero).find((n) => n > 0);
    if (!numero) return { error: 'Dime desde cuánto vendes, por ejemplo «desde 100 kilos», o «cualquier cantidad».' };
    if (datos.cantidad !== null && numero > datos.cantidad) return { error: 'El pedido mínimo no puede ser mayor que lo que tienes (' + mostrarCantidad(datos.cantidad) + '). ¿Desde cuánto lo ofreces?' };
    nuevo.minimo = numero;
    return { datos: nuevo };
  }
  if (paso === 'fecha') {
    let dias = -1;
    if (/\b(hoy|ya|ahora|ahorita|listo|lista|disponible)\b/.test(t)) dias = 0;
    else if (/\bpasado manana\b/.test(t)) dias = 2;
    else if (/\bmanana\b/.test(t)) dias = 1;
    else if (/\b(dos semanas|quince dias|15 dias)\b/.test(t)) dias = 14;
    else if (/\b(una semana|semana|8 dias|ocho dias)\b/.test(t)) dias = 7;
    else if (/\bmes\b/.test(t)) dias = 30;
    else {
      const enDias = t.match(/(\d+|[a-z]+)\s+dias?/);
      if (enDias && leerNumero(enDias[1]) > 0) dias = leerNumero(enDias[1]);
    }
    if (dias < 0 || dias > 120) return { error: 'Dime cuándo está lista, por ejemplo «desde hoy», «mañana» o «en una semana».' };
    nuevo.fecha = fechaDesdeHoy(dias);
    return { datos: nuevo };
  }
  if (paso === 'precio') {
    if (/\b(convenir|negociar|negociable|no se|no sé|hablamos|depende)\b/.test(t)) { nuevo.precio = 0; return { datos: nuevo }; }
    let precio = soloPrecio(t);
    if (precio <= 0) precio = extraerPrecio(' a ' + t.replace(/^a\s+/, '')).precio;
    if (precio <= 0) return { error: 'Dime el precio en pesos, por ejemplo «2.500» o «25 mil», o «a convenir».' };
    nuevo.precio = precio;
    return { datos: nuevo };
  }
  // descripcion
  if (/^(no|nada|sin descripcion|omitir|asi esta bien|listo|ninguna)$/.test(t)) nuevo.descripcion = '';
  else nuevo.descripcion = mensaje.trim().slice(0, 240);
  return { datos: nuevo };
}

// conserva las tildes de lo que escribio la persona ("pina" -> "piña")
function nombreConTildes(mensaje: string, nombre: string) {
  const palabras = mensaje.replace(/[¿?¡!,;:."]/g, ' ').split(/\s+/);
  const cuantas = nombre.split(' ').length;
  for (let i = 0; i + cuantas <= palabras.length; i++) {
    const trozo = palabras.slice(i, i + cuantas).join(' ');
    if (normalizar(trozo) === nombre) return trozo.toLocaleLowerCase('es-CO');
  }
  return nombre;
}

// resumen corto del borrador para leerlo o escucharlo
export function resumen(datos: DatosGuia) {
  const unidad = datos.unidad ?? 'kg';
  const cantidad = datos.cantidad ?? 0;
  const partes = [(datos.nombre ?? '') + ': ' + mostrarCantidad(cantidad) + ' ' + textoUnidad(cantidad, unidad) + ' en ' + (datos.municipio ?? 'Casanare')];
  if (datos.minimo) partes.push('desde ' + mostrarCantidad(datos.minimo) + ' ' + textoUnidad(datos.minimo, unidad));
  else partes.push('en cualquier cantidad');
  partes.push(datos.precio ? 'a $' + datos.precio.toLocaleString('es-CO') + ' cada ' + unidad : 'precio a convenir');
  return partes.join(', ');
}

// de una frase larga ("tengo 500 kilos de pina en aguazul desde 100 kilos a 2.500") se sacan
// tambien el municipio, el pedido minimo y el precio, para no volver a preguntarlos
export function completarDesdeFrase(mensaje: string, datos: DatosGuia, municipios: string[]): DatosGuia {
  const t = normalizar(mensaje);
  const nuevo = { ...datos };
  if (nuevo.municipio === null) {
    const municipio = municipioEn(t);
    if (municipio !== '' && municipios.includes(municipio)) nuevo.municipio = municipio;
  }
  if (nuevo.minimo === null) {
    const minimo = t.match(/\b(?:desde|minimo(?: de)?|a partir de|pedido minimo(?: de)?)\s+(\d[\d.,]*|[a-z]+)\s*(?:kilos?|kg|bultos?|canastillas?|toneladas?|racimos?|unidades?|cajas?)?/);
    if (minimo) {
      const n = leerNumero(minimo[1]);
      if (n > 0 && (nuevo.cantidad === null || n <= nuevo.cantidad)) nuevo.minimo = n;
    }
    if (/\b(cualquier cantidad|al detal|poquito)\b/.test(t)) nuevo.minimo = 0;
  }
  if (nuevo.precio === null) {
    if (/\b(a convenir|negociable|negociar)\b/.test(t)) nuevo.precio = 0;
    else {
      const precio = extraerPrecio(t.replace(/\b(?:desde|a partir de)\s+\d[\d.,]*/g, ' '));
      if (precio.precio >= 100 && !precio.esTotal) nuevo.precio = precio.precio;
    }
  }
  return nuevo;
}
