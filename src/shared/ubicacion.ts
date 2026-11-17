import * as Location from 'expo-location';
import { getDatabase } from '../infrastructure/database/database';

// centro aproximado de cada municipio de casanare (latitud, longitud).
// con esto se calcula el municipio mas cercano sin necesitar internet
const centros: Array<{ municipio: string; lat: number; lng: number }> = [
  { municipio: 'Yopal', lat: 5.3378, lng: -72.3959 },
  { municipio: 'Aguazul', lat: 5.1727, lng: -72.5547 },
  { municipio: 'Chámeza', lat: 5.2139, lng: -72.8714 },
  { municipio: 'Hato Corozal', lat: 6.1561, lng: -71.765 },
  { municipio: 'La Salina', lat: 6.1272, lng: -72.3347 },
  { municipio: 'Maní', lat: 4.8167, lng: -72.2833 },
  { municipio: 'Monterrey', lat: 4.8786, lng: -72.8961 },
  { municipio: 'Nunchía', lat: 5.6372, lng: -72.195 },
  { municipio: 'Orocué', lat: 4.7906, lng: -71.3392 },
  { municipio: 'Paz de Ariporo', lat: 5.8808, lng: -71.8925 },
  { municipio: 'Pore', lat: 5.7281, lng: -71.9928 },
  { municipio: 'Recetor', lat: 5.2292, lng: -72.7611 },
  { municipio: 'Sabanalarga', lat: 4.8544, lng: -73.04 },
  { municipio: 'Sácama', lat: 6.0981, lng: -72.2486 },
  { municipio: 'San Luis de Palenque', lat: 5.4219, lng: -71.7314 },
  { municipio: 'Támara', lat: 5.8303, lng: -72.1617 },
  { municipio: 'Tauramena', lat: 5.0178, lng: -72.7475 },
  { municipio: 'Trinidad', lat: 5.4089, lng: -71.6625 },
  { municipio: 'Villanueva', lat: 4.6106, lng: -72.9278 },
];

// distancia en kilometros entre dos puntos (formula del haversine)
function distanciaKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radio = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radio * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function municipioCercano(lat: number, lng: number) {
  let mejor = '';
  let menor = 999999;
  for (const centro of centros) {
    const km = distanciaKm(lat, lng, centro.lat, centro.lng);
    if (km < menor) { menor = km; mejor = centro.municipio; }
  }
  // a mas de 70 km del municipio mas cercano ya no se esta en casanare
  if (menor > 70) return '';
  return mejor;
}

export type ResultadoUbicacion = { municipio: string; motivo: 'ok' | 'sin-permiso' | 'fuera' | 'error' };

// pide permiso y busca en que municipio esta la persona
export async function detectarMunicipio(): Promise<ResultadoUbicacion> {
  try {
    const permiso = await Location.requestForegroundPermissionsAsync();
    if (!permiso.granted) return { municipio: '', motivo: 'sin-permiso' };
    let posicion = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 });
    if (!posicion) posicion = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const municipio = municipioCercano(posicion.coords.latitude, posicion.coords.longitude);
    if (municipio === '') return { municipio: '', motivo: 'fuera' };
    return { municipio, motivo: 'ok' };
  } catch {
    return { municipio: '', motivo: 'error' };
  }
}

// el municipio elegido para buscar se recuerda en el celular
// ('' = todo casanare, null = nunca se ha elegido)
export async function leerMunicipioGuardado() {
  const db = await getDatabase();
  const fila = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'municipio_busqueda');
  if (!fila) return null;
  return fila.value;
}

export async function guardarMunicipio(municipio: string) {
  const db = await getDatabase();
  await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'municipio_busqueda', municipio);
}
