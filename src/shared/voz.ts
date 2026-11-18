import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { getDatabase } from '../infrastructure/database/database';

// voz de aru: la del propio celular (gratis y sin internet).
// se prefieren las voces de mejor calidad en espanol latino; la persona puede elegir otra
export type VozEspanol = { identificador: string; nombre: string; idioma: string; pais: string; calidad: 'mejor' | 'normal' };
type VozElegida = { identificador: string; idioma: string } | null;

let vozElegida: VozElegida | undefined;
let velocidad = 0.95;
let ajustesLeidos = false;
// en iphone una voz que aparece en la lista puede no estar descargada: si falla, se usa solo el idioma
const vocesQueFallan = new Set<string>();
const oyentes: Array<(hablando: boolean) => void> = [];
// avisos de cada palabra que dice la voz (para que aru se mueva con el audio)
const oyentesPalabra: Array<() => void> = [];

const ORDEN = ['es-co', 'es-us', 'es-mx', 'es-419', 'es-ar', 'es-cl', 'es-es', 'es'];
const PAISES: Record<string, string> = { co: 'Colombia', us: 'Latinoamérica', mx: 'México', '419': 'Latinoamérica', ar: 'Argentina', cl: 'Chile', es: 'España' };

function puntaje(voz: Speech.Voice) {
  const idioma = voz.language.replace('_', '-').toLowerCase();
  const posicion = ORDEN.findIndex((o) => idioma.startsWith(o));
  if (posicion === -1) return -1;
  const id = voz.identifier.toLowerCase();
  let puntos = (ORDEN.length - posicion) * 10;
  // las voces "premium" y "enhanced" (mejoradas) suenan mucho mas naturales
  if (id.includes('premium')) puntos += 9;
  else if (voz.quality === Speech.VoiceQuality.Enhanced || id.includes('enhanced')) puntos += 6;
  // en android las voces de red suenan mejor pero necesitan internet: se prefiere la local
  if (id.includes('network')) puntos -= 3;
  if (id.includes('local')) puntos += 1;
  return puntos;
}

// todas las voces en espanol que tiene el celular, de mejor a peor
export async function listarVocesEspanol(): Promise<VozEspanol[]> {
  try {
    const voces = await Speech.getAvailableVoicesAsync();
    const lista: Array<VozEspanol & { puntos: number }> = [];
    for (const voz of voces) {
      const puntos = puntaje(voz);
      if (puntos < 0) continue;
      // ios muestra voces "super-compact" que suenan muy mal o no estan instaladas
      if (voz.identifier.toLowerCase().includes('super-compact')) continue;
      const idioma = voz.language.replace('_', '-');
      const region = idioma.split('-')[1]?.toLowerCase() ?? '';
      const id = voz.identifier.toLowerCase();
      const calidad = id.includes('premium') || id.includes('enhanced') || voz.quality === Speech.VoiceQuality.Enhanced ? 'mejor' : 'normal';
      let nombre = voz.name && voz.name !== voz.identifier ? voz.name : 'Voz ' + (lista.length + 1);
      // en android el nombre es un codigo largo: se muestra uno corto
      if (/^[a-z]{2}-[a-z]{2}-x-/i.test(nombre)) nombre = 'Voz ' + (lista.length + 1);
      lista.push({ identificador: voz.identifier, nombre, idioma, pais: PAISES[region] ?? 'Español', calidad, puntos });
    }
    lista.sort((a, b) => b.puntos - a.puntos);
    return lista.slice(0, 20).map(({ puntos: _p, ...v }) => v);
  } catch { return []; }
}

async function leerAjustes() {
  if (ajustesLeidos) return;
  ajustesLeidos = true;
  try {
    const db = await getDatabase();
    const voz = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'voz_aru');
    const vel = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'voz_velocidad');
    if (vel && Number(vel.value) > 0) velocidad = Number(vel.value);
    if (voz) vozElegida = JSON.parse(voz.value) as VozElegida;
  } catch { /* se usa la voz automatica */ }
}

