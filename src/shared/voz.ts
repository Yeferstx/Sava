import * as Speech from 'expo-speech';

// voz de maria. se busca la mejor voz en espanol que tenga el celular:
// primero colombia, luego latinoamerica y al final espana. si hay calidad mejorada se usa esa
let vozElegida: string | null | undefined;
const oyentes: Array<(hablando: boolean) => void> = [];

async function buscarVoz() {
  if (vozElegida !== undefined) return vozElegida;
  try {
    const voces = await Speech.getAvailableVoicesAsync();
    const orden = ['es-co', 'es-us', 'es-mx', 'es-419', 'es-es', 'es'];
    let mejor = null;
    let puntosMejor = -1;
    for (const voz of voces) {
      const idioma = voz.language.toLowerCase().replace('_', '-');
      let posicion = -1;
      for (let i = 0; i < orden.length; i++) {
        if (idioma.startsWith(orden[i])) { posicion = i; break; }
      }
      if (posicion === -1) continue;
      let puntos = (orden.length - posicion) * 10;
      if (voz.quality === Speech.VoiceQuality.Enhanced) puntos = puntos + 5;
      if (puntos > puntosMejor) { puntosMejor = puntos; mejor = voz.identifier; }
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

// quita simbolos que la voz lee raro ($ 2.500 -> 2.500 pesos)
function limpiarParaVoz(texto: string) {
  return texto.replace(/\$\s?([\d.]+)/g, '$1 pesos').replace(/[«»"]/g, '').replace(/\bkg\b/g, 'kilos').replace(/\n/g, '. ');
}

// lee un texto en voz alta en espanol. sirve para personas que leen con dificultad
export async function hablar(texto: string) {
  Speech.stop();
  const voz = await buscarVoz();
  const opciones: Speech.SpeechOptions = {
    language: 'es-CO',
    rate: 0.92,
    pitch: 1.05,
    onStart: () => avisar(true),
    onDone: () => avisar(false),
    onStopped: () => avisar(false),
    onError: () => avisar(false),
  };
  if (voz) opciones.voice = voz;
  Speech.speak(limpiarParaVoz(texto), opciones);
}

export function callar() {
  Speech.stop();
  avisar(false);
}
