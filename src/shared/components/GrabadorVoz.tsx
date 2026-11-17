import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import { Mic, Square, Trash2 } from 'lucide-react-native';
import { colors } from '../theme';
import { callar } from '../voz';
import NotaVoz from './NotaVoz';

const MAXIMO_SEGUNDOS = 60;

// boton grande para grabar una nota de voz. pensado para quien no sabe escribir:
// se toca una vez para grabar y otra para terminar
export default function GrabadorVoz({ onListo, texto = 'Grabar nota de voz' }: { onListo: (nota: { uri: string; segundos: number } | null) => void; texto?: string }) {
  const grabador = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const estado = useAudioRecorderState(grabador, 250);
  const [nota, setNota] = useState<{ uri: string; segundos: number } | null>(null);
  const pulso = useRef(new Animated.Value(0)).current;

  const segundos = Math.floor(estado.durationMillis / 1000);

  useEffect(() => {
    if (!estado.isRecording) { pulso.stopAnimation(); pulso.setValue(0); return; }
    const animacion = Animated.loop(Animated.timing(pulso, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    animacion.start();
    return () => animacion.stop();
  }, [estado.isRecording]);

  // al llegar al maximo se corta sola
  useEffect(() => { if (estado.isRecording && segundos >= MAXIMO_SEGUNDOS) void terminar(); }, [segundos]);

  async function empezar() {
    const permiso = await requestRecordingPermissionsAsync();
    if (!permiso.granted) { Alert.alert('Permiso del micrófono', 'Permite usar el micrófono para grabar notas de voz.'); return; }
    callar();
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await grabador.prepareToRecordAsync();
      grabador.record();
    } catch { Alert.alert('No se pudo grabar', 'Intenta de nuevo.'); }
  }

  async function terminar() {
    const duracion = estado.durationMillis / 1000;
    try {
      await grabador.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch { /* ya estaba detenido */ }
    if (!grabador.uri || duracion < 1) { Alert.alert('Muy corta', 'Mantén la grabación al menos un segundo.'); return; }
    const nueva = { uri: grabador.uri, segundos: Math.round(duracion) };
    setNota(nueva);
    onListo(nueva);
  }

  function borrar() {
    setNota(null);
    onListo(null);
  }

  if (nota) {
    return <View style={styles.lista}>
      <View style={styles.flex}><NotaVoz uri={nota.uri} segundos={nota.segundos} /></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Borrar nota de voz" hitSlop={8} onPress={borrar} style={styles.borrar}><Trash2 size={20} color="#775D50" /></Pressable>
    </View>;
  }

  const escala = pulso.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] });
  const opacidad = pulso.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] });
  const tiempo = '0:' + String(segundos).padStart(2, '0');

  return <Pressable accessibilityRole="button" accessibilityLabel={estado.isRecording ? 'Terminar de grabar' : texto} onPress={() => { if (estado.isRecording) void terminar(); else void empezar(); }} style={[styles.boton, estado.isRecording && styles.grabando]}>
    <View style={styles.circuloCaja}>
      <Animated.View style={[styles.onda, { opacity: opacidad, transform: [{ scale: escala }] }]} />
      <View style={[styles.circulo, estado.isRecording && styles.circuloGrabando]}>{estado.isRecording ? <Square size={18} color={colors.white} fill={colors.white} /> : <Mic size={24} color={colors.white} />}</View>
    </View>
    <View style={styles.flex}>
      <Text style={styles.titulo}>{estado.isRecording ? 'Grabando… toca para terminar' : texto}</Text>
      <Text style={styles.ayuda}>{estado.isRecording ? tiempo + ' de 1:00' : 'Toca y habla. Máximo 1 minuto.'}</Text>
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  boton: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.verde },
  grabando: { borderColor: colors.arcilla, backgroundColor: '#F5E7E2' },
  circuloCaja: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  onda: { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: colors.arcilla },
  circulo: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.verde, alignItems: 'center', justifyContent: 'center' },
  circuloGrabando: { backgroundColor: '#775D50' },
  titulo: { color: colors.grafito, fontSize: 15, fontWeight: '800' },
  ayuda: { color: colors.muted, fontSize: 12, marginTop: 2 },
  lista: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  borrar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5E7E2', alignItems: 'center', justifyContent: 'center' },
});
