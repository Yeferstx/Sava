import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

// voz de maria. se busca la mejor voz en espanol que tenga el celular:
// primero colombia, luego latinoamerica y al final espana
type VozElegida = { identificador: string; idioma: string } | null;
let vozElegida: VozElegida | undefined;
const oyentes: Array<(hablando: boolean) => void> = [];
// avisos de cada palabra que dice la voz (para que maria se mueva con el audio)
const oyentesPalabra: Array<() => void> = [];

async function buscarVoz() {
  if (vozElegida !== undefined) return vozElegida;
  try {
    const voces = await Speech.getAvailableVoicesAsync();
    const orden = ['es-co', 'es-us', 'es-mx', 'es-419', 'es-es', 'es'];
    let mejor: VozElegida = null;
    let puntosMejor = -1;
    for (const voz of voces) {
      const idioma = voz.language.replace('_', '-');
      let posicion = -1;
      for (let i = 0; i < orden.length; i++) {
        if (idioma.toLowerCase().startsWith(orden[i])) { posicion = i; break; }
      }
      if (posicion === -1) continue;
      // ios muestra voces "super-compact" que no estan instaladas
      if (voz.identifier.toLowerCase().includes('super-compact')) continue;
      let puntos = (orden.length - posicion) * 10;
      if (voz.quality === Speech.VoiceQuality.Enhanced) puntos = puntos + 5;
      if (puntos > puntosMejor) { puntosMejor = puntos; mejor = { identificador: voz.identifier, idioma }; }
    }
    vozElegida = mejor;
  } catch {
    vozElegida = null;
  }
  return vozElegida;
}

function avisar(hablando: boolean) {
  for (const oyente of oyentes) oyente(hablando);
}

// para que la pantalla muestre cuando maria esta hablando
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

// quita simbolos que la voz lee raro ($ 2.500 -> 2.500 pesos)
function limpiarParaVoz(texto: string) {
  return texto.replace(/\$\s?([\d.]+)/g, '$1 pesos').replace(/[«»"]/g, '').replace(/\bkg\b/g, 'kilos').replace(/\n/g, '. ');
}

// lee un texto en voz alta en espanol. sirve para personas que leen con dificultad
export async function hablar(texto: string) {
  Speech.stop();
  const voz = await buscarVoz();
  const opciones: Speech.SpeechOptions = {
    language: 'es-MX',
    rate: 0.92,
    pitch: 1.05,
    onStart: () => avisar(true),
    onDone: () => avisar(false),
    onStopped: () => avisar(false),
    onError: () => avisar(false),
    onBoundary: () => { for (const oyente of oyentesPalabra) oyente(); },
  };
  if (voz) {
    opciones.language = voz.idioma;
    // en iphone pedir una voz por nombre puede fallar si no esta descargada.
    // por eso solo se le da el idioma y ios escoge una voz que si tenga
    if (Platform.OS === 'android') opciones.voice = voz.identificador;
  }
  Speech.speak(limpiarParaVoz(texto), opciones);
}

export function callar() {
  Speech.stop();
  avisar(false);
}
