import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { colors } from '../theme';
import { callar } from '../voz';

function minutos(segundos: number) {
  const s = Math.max(0, Math.round(segundos));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// reproductor de una nota de voz, como en whatsapp
export default function NotaVoz({
  uri,
  segundos,
  deOtro = false,
  autor = '',
}: {
  uri: string;
  segundos: number;
  deOtro?: boolean;
  autor?: string;
}) {
  const reproductor = useAudioPlayer(uri);
  const estado = useAudioPlayerStatus(reproductor);
  let total = segundos;
  if (estado.duration > 0) total = estado.duration;
  let avance = 0;
  if (total > 0) avance = Math.min(1, estado.currentTime / total);

  function tocar() {
    if (estado.playing) {
      reproductor.pause();
      return;
    }
    callar();
    // si ya termino, vuelve al inicio
    if (estado.didJustFinish || (total > 0 && estado.currentTime >= total - 0.2)) reproductor.seekTo(0);
    reproductor.play();
  }

  let tiempo = minutos(total);
  if (estado.playing || estado.currentTime > 0) tiempo = minutos(estado.currentTime) + ' / ' + minutos(total);

  return (
    <View style={[styles.burbuja, deOtro && styles.deOtro]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={estado.playing ? 'Pausar nota de voz' : 'Escuchar nota de voz'}
        onPress={tocar}
        style={[styles.play, deOtro && styles.playOtro]}
      >
        {estado.playing ? (
          <Pause size={20} color={colors.white} fill={colors.white} />
        ) : (
          <Play size={20} color={colors.white} fill={colors.white} />
        )}
      </Pressable>
      <View style={styles.flex}>
        {autor !== '' && <Text style={styles.autor}>{autor}</Text>}
        <View style={styles.barra}>
          <View style={[styles.relleno, { width: avance * 100 + '%' }]} />
        </View>
        <Text style={styles.tiempo}>Nota de voz · {tiempo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  burbuja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.verdeClaro,
  },
  deOtro: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  play: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.verde,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  playOtro: { backgroundColor: colors.grafito },
  autor: { color: colors.grafito, fontSize: 12, fontWeight: '800', marginBottom: 4 },
  barra: { height: 5, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  relleno: { height: 5, borderRadius: 3, backgroundColor: colors.verde },
  tiempo: { color: colors.muted, fontSize: 12, marginTop: 5 },
});
