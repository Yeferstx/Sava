import * as Speech from 'expo-speech';

// lee un texto en voz alta en espanol. sirve para personas que leen con dificultad
export function hablar(texto: string) {
  Speech.stop();
  Speech.speak(texto, { language: 'es-CO', rate: 0.95 });
}

export function callar() {
  Speech.stop();
}
