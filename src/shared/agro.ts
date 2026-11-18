// datos del campo casanareño que usan varias pantallas

// grupos generales de cosechas
export const categoriasAgricolas = ['Frutas', 'Tubérculos', 'Granos', 'Hortalizas', 'Otros productos agrícolas'];

// categorias de antes (productos ya publicados) y su grupo nuevo
const cosechasViejas: Record<string, string> = {
  'Plátano y banano': 'Frutas', 'Piña': 'Frutas', 'Papaya': 'Frutas', 'Patilla': 'Frutas', 'Maracuyá y frutas': 'Frutas',
  'Yuca y tubérculos': 'Tubérculos', 'Ahuyama': 'Hortalizas', 'Otros': 'Otros productos agrícolas',
};

export const unidades = ['kg', 'tonelada', 'bulto', 'canastilla', 'caja', 'racimo', 'unidad', 'libra'];

// lo que venden las tiendas del campo (agropecuarias)
export const categoriasInsumos = [
  'Semillas y plantas', 'Nutrición de cultivos', 'Protección de cultivos', 'Herramientas', 'Insumos para ganadería', 'Equipos agrícolas', 'Otros insumos',
];

// nombres viejos de insumos (productos ya publicados) y su categoria nueva
const insumosViejos: Record<string, string> = {
  'Semillas': 'Semillas y plantas',
  'Abonos y fertilizantes': 'Nutrición de cultivos',
  'Cultivos y suelos': 'Nutrición de cultivos',
  'Agroquímicos': 'Protección de cultivos',
  'Alimento para animales': 'Insumos para ganadería',
  'Ganadería': 'Insumos para ganadería',
  'Equipos y riego': 'Equipos agrícolas',
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
  if (texto.includes('yuca') || (texto.includes('papa') && !texto.includes('papaya')) || texto.includes('ñame') || texto.includes('batata') || texto.includes('arracacha')) return 'Tubérculos';
  if (texto.includes('arroz') || texto.includes('maíz') || texto.includes('maiz') || texto.includes('soya') || texto.includes('frijol') || texto.includes('fríjol') || texto.includes('cacao') || texto.includes('café') || texto.includes('cafe')) return 'Granos';
  if (texto.includes('plátano') || texto.includes('platano') || texto.includes('banano') || texto.includes('topocho') || texto.includes('piña') || texto.includes('papaya') || texto.includes('patilla') || texto.includes('sandía') || texto.includes('sandia') || texto.includes('maracuy') || texto.includes('mango') || texto.includes('guayaba') || texto.includes('limón') || texto.includes('limon') || texto.includes('naranja') || texto.includes('aguacate') || texto.includes('fruta')) return 'Frutas';
  if (texto.includes('ahuyama') || texto.includes('zapallo')) return 'Hortalizas';
  // insumos de las tiendas del campo
  if (texto.includes('semilla') || texto.includes('plantula') || texto.includes('plántula') || texto.includes('colino')) return 'Semillas y plantas';
  if (texto.includes('abono') || texto.includes('fertiliz') || texto.includes('urea') || texto.includes('triple 15') || texto.includes('cal ')) return 'Nutrición de cultivos';
  if (texto.includes('veneno') || texto.includes('herbicida') || texto.includes('insecticida') || texto.includes('fungicida') || texto.includes('glifosato') || texto.includes('matamaleza') || texto.includes('fumig')) return 'Protección de cultivos';
  if (texto.includes('machete') || texto.includes('pala') || texto.includes('azad') || texto.includes('guadaña') || texto.includes('alambre') || texto.includes('lima')) return 'Herramientas';
  if (texto.includes('bomba') || texto.includes('manguera') || texto.includes('riego') || texto.includes('aspersor') || texto.includes('motor') || texto.includes('fumigadora')) return 'Equipos agrícolas';
  if (texto.includes('concentrado') || texto.includes('purina') || texto.includes('sal mineral') || texto.includes('melaza') || texto.includes('vacuna') || texto.includes('ganado')) return 'Insumos para ganadería';
  if (texto.includes('tomate') || texto.includes('cebolla') || texto.includes('pimentón') || texto.includes('cilantro') || texto.includes('lechuga') || texto.includes('ají') || texto.includes('pepino') || texto.includes('habichuela')) return 'Hortalizas';
  return 'Otros productos agrícolas';
}

// la categoria vieja de productos anteriores cae en "otros"
export function categoriaVisible(categoria: string) {
  if (categoriasAgricolas.includes(categoria)) return categoria;
  if (categoriasInsumos.includes(categoria)) return categoria;
  if (insumosViejos[categoria] !== undefined) return insumosViejos[categoria];
  if (cosechasViejas[categoria] !== undefined) return cosechasViejas[categoria];
  return 'Otros productos agrícolas';
}