async function buscarVoz() {
  await leerAjustes();
  if (vozElegida !== undefined) return vozElegida;
  const lista = await listarVocesEspanol();
  vozElegida = lista.length > 0 ? { identificador: lista[0].identificador, idioma: lista[0].idioma } : null;
  return vozElegida;
}

// la persona elige la voz y la velocidad (se recuerda en el celular)
export async function elegirVoz(voz: VozEspanol | null, nuevaVelocidad: number) {
  vozElegida = voz ? { identificador: voz.identificador, idioma: voz.idioma } : undefined;
  velocidad = nuevaVelocidad;
  vocesQueFallan.clear();
  try {
    const db = await getDatabase();
    if (voz) await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'voz_aru', JSON.stringify(vozElegida));
    else await db.runAsync('DELETE FROM app_settings WHERE key = ?', 'voz_aru');
    await db.runAsync('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', 'voz_velocidad', String(nuevaVelocidad));
  } catch { /* queda solo mientras la app esta abierta */ }
}

export async function ajustesVoz() {
  await leerAjustes();
  const voz = await buscarVoz();
  return { identificador: voz ? voz.identificador : '', velocidad };
}

function avisar(hablando: boolean) {
  for (const oyente of oyentes) oyente(hablando);
}

// para que la pantalla muestre cuando aru esta hablando
export function escucharVoz(oyente: (hablando: boolean) => void) {
  oyentes.push(oyente);
  return () => {
    const i = oyentes.indexOf(oyente);
    if (i >= 0) oyentes.splice(i, 1);
  };
}

export function escucharPalabras(oyente: () => void) {
  oyentesPalabra.push(oyente);
  return () => {
    const i = oyentesPalabra.indexOf(oyente);
    if (i >= 0) oyentesPalabra.splice(i, 1);
  };
}

// quita simbolos que la voz lee raro ($ 2.500 -> 2.500 pesos) y abreviaturas
function limpiarParaVoz(texto: string) {
  return texto
    .replace(/\$\s?([\d.]+)/g, '$1 pesos')
    .replace(/[«»"*•]/g, '')
    .replace(/\bkg\b/gi, 'kilos')
    .replace(/(\d)\s?%/g, '$1 por ciento')
    .replace(/\bc\/u\b/gi, 'cada uno')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\n+/g, '. ');
}

async function vozElegidaAMano() {
  try {
    const db = await getDatabase();
    return !!(await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', 'voz_aru'));
  } catch { return false; }
}

// lee un texto en voz alta en espanol. sirve para personas que leen con dificultad
export async function hablar(texto: string, vozDePrueba?: VozEspanol, velocidadDePrueba?: number) {
  Speech.stop();
  const voz = vozDePrueba ? { identificador: vozDePrueba.identificador, idioma: vozDePrueba.idioma } : await buscarVoz();
  let empezo = false;
  const opciones: Speech.SpeechOptions = {
    language: 'es-MX',
    // voz pausada y con tono natural (ni aguda ni lenta)
    rate: velocidadDePrueba ?? velocidad,
    pitch: 1.0,
    onStart: () => { empezo = true; avisar(true); },
    onDone: () => avisar(false),
    onStopped: () => avisar(false),
    onError: () => {
      avisar(false);
      // la voz elegida no esta instalada: se repite con la voz que el celular tenga para el idioma
      if (!empezo && voz && opciones.voice) {
        vocesQueFallan.add(voz.identificador);
        Speech.speak(limpiarParaVoz(texto), { ...opciones, voice: undefined, onError: () => avisar(false) });
      }
    },
    onBoundary: () => { for (const oyente of oyentesPalabra) oyente(); },
  };
  if (voz) {
    opciones.language = voz.idioma;
    if (!vocesQueFallan.has(voz.identificador)) opciones.voice = voz.identificador;
  }
  // en iphone, si nunca se eligio una voz a mano, se deja que ios escoja la del idioma (mas seguro)
  if (Platform.OS === 'ios' && !vozDePrueba && !(await vozElegidaAMano())) opciones.voice = undefined;
  Speech.speak(limpiarParaVoz(texto), opciones);
}

export function callar() {
  Speech.stop();
  avisar(false);
}
