// datos del campo casanareño que usan varias pantallas

export const categoriasAgricolas = [
  'Plátano y banano', 'Yuca y tubérculos', 'Piña', 'Papaya', 'Patilla',
  'Ahuyama', 'Maracuyá y frutas', 'Hortalizas', 'Otros',
];

export const unidades = ['kg', 'bulto', 'caja', 'racimo', 'unidad', 'libra'];

// lo que venden las tiendas del campo (agropecuarias)
export const categoriasInsumos = [
  'Semillas y plantas', 'Cultivos y suelos', 'Ganadería', 'Equipos y riego', 'Otros insumos',
];

// nombres viejos de insumos (productos ya publicados) y su categoria nueva
const insumosViejos: Record<string, string> = {
  'Semillas': 'Semillas y plantas',
  'Abonos y fertilizantes': 'Cultivos y suelos',
  'Agroquímicos': 'Cultivos y suelos',
  'Herramientas': 'Equipos y riego',
  'Alimento para animales': 'Ganadería',
};

export const unidadesInsumo = ['unidad', 'bulto', 'kg', 'litro', 'galón', 'caja'];

export function esInsumo(categoria: string) {
  return categoriasInsumos.includes(categoria) || insumosViejos[categoria] !== undefined;
}

export const formasEntrega = ['Recogida en la finca', 'Entrega en el pueblo', 'A convenir'];

// opciones de fecha de disponibilidad (dias desde hoy)
export const opcionesFecha = [
  { texto: 'Desde hoy', dias: 0 },
  { texto: 'Mañana', dias: 1 },
  { texto: 'En 3 días', dias: 3 },
  { texto: 'En 1 semana', dias: 7 },
  { texto: 'En 2 semanas', dias: 14 },
];

// fecha en formato 2026-11-17 contando dias desde hoy
export function fechaDesdeHoy(dias: number) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return fecha.getFullYear() + '-' + mes + '-' + dia;
}

// muestra "Disponible desde hoy" o "Disponible desde el 20 nov"
export function textoDisponible(fecha: string | null | undefined) {
  if (!fecha) return 'Disponible ahora';
  const hoy = fechaDesdeHoy(0);
  if (fecha <= hoy) return 'Disponible ahora';
  const partes = fecha.split('-');
  const dia = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
  return 'Disponible desde el ' + dia.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export function textoFecha(fecha: string | null | undefined) {
  if (!fecha) return '';
  return new Date(fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
}

// adivina la categoria por el nombre, sirve para los borradores de maria
export function categoriaDeProducto(nombre: string) {
  const texto = nombre.toLowerCase();
  if (texto.includes('plátano') || texto.includes('platano') || texto.includes('banano') || texto.includes('topocho')) return 'Plátano y banano';
  if (texto.includes('yuca') || (texto.includes('papa') && !texto.includes('papaya')) || texto.includes('ñame') || texto.includes('batata')) return 'Yuca y tubérculos';
  if (texto.includes('piña')) return 'Piña';
  if (texto.includes('papaya')) return 'Papaya';
  if (texto.includes('patilla') || texto.includes('sandía') || texto.includes('sandia')) return 'Patilla';
  if (texto.includes('ahuyama') || texto.includes('zapallo')) return 'Ahuyama';
  if (texto.includes('maracuy') || texto.includes('mango') || texto.includes('guayaba') || texto.includes('limón') || texto.includes('limon') || texto.includes('naranja') || texto.includes('fruta')) return 'Maracuyá y frutas';
  // insumos de las tiendas del campo
  if (texto.includes('semilla') || texto.includes('plantula') || texto.includes('plántula') || texto.includes('colino')) return 'Semillas y plantas';
  if (texto.includes('abono') || texto.includes('fertiliz') || texto.includes('urea') || texto.includes('triple 15') || texto.includes('cal ')) return 'Cultivos y suelos';
  if (texto.includes('veneno') || texto.includes('herbicida') || texto.includes('insecticida') || texto.includes('fungicida') || texto.includes('glifosato') || texto.includes('matamaleza') || texto.includes('fumig')) return 'Cultivos y suelos';
  if (texto.includes('machete') || texto.includes('pala') || texto.includes('azad') || texto.includes('bomba') || texto.includes('guadaña') || texto.includes('alambre') || texto.includes('manguera') || texto.includes('riego') || texto.includes('aspersor')) return 'Equipos y riego';
  if (texto.includes('concentrado') || texto.includes('purina') || texto.includes('sal mineral') || texto.includes('melaza') || texto.includes('vacuna') || texto.includes('ganado')) return 'Ganadería';
  if (texto.includes('tomate') || texto.includes('cebolla') || texto.includes('pimentón') || texto.includes('cilantro') || texto.includes('lechuga') || texto.includes('ají') || texto.includes('pepino') || texto.includes('habichuela')) return 'Hortalizas';
  return 'Otros';
}

// la categoria vieja de productos anteriores cae en "otros"
export function categoriaVisible(categoria: string) {
  if (categoriasAgricolas.includes(categoria)) return categoria;
  if (categoriasInsumos.includes(categoria)) return categoria;
  if (insumosViejos[categoria] !== undefined) return insumosViejos[categoria];
  return 'Otros';
}
