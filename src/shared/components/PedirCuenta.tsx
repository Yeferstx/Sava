import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, UserRoundPlus } from 'lucide-react-native';
import { colors } from '../theme';

// explicacion amable cuando una accion necesita cuenta. no bloquea el resto de la app
export default function PedirCuenta({ motivo, onCrear, onEntrar, onAhoraNo }: { motivo: string; onCrear: () => void; onEntrar: () => void; onAhoraNo: () => void }) {
  return (
    <View style={styles.pantalla}>
      <Pressable accessibilityRole="button" onPress={onAhoraNo} style={styles.volver}><ArrowLeft size={20} color={colors.verde} /><Text style={styles.volverTexto}>Seguir explorando</Text></Pressable>
      <View style={styles.centro}>
        <View style={styles.icono}><UserRoundPlus size={34} color={colors.verde} /></View>
        <Text style={styles.titulo}>Necesitas una cuenta</Text>
        <Text style={styles.texto}>{motivo}</Text>
        <Pressable accessibilityRole="button" onPress={onCrear} style={({ pressed }) => [styles.boton, pressed && styles.presionado]}><Text style={styles.botonTexto}>Crear cuenta gratis</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={onEntrar} style={({ pressed }) => [styles.botonSuave, pressed && styles.presionado]}><Text style={styles.botonSuaveTexto}>Ya tengo cuenta</Text></Pressable>
        <Text style={styles.nota}>Sin cuenta puedes seguir viendo cosechas, videos y hablar con Aru.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, padding: 20 },
  volver: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6 },
  volverTexto: { color: colors.verde, fontSize: 15, fontWeight: '800' },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60 },
  icono: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.salvia, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  titulo: { color: colors.verde, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  texto: { color: colors.grafito, fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 8, marginBottom: 22, paddingHorizontal: 8 },
  boton: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15, borderRadius: 26, backgroundColor: colors.verde },
  botonTexto: { color: colors.white, fontSize: 16, fontWeight: '900' },
  botonSuave: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 14, borderRadius: 26, borderWidth: 1.5, borderColor: colors.verde, marginTop: 10 },
  botonSuaveTexto: { color: colors.verde, fontSize: 16, fontWeight: '800' },
  presionado: { transform: [{ scale: 0.97 }] },
  nota: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 16 },
});
