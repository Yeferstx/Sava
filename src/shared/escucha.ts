// escucha por voz con el reconocimiento del propio celular (expo-speech-recognition).
// solo funciona en la app instalada (development build o apk). en expo go el modulo
// nativo no existe: aqui se detecta y la app usa el dictado del teclado en su lugar
import { File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo';

type EventoResultado = { isFinal: boolean; results: Array<{ transcript: string }> };
type EventoError = { error: string; message: string };
type Suscripcion = { remove: () => void };
type ModuloEscucha = {
  isRecognitionAvailable: () => boolean;
  supportsRecording: () => boolean;
  supportsOnDeviceRecognition: () => boolean;
  getSupportedLocales: (opciones: { androidRecognitionServicePackage?: string }) => Promise<{ locales: string[]; installedLocales: string[] }>;
  androidTriggerOfflineModelDownload: (opciones: { locale: string }) => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opciones: Record<string, unknown>) => void;
  stop: () => void;
  abort: () => void;
  addListener: (evento: string, oyente: (datos: never) => void) => Suscripcion;
};

const IDIOMA = 'es-CO';
let modulo: ModuloEscucha | null | undefined;

function cargar() {
  if (modulo !== undefined) return modulo;
  try {
    // en expo go el modulo nativo no existe: se revisa primero, sin forzarlo, para no mostrar un error
    if (!requireOptionalNativeModule('ExpoSpeechRecognition')) { modulo = null; return modulo; }
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

// android 13 o mas nuevo (y iphone) pueden guardar el audio mientras escuchan
function puedeGrabar(m: ModuloEscucha) {
  try { return m.supportsRecording(); } catch { return false; }
}

// el celular tiene el espanol descargado para entender sin internet
export async function entiendeSinInternet() {
  const m = cargar();
  if (!m) return false;
  try {
    if (!m.supportsOnDeviceRecognition()) return false;
    const idiomas = await m.getSupportedLocales({});
    for (const idioma of idiomas.installedLocales) { if (idioma.toLowerCase().startsWith('es')) return true; }
    // en iphone la lista viene vacia aunque si funcione sin internet
    return idiomas.installedLocales.length === 0 && idiomas.locales.length > 0;
  } catch { return false; }
}

// con internet se pide al celular que descargue el espanol para la proxima vez que no haya senal
let descargaPedida = false;
export async function prepararSinInternet() {
  const m = cargar();
  if (!m || descargaPedida) return;
  descargaPedida = true;
  try {
    if (await entiendeSinInternet()) return;
    await m.androidTriggerOfflineModelDownload({ locale: IDIOMA });
  } catch { /* no todos los celulares lo permiten */ }
}

// borra una nota de voz que ya no se necesita
export function borrarAudio(uri: string) {
  try { const archivo = new File(uri); if (archivo.exists) archivo.delete(); } catch { /* ya no existe */ }
}

type Oyentes = {
  // volumen entre 0 y 1 (amplitud real del microfono)
  onVolumen: (nivel: number) => void;
  onTexto: (texto: string, final: boolean) => void;
  // audio: ruta del archivo .wav con lo que dijo la persona ('' si el celular no lo guarda)
  onFin: (audio: string) => void;
  onError: (motivo: string) => void;
};

// empieza a escuchar. sinInternet: entiende con el espanol descargado en el celular.
// devuelve una funcion para detener
export async function empezarEscucha(oyentes: Oyentes, sinInternet = false) {
  const m = cargar();
  if (!m) { oyentes.onError('no-disponible'); return () => undefined; }
  const permiso = await m.requestPermissionsAsync();
  if (!permiso.granted) { oyentes.onError('sin-permiso'); return () => undefined; }

  const suscripciones: Suscripcion[] = [];
  let terminado = false;
  let audio = '';
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
  suscripciones.push(m.addListener('audioend', ((datos: { uri: string | null }) => {
    if (datos.uri) audio = datos.uri;
  }) as never));
  suscripciones.push(m.addListener('error', ((datos: EventoError) => {
    if (terminado) return;
    oyentes.onError(datos.error);
  }) as never));
  suscripciones.push(m.addListener('end', (() => {
    terminado = true;
    limpiar();
    oyentes.onFin(audio);
  }) as never));

  const opciones: Record<string, unknown> = { lang: IDIOMA, interimResults: true, continuous: false, addsPunctuation: true, volumeChangeEventOptions: { enabled: true, intervalMillis: 100 } };
  if (sinInternet) opciones.requiresOnDeviceRecognition = true;
  // el audio se guarda en documentos (no en cache) para que no se borre si queda esperando senal
  if (puedeGrabar(m)) opciones.recordingOptions = { persist: true, outputDirectory: Paths.document.uri, outputFileName: 'nota-' + Date.now() + '.wav' };
  m.start(opciones);

  return () => {
    if (terminado) return;
    try { m.stop(); } catch { limpiar(); oyentes.onFin(audio); }
  };
}

// convierte en texto una nota de voz guardada (se usa cuando vuelve la senal).
// devuelve '' si no se pudo entender
export function transcribirAudio(uri: string): Promise<string> {
  const m = cargar();
  if (!m) return Promise.resolve('');
  return new Promise((resolver) => {
    const suscripciones: Suscripcion[] = [];
    let texto = '';
    let listo = false;
    function terminar() {
      if (listo) return;
      listo = true;
      for (const s of suscripciones) s.remove();
      resolver(texto.trim());
    }
    suscripciones.push(m.addListener('result', ((datos: EventoResultado) => {
      if (datos.results.length > 0 && datos.isFinal) texto = texto + ' ' + datos.results[0].transcript;
    }) as never));
    suscripciones.push(m.addListener('error', (() => terminar()) as never));
    suscripciones.push(m.addListener('end', (() => terminar()) as never));
    // si algo se queda colgado no se espera para siempre
    setTimeout(terminar, 45000);
    try {
      m.start({ lang: IDIOMA, interimResults: false, continuous: true, addsPunctuation: true, audioSource: { uri } });
    } catch { terminar(); }
  });
}
