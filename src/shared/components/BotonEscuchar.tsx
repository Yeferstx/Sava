import { Pressable, StyleSheet, Text } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import { colors } from '../theme';
import { hablar } from '../voz';

// boton para oir el texto en voz alta
export default function BotonEscuchar({ texto, etiqueta = 'Escuchar', claro = false, centrado = false }: { texto: string; etiqueta?: string; claro?: boolean; centrado?: boolean }) {
  let color: string = colors.verde;
  if (claro) color = colors.white;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={'Escuchar: ' + texto} hitSlop={8} onPress={() => hablar(texto)} style={[styles.boton, claro && styles.claro, centrado && styles.centrado]}>
      <Volume2 size={18} color={color} />
      {etiqueta !== '' && <Text style={[styles.texto, { color }]}>{etiqueta}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 11, paddingVertical: 7, borderRadius: 16, backgroundColor: colors.verdeClaro },
  centrado: { alignSelf: 'center' },
  claro: { backgroundColor: 'rgba(255,255,255,0.16)' },
  texto: { fontSize: 13, fontWeight: '800' },
});
