// escucha por voz con el reconocimiento del propio celular (expo-speech-recognition).
// solo funciona en la app instalada (development build o apk). en expo go el modulo
// nativo no existe: aqui se detecta y la app usa el dictado del teclado en su lugar

type EventoResultado = { isFinal: boolean; results: Array<{ transcript: string }> };
type EventoError = { error: string; message: string };
type Suscripcion = { remove: () => void };
type ModuloEscucha = {
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opciones: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  addListener: (evento: string, oyente: (datos: never) => void) => Suscripcion;
};

let modulo: ModuloEscucha | null | undefined;

function cargar() {
  if (modulo !== undefined) return modulo;
  try {
    // se carga aqui (no arriba) para que expo go no se cierre si falta el modulo nativo
    modulo = require('expo-speech-recognition').ExpoSpeechRecognitionModule as ModuloEscucha;
  } catch {
    modulo = null;
  }
  return modulo;
}

export function escuchaDisponible() {
  const m = cargar();
  if (!m) return false;
  try { return m.isRecognitionAvailable(); } catch { return false; }
}

type Oyentes = {
  // volumen entre 0 y 1 (amplitud real del microfono)
  onVolumen: (nivel: number) => void;
  onTexto: (texto: string, final: boolean) => void;
  onFin: () => void;
  onError: (mensaje: string) => void;
};

// empieza a escuchar. devuelve una funcion para detener
export async function empezarEscucha(oyentes: Oyentes) {
  const m = cargar();
  if (!m) { oyentes.onError('no-disponible'); return () => undefined; }
  const permiso = await m.requestPermissionsAsync();
  if (!permiso.granted) { oyentes.onError('sin-permiso'); return () => undefined; }

  const suscripciones: Suscripcion[] = [];
  let terminado = false;
  function limpiar() {
    for (const s of suscripciones) s.remove();
    suscripciones.length = 0;
  }
  suscripciones.push(m.addListener('volumechange', ((datos: { value: number }) => {
    // el celular entrega de -2 (silencio) a 10 (muy fuerte)
    let nivel = (datos.value + 2) / 12;
    if (nivel < 0) nivel = 0;
    if (nivel > 1) nivel = 1;
    oyentes.onVolumen(nivel);
  }) as never));
  suscripciones.push(m.addListener('result', ((datos: EventoResultado) => {
    if (datos.results.length === 0) return;
    oyentes.onTexto(datos.results[0].transcript, datos.isFinal);
  }) as never));
  suscripciones.push(m.addListener('error', ((datos: EventoError) => {
    if (terminado) return;
    oyentes.onError(datos.error);
  }) as never));
  suscripciones.push(m.addListener('end', (() => {
    terminado = true;
    limpiar();
    oyentes.onFin();
  }) as never));

  m.start({ lang: 'es-CO', interimResults: true, continuous: false, addsPunctuation: true, volumeChangeEventOptions: { enabled: true, intervalMillis: 100 } });

  return () => {
    if (terminado) return;
    try { m.stop(); } catch { limpiar(); oyentes.onFin(); }
  };
}
